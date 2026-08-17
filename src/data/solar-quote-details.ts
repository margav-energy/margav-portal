import { INSTALL_STATUS_STYLES } from "@/lib/status-colors";
import type { Quote } from "@/types/quote";
import type { SolarArray, SolarQuoteDetail } from "@/types/solar-quote";
import type { LineItem, QuoteHistoryEntry, QuoteNote } from "@/types/quote-detail-shared";

/**
 * The 14 original mock quotes only ever carried the bare-bones `Quote`
 * fields (name, postcode, amount, dates, ...) — none of the rich solar
 * breakdown data the boiler quotes have. Rather than hand-author 14
 * one-off records, this derives a full, internally-consistent
 * `SolarQuoteDetail` from each quote's existing fields, so every quote
 * gets a real-looking detail page and new quotes keep working
 * automatically. Uses the same "sum of character codes → pick from a
 * small array" hashing technique already used for visual variety
 * elsewhere (`accentForName` in `InitialsAvatar.tsx` / `ActivityAvatar.tsx`)
 * so results are deterministic but vary between quotes.
 */

function hashString(value: string): number {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}

function pick<T>(options: readonly T[], hash: number, salt = 0): T {
  return options[(hash + salt) % options.length];
}

const REP_ROSTER = ["Damon Clarke", "Lucy Starkey", "Kiefer Phillips", "Jordan Reeves"];
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.co.uk", "icloud.com"];
const OCCUPANCY_ARCHETYPES = ["In half of day", "Home all day", "Out during the day", "Shift work"];
const ESTIMATED_REASONS_NO_BILL = [
  "Could not obtain a bill from my supplier",
  "New tenancy, no bill received yet",
  "Smart meter not yet linked to supplier portal",
];
const ORIENTATIONS = ["40° South", "35° South East", "45° South West", "30° South"];

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".");
}

function phoneFor(hash: number): string {
  const digits = String(100000000 + ((hash * 9973) % 900000000));
  return `07${digits}`;
}

function mpanFor(hash: number): string {
  if (hash % 3 === 0) return "Provided in Email";
  const digits = String(1000000000000 + ((hash * 7919) % 9000000000000));
  return digits.slice(0, 13);
}

function statusLabelFor(quote: Quote): string {
  if (quote.stage === "sent_to_sign") return "Sent to Customer";
  if (quote.installStatus) return INSTALL_STATUS_STYLES[quote.installStatus].label;
  return "Signed";
}

function referenceFor(quote: Quote, hash: number): string {
  const digits = (quote.id.match(/\d+/)?.[0] ?? "0").padStart(4, "0");
  const suffix = String(1000 + (hash % 9000));
  return `COM${digits}-${suffix}-SB${suffix}`;
}

function buildNote(quote: Quote, rep: string, hash: number): QuoteNote[] {
  const templates = [
    `Customer keen to reduce reliance on grid electricity, particularly with rising unit rates. Confirmed occupancy pattern and roof access on site. Talked through system sizing and payback expectations.`,
    `Good south-facing roof aspect with minimal shading. Discussed battery storage options and self-consumption benefits. Customer keen to proceed once finance is confirmed.`,
    `Customer works from home so daytime consumption is high — good fit for solar. Walked through the pitch/shade survey findings and confirmed the quoted system size.`,
    `Existing supplier has increased rates twice this year, driving interest in solar. Confirmed roof condition and no known asbestos or spray foam. Keen to move ahead quickly.`,
  ];
  return [
    {
      id: `${quote.id}-note-1`,
      authorName: rep,
      authorInitials: rep
        .split(" ")
        .map((part) => part[0])
        .join(""),
      timestamp: `${quote.sentDate}T${String(10 + (hash % 8)).padStart(2, "0")}:${String((hash % 6) * 10).padStart(2, "0")}:00`,
      body: pick(templates, hash),
    },
  ];
}

function buildHistory(quote: Quote, rep: string): QuoteHistoryEntry[] {
  const entries: QuoteHistoryEntry[] = [
    {
      id: `${quote.id}-h-1`,
      actorName: "System",
      isSystem: true,
      description: "Changed the quote status to Sent to Customer",
      timestamp: `${quote.sentDate}T17:30:00`,
    },
    {
      id: `${quote.id}-h-2`,
      actorName: rep,
      description: "Updated the solar array configuration on the order",
      timestamp: `${quote.sentDate}T17:15:00`,
    },
  ];

  if (quote.stage === "signed" && quote.signedDate) {
    entries.unshift({
      id: `${quote.id}-h-0`,
      actorName: "System",
      isSystem: true,
      description: "Changed the quote status to signed",
      timestamp: `${quote.signedDate}T11:00:00`,
    });
    entries.splice(1, 0, {
      id: `${quote.id}-h-0b`,
      actorName: "System",
      isSystem: true,
      description: "The contract proposal has been accessed by the customer or sales representative",
      timestamp: `${quote.signedDate}T09:45:00`,
    });
  }

  return entries;
}

export function buildSolarQuoteDetail(quote: Quote): SolarQuoteDetail {
  const hash = hashString(quote.id);
  // Prefer the rep already assigned in the quotes list, so the list's
  // Representative column and this detail page always agree.
  const rep = quote.representative ?? pick(REP_ROSTER, hash);
  const [firstName, ...rest] = quote.customerName.split(" ");
  const lastName = rest.join(" ") || firstName;

  // Panels/system sizing derived from the quote's existing amount, so the
  // list and detail page always agree on price.
  const panels = Math.max(8, Math.min(24, Math.round(quote.amount / 550)));
  const batteries = hash % 3;
  const systemSizeKw = Number((panels * 0.485).toFixed(2));
  const genY1Kwh = systemSizeKw * 950;
  const savingY1 = Math.round(quote.amount * (0.11 + (hash % 5) / 100));
  const lifetimeSaving = savingY1 * (18 + (hash % 8));
  const profit = Math.round(quote.amount * (0.25 + (hash % 16) / 100));
  const roiPercent = Math.round((lifetimeSaving / quote.amount) * 100);
  const gridIndependencePercent = 70 + (hash % 26);
  const paybackYears = Math.min(25, Math.max(5, Math.round(quote.amount / savingY1)));

  const extras: LineItem[] = hash % 4 === 0 ? [{ id: `${quote.id}-extra-1`, name: "Extra half installation day", quantity: 1, unitPrice: 725 }] : [];
  const standardAdditionals: LineItem[] = [];
  const freeTextExtras = hash % 5 === 0 ? [{ id: `${quote.id}-free-text-1`, description: "hand railing", quantity: 4, unitPrice: 25 }] : [];

  const extrasTotal = extras.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const additionalsTotal = standardAdditionals.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const freeTextTotal = freeTextExtras.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // The panel array absorbs whatever's left so the pricing breakdown always
  // reconciles exactly with the quote's listed `amount`.
  const arrayBudget = quote.amount - extrasTotal - additionalsTotal - freeTextTotal;
  const secondArrayPanels = panels > 12 ? Math.floor(panels / 3) : 0;
  const firstArrayPanels = panels - secondArrayPanels;
  const perPanelPrice = Number((arrayBudget / panels).toFixed(2));

  const solarArrays: SolarArray[] = [
    {
      id: `${quote.id}-array-1`,
      label: "Solar Array #1",
      shadeFactor: Number((0.85 + (hash % 15) / 100).toFixed(2)),
      orientation: pick(ORIENTATIONS, hash),
      pitchDegrees: 30 + (hash % 16),
      items: [
        { id: `${quote.id}-array-1-item`, name: "AIKO Neostar 3S 485w", quantity: firstArrayPanels, unitPrice: perPanelPrice },
      ],
    },
  ];
  if (secondArrayPanels > 0) {
    solarArrays.push({
      id: `${quote.id}-array-2`,
      label: "Solar Array #2",
      shadeFactor: Number((0.85 + (hash % 12) / 100).toFixed(2)),
      orientation: pick(ORIENTATIONS, hash, 1),
      pitchDegrees: 30 + (hash % 12),
      items: [
        { id: `${quote.id}-array-2-item`, name: "AIKO Neostar 3S 485w", quantity: secondArrayPanels, unitPrice: perPanelPrice },
      ],
    });
  }

  const pricingBreakdown: LineItem[] = [
    { id: `${quote.id}-pricing-array`, name: "Solar array + install", quantity: 1, unitPrice: arrayBudget },
    ...(extras.length > 0 ? [{ id: `${quote.id}-pricing-extras`, name: "Extras", quantity: 1, unitPrice: extrasTotal }] : []),
    ...(freeTextExtras.length > 0
      ? [{ id: `${quote.id}-pricing-free-text`, name: "Free-text extras", quantity: 1, unitPrice: freeTextTotal }]
      : []),
  ];

  return {
    quoteId: quote.id,
    reference: referenceFor(quote, hash),
    version: 1,
    statusLabel: statusLabelFor(quote),
    assignedRep: rep,
    locked: quote.stage === "signed",
    customer: {
      name: quote.customerName,
      email: `${slugifyName(firstName)}.${slugifyName(lastName)}@${pick(EMAIL_DOMAINS, hash)}`,
      phone: phoneFor(hash),
      addressLines: quote.address.split(", "),
    },
    property: {
      occupancyArchetype: pick(OCCUPANCY_ARCHETYPES, hash),
      annualConsumptionKwh: 2500 + (hash % 35) * 100,
      electricUnitRate: Number((0.22 + (hash % 50) / 1000).toFixed(4)),
      estimatedBill: hash % 2 === 0 ? "Yes" : "No",
      estimatedReason: hash % 2 === 0 ? pick(ESTIMATED_REASONS_NO_BILL, hash) : "Provided an accurate bill",
      sprayFoam: hash % 5 === 0 ? "Yes" : "No",
      mpan: mpanFor(hash),
    },
    solarArrays,
    extras,
    standardAdditionals,
    freeTextExtras,
    selectedPaymentMethod: quote.paymentType === "cash" || quote.paymentType === "bacs" ? "bacs" : "monthly_plan_15yr",
    keyDetails: {
      panels,
      batteries,
      systemSizeKw,
      genY1Kwh,
      savingY1,
      lifetimeSaving,
      profit,
      roiPercent,
      gridIndependencePercent,
      paybackYears,
    },
    pricingBreakdown,
    profitBreakdown: {
      costPrice: quote.amount - profit,
      sellPrice: quote.amount,
      profit,
      marginPercent: Number(((profit / quote.amount) * 100).toFixed(1)),
    },
    notes: buildNote(quote, rep, hash),
    history: buildHistory(quote, rep),
  };
}
