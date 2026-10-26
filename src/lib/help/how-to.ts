/** "How to use this page" guides, written so a 10-year-old could follow them. One entry per page,
 * found by the page's address (see findHowTo). Keep sentences short and words simple. */

export type HowTo = {
  title: string;
  /** What this page is, in a sentence or two. */
  what: string;
  /** When to come here. */
  when: string[];
  /** Step by step. */
  steps: string[];
  tip?: string;
};

const SCAN_TIP = "Short on time? Tap a \"Scan\" button and take a photo — the app reads it and fills things in for you. You always get to check it first.";

export const HOW_TO: Record<string, HowTo> = {
  /* ------------------------------- Home ------------------------------- */
  "/dashboard": {
    title: "Home",
    what: "This is your starting page. It shows how many customers, suppliers, items and draft invoices you have, and gives you shortcuts to the jobs you do most.",
    when: ["When you open the app and want to know where to begin.", "When you want to plan today's shopping or write a new invoice fast."],
    steps: ["Look at the numbers to see what you already have.", "Tap \"Plan a stock sheet\" to work out what to buy today.", "Tap \"New invoice\" to bill a customer.", "Use the menu on the left (or the ☰ button on a phone) to go anywhere else."],
    tip: "Every page has a box like this at the top. Tap it any time you forget what a page is for.",
  },

  /* ----------------------------- Customers ---------------------------- */
  "/dashboard/customers": {
    title: "Customers",
    what: "A customer is someone you sell to, like a restaurant or a shop. This page is your list of all of them.",
    when: ["When you want to find a customer or check their details.", "Before you can write an invoice, because every invoice needs a customer."],
    steps: ["Look through the list or search for a name.", "Tap a customer to see their details and invoices.", "Tap \"New customer\" to add someone new.", "Have a long list already? Use \"Import\" to add many at once."],
  },
  "/dashboard/customers/new": {
    title: "Add a customer",
    what: "Fill in a form to add a new customer to your list.",
    when: ["When you start selling to someone new."],
    steps: ["Type their name (this is the only thing you must fill in).", "Add an email, phone number and address if you have them.", "Tap Save. They are now ready to use on invoices."],
  },
  "/dashboard/customers/import": {
    title: "Import customers",
    what: "Add lots of customers in one go from a spreadsheet instead of typing them one by one.",
    when: ["When you already have a list of customers in Excel or a CSV file."],
    steps: ["Get your spreadsheet ready with a column for each thing (name, email, and so on).", "Choose the file here.", "Check the preview looks right.", "Tap Import."],
    tip: "Do a small file first to make sure it works.",
  },
  "/dashboard/customers/[id]": {
    title: "A customer",
    what: "Everything about one customer: their details, their invoices, and who from their team can log in.",
    when: ["When you need to change their details.", "When you want to give them (or their staff) a login so they can see their own invoices."],
    steps: ["Check or change the details and save.", "Look at the invoices below to see what they owe.", "Under \"Portal access\", type an email and send an invite so they can log in and see their invoices."],
  },

  /* ----------------------------- Suppliers ---------------------------- */
  "/dashboard/vendors": {
    title: "Suppliers",
    what: "A supplier is someone you buy from, like a wholesaler or a shop. This is your list of them.",
    when: ["When you want to find a supplier.", "Before you record a purchase, because every purchase needs a supplier."],
    steps: ["Look through the list or search.", "Tap a supplier to see their details and what you bought from them.", "Tap \"New supplier\" to add one.", "Scanned a receipt from a new shop? The app can add the shop here for you — it always asks first."],
  },
  "/dashboard/vendors/new": {
    title: "Add a supplier",
    what: "Fill in a form to add a new supplier.",
    when: ["When you start buying from a new place."],
    steps: ["Type their name (the only thing you must fill in).", "Add contact details and notes if you want.", "Tap Save."],
  },
  "/dashboard/vendors/import": {
    title: "Import suppliers",
    what: "Add many suppliers at once from a spreadsheet.",
    when: ["When you already have your suppliers in Excel or a CSV file."],
    steps: ["Get your spreadsheet ready.", "Choose the file here.", "Check the preview.", "Tap Import."],
  },
  "/dashboard/vendors/[id]": {
    title: "A supplier",
    what: "Everything about one supplier: details, what you bought, and who from their team can log in.",
    when: ["When you need to change their details.", "When you want to let them see your orders by giving them a login."],
    steps: ["Check or change the details and save.", "Look at the purchases to see what you bought.", "Under \"Portal access\", invite their team by email."],
  },

  /* ------------------------------- Items ------------------------------ */
  "/dashboard/items": {
    title: "Items",
    what: "Your catalogue: a list of everything you buy and sell, like chicken, tomatoes or olive oil. It also keeps how much of each you have in stock.",
    when: ["When you want to check a price or how much stock you have.", "When you want to add something new you sell or buy."],
    steps: ["Search for an item or scroll the list.", "Tap an item to change its price, unit or VAT.", "Tap \"New item\" to add one.", "Items are also added automatically when you scan a receipt — after you say yes."],
    tip: "VAT is a tax that gets added to some prices. Food is often 0%. Most other things are 20%.",
  },
  "/dashboard/items/new": {
    title: "Add an item",
    what: "Add something new to your catalogue.",
    when: ["When you start buying or selling something new."],
    steps: ["Type the name.", "Choose the unit (like kg, box or bottle).", "Type the price you sell it for and the VAT rate.", "Type how many you have right now, if you know.", "Tap Save."],
  },
  "/dashboard/items/import": {
    title: "Import items",
    what: "Add lots of items at once from a spreadsheet.",
    when: ["When you already have a price list in Excel or a CSV file."],
    steps: ["Get your spreadsheet ready.", "Choose the file here.", "Check the preview.", "Tap Import."],
  },
  "/dashboard/items/[id]": {
    title: "An item",
    what: "The details of one item: its name, price, unit, VAT and how many you have.",
    when: ["When a price changes.", "When you want to hide an item you no longer use."],
    steps: ["Change what you need.", "Untick \"Active\" to hide it from lists without deleting it.", "Tap Save."],
  },

  /* ------------------------------ Invoices ---------------------------- */
  "/dashboard/invoices": {
    title: "Invoices",
    what: "An invoice is a bill you send to a customer for what you sold them. This page lists them all and shows which ones are paid.",
    when: ["When you want to see who still owes you money.", "When you want to open, print or send an invoice."],
    steps: ["Looking for one? Type in the Search box: a customer's name, an invoice number, a date (like 19/10/2026 or October) or an amount. Use From and To to pick a range of dates, then tap Search.", "Want them in piles? Choose \"Group by\" Day, Month or Year. Each pile shows how many and the total, with a link to its full report.", "Look at the list. The status shows if it is draft, sent or paid.", "Tap one to open it.", "Tap \"New\" to make an invoice, or \"Daily report\" to see everything for one day."],
  },
  "/dashboard/invoices/new": {
    title: "New invoice",
    what: "Make a bill for a customer.",
    when: ["When you have delivered something and want to be paid."],
    steps: ["Pick the customer (or tap \"New customer\" to add one on the spot).", "Property company? Tap \"Scan an invoice\" to read a whole rent-style invoice (the customer, dates, fee, VAT, managed property, rent received and balance due), or fill in the Property details box yourself. The invoice then prints in the rent layout.", "Add the items they bought. You can type them, tap a suggestion, or tap \"Scan a photo\" of the order or delivery note.", "Check the quantities and prices.", "Tap Save. You can then print it, send it or share the PDF."],
    tip: SCAN_TIP,
  },
  "/dashboard/invoices/daily": {
    title: "Daily report",
    what: "Everything for one day on one page: what you sold, what you bought, what stock came in, what you spent, and how much was left over.",
    when: ["At the end of the day to see how it went.", "When your accountant asks what happened on a certain day."],
    steps: ["Choose the date and tap View.", "Read down the page: sales, then things bought, then stock that came in, then expenses.", "The last box shows what was left over after the costs.", "Tap Print or PDF to keep a copy."],
    tip: "Receipts you scanned show up here on their date, so the day's totals stay right.",
  },
  "/dashboard/invoices/[id]": {
    title: "An invoice",
    what: "One invoice. You can see it, change it, print it, send it and mark it paid.",
    when: ["When a customer asks for a copy.", "When they have paid and you want to record it."],
    steps: ["Check the lines and the total.", "Change anything that is wrong and save.", "Tap Print or PDF to share it.", "When they pay, record the payment so it shows as paid."],
  },

  /* ------------------------------- Quotes ----------------------------- */
  "/dashboard/quotes": {
    title: "Quotes",
    what: "A quote is a price offer you give someone before they buy. It says \"this is what it would cost\".",
    when: ["When someone asks \"how much would it be?\"."],
    steps: ["Looking for one? Type a name, a date (like 19/10/2026 or October) or an amount in the Search box. Use From and To to pick a range of dates, then tap Search.", "Want them in piles? Choose \"Group by\" Day, Month or Year. Each pile shows how many and the total.", "Look at your list of quotes.", "Tap one to open or print it.", "Tap \"New\" to make a quote."],
  },
  "/dashboard/quotes/new": {
    title: "New quote",
    what: "Build a price list for someone who might become a customer. They don't need to be in your customer list yet.",
    when: ["When you want to tell someone the price before they say yes."],
    steps: ["Type who it is for.", "Add the items and prices. Or tap \"Scan a photo\" of their list.", "Check the total.", "Tap Create quote, then print or share it."],
    tip: SCAN_TIP,
  },
  "/dashboard/quotes/[id]": {
    title: "A quote",
    what: "One quote you made earlier.",
    when: ["When the person comes back and says yes, or wants a change."],
    steps: ["Read it through.", "Change the items or prices and save.", "Print it or share the PDF."],
  },

  /* ----------------------------- Purchases ---------------------------- */
  "/dashboard/purchases": {
    title: "Purchases",
    what: "A purchase is something you bought from a supplier. This page lists everything you bought. Buying stock here also adds it to your stock list.",
    when: ["When you want to see what you bought and from whom.", "When a supplier sends you a bill."],
    steps: ["Looking for one? Type a supplier's name, a bill number, an item, a date (like 19/10/2026 or October) or an amount in the Search box. Use From and To to pick a range of dates, then tap Search.", "Want them in piles? Choose \"Group by\" Day, Month or Year. Each pile shows how many and the total, with a link to its full report.", "Look through the list.", "Tap one to see its items.", "Tap \"New\" to record a new purchase.", "\"Spend by category\" shows how much went on fish, veg, meat and so on. Lines take their category from the item, or else from the kind of supplier (a fishmonger's slip all counts as Fish & seafood)."],
  },
  "/dashboard/purchases/new": {
    title: "New purchase",
    what: "Write down something you bought from a supplier. The items you buy are added to your stock.",
    when: ["When a supplier gives you a bill or a delivery note."],
    steps: ["Pick the supplier, or tap \"New supplier\" to add one on the spot.", "Tap \"Scan with AI\" and take a photo (or choose a PDF) of the bill. Or type the items yourself. If the prices already include VAT (like a shop receipt), the scan takes the VAT out so it is not counted twice.", "Property company? The agent's property statement (managed property, rent received, expenses, balance due, rent dates) is read into its own box.", "Check the supplier, the bill number, the date and every item.", "Tap Save purchase."],
    tip: SCAN_TIP,
  },
  "/dashboard/purchases/[id]": {
    title: "A purchase",
    what: "One thing you bought: the supplier, the items, the prices and the VAT.",
    when: ["When you want to check a bill.", "When you have paid it and want to mark it paid."],
    steps: ["Read the items and the total.", "Mark it as reviewed once you have checked it.", "Delete it if it was a mistake (only the owner or an admin can)."],
  },

  /* ----------------------------- Recurring ---------------------------- */
  "/dashboard/templates": {
    title: "Recurring invoices",
    what: "Some customers buy the same things every week or month. A recurring template makes that invoice for you again and again, so you don't have to type it each time.",
    when: ["When a customer orders the same thing on a regular schedule."],
    steps: ["Look at your templates.", "Tap one to change it.", "Tap \"New template\" to set one up."],
  },
  "/dashboard/templates/new": {
    title: "New recurring invoice",
    what: "Set up an invoice that repeats by itself.",
    when: ["When the same customer buys the same things every week or month."],
    steps: ["Pick the customer.", "Choose how often (weekly or monthly) and when it starts.", "Add the items.", "Save. The app now makes a draft invoice on schedule."],
  },
  "/dashboard/templates/[id]": {
    title: "A recurring invoice",
    what: "One repeating invoice.",
    when: ["When the order changes, or you want to pause it."],
    steps: ["Change the items or the schedule.", "Switch it off to pause it.", "Save."],
  },

  /* --------------------------- Stock sheets / runs -------------------- */
  "/dashboard/runs": {
    title: "Stock sheets",
    what: "A stock sheet is your plan for one day's run: what customers need, what to buy, and where to go. Each one is for a single date.",
    when: ["At the start of the day to plan what to buy.", "At the end of the day to look at the report."],
    steps: ["Tap \"New stock sheet\" to start today's.", "Tap an old one to open it.", "Inside, add stops (suppliers to collect from and customers to deliver to)."],
  },
  "/dashboard/runs/new": {
    title: "New stock sheet",
    what: "Start a plan for a day.",
    when: ["When you begin planning a new day's run."],
    steps: ["Choose the date.", "Tap Create.", "Then add your stops on the next page."],
  },
  "/dashboard/runs/[id]": {
    title: "One day's stock sheet",
    what: "The plan for one day. It is made of stops. A stop is a place you collect from (a supplier) or deliver to (a customer).",
    when: ["When you are planning, or doing, the day's run."],
    steps: ["Pick \"Supplier\" or \"Customer\" and who it is, then tap \"Add stop\".", "Tap \"Checklist\" on a stop to list the items.", "Tap \"Stock count\" to build the order to send to suppliers.", "Tap \"Condensed report\" at the end of the day."],
  },
  "/dashboard/runs/[id]/checklist/[id]": {
    title: "Checklist for one stop",
    what: "The list of items for one stop. For a customer it becomes their invoice. For a supplier it becomes a purchase.",
    when: ["When you are loading up, delivering or collecting."],
    steps: ["Add items: search, tap a suggestion, or tap \"Scan a photo\" of the delivery note or the goods.", "Check the quantities and prices.", "Tap \"Save checklist\" (or turn on auto-save in Connections).", "Tap \"Create invoice\" or \"Create purchase\" when it is finished."],
    tip: "A saved checklist goes straight into the day's report.",
  },
  "/dashboard/runs/[id]/stock-sheet": {
    title: "Order list",
    what: "Work out what you need to buy today and from whom. It makes a sheet you can print, send as a PDF or open in Excel.",
    when: ["Before you go shopping or phone your suppliers."],
    steps: ["Tick the suppliers you are ordering from today.", "Add items: tap the quick buttons for what customers ordered, search, or tap \"Scan a photo of what's needed\".", "Check each row has a supplier.", "Tap Print, PDF or Export Excel."],
  },
  "/dashboard/runs/[id]/report": {
    title: "Condensed report",
    what: "The final report for the day: what customers ordered, what you picked up, and the money (what you spent, what you earned, what was left over).",
    when: ["At the end of the day."],
    steps: ["Switch between \"Customers\" and \"Suppliers\" to see each list.", "Scroll to the money box at the bottom: costs, expenses, sales and profit.", "Costs and expenses from scanned receipts on this date are included.", "Tap Print, Download PDF, Share or Export Excel."],
  },

  /* ------------------------------ Payments ---------------------------- */
  "/dashboard/payments": {
    title: "Payments (your plan)",
    what: "This page is about paying for this app: your plan, your card and the bills the app sends you.",
    when: ["When you want to change your plan.", "When you want to update your card or download a bill."],
    steps: ["See your current plan.", "Choose a different plan if you need to.", "Tap \"Payment method & invoices\" to update your card and see past bills."],
    tip: "This is not where your customers pay you. Those payments are on each invoice.",
  },

  /* ------------------------------- Reports ---------------------------- */
  "/dashboard/reports": {
    title: "Sales report",
    what: "See how much you sold over time. You can look at it by day, month or year, and by customer.",
    when: ["When you want to know which customers or days made the most money.", "When you want to compare one month with another."],
    steps: ["Choose the dates.", "Choose day, month or year.", "Pick one customer, or leave it on all.", "Read the table: money in, what it cost you, and what was left over.", "Tap any day, month or year in the table to open its full report: sales, things bought, stock that came in, expenses and every receipt."],
    tip: "Choose \"Monthly\" and tap a month to see everything for that whole month. Choose \"Yearly\" to see a whole year.",
  },
  "/dashboard/reports/period": {
    title: "Full report",
    what: "Everything that happened in one day, one month or one year, all on one page.",
    when: ["When you tapped a day, month or year on the Sales report and want the whole story.", "When your accountant asks what happened in a certain month."],
    steps: ["Read from the top: what you sold, what you bought, the stock that came in, and what you spent.", "Open the receipts list to see every single item that was on each receipt, with its price and VAT.", "The last box shows what was left over after the costs, and the VAT.", "Tap Print or PDF to keep a copy, or \"Back to the sales report\" to go back."],
  },

  /* ------------------------------- Stock ------------------------------ */
  "/dashboard/stock": {
    title: "Stock levels",
    what: "This shows how much of everything you have right now, and what it is worth.",
    when: ["When you want to know if you are running low.", "When you want to know the value of your stock."],
    steps: ["Look at the numbers at the top: stock value, items you track, items that have run out.", "Scroll the list to see how many of each you have.", "Stock goes up when you record a purchase or scan a receipt, and goes down when you log waste or do a count."],
  },
  "/dashboard/stock?tab=wastage": {
    title: "Wastage",
    what: "Wastage is food or things you throw away or lose, like food that went off. Writing it down shows where money is leaking out.",
    when: ["Every time something is thrown away, spoiled or lost."],
    steps: ["Pick the item.", "Type how much was wasted.", "Choose why (for example it went off or it was dropped).", "Tap Log wastage. Your stock goes down by that much."],
  },
  "/dashboard/stock?tab=counts": {
    title: "Stock counts",
    what: "A stock count is when you count what is really on the shelf and compare it with what the app thinks you have.",
    when: ["Once a week or once a month, to catch missing stock."],
    steps: ["Count each item on the shelf.", "Type the numbers in, or tap \"Scan everything you have\" and take a photo of the shelf or your list.", "Look at the Difference column: red means less than expected.", "Tick \"Update stock levels\" if you want the app to use your numbers, then tap Save count."],
    tip: SCAN_TIP,
  },

  /* ------------------------------ Cash-up ----------------------------- */
  "/dashboard/cash-up": {
    title: "Cash-up",
    what: "Cash-up is counting the money in the till at the end of the day and checking it matches what the till says you should have.",
    when: ["At closing time, every day you take cash."],
    steps: ["Type what the till system says you sold in cash and by card.", "Count the notes and coins and type them in — or tap \"Scan the till\" and take a photo.", "Look at the Variance box. Green is perfect. Amber or red means money is over or missing.", "Tap Save cash-up."],
    tip: "Saving again for the same day and till replaces the old one.",
  },

  /* -------------------------------- Team ------------------------------ */
  "/dashboard/team": {
    title: "Team",
    what: "The people who can log in to your business. You choose what each person is allowed to see.",
    when: ["When you hire someone new, or someone leaves."],
    steps: ["Type their email and choose a role.", "Tap Invite. They get an email with a link.", "To remove someone, use the button next to their name."],
    tip: "Owner and admin can change things. Bookkeeper can see the money pages. Staff do the daily jobs.",
  },

  /* ---------------------------- Bookkeeping --------------------------- */
  "/dashboard/bookkeeping": {
    title: "Bookkeeping overview",
    what: "A summary of the money side of your business for a period: what came in, what went out, what you owe and are owed.",
    when: ["When you want a quick health check of the business."],
    steps: ["Choose the dates at the top.", "Look at the cards: sales, costs, profit.", "Check any orange warning boxes — they are things to fix.", "Use the tabs above to go deeper."],
    tip: "Bookkeeping is just keeping a tidy record of money in and money out.",
  },
  "/dashboard/bookkeeping/bank": {
    title: "Bank",
    what: "Your bank's money movements, shown in a list. The app helps match each one to an invoice, a bill or an expense so nothing is missed.",
    when: ["When you want to check your bank against your records."],
    steps: ["Add your bank lines: tap \"Scan a statement photo\" and take a clear photo of each page, or tap \"Choose file\" for a CSV or Excel file, or connect your bank in Connections.", "After a scan you get a table of every line. Look for the green ticks: they mean the page adds up to the statement's own opening balance, closing balance and totals. An amber warning means a line may be missing or wrong, so check it.", "Tap Import. Scanning the same page twice is safe, because lines already on file are skipped.", "Look at each line. The app suggests a match.", "Accept the match, or pick the right invoice, bill or expense.", "Lines with nothing left to match are marked done."],
  },
  "/dashboard/bookkeeping/receivables": {
    title: "Money owed to you",
    what: "Customers who have not paid you yet, and how late each one is.",
    when: ["When you want to chase people who owe you money."],
    steps: ["Look at the ageing table: it groups what is owed by how old it is.", "Open an invoice from the list below.", "Record the payment when it arrives."],
  },
  "/dashboard/bookkeeping/payables": {
    title: "Money you owe",
    what: "Bills from suppliers that you have not paid yet.",
    when: ["When you want to know what to pay and when."],
    steps: ["Look at the bills, newest due first.", "Tap \"Mark paid\" when you pay one.", "Change the VAT on a bill with Edit if it is wrong."],
    tip: "Shop receipts you scan are already paid, so they do not appear here.",
  },
  "/dashboard/bookkeeping/bad-debts": {
    title: "Bad debts",
    what: "Two VAT rules about money unpaid for 6 months. If a customer never pays you, you can claim back the VAT you already paid on their invoice. If you never pay a supplier, you must give back the VAT you claimed on their bill.",
    when: ["Before each VAT return.", "When a customer hasn't paid for a long time."],
    steps: [
      "Look at \"Customers who haven't paid\". These invoices are 6 months past their due date.",
      "If you have given up on the money, tap \"Write off & claim VAT\". The unpaid amount shows as a cost in Profit & loss, and the VAT comes back to you on the VAT return.",
      "If the customer pays later, the invoice shows \"Pay it back\" — tap it so the VAT is paid back.",
      "Look at \"Bills you haven't paid\" and tap \"Pay VAT back\" for each. When you finally pay the bill, tap \"Reclaim VAT\".",
    ],
    tip: "\"Coming up\" shows invoices that will reach 6 months soon — a good time to chase them.",
  },
  "/dashboard/bookkeeping/credit-notes": {
    title: "Credit notes",
    what: "A credit note says money is owed back. \"From suppliers\" are ones suppliers give you — for returned goods, a refunded deposit (like gas cylinders) or a mistake on a bill. \"To customers\" are ones you give your customers, which you can print and send.",
    when: ["When a supplier gives or sends you a credit note.", "When you need to refund or credit a customer.", "When you want to check which credits you still haven't had back."],
    steps: [
      "Tap \"Scan a credit note\" and take a photo.",
      "Check the supplier, number, date, the invoice it is against, and each line.",
      "Tap Save credit note. It shows in the list as Open.",
      "When the supplier takes it off a bill or pays you back, open it and tap \"Taken off a bill\" or \"Refunded to me\".",
      "To credit a customer, tap \"To customers\", pick the customer and the invoice, tap \"Copy lines from the invoice\", keep only what you are crediting, and save. Print it to send them.",
      "Then tap \"Take off the invoice\" (they owe less) or \"Refunded to customer\" (you paid them back).",
    ],
    tip: "The photo is kept with the credit note, so you can always look at the paper copy again.",
  },
  "/dashboard/bookkeeping/fuel": {
    title: "Fuel",
    what: "Fuel receipts for the business's vehicles, and how much of their VAT you can claim back on your VAT return.",
    when: ["Every time someone fills up a business vehicle.", "Before doing the VAT return, to check the fuel VAT."],
    steps: [
      "First add your vehicles under Vehicles: pick the type (van, car…) and whether it is also used privately. That decides how much VAT can be claimed.",
      "Tap \"Scan a fuel receipt\" and take a photo of the receipt from the pump.",
      "Check the station, its VAT number, the total and the vehicle, then tap Save.",
      "The VAT you can claim goes into the VAT return automatically, and the receipt shows under Expenses as Fuel.",
    ],
    tip: "A receipt with no VAT number can't be used to claim VAT back — ask the station for a VAT receipt.",
  },
  "/dashboard/bookkeeping/categories": {
    title: "Categories",
    what: "The groups your products and purchases are sorted into. You can make your own, like Kitchenware or Cleaning materials.",
    when: ["When two different kinds of thing keep ending up in the same group.", "When you want spending split up your own way."],
    steps: [
      "Type a group name, like Cleaning materials.",
      "Add keywords, like bleach, caustic, detergent. Anything scanned with one of those words goes into the group by itself.",
      "Tap Add group. It now shows in every category list, on items, purchases and receipts.",
      "Rename or delete a group with Edit or Delete — items in it follow the rename.",
    ],
  },
  "/dashboard/bookkeeping/expenses": {
    title: "Expenses",
    what: "An expense is money you spent that is not stock for resale — fuel, cleaning stuff, phone bills, tools and so on. Scanned receipts live here too.",
    when: ["Every time you spend money on the business.", "When you have a shop receipt."],
    steps: ["Tap \"Scan a receipt\" and take a photo.", "Check the table that appears: each item, how many, the price, the VAT and the total.", "Tick \"Stock\" for food and ingredients so they go into your stock list.", "Tap Save receipt.", "Tap any row in the list below (or \"See items\") to open it and see every item, price and VAT.", "An old entry with no item list? Open it and tap \"Read the items from the receipt photo\" to rebuild it properly."],
    tip: "Things you tick as stock are saved as a purchase from the shop, so your profit counts them once. They show in green.",
  },
  "/dashboard/bookkeeping/pos": {
    title: "POS and sales",
    what: "POS means the till system you use to take payment. This page brings in your till's daily sales so they count in your records.",
    when: ["When you take sales through a till or card machine."],
    steps: ["Import your daily sales file, or connect Square in Connections.", "Check the totals for cash, card and other.", "These figures also fill in the Cash-up page for you."],
  },
  "/dashboard/bookkeeping/payroll": {
    title: "Payroll",
    what: "Payroll is paying your staff. This page records each pay run and what you paid.",
    when: ["Every time you pay your team."],
    steps: ["Start a new pay run for the period.", "Add each person and what they were paid.", "Save it. It is counted in your profit and loss."],
  },
  "/dashboard/bookkeeping/vat": {
    title: "VAT",
    what: "VAT is a tax added to many prices. Each period you tell the government how much VAT you charged and how much you paid. This page works those numbers out.",
    when: ["Before you send your VAT return."],
    steps: ["Choose the period (usually a quarter).", "Check your VAT number is filled in at the top.", "Read the numbered boxes — they match the boxes on the official form.", "Use Connections to send it to HMRC when you are ready."],
    tip: "Your invoices, bills, expenses and scanned receipts all feed this page automatically.",
  },
  "/dashboard/bookkeeping/reports": {
    title: "Reports",
    what: "A list of everything the business sold and bought on one day, in one month or in one year, with the VAT on each thing.",
    when: ["When you want to see a whole day, month or year in one place.", "When you need to check just the things with VAT, or just the things with no VAT.", "When you want to look at one kind of thing, like fish, vegetables or fuel."],
    steps: [
      "Tap Day, Month or Year. Use the arrows to move to the one before or after, or pick any date and tap Show.",
      "Tap With VAT or No VAT to flip between things that have VAT and things that don't. Tap All items to see everything.",
      "Tap Sales or Costs to see only money coming in or only money going out.",
      "Tap a category (like Fish & seafood or Fuel) to see only those things. Tap it again to see all of them.",
      "Read the cards at the top, and the totals at the bottom, for the sums of whatever you are looking at.",
      "Looking at a month or a year? Tap a day or a month in the list to open that one.",
    ],
    tip: "The totals change as you tap, so you can check 'how much VAT did we pay on fuel this month?' in two taps.",
  },
  "/dashboard/bookkeeping/pnl": {
    title: "Profit and loss",
    what: "Profit is what is left after you take away what things cost. This page shows it month by month.",
    when: ["When you want to know if the business is making money."],
    steps: ["Choose the dates.", "Read down: sales, then costs, then staff, then expenses, then profit.", "Compare months to spot good and bad ones."],
  },
  "/dashboard/bookkeeping/export": {
    title: "Accountant pack",
    what: "Download your records in files an accountant can open.",
    when: ["When your accountant asks for your books.", "At the end of the year."],
    steps: ["Choose the dates.", "Tap the download buttons for the files you need.", "Send them to your accountant."],
  },
  "/dashboard/bookkeeping/connections": {
    title: "Connections and AI scanning",
    what: "Connect the app to other services (your bank, your till, accounting software, HMRC). It also has the settings for photo scanning.",
    when: ["When you want your bank or till to feed in automatically.", "When you want scans to save by themselves."],
    steps: ["Tap Connect next to a service and follow the steps.", "Under \"AI photo scanning\", tick \"Save scanned photos automatically\" if you want scans to save without you pressing Save, then tap Save.", "If something says \"Not switched on for this server\", ask whoever looks after the app."],
    tip: "Even with auto-save on, the app always asks before adding a new supplier or item.",
  },

  /* --------------------------- Customer portal ------------------------ */
  "/customer-portal": {
    title: "Your home page",
    what: "This is your own page for seeing what you have bought and what you owe.",
    when: ["When you want a quick look at your account."],
    steps: ["Look at the numbers.", "Use the menu to see invoices, items, deliveries and more."],
  },
  "/customer-portal/invoices": {
    title: "Your invoices",
    what: "All the bills you have been sent.",
    when: ["When you want to see what you owe or pay a bill."],
    steps: ["Look at the list.", "Tap one to open it.", "Download or print the PDF."],
  },
  "/customer-portal/invoices/[id]": {
    title: "An invoice",
    what: "One bill, with every item and the total.",
    when: ["When you need to check or pay it."],
    steps: ["Check the items and the total.", "Tap Print or PDF to keep a copy."],
  },
  "/customer-portal/items": { title: "Items", what: "The things you can buy and their prices.", when: ["When you want to check a price."], steps: ["Search for an item.", "Read its price."] },
  "/customer-portal/deliveries": { title: "Deliveries", what: "What has been delivered to you and when.", when: ["When you want to check an order arrived."], steps: ["Choose a date.", "See what came on that day."] },
  "/customer-portal/recurring": { title: "Regular orders", what: "Orders that are made for you again and again on a schedule.", when: ["When you want to see what repeats."], steps: ["Look at the list.", "See what is in each one and when it happens."] },
  "/customer-portal/reports": { title: "Reports", what: "A summary of what you have bought over time.", when: ["When you want to see your spending."], steps: ["Choose the dates.", "Read the totals."] },
  "/customer-portal/team": {
    title: "Your team",
    what: "The people from your business who can log in here.",
    when: ["When a new person needs to see the invoices."],
    steps: ["Type their email and choose a role.", "Tap Invite.", "Remove people who have left."],
  },

  /* --------------------------- Supplier portal ------------------------ */
  "/supplier-portal": {
    title: "Your home page",
    what: "This is your own page for seeing the orders you have been given.",
    when: ["When you want a quick look at your account."],
    steps: ["Look at the numbers.", "Use the menu to see purchases, items, deliveries and more."],
  },
  "/supplier-portal/purchases": {
    title: "Orders",
    what: "All the orders placed with you.",
    when: ["When you want to know what to prepare."],
    steps: ["Look at the list.", "Tap one to see the items."],
  },
  "/supplier-portal/purchases/[id]": {
    title: "An order",
    what: "One order, with every item and quantity.",
    when: ["When you are getting an order ready."],
    steps: ["Read the items and quantities.", "Tap Print or PDF if you need a copy."],
  },
  "/supplier-portal/items": { title: "Items", what: "The things you supply and their prices.", when: ["When you want to check a price."], steps: ["Search for an item.", "Read its price."] },
  "/supplier-portal/deliveries": { title: "Deliveries", what: "What is due to be collected or delivered, and when.", when: ["When you are planning your day."], steps: ["Choose a date.", "See what is expected."] },
  "/supplier-portal/reports": { title: "Reports", what: "A summary of what has been ordered from you over time.", when: ["When you want to see how much you supply."], steps: ["Choose the dates.", "Read the totals."] },
  "/supplier-portal/team": {
    title: "Your team",
    what: "The people from your business who can log in here.",
    when: ["When a new person needs to see the orders."],
    steps: ["Type their email and choose a role.", "Tap Invite.", "Remove people who have left."],
  },
};

const ID_SEGMENT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/** Finds the guide for an address, treating any id in the path as "[id]". The Stock page has three
 * tabs chosen by `?tab=`. */
export function findHowTo(pathname: string, tab?: string | null): HowTo | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const key = clean
    .split("/")
    .map((seg) => (ID_SEGMENT.test(seg) ? "[id]" : seg))
    .join("/");
  if (key === "/dashboard/stock") {
    if (tab === "wastage") return HOW_TO["/dashboard/stock?tab=wastage"];
    if (tab === "counts") return HOW_TO["/dashboard/stock?tab=counts"];
  }
  return HOW_TO[key] ?? null;
}
