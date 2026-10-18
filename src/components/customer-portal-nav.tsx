"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, FileText, Package, BarChart3, Repeat, Route, UserPlus, Menu, X, LogOut } from "lucide-react";
import { signOut } from "@/app/dashboard/actions";

const links = [
  { href: "/customer-portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customer-portal/invoices", label: "Invoices", icon: FileText },
  { href: "/customer-portal/items", label: "Items", icon: Package },
  { href: "/customer-portal/deliveries", label: "Deliveries", icon: Route },
  { href: "/customer-portal/recurring", label: "Recurring", icon: Repeat },
  { href: "/customer-portal/reports", label: "Reports", icon: BarChart3 },
  { href: "/customer-portal/team", label: "Team", icon: UserPlus },
];

function visibleLinks(role: string) {
  if (role === "owner") return links;
  return links.filter((l) => l.href !== "/customer-portal/team");
}

function NavLinks({
  links: navLinks,
  pathname,
  onNavigate,
}: {
  links: typeof links;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/customer-portal" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CustomerPortalNav({ customerName, role }: { customerName: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navLinks = visibleLinks(role);

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <span className="font-semibold text-slate-900 dark:text-slate-50">{customerName || "Portal"}</span>
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open ? (
        <div className="no-print border-b border-slate-200 bg-white px-4 pb-4 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <NavLinks links={navLinks} pathname={pathname} onNavigate={() => setOpen(false)} />
          <form action={signOut} className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <LogOut size={18} />
              Log out
            </button>
          </form>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <span className="mb-6 px-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {customerName || "Portal"}
        </span>
        <NavLinks links={navLinks} pathname={pathname} />
        <form action={signOut} className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <LogOut size={18} />
            Log out
          </button>
        </form>
      </aside>
    </>
  );
}
