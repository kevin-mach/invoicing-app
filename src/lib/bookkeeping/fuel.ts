import { roundMoney } from "@/lib/format";

/** Fuel and VAT, following HMRC VAT Notice 700/64. Fuel is standard-rated, so the VAT in a pump
 * price is 1/6 of it. How much of that a business may reclaim depends on the vehicle:
 * - used only for business → all of it;
 * - a car also used privately → all of it plus a quarterly fuel scale charge (output VAT), or only
 *   the business share, or none (scale charges are for cars only, never vans);
 * - a van or other vehicle also used privately → the business share, or none.
 * Rates change: the scale charge table below is HMRC's for 1 May 2026 – 30 April 2027. */

export const VEHICLE_TYPES = ["Company van", "Company car", "Motorbike", "Lorry / HGV", "Minibus", "Other"] as const;
export const FUEL_TYPES = ["Diesel", "Petrol", "Hybrid", "Electric", "LPG"] as const;

export const VAT_METHODS = {
  full: "Reclaim all the VAT (business use only)",
  scale_charge: "Reclaim all the VAT and pay the fuel scale charge",
  business_share: "Reclaim only the business share",
  none: "Don't reclaim VAT on this vehicle's fuel",
} as const;
export type VatMethod = keyof typeof VAT_METHODS;

export function isVatMethod(v: unknown): v is VatMethod {
  return typeof v === "string" && v in VAT_METHODS;
}

/** The methods a vehicle may use. No private use → reclaim it all. Scale charges are for cars only. */
export function allowedVatMethods(vehicleType: string, privateUse: boolean): VatMethod[] {
  if (!privateUse) return ["full"];
  return vehicleType === "Company car" ? ["scale_charge", "business_share", "none"] : ["business_share", "none"];
}

/** HMRC road fuel scale charges, 1 May 2026 to 30 April 2027: VAT-inclusive charge and the VAT in it,
 * per 12 months, 3 months and 1 month, by CO2 band (g/km).
 * https://www.gov.uk/guidance/vat-road-fuel-scale-charges-from-1-may-2026-to-30-april-2027 */
export const SCALE_CHARGES_2026 = [
  { band: "120 or less", y: [657, 109.5], q: [163, 27.17], m: [54, 9] },
  { band: "125", y: [983, 163.83], q: [246, 41], m: [81, 13.5] },
  { band: "130", y: [1051, 175.17], q: [261, 43.5], m: [86, 14.33] },
  { band: "135", y: [1114, 185.67], q: [278, 46.33], m: [92, 15.33] },
  { band: "140", y: [1182, 197], q: [294, 49], m: [98, 16.33] },
  { band: "145", y: [1245, 207.5], q: [311, 51.83], m: [103, 17.17] },
  { band: "150", y: [1314, 219], q: [328, 54.67], m: [109, 18.17] },
  { band: "155", y: [1377, 229.5], q: [344, 57.33], m: [114, 19] },
  { band: "160", y: [1445, 240.83], q: [361, 60.17], m: [119, 19.83] },
  { band: "165", y: [1508, 251.33], q: [377, 62.83], m: [125, 20.83] },
  { band: "170", y: [1576, 262.67], q: [393, 65.5], m: [130, 21.67] },
  { band: "175", y: [1640, 273.33], q: [409, 68.17], m: [136, 22.67] },
  { band: "180", y: [1708, 284.67], q: [426, 71], m: [142, 23.67] },
  { band: "185", y: [1771, 295.17], q: [442, 73.67], m: [146, 24.33] },
  { band: "190", y: [1839, 306.5], q: [459, 76.5], m: [152, 25.33] },
  { band: "195", y: [1902, 317], q: [475, 79.17], m: [158, 26.33] },
  { band: "200", y: [1971, 328.5], q: [492, 82], m: [163, 27.17] },
  { band: "205", y: [2034, 339], q: [509, 84.83], m: [169, 28.17] },
  { band: "210", y: [2102, 350.33], q: [524, 87.33], m: [174, 29] },
  { band: "215", y: [2165, 360.83], q: [541, 90.17], m: [180, 30] },
  { band: "220", y: [2233, 372.17], q: [557, 92.83], m: [185, 30.83] },
  { band: "225 or more", y: [2297, 382.83], q: [574, 95.67], m: [190, 31.67] },
] as const;
export const CO2_BANDS: readonly string[] = SCALE_CHARGES_2026.map((r) => r.band);

/** Whole calendar months a period covers (a VAT quarter is 3). */
function monthsIn(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm) + 1);
}

/** The scale charge for one car over a VAT period: the gross charge and the output VAT in it. Uses
 * HMRC's annual, quarterly or monthly figure to match the period's length. */
export function scaleChargeFor(co2Band: string | null, from: string, to: string): { charge: number; vat: number } | null {
  const row = SCALE_CHARGES_2026.find((r) => r.band === co2Band);
  if (!row) return null;
  const months = monthsIn(from, to);
  const [charge, vat] = months === 12 ? row.y : months % 3 === 0 ? [row.q[0] * (months / 3), row.q[1] * (months / 3)] : [row.m[0] * months, row.m[1] * months];
  return { charge: roundMoney(charge), vat: roundMoney(vat) };
}

export type VehicleVatInfo = { vat_method: string; business_share_pct: number | null };

/** The share (0–100) of a fuel receipt's VAT this vehicle may reclaim. */
export function reclaimPctFor(vehicle: VehicleVatInfo | null): number {
  if (!vehicle) return 100;
  if (vehicle.vat_method === "none") return 0;
  if (vehicle.vat_method === "business_share") return Math.min(100, Math.max(0, Number(vehicle.business_share_pct) || 0));
  return 100;
}

/** The VAT in a VAT-inclusive pump price at 20%. */
export function vatInFuel(total: number): number {
  return roundMoney(total / 6);
}
