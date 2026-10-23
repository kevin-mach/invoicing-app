"use client";

import { useState } from "react";
import { formatGBP } from "@/lib/format";
import { btnPrimary, btnSecondary, FormNote, inputClass as sharedInputClass, type FormStatus } from "@/components/bookkeeping/ui";
import type { PushPlan } from "@/lib/integrations/accounting";
import type { ClientFingerprint, Obligation } from "@/lib/integrations/hmrc";
import {
  disconnectProvider,
  loadBankAccounts,
  loadObligations,
  prepareReturn,
  previewPush,
  pushDocuments,
  saveProviderSettings,
  saveVrn,
  setBankAccountEnabled,
  submitReturn,
  syncNow,
} from "./actions";
import { updateAutoSaveScans, updateBusinessType } from "../actions";

// Connections uses a compact single-line input (unlike the taller block-level form fields
// elsewhere), so it keeps its own size but pulls the colours from the shared kit.
const input = `${sharedInputClass.replace("mt-1 w-full", "").trim()}`;
const btn = btnSecondary;

function Note({ note }: { note: FormStatus }) {
  return <FormNote note={note} />;
}

export function ProviderActions({
  provider,
  connected,
  syncable,
  canManage,
}: {
  provider: string;
  connected: boolean;
  syncable: boolean;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);
  if (!canManage) return <p className="text-sm text-slate-500">Only the account owner can manage this.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* A plain link: the OAuth flow is a full-page redirect to the provider and back. */}
        <a href={`/api/integrations/${provider}/connect`} className={connected ? btn : btnPrimary}>
          {connected ? "Reconnect" : "Connect"}
        </a>
        {connected && syncable ? (
          <button
            type="button"
            disabled={busy}
            className={btn}
            onClick={async () => {
              setBusy(true);
              setNote(null);
              const r = await syncNow(provider);
              setBusy(false);
              setNote(r.error ? { ok: false, text: r.error } : { ok: true, text: r.message ?? "Synced." });
            }}
          >
            {busy ? "Syncing..." : "Sync now"}
          </button>
        ) : null}
        {connected ? (
          <button
            type="button"
            disabled={busy}
            className={btn}
            onClick={async () => {
              if (!confirm("Disconnect? Stored access is deleted; data already imported stays.")) return;
              setBusy(true);
              const r = await disconnectProvider(provider);
              setBusy(false);
              if (r.error) setNote({ ok: false, text: r.error });
            }}
          >
            Disconnect
          </button>
        ) : null}
      </div>
      <Note note={note} />
    </div>
  );
}

export function BankAccounts() {
  const [accounts, setAccounts] = useState<{ id: string; name: string; enabled: boolean }[] | null>(null);
  const [note, setNote] = useState<FormStatus>(null);
  return (
    <div className="mt-3">
      {!accounts ? (
        <button
          type="button"
          className={btn}
          onClick={async () => {
            const r = await loadBankAccounts();
            if (r.error) setNote({ ok: false, text: r.error });
            else setAccounts(r.accounts ?? []);
          }}
        >
          Choose accounts to import
        </button>
      ) : (
        <ul className="space-y-1.5">
          {accounts.map((a) => (
            <li key={a.id}>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={a.enabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    setAccounts((list) => list?.map((x) => (x.id === a.id ? { ...x, enabled } : x)) ?? null);
                    const r = await setBankAccountEnabled(a.id, enabled);
                    if (r.error) setNote({ ok: false, text: r.error });
                  }}
                />
                {a.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <Note note={note} />
    </div>
  );
}

export function AccountingPanel({ provider, settings }: { provider: "xero" | "quickbooks"; settings: Record<string, string> }) {
  const [plan, setPlan] = useState<PushPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);
  const [sales, setSales] = useState(settings.xeroSalesAccount ?? "");
  const [purchase, setPurchase] = useState(settings.xeroPurchaseAccount ?? "");

  return (
    <div className="mt-3 space-y-3">
      {provider === "xero" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-400">
            Sales account code
            <input value={sales} onChange={(e) => setSales(e.target.value)} placeholder="200" className={`${input} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-400">
            Purchases account code
            <input value={purchase} onChange={(e) => setPurchase(e.target.value)} placeholder="310" className={`${input} mt-1 block w-28`} />
          </label>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              const r = await saveProviderSettings("xero", { xeroSalesAccount: sales, xeroPurchaseAccount: purchase });
              setNote(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved." });
            }}
          >
            Save codes
          </button>
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        className={btn}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          const r = await previewPush(provider);
          setBusy(false);
          if (r.error) setNote({ ok: false, text: r.error });
          else setPlan(r.plan ?? null);
        }}
      >
        {busy ? "Checking..." : "Preview what will be sent"}
      </button>

      {plan ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="font-medium text-slate-900 dark:text-slate-50">
            {plan.ready.length} ready to send{plan.remaining ? ` (+${plan.remaining} more next time)` : ""}
            {plan.blocked.length ? ` · ${plan.blocked.length} held back` : ""}
          </p>
          {plan.ready.length ? (
            <ul className="max-h-48 space-y-1 overflow-auto text-slate-600 dark:text-slate-400">
              {plan.ready.map((d) => (
                <li key={`${d.kind}:${d.id}`}>
                  {d.kind === "invoice" ? "Invoice" : "Bill"} {d.number} · {d.party} · {d.date} · {formatGBP(d.net + d.vat)}
                </li>
              ))}
            </ul>
          ) : null}
          {plan.blocked.length ? (
            <details>
              <summary className="cursor-pointer text-amber-700 dark:text-amber-400">Why {plan.blocked.length} are held back</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-slate-600 dark:text-slate-400">
                {plan.blocked.map((d) => (
                  <li key={`${d.kind}:${d.id}`}>
                    {d.kind === "invoice" ? "Invoice" : "Bill"} {d.number}: {d.blocked}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {plan.ready.length ? (
            <button
              type="button"
              disabled={busy}
              className={btnPrimary}
              onClick={async () => {
                if (!confirm(`Send ${plan.ready.length} document${plan.ready.length === 1 ? "" : "s"} to ${provider === "xero" ? "Xero" : "QuickBooks"}? They're created as approved, not draft.`)) return;
                setBusy(true);
                const r = await pushDocuments(provider);
                setBusy(false);
                if (r.error) return setNote({ ok: false, text: r.error });
                const res = r.result!;
                setNote({
                  ok: res.failed.length === 0,
                  text: `Sent ${res.pushed}.${res.failed.length ? ` ${res.failed.length} failed — ${res.failed[0].number}: ${res.failed[0].reason}` : ""}`,
                });
                setPlan(null);
              }}
            >
              Send {plan.ready.length}
            </button>
          ) : null}
        </div>
      ) : null}
      <Note note={note} />
    </div>
  );
}

function collectFingerprint(): ClientFingerprint {
  let deviceId = "";
  try {
    deviceId = localStorage.getItem("gov-device-id") ?? "";
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("gov-device-id", deviceId);
    }
  } catch {
    deviceId = crypto.randomUUID();
  }
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  return {
    deviceId,
    userAgent: navigator.userAgent,
    timezone: `UTC${sign}${hh}:${mm}`,
    screen: `width=${screen.width}&height=${screen.height}&scaling-factor=${window.devicePixelRatio || 1}&colour-depth=${screen.colorDepth}`,
    window: `width=${window.innerWidth}&height=${window.innerHeight}`,
  };
}

type Prepared = { payload: Record<string, number | string | boolean>; start: string; end: string; unaddedVat: number };

export function HmrcPanel({ vrn: initialVrn, environment }: { vrn: string; environment: "sandbox" | "production" }) {
  const [vrn, setVrn] = useState(initialVrn);
  const [obligations, setObligations] = useState<Obligation[] | null>(null);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [declared, setDeclared] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const load = async () => {
    setBusy(true);
    setNote(null);
    const r = await loadObligations(collectFingerprint());
    setBusy(false);
    if (r.error) return setNote({ ok: false, text: r.error });
    setObligations(r.obligations ?? []);
    setSubmitted(r.submitted ?? []);
  };

  const num = (k: string) => Number(prepared?.payload[k] ?? 0);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-600 dark:text-slate-400">
          VAT registration number
          <input value={vrn} onChange={(e) => setVrn(e.target.value)} placeholder="123456789" className={`${input} mt-1 block w-44`} />
        </label>
        <button
          type="button"
          className={btn}
          onClick={async () => {
            const r = await saveVrn(vrn);
            setNote(r.error ? { ok: false, text: r.error } : { ok: true, text: "VAT number saved." });
          }}
        >
          Save
        </button>
        <button type="button" disabled={busy} className={btnPrimary} onClick={load}>
          {busy ? "Asking HMRC..." : "Load VAT obligations"}
        </button>
      </div>
      {environment === "sandbox" ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">Sandbox: returns go to HMRC&apos;s test service and have no legal effect.</p>
      ) : null}

      {obligations ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {obligations.map((o) => {
                const done = o.status === "F" || submitted.includes(o.periodKey);
                return (
                  <tr key={o.periodKey} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-50">
                      {o.start} → {o.end}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{o.due}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{done ? "Filed" : "Open"}</td>
                    <td className="px-3 py-2 text-right">
                      {!done ? (
                        <button
                          type="button"
                          className={btn}
                          onClick={async () => {
                            setNote(null);
                            setDeclared(false);
                            setConfirmText("");
                            const r = await prepareReturn(collectFingerprint(), o.periodKey);
                            if (r.error) return setNote({ ok: false, text: r.error });
                            setPrepared({ payload: r.payload as Prepared["payload"], start: r.start!, end: r.end!, unaddedVat: r.unaddedVat ?? 0 });
                          }}
                        >
                          Prepare return
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!obligations.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                    HMRC returned no obligations for the last 12 months.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {prepared ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="font-medium text-slate-900 dark:text-slate-50">
            VAT return {prepared.start} → {prepared.end}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ["1 VAT due on sales", formatGBP(num("vatDueSales"))],
              ["2 VAT due on acquisitions", formatGBP(0)],
              ["3 Total VAT due", formatGBP(num("totalVatDue"))],
              ["4 VAT reclaimed", formatGBP(num("vatReclaimedCurrPeriod"))],
              ["5 Net VAT", formatGBP(num("netVatDue"))],
              ["6 Sales ex VAT", `£${num("totalValueSalesExVAT")}`],
              ["7 Purchases ex VAT", `£${num("totalValuePurchasesExVAT")}`],
              ["8 / 9 EU supplies", "£0"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-50">{v}</dd>
              </div>
            ))}
          </dl>
          {prepared.unaddedVat > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {prepared.unaddedVat} invoice{prepared.unaddedVat === 1 ? "" : "s"} in this period show VAT but don&apos;t add it to the total. Box 1 still counts that VAT as owed. Check this is right before filing.
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="mt-1" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
            When I submit this VAT information I am making a legal declaration that the information is true and complete. A false declaration can result in prosecution.
          </label>
          {environment === "production" ? (
            <label className="block text-sm text-slate-700 dark:text-slate-300">
              This is a live filing. Type SUBMIT to confirm:
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`${input} ml-2 w-32`} />
            </label>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !declared}
              className={btnPrimary}
              onClick={async () => {
                setBusy(true);
                const expected = Object.fromEntries(
                  Object.entries(prepared.payload).filter((e): e is [string, number] => typeof e[1] === "number")
                );
                const r = await submitReturn(collectFingerprint(), {
                  periodKey: String(prepared.payload.periodKey),
                  declared,
                  confirmText,
                  expected,
                });
                setBusy(false);
                if (r.error) return setNote({ ok: false, text: r.error });
                setNote({ ok: true, text: `Submitted. HMRC receipt ${r.receipt?.formBundleNumber ?? "(none returned)"}.` });
                setSubmitted((s) => [...s, String(prepared.payload.periodKey)]);
                setPrepared(null);
              }}
            >
              {busy ? "Submitting..." : "Submit to HMRC"}
            </button>
            <button type="button" className={btn} onClick={() => setPrepared(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <Note note={note} />
    </div>
  );
}

export function AutoSaveScanToggle({ autoSaveScans, canEdit }: { autoSaveScans: boolean; canEdit: boolean }) {
  const [on, setOn] = useState(autoSaveScans);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const save = async () => {
    setBusy(true);
    setNote(null);
    const result = await updateAutoSaveScans({ autoSaveScans: on });
    setBusy(false);
    if (result.error) {
      setNote({ ok: false, text: result.error });
      return;
    }
    setNote({
      ok: true,
      text: on
        ? "On — a scan now saves itself once the photo gives everything needed."
        : "Off — every scan waits for someone to check it and press Save.",
    });
  };

  return (
    <div className="mt-3">
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => setOn(e.target.checked)} className="mt-1" />
        <span className="text-sm">
          <span className="font-medium text-slate-900 dark:text-slate-50">Save scanned photos automatically</span>
          <span className="block text-slate-500 dark:text-slate-400">
            Off (the default): every scan fills in the form and waits for someone to check it and press Save. On: a
            scan saves itself the moment the photo gives everything that save needs — expenses, cash-ups, purchases,
            stock counts, invoices, quotes and checklists (which feed the run report). Anything the photo mentions
            that isn&apos;t in your database yet (a new item or supplier) is never added without asking you first, and
            a blurry photo, an unknown price or a skipped item always stops for a person to check — whichever way
            this is set.
          </span>
        </span>
      </label>
      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={busy} onClick={save} className={btnPrimary}>
            {busy ? "Saving..." : "Save"}
          </button>
          <Note note={note} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Only the owner or an admin can change this.</p>
      )}
    </div>
  );
}

export function BusinessTypeSetting({ businessType, canEdit }: { businessType: "standard" | "property"; canEdit: boolean }) {
  const [value, setValue] = useState(businessType);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<FormStatus>(null);

  const save = async () => {
    setBusy(true);
    setNote(null);
    const result = await updateBusinessType({ businessType: value });
    setBusy(false);
    setNote(result.error ? { ok: false, text: result.error } : { ok: true, text: "Saved." });
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Type of business</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Choose <em>Property investment</em> and invoices and purchases get a property section: the managed property, rent received, balance due and the
        rent dates. Every other business keeps the standard invoice.
      </p>
      <select
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value as "standard" | "property")}
        className="mt-2 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
      >
        <option value="standard">Standard business (food, retail, services)</option>
        <option value="property">Property investment company</option>
      </select>
      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={busy || value === businessType} onClick={save} className={btnPrimary}>
            {busy ? "Saving..." : "Save"}
          </button>
          <Note note={note} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Only the owner or an admin can change this.</p>
      )}
    </div>
  );
}
