import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { workspaceService } from "@/lib/workspaceService";
import { supabase } from "@/lib/dataService";

interface Company {
  id: string;
  name: string;
}

interface CompanySelectorProps {
  collapsed?: boolean;
  className?: string;
}

export function CompanySelector({ collapsed = false, className }: CompanySelectorProps) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
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

  // Load businesses scoped to the current workspace
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setIsLoading(true);

        // Wait for workspace to be initialized if not already
        let state = workspaceService.getState();
        if (!state.initialized) {
          await workspaceService.initialize();
          state = workspaceService.getState();
        }

        const businessIds = state.businessIds;
        const currentBusinessId = state.currentBusinessId;

        if (businessIds.length === 0) {
          setCompanies([]);
          setSelectedCompanyId(null);
          setIsLoading(false);
          return;
        }

        // Fetch business details for these IDs from Supabase
        const { data, error } = await supabase
          .from("businesses")
          .select("id, name")
          .in("id", businessIds)
          .order("name");

        if (error) {
          console.warn("[CompanySelector] failed to load businesses:", error.message);
          setIsLoading(false);
          return;
        }

        const loaded: Company[] = (data ?? []).map((b: { id: string; name: string }) => ({
          id: b.id,
          name: b.name,
        }));

        setCompanies(loaded);
        setSelectedCompanyId(currentBusinessId ?? loaded[0]?.id ?? null);

        // Sync business name to localStorage for other components
        const active = loaded.find((c) => c.id === (currentBusinessId ?? loaded[0]?.id));
        if (active) {
          localStorage.setItem("business_name", active.name);
          window.dispatchEvent(new CustomEvent("businessNameChanged", { detail: active.name }));
        }
      } catch (err) {
        console.warn("[CompanySelector] error loading companies:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanies();

    // Re-load when workspace state changes
    const unsubscribe = workspaceService.subscribe((state) => {
      if (!state.initialized) return;
      // Trigger a reload when business list changes
      loadCompanies();
    });

    return () => unsubscribe();
  }, []);

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setIsOpen(false);
    setSearchTerm("");

    await workspaceService.switchBusiness(companyId);

    // Navigate to projects page so the user sees data for the new company
    navigate("/admin/projects");

    const selected = companies.find((c) => c.id === companyId);
    if (selected) {
      localStorage.setItem("business_name", selected.name);
      window.dispatchEvent(new CustomEvent("businessNameChanged", { detail: selected.name }));
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

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
                    {selectedCompany?.name || "Select Company"}
                  </div>
                </div>
                <div className="flex items-center">
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </div>
              </div>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-full p-0" align="start">
            {/* Search */}
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

            <div className="max-h-[200px] overflow-y-auto">
              {filteredCompanies.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {searchTerm ? `No companies found matching "${searchTerm}"` : "No companies available"}
                </div>
              )}

              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between w-full p-2 hover:bg-muted cursor-pointer"
                  onClick={() => handleCompanyChange(company.id)}
                >
                  <div className="flex items-center space-x-2 flex-1">
                    <span className="font-medium text-sm">{company.name}</span>
                    {company.id === selectedCompanyId && (
                      <Check className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
