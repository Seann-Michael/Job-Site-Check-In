import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

const BUSINESS_TYPE_OPTIONS = [
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail Store" },
  { value: "automotive", label: "Automotive" },
  { value: "healthcare", label: "Healthcare" },
  { value: "beauty", label: "Beauty & Spa" },
  { value: "fitness", label: "Fitness & Gym" },
  { value: "real-estate", label: "Real Estate" },
  { value: "legal", label: "Legal Services" },
  { value: "financial", label: "Financial Services" },
  { value: "home-services", label: "Home Services" },
  { value: "professional", label: "Professional Services" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "nonprofit", label: "Non-Profit" },
  { value: "food", label: "Food & Beverage" },
  { value: "lodging", label: "Hotels & Lodging" },
  { value: "shopping", label: "Shopping Center" },
  { value: "travel", label: "Travel & Tourism" },
  { value: "technology", label: "Technology" },
  { value: "consulting", label: "Consulting" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "construction", label: "Construction" },
  { value: "transportation", label: "Transportation" },
  { value: "agriculture", label: "Agriculture" },
  { value: "art", label: "Arts & Culture" },
  { value: "government", label: "Government" },
  { value: "other", label: "Other" },
];

interface BusinessTypesSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  maxSelections?: number;
}

export const BusinessTypesSelect: React.FC<BusinessTypesSelectProps> = ({
  values = [],
  onValuesChange,
  label = "Business Types",
  placeholder = "Select business categories",
  disabled = false,
  maxSelections = 5,
}) => {
  const [selectedType, setSelectedType] = useState("");
  const [customType, setCustomType] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const addBusinessType = (typeValue: string) => {
    if (
      typeValue &&
      !values.includes(typeValue) &&
      values.length < maxSelections
    ) {
      onValuesChange([...values, typeValue]);
    }
    setSelectedType("");
  };

  const removeBusinessType = (typeValue: string) => {
    onValuesChange(values.filter((v) => v !== typeValue));
  };

  const addCustomType = () => {
    if (customType.trim() && !values.includes(customType.trim())) {
      addBusinessType(customType.trim().toLowerCase().replace(/\s+/g, "-"));
      setCustomType("");
      setShowCustomInput(false);
    }
  };

  const getTypeLabel = (value: string) => {
    const option = BUSINESS_TYPE_OPTIONS.find((opt) => opt.value === value);
    return option
      ? option.label
      : value.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {/* Selected Types Display */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1 pr-1">
              {getTypeLabel(type)}
              <button
                onClick={() => removeBusinessType(type)}
                className="hover:bg-red-100 rounded p-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add New Type */}
      {!disabled && values.length < maxSelections && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select
              value={selectedType}
              onValueChange={(value) => {
                setSelectedType(value);
                addBusinessType(value);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.filter(
                  (option) => !values.includes(option.value),
                ).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Custom
            </Button>
          </div>

          {/* Custom Type Input */}
          {showCustomInput && (
            <div className="flex gap-2">
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter custom business type"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomType();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomType}
                disabled={!customType.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomType("");
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select up to {maxSelections} business categories that best describe your
        business.
        {values.length >= maxSelections && " (Maximum reached)"}
      </p>
    </div>
  );
};
