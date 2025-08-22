import React, { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  ChevronDown,
  Plus,
  Check,
  Star,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Company {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  isFavorite?: boolean;
}

interface CompanySelectorProps {
  collapsed?: boolean;
  className?: string;
}

export function CompanySelector({ collapsed = false, className }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Load companies from localStorage/API
  useEffect(() => {
    const loadCompanies = () => {
      try {
        // Force clear old branding data and reset to Waypoint
        localStorage.removeItem("user_companies");
        localStorage.removeItem("selected_company_id");
        localStorage.setItem("business_name", "Waypoint");

        // Mock data for demonstration - replace with actual API call
        const mockCompanies: Company[] = [
          {
            id: "1",
            name: "Waypoint",
            plan: "Pro",
            isActive: true,
            isFavorite: false,
          },
          {
            id: "2",
            name: "Fairfield Auto Repair",
            plan: "Basic",
            isActive: true,
            isFavorite: true,
          },
          {
            id: "3",
            name: "Sunshine Dental",
            plan: "Pro",
            isActive: false,
            isFavorite: false,
          },
          {
            id: "4",
            name: "Mike's Pizza Palace",
            plan: "Pro",
            isActive: true,
            isFavorite: true,
          },
          {
            id: "5",
            name: "Green Thumb Landscaping",
            plan: "Basic",
            isActive: true,
            isFavorite: false,
          },
        ];

        setCompanies(mockCompanies);
        setSelectedCompany(mockCompanies[0].id);

        // Save to localStorage with Waypoint as default
        localStorage.setItem("user_companies", JSON.stringify(mockCompanies));
        localStorage.setItem("selected_company_id", mockCompanies[0].id);
        localStorage.setItem("business_name", mockCompanies[0].name);

        // Dispatch event to update business name in layout immediately
        window.dispatchEvent(new CustomEvent("businessNameChanged", {
          detail: mockCompanies[0].name
        }));
      } catch (error) {
        console.error("Error loading companies:", error);
        // Fallback to default
        const defaultCompany: Company = {
          id: "default",
          name: "Waypoint",
          plan: "Pro",
          isActive: true,
        };
        setCompanies([defaultCompany]);
        setSelectedCompany(defaultCompany.id);
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanies();
  }, []);

  const handleCompanyChange = (companyId: string) => {
    // Handle add new company option
    if (companyId === "add-new") {
      // TODO: Implement add new company functionality
      console.log("Add new company clicked");
      return;
    }

    setSelectedCompany(companyId);
    localStorage.setItem("selected_company_id", companyId);
    setIsOpen(false);
    setSearchTerm(""); // Clear search when selecting

    // Update business name for the layout
    const selectedCompanyData = companies.find(c => c.id === companyId);
    if (selectedCompanyData) {
      localStorage.setItem("business_name", selectedCompanyData.name);

      // Dispatch event to update business name in layout
      window.dispatchEvent(new CustomEvent("businessNameChanged", {
        detail: selectedCompanyData.name
      }));
    }
  };

  const toggleFavorite = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanies(prev =>
      prev.map(company =>
        company.id === companyId
          ? { ...company, isFavorite: !company.isFavorite }
          : company
      )
    );

    // Save favorites to localStorage
    const updatedCompanies = companies.map(company =>
      company.id === companyId
        ? { ...company, isFavorite: !company.isFavorite }
        : company
    );
    localStorage.setItem("user_companies", JSON.stringify(updatedCompanies));
  };

  // Filter and sort companies
  const getFilteredAndSortedCompanies = () => {
    let filtered = companies.filter(company =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort favorites first, then by name
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const getSelectedCompany = () => {
    return companies.find(c => c.id === selectedCompany);
  };

  const selectedCompanyData = getSelectedCompany();

  if (isLoading) {
    return (
      <div className={cn("p-4 border-b", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className={cn("p-4 border-b flex justify-center", className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
          <MapPin className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 border-b space-y-3", className)}>
      {/* Company Selector */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Active Company
        </div>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className="w-full justify-between h-auto p-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm truncate">
                    {selectedCompanyData?.name || "Select Company"}
                  </div>
                </div>
                <div className="flex items-center">
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </div>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            {/* Search Input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Filtered Companies */}
            <div className="max-h-[200px] overflow-y-auto">
              {getFilteredAndSortedCompanies().map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted cursor-pointer"
                  onClick={() => handleCompanyChange(company.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{company.name}</span>
                      {company.id === selectedCompany && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <Badge
                        variant={company.plan === "Pro" ? "default" : "secondary"}
                        className="text-xs py-0 px-1"
                      >
                        {company.plan}
                      </Badge>
                      {!company.isActive && (
                        <Badge variant="outline" className="text-xs py-0 px-1">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-6 w-6 flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(company.id, e);
                    }}
                  >
                    <Star
                      className={cn(
                        "h-3 w-3",
                        company.isFavorite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground hover:text-yellow-400"
                      )}
                    />
                  </div>
                </div>
              ))}

              {/* No Results Message */}
              {getFilteredAndSortedCompanies().length === 0 && searchTerm && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No companies found matching "{searchTerm}"
                </div>
              )}

              {/* Add New Company Option */}
              <div
                className="flex items-center space-x-2 w-full p-2 hover:bg-muted cursor-pointer border-t"
                onClick={() => handleCompanyChange("add-new")}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground text-sm">Add New Company</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

    </div>
  );
}
