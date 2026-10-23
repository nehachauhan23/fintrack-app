const NOISE = new Set([
  "upi", "pos", "ach", "debit", "credit", "card", "purchase", "payment", "txn", "transaction", "ref", "no",
  "www", "com", "in", "net", "online", "pvt", "ltd", "inc", "llc", "the", "to", "from", "via", "imps", "neft", "atm",
]);

/** Collapses a bank-statement description into a stable key: "POS 4421 STARBUCKS #1032 NYC" → "starbucks nyc". */
export function normalizeMerchant(text: string): string {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9&\s.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !/\d{3,}/.test(t) && !NOISE.has(t));
  return tokens.slice(0, 3).join(" ").trim();
}

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  food: ["swiggy", "zomato", "restaurant", "cafe", "coffee", "starbucks", "mcdonald", "pizza", "domino", "kfc", "burger", "bakery", "doordash", "ubereats", "grubhub", "diner"],
  groceries: ["grocery", "supermarket", "bigbasket", "blinkit", "zepto", "walmart", "costco", "kroger", "whole foods", "dmart", "instamart", "aldi", "tesco", "trader joe"],
  transportation: ["uber", "ola cabs", "lyft", "metro", "fuel", "petrol", "diesel", "gas station", "shell", "parking", "irctc", "railway", "toll", "taxi"],
  utilities: ["electricity", "water bill", "broadband", "internet", "airtel", "jio", "vodafone", "verizon", "comcast", "phone bill", "gas bill", "power bill"],
  entertainment: ["netflix", "spotify", "hotstar", "prime video", "cinema", "movie", "pvr", "steam", "youtube", "disney", "hulu", "playstation", "xbox"],
  shopping: ["amazon", "flipkart", "myntra", "ikea", "nike", "zara", "h&m", "ebay", "etsy", "target"],
  healthcare: ["pharmacy", "apollo", "hospital", "clinic", "dental", "medplus", "cvs", "doctor", "diagnostic", "walgreens"],
  education: ["udemy", "coursera", "tuition", "school", "college", "university", "bookstore", "edx"],
  travel: ["airlines", "airbnb", "booking.com", "makemytrip", "hotel", "indigo", "flight", "expedia", "hostel"],
  housing: ["rent", "mortgage", "landlord", "society maintenance", "property tax"],
  insurance: ["insurance", "lic premium", "premium"],
  personal: ["salon", "gym", "spa", "barber", "fitness"],
  bills: ["bank fee", "service charge", "late fee", "penalty", "overdraft"],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
  salary: ["salary", "payroll", "stipend", "wages"],
  freelance: ["freelance", "client payment", "invoice"],
  investments: ["dividend", "interest credit", "mutual fund", "redemption", "interest paid"],
  rental: ["rent received", "rental income", "tenant"],
};

/** Deterministic first-pass categorisation; returns null when nothing matches (the caller may then ask the AI). */
export function guessCategory(text: string, type: "INCOME" | "EXPENSE"): string | null {
  const hay = text.toLowerCase();
  const table = type === "INCOME" ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
  for (const [category, words] of Object.entries(table)) {
    if (words.some((w) => hay.includes(w))) return category;
  }
  return null;
}
