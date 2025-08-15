import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useCredits } from "@/components/CreditProvider";
import { formatCredits } from "@/lib/creditSystem";
import { useNavigate } from "react-router-dom";

export function CreditDisplay() {
  const { balance, isLoading } = useCredits();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Zap className="h-4 w-4 mr-1" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  const getBalanceColor = () => {
    if (balance.remaining < 1000) return "text-red-600";
    if (balance.remaining < 5000) return "text-yellow-600";
    return "text-green-600";
  };

  const getBalanceVariant = () => {
    if (balance.remaining < 1000) return "destructive";
    if (balance.remaining < 5000) return "secondary";
    return "default";
  };

  // Simplified version without dropdown to fix infinite loop
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => navigate("/admin/credits")}
      className="flex items-center gap-2"
    >
      <Zap className="h-4 w-4" />
      <Badge variant={getBalanceVariant()} className="gap-1">
        {formatCredits(balance.remaining)}
      </Badge>
      {balance.remaining < 1000 && (
        <AlertTriangle className="h-3 w-3 text-red-500" />
      )}
    </Button>
  );
}
