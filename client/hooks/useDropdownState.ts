import { useState, useEffect } from "react";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownHistory {
  [key: string]: DropdownOption[];
}

// Global storage for dropdown histories
let globalDropdownHistory: DropdownHistory = {};

// Load from localStorage on startup
try {
  // Check if we're in Builder.io editor environment
  const isBuilderIoEditor =
    typeof window !== "undefined" &&
    (window.location.href.includes("builder.io") ||
      window.parent !== window ||
      document.referrer.includes("builder.io"));

  if (!isBuilderIoEditor) {
    const stored = localStorage.getItem("globalDropdownHistory");
    if (stored) {
      globalDropdownHistory = JSON.parse(stored);
    }
  }
} catch (error) {
  console.warn("Failed to load dropdown history from localStorage");
}

// Save to localStorage with debouncing
let saveTimeout: NodeJS.Timeout;
const saveToStorage = () => {
  // Check if we're in Builder.io editor environment
  const isBuilderIoEditor =
    typeof window !== "undefined" &&
    (window.location.href.includes("builder.io") ||
      window.parent !== window ||
      document.referrer.includes("builder.io"));

  if (isBuilderIoEditor) {
    return; // Don't save in Builder.io editor
  }

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(
        "globalDropdownHistory",
        JSON.stringify(globalDropdownHistory),
      );
    } catch (error) {
      console.warn("Failed to save dropdown history to localStorage");
    }
  }, 500);
};

export function useDropdownState(
  fieldName: string,
  maxHistorySize: number = 20,
) {
  const [options, setOptions] = useState<DropdownOption[]>(() => {
    return globalDropdownHistory[fieldName] || [];
  });

  const addOption = (value: string, label?: string) => {
    if (!value || value.trim() === "") return;

    const displayLabel = label || value;
    const newOption: DropdownOption = {
      value: value.trim(),
      label: displayLabel,
    };

    // Check if option already exists
    const existingIndex = options.findIndex(
      (opt) => opt.value === newOption.value,
    );

    let updatedOptions: DropdownOption[];

    if (existingIndex >= 0) {
      // Move existing option to top
      updatedOptions = [
        newOption,
        ...options.filter((_, index) => index !== existingIndex),
      ];
    } else {
      // Add new option to top
      updatedOptions = [newOption, ...options].slice(0, maxHistorySize);
    }

    // Update local state
    setOptions(updatedOptions);

    // Update global history
    globalDropdownHistory[fieldName] = updatedOptions;
    saveToStorage();
  };

  const removeOption = (value: string) => {
    const updatedOptions = options.filter((opt) => opt.value !== value);
    setOptions(updatedOptions);
    globalDropdownHistory[fieldName] = updatedOptions;
    saveToStorage();
  };

  const clearHistory = () => {
    setOptions([]);
    delete globalDropdownHistory[fieldName];
    saveToStorage();
  };

  // Sync with global state changes from other components
  useEffect(() => {
    const syncOptions = () => {
      const currentGlobalOptions = globalDropdownHistory[fieldName] || [];
      setOptions(currentGlobalOptions);
    };

    // Listen for storage changes from other tabs
    window.addEventListener("storage", syncOptions);

    return () => {
      window.removeEventListener("storage", syncOptions);
    };
  }, [fieldName]);

  return {
    options,
    addOption,
    removeOption,
    clearHistory,
  };
}

// Common field names for consistency across the app
export const DROPDOWN_FIELDS = {
  PROJECT_KEYWORDS: "project_keywords",
  PROJECT_STATUS: "project_status",
  CUSTOMER_TYPE: "customer_type",
  PROJECT_TYPE: "project_type",
  LOCATION_CITY: "location_city",
  LOCATION_STATE: "location_state",
  TASK_CATEGORY: "task_category",
  TASK_PRIORITY: "task_priority",
  MATERIAL_TYPE: "material_type",
  CONTRACTOR_NAME: "contractor_name",
  SUPPLIER_NAME: "supplier_name",
} as const;
