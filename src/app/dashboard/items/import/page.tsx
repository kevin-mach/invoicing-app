"use client";

import { CsvImportForm } from "@/components/csv-import-form";
import type { ImportField } from "@/lib/csv/parse";
import { importItems } from "./actions";

const fields: ImportField[] = [
  { key: "item_code", label: "Item code", aliases: ["itemcode", "sku", "code", "productcode"] },
  { key: "name", label: "Name", required: true, aliases: ["name", "itemname", "productname"] },
  { key: "description", label: "Description", aliases: ["description", "desc", "details"] },
  { key: "category", label: "Category", aliases: ["category", "type", "group"] },
  { key: "sale_price", label: "Sale price", aliases: ["saleprice", "price", "unitprice", "sellprice"] },
  { key: "stock_qty", label: "Stock qty", aliases: ["stockqty", "quantity", "qty", "stock", "onhand"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom", "unitofmeasure"] },
];

export default function ImportItemsPage() {
  return (
    <CsvImportForm
      title="Import items"
      description="Upload a spreadsheet to add many catalog items at once. Item codes are auto-assigned if left blank."
      fields={fields}
      templateFilename="items-template.csv"
      action={importItems}
      listHref="/dashboard/items"
    />
  );
}
