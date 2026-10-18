"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/supabase/org";
import { DENOMINATIONS, countCash, type Denominations } from "@/lib/cashup";
import { roundMoney } from "@/lib/format";

export type CashUpResult = { error: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: unknown) => roundMoney(Math.max(0, Number(n) || 0));

export async function saveCashUp(input: {
  cashupDate: string;
  till: string;
  openingFloat: number;
  expectedCashSales: number;
  cardSales: number;
  otherSales: number;
  paidOuts: number;
  denominations: Denominations;
  countedTotalOverride: number;
  closingFloat: number;
  notes: string;
}): Promise<CashUpResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (!ISO_DATE.test(input.cashupDate)) return { error: "Enter the date." };
  const till = input.till.trim().slice(0, 40) || "Main";

  // Only accept known denominations, as whole counts.
  const denominations: Denominations = {};
  for (const d of DENOMINATIONS) {
    const n = Math.max(0, Math.floor(Number(input.denominations?.[d.key]) || 0));
    if (n) denominations[d.key] = n;
  }
  const counted = countCash(denominations) || money(input.countedTotalOverride);
  const closingFloat = money(input.closingFloat);
  if (closingFloat > counted + 0.005) return { error: "The float left in the till can't be more than the cash counted." };

  const supabase = await createClient();
  const { error } = await supabase.from("cash_ups").upsert(
    {
      org_id: org.orgId,
      cashup_date: input.cashupDate,
      till,
      opening_float: money(input.openingFloat),
      expected_cash_sales: money(input.expectedCashSales),
      card_sales: money(input.cardSales),
      other_sales: money(input.otherSales),
      paid_outs: money(input.paidOuts),
      denominations,
      counted_cash: counted,
      closing_float: closingFloat,
      notes: input.notes.trim().slice(0, 500) || null,
      created_by: org.userId,
    },
    { onConflict: "org_id,cashup_date,till" }
  );
  if (error) return { error: error.message };

  revalidatePath("/dashboard/cash-up");
  revalidatePath("/dashboard/bookkeeping", "layout");
  return { error: null };
}

export async function deleteCashUp(id: string): Promise<CashUpResult> {
  const org = await getCurrentOrg();
  if (!org) return { error: "You must be signed in." };
  if (org.role === "staff") return { error: "Ask a manager to delete a cash-up." };
  const supabase = await createClient();

  // A bank line matched to this cash-up goes back to unreviewed.
  await supabase
    .from("bank_transactions")
    .update({ status: "unreviewed", matched_type: null, matched_id: null, note: null })
    .eq("matched_type", "cashup")
    .eq("matched_id", id)
    .eq("org_id", org.orgId);

  const { error } = await supabase.from("cash_ups").delete().eq("id", id).eq("org_id", org.orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/cash-up");
  revalidatePath("/dashboard/bookkeeping", "layout");
  return { error: null };
}
