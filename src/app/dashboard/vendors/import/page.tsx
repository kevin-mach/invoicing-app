"use client";

import { CsvImportForm } from "@/components/csv-import-form";
import type { ImportField } from "@/lib/csv/parse";
import { importVendors } from "./actions";

const fields: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "vendorname", "suppliername", "company", "businessname"] },
  { key: "contact", label: "Contact", aliases: ["contact", "contactperson", "contactinfo", "phone", "email"] },
  { key: "address", label: "Address", aliases: ["address", "streetaddress"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
];

export default function ImportVendorsPage() {
  return (
    <CsvImportForm
      title="Import suppliers"
      description="Upload a spreadsheet to add many suppliers at once."
      fields={fields}
      templateFilename="suppliers-template.csv"
      action={importVendors}
      listHref="/dashboard/vendors"
    />
  );
}
