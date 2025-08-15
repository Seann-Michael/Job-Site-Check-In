import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  getCreditBalance,
  getCreditTransactions,
  CreditBalance,
  CreditTransaction,
  initializeCreditSystem,
} from "@/lib/creditSystem";

interface CreditContextType {
  balance: CreditBalance;
  transactions: CreditTransaction[];
  refreshCredits: () => void;
  isLoading: boolean;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

interface CreditProviderProps {
  children: ReactNode;
}

export function CreditProvider({ children }: CreditProviderProps) {
  // Simplified static provider to isolate infinite loop issue
  const staticValue: CreditContextType = useMemo(() => ({
    balance: {
      total: 250000,
      used: 0,
      remaining: 250000,
      lastUpdated: new Date().toISOString(),
    },
    transactions: [],
    refreshCredits: () => {}, // No-op function
    isLoading: false,
  }), []);

  return (
    <CreditContext.Provider value={staticValue}>{children}</CreditContext.Provider>
  );
}

export function useCredits(): CreditContextType {
  const context = useContext(CreditContext);
  if (context === undefined) {
    console.warn(
      "useCredits must be used within a CreditProvider. Returning fallback values to prevent crashes.",
    );
    // Return a safe fallback context to prevent app crashes
    return {
      balance: {
        total: 250000, // Fallback to development credits
        used: 0,
        remaining: 250000,
        lastUpdated: new Date().toISOString(),
      },
      transactions: [],
      refreshCredits: () => {
        console.warn("refreshCredits called outside of CreditProvider context");
      },
      isLoading: false, // Set to false to prevent loading state issues
    };
  }
  return context;
}
