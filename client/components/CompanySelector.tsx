import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Company {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
}

interface CompanySelectorProps {
  collapsed?: boolean;
  className?: string;
}

export function CompanySelector({ collapsed = false, className }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Load companies from localStorage/API
  useEffect(() => {
    const loadCompanies = () => {
      try {
        // Try to load from localStorage first
        const savedCompanies = localStorage.getItem("user_companies");
        const currentCompanyId = localStorage.getItem("selected_company_id");
        
        if (savedCompanies) {
          const parsedCompanies = JSON.parse(savedCompanies);
          setCompanies(parsedCompanies);
          setSelectedCompany(currentCompanyId || parsedCompanies[0]?.id || "");
        } else {
          // Mock data for demonstration - replace with actual API call
          const mockCompanies: Company[] = [
            {
              id: "1",
              name: "Joe's Pizza & More",
              plan: "Pro",
              isActive: true,
            },
            {
              id: "2", 
              name: "Fairfield Auto Repair",
              plan: "Basic",
              isActive: true,
            },
            {
              id: "3",
              name: "Sunshine Dental",
              plan: "Pro",
              isActive: false,
            },
          ];
          
          setCompanies(mockCompanies);
          setSelectedCompany(mockCompanies[0].id);
          
          // Save to localStorage
          localStorage.setItem("user_companies", JSON.stringify(mockCompanies));
          localStorage.setItem("selected_company_id", mockCompanies[0].id);
        }
      } catch (error) {
        console.error("Error loading companies:", error);
        // Fallback to default
        const defaultCompany: Company = {
          id: "default",
          name: "Local SEO Ranker",
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
    setSelectedCompany(companyId);
    localStorage.setItem("selected_company_id", companyId);
    
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
          <Building2 className="h-5 w-5 text-primary-foreground" />
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
        
        <Select value={selectedCompany} onValueChange={handleCompanyChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                  <Building2 className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm truncate">
                    {selectedCompanyData?.name || "Select Company"}
                  </div>
                </div>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                <div className="flex items-center space-x-2 w-full">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                    <Building2 className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
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
                </div>
              </SelectItem>
            ))}
            
            {/* Add New Company Option */}
            <SelectItem value="add-new" className="border-t">
              <div className="flex items-center space-x-2 w-full">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground text-sm">Add New Company</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}
