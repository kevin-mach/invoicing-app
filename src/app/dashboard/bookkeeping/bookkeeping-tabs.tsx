"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/bookkeeping", label: "Overview" },
  { href: "/dashboard/bookkeeping/reports", label: "Reports" },
  { href: "/dashboard/bookkeeping/bank", label: "Bank" },
  { href: "/dashboard/bookkeeping/receivables", label: "Receivables" },
  { href: "/dashboard/bookkeeping/payables", label: "Payables" },
  { href: "/dashboard/bookkeeping/credit-notes", label: "Credit notes" },
  { href: "/dashboard/bookkeeping/fuel", label: "Fuel" },
  { href: "/dashboard/bookkeeping/bad-debts", label: "Bad debts" },
  { href: "/dashboard/bookkeeping/expenses", label: "Expenses" },
  { href: "/dashboard/bookkeeping/pos", label: "POS & sales" },
  { href: "/dashboard/bookkeeping/payroll", label: "Payroll" },
  { href: "/dashboard/bookkeeping/vat", label: "VAT" },
  { href: "/dashboard/bookkeeping/pnl", label: "Profit & loss" },
  { href: "/dashboard/bookkeeping/categories", label: "Categories" },
  { href: "/dashboard/bookkeeping/export", label: "Export" },
  { href: "/dashboard/bookkeeping/connections", label: "Connections" },
];

export function BookkeepingTabs() {
  const pathname = usePathname();
  return (
    <nav className="no-print -mx-1 mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800">
      {TABS.map((t) => {
        const active = t.href === "/dashboard/bookkeeping" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-slate-900 text-slate-900 dark:border-slate-50 dark:text-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
