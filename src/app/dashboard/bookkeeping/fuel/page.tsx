import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireBookkeeper } from "@/lib/bookkeeping/access";
import { resolvePeriod, toIsoDate } from "@/lib/bookkeeping/period";
import { getScaleCharges } from "@/lib/bookkeeping/data";
import { PeriodFilter } from "@/components/bookkeeping/period-filter";
import { StatCard } from "@/components/bookkeeping/ui";
import { formatGBP, roundMoney } from "@/lib/format";
import { FuelReceiptForm } from "./fuel-receipt-form";
import { FuelReceiptDelete } from "./fuel-receipt-delete";
import { VehiclesSection, type VehicleRow } from "./vehicles-section";

export default async function FuelPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const org = await requireBookkeeper();
  if (!org) return null;

  const params = await searchParams;
  const { from, to } = resolvePeriod(params.from, params.to, "this-quarter");
  const today = toIsoDate(new Date());
  const supabase = await createClient();
  const [{ data: vehicleRows }, { data: receipts }, scaleCharges] = await Promise.all([
    supabase.from("vehicles").select("*").eq("org_id", org.orgId).eq("active", true).order("name"),
    supabase
      .from("fuel_receipts")
      .select("*, vehicles(name, registration)")
      .eq("org_id", org.orgId)
      .gte("receipt_date", from)
      .lte("receipt_date", to)
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false }),
    getScaleCharges(org.orgId, from, to),
  ]);
  const vehicles: VehicleRow[] = vehicleRows ?? [];

  const paths = (receipts ?? []).map((r) => r.receipt_path).filter((p): p is string => !!p);
  const signed = paths.length ? await supabase.storage.from("receipts").createSignedUrls(paths, 3600) : { data: [] };
  const linkByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const spent = roundMoney((receipts ?? []).reduce((s, r) => s + r.total, 0));
  const vatOnReceipts = roundMoney((receipts ?? []).reduce((s, r) => s + r.vat_on_receipt, 0));
  const reclaimed = roundMoney((receipts ?? []).reduce((s, r) => s + r.vat_reclaimed, 0));
  const scaleVat = roundMoney(scaleCharges.reduce((s, c) => s + c.vat, 0));
  const noVatNumber = (receipts ?? []).filter((r) => !r.station_vat_number).length;

  // HMRC: a business that uses the scale charge must use it for every car fuelled for private use.
  const privateCars = vehicles.filter((v) => v.vehicle_type === "Company car" && v.private_use);
  const mixedScale = privateCars.some((v) => v.vat_method === "scale_charge") && privateCars.some((v) => v.vat_method !== "scale_charge");

  return (
    <div className="space-y-6">
      <PeriodFilter basePath="/dashboard/bookkeeping/fuel" from={from} to={to} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Fuel bought" value={formatGBP(spent)} hint={`${receipts?.length ?? 0} receipt${receipts?.length === 1 ? "" : "s"}`} />
        <StatCard label="VAT on the receipts" value={formatGBP(vatOnReceipts)} />
        <StatCard label="VAT you can reclaim" value={formatGBP(reclaimed)} tone="good" hint="Goes in Box 4 of the VAT return" />
        <StatCard
          label="Fuel scale charges"
          value={formatGBP(scaleVat)}
          tone={scaleVat > 0 ? "warn" : undefined}
          hint={scaleCharges.length ? `VAT due on ${scaleCharges.length} car${scaleCharges.length === 1 ? "" : "s"} — goes in Box 1` : "None — no cars on the scale charge"}
        />
      </div>

      {mixedScale ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            HMRC says that if you use the fuel scale charge, you must use it for <span className="font-medium">every</span> car whose fuel is used privately. Some of
            your privately-used cars are on the scale charge and some aren&apos;t — set them all the same way.
          </p>
        </div>
      ) : null}
      {noVatNumber ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {noVatNumber} receipt{noVatNumber === 1 ? " has" : "s have"} no VAT number, so no VAT is reclaimed on {noVatNumber === 1 ? "it" : "them"}. Ask the station for a VAT receipt.
        </p>
      ) : null}

      <VehiclesSection vehicles={vehicles} />
      <FuelReceiptForm orgId={org.orgId} today={today} vehicles={vehicles} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Station</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 text-right font-medium">Litres</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">VAT</th>
              <th className="px-4 py-3 text-right font-medium">Reclaimed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(receipts ?? []).map((r) => {
              const v = r.vehicles as unknown as { name: string; registration: string | null } | null;
              const link = r.receipt_path ? linkByPath.get(r.receipt_path) : null;
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{r.receipt_date}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900 dark:text-slate-50">{r.station}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.fuel_type ?? "Fuel"}
                      {r.station_vat_number ? ` · VAT ${r.station_vat_number}` : " · no VAT number"}
                      {link ? (
                        <>
                          {" · "}
                          <a href={link} target="_blank" rel="noreferrer" className="underline">
                            receipt
                          </a>
                        </>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{v ? `${v.name}${v.registration ? ` (${v.registration})` : ""}` : "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{r.litres ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">{formatGBP(r.total)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatGBP(r.vat_on_receipt)}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-50">
                    {formatGBP(r.vat_reclaimed)}
                    {r.reclaim_pct < 100 ? <span className="block text-xs text-slate-500">{r.reclaim_pct}%</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FuelReceiptDelete id={r.id} label={`${r.station} ${r.receipt_date}`} />
                  </td>
                </tr>
              );
            })}
            {!receipts?.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No fuel receipts in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Fuel VAT follows HMRC&apos;s VAT Notice 700/64. Scale charges use HMRC&apos;s table for 1 May 2026 – 30 April 2027. Each receipt also shows under Expenses as
        Fuel. Mileage tracking isn&apos;t included yet — if a vehicle reclaims a business share, keep mileage records to back it up.
      </p>
    </div>
  );
}
