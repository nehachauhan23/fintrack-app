"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X, TrendingUp, AlertTriangle } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBudget } from "@/actions/budget";
import { cn } from "@/lib/utils";

export function BudgetProgress({ initialBudget, currentExpenses }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(
    initialBudget?.amount?.toString() || ""
  );

  const { loading: isLoading, fn: updateBudgetFn, data: updatedBudget, error } = useFetch(updateBudget);

  const percentUsed = initialBudget
    ? Math.min((currentExpenses / initialBudget.amount) * 100, 100)
    : 0;

  const remaining = initialBudget
    ? initialBudget.amount - currentExpenses
    : 0;

  const statusColor =
    percentUsed >= 90 ? "bg-red-500" :
    percentUsed >= 75 ? "bg-amber-500" :
    "bg-emerald-500";

  const statusLabel =
    percentUsed >= 90 ? "Critical" :
    percentUsed >= 75 ? "Warning" :
    "On Track";

  const statusTextColor =
    percentUsed >= 90 ? "text-red-600" :
    percentUsed >= 75 ? "text-amber-600" :
    "text-emerald-600";

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount",{
        duration: 1200
      });
      return;
    }
    await updateBudgetFn(amount);
  };

  const handleCancel = () => {
    setNewBudget(initialBudget?.amount?.toString() || "");
    setIsEditing(false);
  };

  useEffect(() => {
    if (updatedBudget?.success) {
      setIsEditing(false);
      toast.success("Budget updated successfully",{
        duration: 1200
      });
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (error) toast.error(error.message || "Failed to update budget");
  }, [error]);

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
      <div className={cn("h-1", statusColor)} />
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">
              Monthly Budget
            </CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Default account · Current month</p>
          </div>
          {initialBudget && !isEditing && (
            <div className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-opacity-10", statusTextColor,
              percentUsed >= 90 ? "bg-red-50" : percentUsed >= 75 ? "bg-amber-50" : "bg-emerald-50"
            )}>
              {percentUsed >= 75 ? <AlertTriangle size={12} /> : <TrendingUp size={12} />}
              {statusLabel}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-5">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">$</span>
            <Input
              type="number"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="w-36 h-9 text-sm"
              placeholder="Enter amount"
              autoFocus
              disabled={isLoading}
            />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleUpdateBudget} disabled={isLoading}>
              <Check className="h-4 w-4 text-emerald-500" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleCancel} disabled={isLoading}>
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        ) : initialBudget ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div className="space-y-0.5">
                <p className="text-2xl font-bold text-gray-900">
                  ${currentExpenses.toFixed(2)}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    of ${initialBudget.amount.toFixed(2)}
                  </span>
                </p>
                <p className={cn("text-xs font-medium", remaining >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {remaining >= 0
                    ? `$${remaining.toFixed(2)} remaining`
                    : `$${Math.abs(remaining).toFixed(2)} over budget`}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1">
              <Progress
                value={percentUsed}
                className="h-2 bg-gray-100"
                indicatorClassName={statusColor}
              />
              <p className="text-xs text-gray-400 text-right">{percentUsed.toFixed(1)}% used</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">No budget set for this month</p>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsEditing(true)}>
              Set Budget
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
