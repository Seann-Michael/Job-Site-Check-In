import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Filter,
  X,
  Calendar,
  Tag,
  MapPin,
  User,
  FolderOpen,
  Star,
  Clock,
  Save,
  Trash2,
} from "lucide-react";
import { useAnalytics } from "@/lib/analytics";

interface SearchFilter {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "date" | "daterange" | "boolean";
  value: any;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilter[];
  createdAt: string;
}

interface AdvancedSearchProps {
  data: any[];
  onResults: (results: any[]) => void;
  onFiltersChange?: (filters: SearchFilter[]) => void;
  searchFields: string[];
  className?: string;
}

export function AdvancedSearch({
  data,
  onResults,
  onFiltersChange,
  searchFields,
  className = "",
}: AdvancedSearchProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter[]>([
    {
      id: "status",
      name: "Status",
      type: "select",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "On Hold", value: "on_hold" },
        { label: "Cancelled", value: "cancelled" },
      ],
      placeholder: "Filter by status",
    },
    {
      id: "dateRange",
      name: "Date Range",
      type: "daterange",
      value: { start: "", end: "" },
      placeholder: "Select date range",
    },
    {
      id: "tags",
      name: "Tags",
      type: "multiselect",
      value: [],
      options: [],
      placeholder: "Select tags",
    },
    {
      id: "assignee",
      name: "Assignee",
      type: "select",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "John Doe", value: "john" },
        { label: "Jane Smith", value: "jane" },
        { label: "Unassigned", value: "unassigned" },
      ],
      placeholder: "Filter by assignee",
    },
    {
      id: "priority",
      name: "Priority",
      type: "select",
      value: "",
      options: [
        { label: "All", value: "" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      placeholder: "Filter by priority",
    },
    {
      id: "hasMedia",
      name: "Has Media",
      type: "boolean",
      value: null,
      placeholder: "Filter by media presence",
    },
  ]);

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { trackFeatureUsage } = useAnalytics();

  useEffect(() => {
    // Load saved searches
    const saved = JSON.parse(localStorage.getItem("savedSearches") || "[]");
    setSavedSearches(saved);

    // Extract unique tags from data for filter options
    const allTags = new Set<string>();
    data.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => allTags.add(tag));
      }
      if (item.keywords && Array.isArray(item.keywords)) {
        item.keywords.forEach((keyword: string) => allTags.add(keyword));
      }
    });

    setFilters((prev) =>
      prev.map((filter) =>
        filter.id === "tags"
          ? {
              ...filter,
              options: Array.from(allTags).map((tag) => ({
                label: tag,
                value: tag,
              })),
            }
          : filter,
      ),
    );
  }, [data]);

  const filteredResults = useMemo(() => {
    let results = [...data];

    // Text search across specified fields
    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(" ");
      results = results.filter((item) =>
        searchTerms.every((term) =>
          searchFields.some((field) => {
            const value = getNestedValue(item, field);
            return value && value.toString().toLowerCase().includes(term);
          }),
        ),
      );
    }

    // Apply filters
    filters.forEach((filter) => {
      if (!filter.value || filter.value === "" || filter.value === null) return;

      switch (filter.id) {
        case "status":
          results = results.filter((item) => item.status === filter.value);
          break;

        case "dateRange":
          if (filter.value.start || filter.value.end) {
            results = results.filter((item) => {
              const itemDate = new Date(item.createdAt || item.date);
              const startDate = filter.value.start
                ? new Date(filter.value.start)
                : null;
              const endDate = filter.value.end
                ? new Date(filter.value.end)
                : null;

              if (startDate && itemDate < startDate) return false;
              if (endDate && itemDate > endDate) return false;
              return true;
            });
          }
          break;

        case "tags":
          if (filter.value.length > 0) {
            results = results.filter((item) => {
              const itemTags = [...(item.tags || []), ...(item.keywords || [])];
              return filter.value.some((tag: string) => itemTags.includes(tag));
            });
          }
          break;

        case "assignee":
          results = results.filter((item) => {
            if (filter.value === "unassigned") {
              return !item.assignee && !item.assignedTo;
            }
            return (
              item.assignee === filter.value || item.assignedTo === filter.value
            );
          });
          break;

        case "priority":
          results = results.filter((item) => item.priority === filter.value);
          break;

        case "hasMedia":
          results = results.filter((item) => {
            const hasMedia =
              (item.photos && item.photos.length > 0) ||
              (item.videos && item.videos.length > 0) ||
              (item.documents && item.documents.length > 0);
            return filter.value ? hasMedia : !hasMedia;
          });
          break;
      }
    });

    return results;
  }, [data, query, filters, searchFields]);

  useEffect(() => {
    onResults(filteredResults);
    onFiltersChange?.(filters);
  }, [filteredResults, onResults, onFiltersChange, filters]);

  const getNestedValue = (obj: any, path: string) => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  const updateFilter = (filterId: string, value: any) => {
    setFilters((prev) =>
      prev.map((filter) =>
        filter.id === filterId ? { ...filter, value } : filter,
      ),
    );
    trackFeatureUsage("advanced_search_filter", "filter_changed", {
      filterId,
      hasValue: !!value,
    });
  };

  const clearFilters = () => {
    setQuery("");
    setFilters((prev) =>
      prev.map((filter) => ({
        ...filter,
        value:
          filter.type === "multiselect"
            ? []
            : filter.type === "daterange"
              ? { start: "", end: "" }
              : filter.type === "boolean"
                ? null
                : "",
      })),
    );
    trackFeatureUsage("advanced_search_clear_filters", "all");
  };

  const saveCurrentSearch = () => {
    if (!saveSearchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName,
      query,
      filters: [...filters],
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem("savedSearches", JSON.stringify(updated));
    setSaveSearchName("");
    setShowSaveDialog(false);
    trackFeatureUsage("advanced_search_save", "save_search", { name: saveSearchName });
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setFilters(search.filters);
    trackFeatureUsage("advanced_search_load", "load_search", { searchId: search.id });
  };

  const deleteSavedSearch = (searchId: string) => {
    const updated = savedSearches.filter((s) => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem("savedSearches", JSON.stringify(updated));
    trackFeatureUsage("advanced_search_delete", "delete_search", { searchId });
  };

  const activeFiltersCount = filters.filter((filter) => {
    if (filter.type === "multiselect") return filter.value.length > 0;
    if (filter.type === "daterange")
      return filter.value.start || filter.value.end;
    if (filter.type === "boolean") return filter.value !== null;
    return filter.value && filter.value !== "";
  }).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all fields..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Advanced Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {filters.map((filter) => (
                  <div key={filter.id} className="space-y-2">
                    <Label className="text-xs font-medium">{filter.name}</Label>

                    {filter.type === "text" && (
                      <Input
                        placeholder={filter.placeholder}
                        value={filter.value}
                        onChange={(e) =>
                          updateFilter(filter.id, e.target.value)
                        }
                      />
                    )}

                    {filter.type === "select" && (
                      <Select
                        value={filter.value}
                        onValueChange={(value) =>
                          updateFilter(filter.id, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={filter.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {filter.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {filter.type === "multiselect" && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {filter.value.map((selectedValue: string) => (
                            <Badge
                              key={selectedValue}
                              variant="secondary"
                              className="text-xs gap-1"
                            >
                              {selectedValue}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() =>
                                  updateFilter(
                                    filter.id,
                                    filter.value.filter(
                                      (v: string) => v !== selectedValue,
                                    ),
                                  )
                                }
                              />
                            </Badge>
                          ))}
                        </div>
                        <Select
                          onValueChange={(value) =>
                            updateFilter(filter.id, [...filter.value, value])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={filter.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options
                              ?.filter(
                                (option) =>
                                  !filter.value.includes(option.value),
                              )
                              .map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {filter.type === "daterange" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          placeholder="Start date"
                          value={filter.value.start}
                          onChange={(e) =>
                            updateFilter(filter.id, {
                              ...filter.value,
                              start: e.target.value,
                            })
                          }
                        />
                        <Input
                          type="date"
                          placeholder="End date"
                          value={filter.value.end}
                          onChange={(e) =>
                            updateFilter(filter.id, {
                              ...filter.value,
                              end: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    {filter.type === "boolean" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${filter.id}-yes`}
                          checked={filter.value === true}
                          onCheckedChange={(checked) =>
                            updateFilter(filter.id, checked ? true : null)
                          }
                        />
                        <Label htmlFor={`${filter.id}-yes`} className="text-xs">
                          Yes
                        </Label>
                        <Checkbox
                          id={`${filter.id}-no`}
                          checked={filter.value === false}
                          onCheckedChange={(checked) =>
                            updateFilter(filter.id, checked ? false : null)
                          }
                        />
                        <Label htmlFor={`${filter.id}-no`} className="text-xs">
                          No
                        </Label>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                    className="gap-1"
                  >
                    <Save className="h-3 w-3" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {(query || activeFiltersCount > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Active filters:</span>

          {query && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />"{query}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setQuery("")}
              />
            </Badge>
          )}

          {filters
            .filter((filter) => {
              if (filter.type === "multiselect") return filter.value.length > 0;
              if (filter.type === "daterange")
                return filter.value.start || filter.value.end;
              if (filter.type === "boolean") return filter.value !== null;
              return filter.value && filter.value !== "";
            })
            .map((filter) => (
              <Badge key={filter.id} variant="secondary" className="gap-1">
                {filter.name}:{" "}
                {filter.type === "multiselect"
                  ? `${filter.value.length} selected`
                  : filter.type === "daterange"
                    ? `${filter.value.start || "∞"} - ${filter.value.end || "∞"}`
                    : filter.type === "boolean"
                      ? filter.value
                        ? "Yes"
                        : "No"
                      : filter.value}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() =>
                    updateFilter(
                      filter.id,
                      filter.type === "multiselect"
                        ? []
                        : filter.type === "daterange"
                          ? { start: "", end: "" }
                          : filter.type === "boolean"
                            ? null
                            : "",
                    )
                  }
                />
              </Badge>
            ))}
        </div>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Saved Searches</Label>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((search) => (
              <div key={search.id} className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSavedSearch(search)}
                  className="text-xs"
                >
                  {search.name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSavedSearch(search.id)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">Save Current Search</Label>
          <Input
            placeholder="Enter search name..."
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={saveCurrentSearch}>
              Save
            </Button>
          </div>
        </Card>
      )}

      {/* Results Summary */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredResults.length} of {data.length} results
      </div>
    </div>
  );
}
