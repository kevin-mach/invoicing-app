"use client";

import { CsvImportForm } from "@/components/csv-import-form";
import type { ImportField } from "@/lib/csv/parse";
import { importCustomers } from "./actions";

const fields: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "customername", "company", "businessname"] },
  { key: "email", label: "Email", aliases: ["email", "emailaddress"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phonenumber", "tel", "telephone"] },
  { key: "address", label: "Address", aliases: ["address", "streetaddress"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
];

export default function ImportCustomersPage() {
  return (
    <CsvImportForm
      title="Import customers"
      description="Upload a spreadsheet to add many customers at once."
      fields={fields}
      templateFilename="customers-template.csv"
      action={importCustomers}
      listHref="/dashboard/customers"
    />
  );
}
