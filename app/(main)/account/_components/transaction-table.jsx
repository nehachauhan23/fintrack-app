"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown, ChevronUp, MoreHorizontal, Trash, Search,
  X, ChevronLeft, ChevronRight, Clock, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { categoryColors, defaultCategories } from "@/data/categories";
import { bulkDeleteTransactions } from "@/actions/account";
import useFetch from "@/hooks/use-fetch";

const ITEMS_PER_PAGE = 10;

const RECURRING_INTERVALS = {
  DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly",
};

// Build a name lookup from defaultCategories
const categoryNameMap = defaultCategories.reduce((acc, c) => {
  acc[c.id] = c.name;
  return acc;
}, {});

export function TransactionTable({ transactions }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ field: "date", direction: "desc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [recurringFilter, setRecurringFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);

  const { loading: deleteLoading, fn: deleteFn, data: deleted } = useFetch(bulkDeleteTransactions);

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((t) =>
        t.description?.toLowerCase().includes(q) ||
        (categoryNameMap[t.category] || t.category).toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }

    if (recurringFilter !== "all") {
      result = result.filter((t) =>
        recurringFilter === "recurring" ? t.isRecurring : !t.isRecurring
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortConfig.field === "date") cmp = new Date(a.date) - new Date(b.date);
      else if (sortConfig.field === "amount") cmp = a.amount - b.amount;
      else if (sortConfig.field === "category") cmp = a.category.localeCompare(b.category);
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });

    return result;
  }, [transactions, searchTerm, typeFilter, recurringFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSorted.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSorted, currentPage]);

  const handleSort = (field) => {
    setSortConfig((c) => ({
      field,
      direction: c.field === field && c.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSelect = (id) => {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds((cur) =>
      cur.length === paginated.length ? [] : paginated.map((t) => t.id)
    );
  };

  const openDeleteDialog = (ids) => {
    setPendingDeleteIds(ids);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    await deleteFn(pendingDeleteIds);
    setDeleteDialogOpen(false);
    setPendingDeleteIds([]);
    setSelectedIds([]);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setRecurringFilter("all");
    setCurrentPage(1);
  };

  const hasFilters = searchTerm || typeFilter !== "all" || recurringFilter !== "all";

  useEffect(() => {
    if (deleted?.success) toast.success("Transactions deleted successfully",{
        duration: 1200
      });
  }, [deleted]);

  const SortIcon = ({ field }) =>
    sortConfig.field === field ? (
      sortConfig.direction === "asc" ? (
        <ChevronUp className="ml-1 h-3.5 w-3.5 text-blue-500" />
      ) : (
        <ChevronDown className="ml-1 h-3.5 w-3.5 text-blue-500" />
      )
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 text-gray-300" />
    );

  return (
    <div className="space-y-4">
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {pendingDeleteIds.length} transaction{pendingDeleteIds.length !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The account balance will be adjusted accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>

          <Select value={recurringFilter} onValueChange={(v) => { setRecurringFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="recurring">Recurring Only</SelectItem>
              <SelectItem value="non-recurring">One-time Only</SelectItem>
            </SelectContent>
          </Select>

          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => openDeleteDialog(selectedIds)}
              className="gap-1.5"
            >
              <Trash className="h-3.5 w-3.5" />
              Delete ({selectedIds.length})
            </Button>
          )}

          {hasFilters && (
            <Button variant="outline" size="icon" onClick={handleClearFilters} title="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {deleteLoading && (
          <div className="h-1 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse w-1/2 mx-auto" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={paginated.length > 0 && selectedIds.length === paginated.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Description
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category <SortIcon field="category" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount <SortIcon field="amount" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Recurring
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                  {hasFilters ? "No transactions match your filters." : "No transactions yet."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((t) => {
                const catColor = categoryColors[t.category] || "#94a3b8";
                const catName = categoryNameMap[t.category] || t.category;
                return (
                  <TableRow key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.includes(t.id)}
                        onCheckedChange={() => handleSelect(t.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {format(new Date(t.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-gray-800 max-w-[200px] truncate">
                      {t.description || <span className="text-gray-400 italic">No description</span>}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${catColor}18`,
                          color: catColor,
                          border: `1px solid ${catColor}30`,
                        }}
                      >
                        {catName}
                      </span>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-semibold text-sm whitespace-nowrap",
                      t.type === "INCOME" ? "text-emerald-600" : "text-red-500"
                    )}>
                      {t.type === "INCOME" ? "+" : "-"}${Number(t.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {t.isRecurring ? (
                        <div className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {RECURRING_INTERVALS[t.recurringInterval] || "Recurring"}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">One-time</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => router.push(`/transaction/create?edit=${t.id}`)}
                            className="cursor-pointer"
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                            onClick={() => openDeleteDialog([t.id])}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-400">
            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAndSorted.length)}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSorted.length)} of{" "}
            {filteredAndSorted.length} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
