"use client";

import { CsvImportForm } from "@/components/csv-import-form";
import type { ImportField } from "@/lib/csv/parse";
import { importVendors } from "./actions";

const fields: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "vendorname", "company", "businessname"] },
  { key: "contact", label: "Contact", aliases: ["contact", "contactperson", "contactinfo", "phone", "email"] },
  { key: "address", label: "Address", aliases: ["address", "streetaddress"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
];

export default function ImportVendorsPage() {
  return (
    <CsvImportForm
      title="Import vendors"
      description="Upload a spreadsheet to add many vendors at once."
      fields={fields}
      templateFilename="vendors-template.csv"
      action={importVendors}
      listHref="/dashboard/vendors"
    />
  );
}
