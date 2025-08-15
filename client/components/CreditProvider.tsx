import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  const [balance, setBalance] = useState<CreditBalance>({
    total: 0,
    used: 0,
    remaining: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCredits = useCallback(() => {
    try {
      const currentBalance = getCreditBalance();
      const currentTransactions = getCreditTransactions();
      setBalance(currentBalance);
      setTransactions(currentTransactions);
    } catch (error) {
      console.error("Error refreshing credits:", error);
      // Set fallback values on error
      setBalance({
        total: 250000,
        used: 0,
        remaining: 250000,
        lastUpdated: new Date().toISOString(),
      });
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      // Initialize credit system
      initializeCreditSystem();
      refreshCredits();

      // Listen for credit updates
      const handleCreditUpdate = (event: CustomEvent) => {
        try {
          setBalance(event.detail.balance);
          refreshCredits(); // Refresh transactions as well
        } catch (error) {
          console.error("Error handling credit update:", error);
        }
      };

      window.addEventListener(
        "creditsUpdated",
        handleCreditUpdate as EventListener,
      );

      return () => {
        window.removeEventListener(
          "creditsUpdated",
          handleCreditUpdate as EventListener,
        );
      };
    } catch (error) {
      console.error("Error initializing credit system:", error);
      // Ensure we're not in loading state even if initialization fails
      setIsLoading(false);
    }
  }, []);

  const value: CreditContextType = {
    balance,
    transactions,
    refreshCredits,
    isLoading,
  };

  return (
    <CreditContext.Provider value={value}>{children}</CreditContext.Provider>
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
