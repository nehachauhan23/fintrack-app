"use client";

import { ArrowUpRight, ArrowDownRight, CreditCard, Wallet, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import useFetch from "@/hooks/use-fetch";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { updateDefaultAccount } from "@/actions/account";
import { toast } from "sonner";

const accountIcons = {
  CURRENT: CreditCard,
  SAVINGS: Wallet,
  default: Building2,
};

const accountColors = {
  CURRENT: "from-blue-500 to-blue-700",
  SAVINGS: "from-emerald-500 to-emerald-700",
  default: "from-violet-500 to-violet-700",
};

export function AccountCard({ account }) {
  const { name, type, balance, id, isDefault } = account;
  const Icon = accountIcons[type] || accountIcons.default;
  const gradient = accountColors[type] || accountColors.default;

  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error,
  } = useFetch(updateDefaultAccount);

  const handleDefaultChange = async (event) => {
    event.preventDefault();
    if (isDefault) {
      toast.warning("You need at least 1 default account");
      return;
    }
    await updateDefaultFn(id);
  };

  useEffect(() => {
    if (updatedAccount?.success) {
      toast.success("Default account updated",{
        duration: 1200
      });
    }
  }, [updatedAccount]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to update default account",{
        duration: 1200
      });
    }
  }, [error]);

  return (
    <Card className="card-lift overflow-hidden rounded-2xl border-0 shadow-md group">
      <Link href={`/account/${id}`}>
        {/* Gradient header strip */}
        <div className={`bg-gradient-to-r ${gradient} p-5 pb-4`}>
          <div className="flex items-start justify-between">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Icon size={20} className="text-white" />
            </div>
            <div onClick={handleDefaultChange}>
              <Switch
                checked={isDefault}
                disabled={updateDefaultLoading}
                className="data-[state=checked]:bg-white/30"
              />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
              {type.charAt(0) + type.slice(1).toLowerCase()} Account
            </p>
            <h3 className="text-white font-bold text-lg mt-0.5 capitalize leading-tight">
              {name}
            </h3>
          </div>
        </div>

        {/* Balance section */}
        <CardContent className="p-5 bg-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${parseFloat(balance).toFixed(2)}
              </p>
            </div>
            {isDefault && (
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 border-0">
                Default
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            Income
          </div>
          <div className="flex items-center gap-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
            Expense
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}
