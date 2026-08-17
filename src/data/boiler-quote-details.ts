import type { BoilerQuoteDetail } from "@/types/boiler-quote";

/**
 * Full breakdown for boiler quotes, keyed by the owning `Quote.id` (see
 * `src/data/quotes.ts` for the matching summary rows). Only fetched when a
 * boiler quote's detail page is opened — see `getBoilerQuoteDetail` in
 * `src/data/quotes-service.ts`.
 */
export const boilerQuoteDetails: Record<string, BoilerQuoteDetail> = {
  "q-2001": {
    quoteId: "q-2001",
    reference: "BLR125-18607-SB18605",
    version: 1,
    statusLabel: "Sent to Customer",
    assignedRep: "Damon Clarke",
    locked: true,
    customer: {
      name: "Bree Marfia",
      email: "breemarfia@gmail.com",
      phone: "07596846984",
      addressLines: ["42 Hill Street", "Newhall", "South Derbyshire", "Derbyshire", "DE11 0JR"],
    },
    property: {
      propertyType: "Detached",
      bedrooms: 4,
      radiators: 8,
      currentBoilerType: "Regular (open vent)",
      currentBoilerAge: "18+ years",
      boilerLocation: "Airing cupboard",
      gasSupplyConfirmed: "Yes",
      mprn: "Provided in Email",
      accessNotes: "Loft access via pull-down ladder; boiler cupboard shared with hot water tank.",
    },
    boilerUnits: [
      {
        id: "unit-1",
        label: "Boiler #1",
        make: "Intergas",
        model: "Xclusive 30",
        outputKw: 30,
        fuelType: "Mains Gas",
        flueType: "Horizontal",
        installType: "Combi",
        // Standard 10-year warranty +2 years for installing the Intergas
        // System Filter (see the "Intergas System Filter" extra below).
        warrantyYears: 12,
        items: [
          { id: "unit-1-item-1", name: "Intergas Xclusive 30", quantity: 1, unitPrice: 1450 },
        ],
      },
    ],
    extras: [
      { id: "extra-1", name: "Intergas System Filter", quantity: 1, unitPrice: 120 },
      { id: "extra-2", name: "Intergas Comfort Touch thermostat", quantity: 1, unitPrice: 180 },
    ],
    standardAdditionals: [
      { id: "additional-1", name: "Powerflush", quantity: 1, unitPrice: 350 },
    ],
    freeTextExtras: [
      { id: "free-text-1", description: "Extra pipework - reroute under floor", quantity: 1, unitPrice: 150 },
    ],
    selectedPaymentMethod: "monthly_plan_15yr",
    keyDetails: {
      estInstallDays: 1,
      price: 2650,
      profit: 780,
      marginPercent: 29.4,
    },
    pricingBreakdown: [
      { id: "pricing-1", name: "Boiler + install", quantity: 1, unitPrice: 1450 },
      { id: "pricing-2", name: "Extras", quantity: 1, unitPrice: 300 },
      { id: "pricing-3", name: "Standard additionals", quantity: 1, unitPrice: 350 },
      { id: "pricing-4", name: "Free-text extras", quantity: 1, unitPrice: 150 },
    ],
    profitBreakdown: {
      costPrice: 1870,
      sellPrice: 2650,
      profit: 780,
      marginPercent: 29.4,
    },
    notes: [
      {
        id: "note-1",
        authorName: "Kiefer Phillips",
        authorInitials: "KP",
        timestamp: "2026-06-11T14:13:00",
        body: "Detached property, current boiler is an 18 year old regular system and struggling on pressure. Customer wants a straight swap to combi to free up the airing cupboard. Gas supply confirmed on site. Quoted Intergas Xclusive 30 (lowest NOx emissions on the market, 10-yr warranty, 12 with the Intergas System Filter fitted). Keen on the 15 year finance plan, no upfront cost.",
      },
    ],
    history: [
      {
        id: "h-1",
        actorName: "Damon Clarke",
        description: "Submitted and saved the 'Pre-Installation Survey' form",
        timestamp: "2026-06-20T14:01:00",
      },
      {
        id: "h-2",
        actorName: "System",
        isSystem: true,
        description: "The contract proposal has been accessed by the customer or sales representative",
        timestamp: "2026-06-18T19:53:00",
      },
      {
        id: "h-3",
        actorName: "System",
        isSystem: true,
        description: "Changed the quote status to sent",
        timestamp: "2026-06-18T19:52:00",
      },
      {
        id: "h-4",
        actorName: "System",
        isSystem: true,
        description: "Changed the quote status to Sent to Customer",
        timestamp: "2026-06-18T19:52:00",
      },
      {
        id: "h-5",
        actorName: "Damon Clarke",
        description: "Changed the payment method to Financer Monthly Plan (15)",
        timestamp: "2026-06-18T19:49:00",
      },
      {
        id: "h-6",
        actorName: "Damon Clarke",
        description: "Updated product Intergas Xclusive 30 (30kW) on the order",
        timestamp: "2026-06-18T19:40:00",
      },
    ],
  },
  "q-2002": {
    quoteId: "q-2002",
    reference: "BLR118-14203-SB14204",
    version: 1,
    statusLabel: "Signed",
    assignedRep: "Lucy Starkey",
    locked: true,
    customer: {
      name: "Connor Whitmore",
      email: "connor.whitmore@outlook.com",
      phone: "07812334521",
      addressLines: ["14 Birch Grove", "Long Eaton", "Nottingham", "NG10 4LP"],
    },
    property: {
      propertyType: "Semi-detached",
      bedrooms: 3,
      radiators: 6,
      currentBoilerType: "System boiler",
      currentBoilerAge: "12 years",
      boilerLocation: "Kitchen",
      gasSupplyConfirmed: "Yes",
      mprn: "7834521099",
      accessNotes: "Cylinder cupboard on first floor, easy access.",
    },
    boilerUnits: [
      {
        id: "unit-1",
        label: "Boiler #1",
        make: "Intergas",
        model: "HRE SB 24",
        outputKw: 24,
        fuelType: "Mains Gas",
        flueType: "Vertical",
        installType: "System",
        cylinderLitres: 180,
        // HRE range standard warranty — no Intergas filter fitted here, so
        // no +2 year bonus (compare q-2001's Xclusive, which has one).
        warrantyYears: 7,
        items: [
          { id: "unit-1-item-1", name: "Intergas HRE SB 24", quantity: 1, unitPrice: 1650 },
          { id: "unit-1-item-2", name: "Telford 180L unvented cylinder", quantity: 1, unitPrice: 820 },
        ],
      },
    ],
    extras: [
      { id: "extra-1", name: "Intergas Comfort Touch thermostat", quantity: 1, unitPrice: 140 },
    ],
    standardAdditionals: [
      { id: "additional-1", name: "Powerflush", quantity: 1, unitPrice: 350 },
      { id: "additional-2", name: "Additional radiator - Utility room", quantity: 1, unitPrice: 220 },
    ],
    freeTextExtras: [
      { id: "free-text-1", description: "Extra length pipe run to garage", quantity: 1, unitPrice: 95 },
    ],
    selectedPaymentMethod: "bacs",
    keyDetails: {
      estInstallDays: 2,
      price: 3275,
      profit: 940,
      marginPercent: 28.7,
    },
    pricingBreakdown: [
      { id: "pricing-1", name: "Boiler + cylinder + install", quantity: 1, unitPrice: 2470 },
      { id: "pricing-2", name: "Extras", quantity: 1, unitPrice: 140 },
      { id: "pricing-3", name: "Standard additionals", quantity: 1, unitPrice: 570 },
      { id: "pricing-4", name: "Free-text extras", quantity: 1, unitPrice: 95 },
    ],
    profitBreakdown: {
      costPrice: 2335,
      sellPrice: 3275,
      profit: 940,
      marginPercent: 28.7,
    },
    notes: [
      {
        id: "note-1",
        authorName: "Lucy Starkey",
        authorInitials: "LS",
        timestamp: "2026-07-04T11:20:00",
        body: "Semi-detached, existing system boiler failing intermittently. Customer keen to keep the hot water cylinder but wants improved efficiency and smart controls. Confirmed gas supply and cylinder cupboard access. BACS payment agreed on site.",
      },
    ],
    history: [
      {
        id: "h-1",
        actorName: "System",
        isSystem: true,
        description: "Changed the quote status to signed",
        timestamp: "2026-07-09T16:45:00",
      },
      {
        id: "h-2",
        actorName: "System",
        isSystem: true,
        description: "The contract proposal has been accessed by the customer or sales representative",
        timestamp: "2026-07-08T09:10:00",
      },
      {
        id: "h-3",
        actorName: "Lucy Starkey",
        description: "Updated product Intergas HRE SB 24 (24kW) on the order",
        timestamp: "2026-07-04T11:22:00",
      },
      {
        id: "h-4",
        actorName: "System",
        isSystem: true,
        description: "Changed the quote status to Sent to Customer",
        timestamp: "2026-07-04T11:25:00",
      },
    ],
  },
};
