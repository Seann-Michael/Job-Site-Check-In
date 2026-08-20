import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  workspaceService,
  type WorkspaceBusiness,
  type WorkspaceState,
} from "@/lib/workspaceService";

interface CompanySelectorProps {
  collapsed?: boolean;
  className?: string;
}

function announceBusinessName(name: string) {
  localStorage.setItem("business_name", name);
  window.dispatchEvent(new CustomEvent("businessNameChanged", { detail: name }));
}

/**
 * Sidebar business switcher.
 *
 * - Owners: a simple list of the businesses they own (hidden when only one).
 * - Super admins: a searchable combobox over every business (name + account id),
 *   since a super admin has full access to all accounts.
 */
export function CompanySelector({ collapsed = false, className }: CompanySelectorProps) {
  const navigate = useNavigate();
  const [wsState, setWsState] = useState<WorkspaceState>(() => workspaceService.getState());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = workspaceService.subscribe(setWsState);
    void workspaceService.whenReady();
    return unsubscribe;
  }, []);

  const isSuperAdmin = workspaceService.isSuperAdmin();
  const companies: WorkspaceBusiness[] = wsState.businesses.filter((b) =>
    wsState.businessIds.includes(b.id),
  );
  const selectedCompany = companies.find((c) => c.id === wsState.currentBusinessId);

  // Keep the legacy "business_name" hook in sync for components that read it.
  useEffect(() => {
    if (selectedCompany) announceBusinessName(selectedCompany.name);
  }, [selectedCompany?.id, selectedCompany?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCompanyChange = async (companyId: string) => {
    setIsOpen(false);
    if (companyId === wsState.currentBusinessId) return;
    await workspaceService.switchBusiness(companyId);
    const selected = companies.find((c) => c.id === companyId);
    if (selected) announceBusinessName(selected.name);
    // Navigate to jobs page so the user sees data for the new company
    navigate("/admin/jobs");
  };

  if (!wsState.initialized) {
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

  const canSwitch = isSuperAdmin ? companies.length >= 1 : companies.length > 1;

  return (
    <div className={cn("p-4 border-b space-y-3", className)}>
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isSuperAdmin ? "Account" : "Active Company"}
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              disabled={!canSwitch}
              className="w-full justify-between h-auto p-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm truncate">
                    {selectedCompany?.name || "Select Company"}
                  </div>
                  {isSuperAdmin && selectedCompany?.accountId && (
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {selectedCompany.accountId}
                    </div>
                  )}
                </div>
                {canSwitch && (
                  <div className="flex items-center">
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                )}
              </div>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
            {isSuperAdmin ? (
              <Command>
                <CommandInput placeholder="Search by name or account id..." />
                <CommandList className="max-h-[260px]">
                  <CommandEmpty>No accounts found.</CommandEmpty>
                  <CommandGroup>
                    {companies.map((company) => (
                      <CommandItem
                        key={company.id}
                        value={`${company.name} ${company.accountId ?? ""}`}
                        onSelect={() => void handleCompanyChange(company.id)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{company.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {company.accountId ?? "—"}
                            {company.status !== "active" && (
                              <span className="ml-2 not-italic font-sans capitalize">
                                · {company.status}
                              </span>
                            )}
                          </div>
                        </div>
                        {company.id === wsState.currentBusinessId && (
                          <Check className="h-3 w-3 text-primary shrink-0" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <div className="max-h-[200px] overflow-y-auto">
                {companies.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No companies available
                  </div>
                )}
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between w-full p-2 hover:bg-muted cursor-pointer"
                    onClick={() => void handleCompanyChange(company.id)}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="font-medium text-sm">{company.name}</span>
                      {company.id === wsState.currentBusinessId && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
