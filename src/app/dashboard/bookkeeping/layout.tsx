import { redirect } from "next/navigation";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { BookkeepingTabs } from "./bookkeeping-tabs";

export default async function BookkeepingLayout({ children }: { children: React.ReactNode }) {
  const org = await requireBookkeeper();
  if (!org) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Bookkeeping</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Reconcile the bank, chase what you&apos;re owed, track what you owe, and keep VAT and profit in view.
      </p>
      <BookkeepingTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
