import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Building2, Plus, Settings } from "lucide-react";

interface Company {
  id: string;
  name: string;
  plan: string;
  avatar?: string;
}

interface CompanySelectorProps {
  collapsed?: boolean;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({ 
  collapsed = false 
}) => {
  const [selectedCompany, setSelectedCompany] = useState<Company>({
    id: "1",
    name: "Local SEO Ranker",
    plan: "Pro",
  });

  // Mock companies data - replace with actual data from your backend
  const companies: Company[] = [
    {
      id: "1",
      name: "Local SEO Ranker",
      plan: "Pro",
    },
    {
      id: "2", 
      name: "Joe's Pizza & More",
      plan: "Basic",
    },
    {
      id: "3",
      name: "Smith Plumbing Co",
      plan: "Enterprise",
    },
  ];

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-10 h-10">
            <Building2 className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-64">
          <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="font-medium">{company.name}</span>
                <span className="text-xs text-muted-foreground">
                  {company.plan} Plan
                </span>
              </div>
              {company.id === selectedCompany.id && (
                <Badge variant="default" className="text-xs">
                  Current
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Company
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Manage Companies
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Company Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {selectedCompany.name}
            </h2>
            <p className="text-xs text-gray-500">{selectedCompany.plan} Plan</p>
          </div>
        </div>
      </div>

      {/* Company Selector Dropdown */}
      <Select
        value={selectedCompany.id}
        onValueChange={(value) => {
          const company = companies.find((c) => c.id === value);
          if (company) setSelectedCompany(company);
        }}
      >
        <SelectTrigger className="w-full h-9">
          <SelectValue placeholder="Select company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="font-medium">{company.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {company.plan} Plan
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Company
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Settings className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
