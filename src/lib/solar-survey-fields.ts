import type {
  SolarSurveyAnswers,
  SolarSurveyRoofKey,
} from "@/types/solar-survey";
import {
  isValidMpan,
  type SolarSurveyTextFormat,
} from "@/lib/solar-survey-format";

/**
 * Section/field layout for the solar pre-installation survey — shared by the
 * public fill-in form (`src/app/survey/[token]/SolarSurveyForm.tsx`), the
 * read-only summary in the portal (`SolarSurveyAnswers.tsx`) and the
 * submit-time validation in `src/app/survey/[token]/solar-actions.ts`, so they
 * never drift apart. Mirrors `Pre-Installation Survey _ Margav.pdf`.
 */

export const YES_NO = ["Yes", "No"];
export const YES_NO_UNKNOWN = ["Yes", "No", "Unknown"];

export interface SolarSurveyFieldBase {
  label: string;
  required?: boolean;
  help?: string;
  /** Illustration shown under the help text, served from `public/solar-survey/`. */
  helpImage?: { src: string; alt: string };
  /** Clean-up applied to typed text (see `solar-survey-format.ts`). */
  format?: SolarSurveyTextFormat;
}

export type SolarSurveyQuestion = SolarSurveyFieldBase &
  (
    | { type: "text" | "textarea" }
    | { type: "select"; options: string[] }
    // `optionImages` maps an option to an illustration in `public/solar-survey/`; the form then renders image tiles instead of plain buttons.
    | {
        type: "choice";
        options: string[];
        optionImages?: Record<string, string>;
      }
  );

export type SolarSurveyTopLevelKey = Exclude<keyof SolarSurveyAnswers, "roofs">;

export type SolarSurveyTopLevelQuestion = SolarSurveyQuestion & {
  key: SolarSurveyTopLevelKey;
};
export type SolarSurveyRoofQuestion = SolarSurveyQuestion & {
  key: SolarSurveyRoofKey;
};

export const PROPERTY_INFO_OPTIONS = [
  "Bungalow",
  "Semi-Detached",
  "Detached",
  "Terraced",
  "Park Home",
  "Other",
];
export const ROOF_HEIGHT_OPTIONS = [
  "One Storey",
  "Two Storey",
  "Three Storey",
  "Four Storey",
  "Commercial (Add Height to Notes)",
];
export const ROOF_SHAPE_OPTIONS = [
  "Flat",
  "Mono Pitch",
  "Gable",
  "Hipped",
  "Half Hipped",
  "Cross Gabled",
];
export const ROOF_COVERING_OPTIONS = [
  "Concrete",
  "Rosemary",
  "Slate",
  "Shingles",
  "Corrugated",
  "Stone",
  "Fibreglass",
  "Felt",
  "Rubber",
  "Metal",
];
/** Roof shape/covering illustrations, served from `public/solar-survey/`. */
function imageMap(options: string[]): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [
      option,
      `/solar-survey/${option.replace(/ /g, "_")}.png`,
    ]),
  );
}
export const ROOF_SHAPE_IMAGES = imageMap(ROOF_SHAPE_OPTIONS);
export const ROOF_COVERING_IMAGES = imageMap(ROOF_COVERING_OPTIONS);

export const ROOF_COUNT_OPTIONS = ["1", "2", "3"];
export const ENERGY_SUPPLIER_OPTIONS = [
  "British Gas",
  "Octopus Energy",
  "EDF",
  "E.ON Next",
  "OVO Energy",
  "Scottish Power",
  "Shell Energy",
  "So Energy",
  "Utilita",
  "Utility Warehouse",
  "Good Energy",
  "Ecotricity",
  "Other",
];
export const METER_PHASE_OPTIONS = ["Single phase", "Three phase", "Not sure"];

export const ROOF_LETTERS = ["A", "B", "C"] as const;

export const SOLAR_PROPERTY_QUESTIONS: SolarSurveyTopLevelQuestion[] = [
  {
    key: "propertyType",
    label: "Property info",
    type: "choice",
    options: PROPERTY_INFO_OPTIONS,
    required: true,
  },
  {
    key: "rearAccess",
    label: "Is there rear access to the property?",
    type: "choice",
    options: YES_NO,
    required: true,
    help: "Please let us know if you are able to access the rear of your property — this is so that we can take materials and scaffolding to the rear (if required).",
  },
  {
    key: "hasWifi",
    label: "Does the property have Wi-Fi?",
    type: "choice",
    options: YES_NO,
    required: true,
  },
  {
    key: "hasPets",
    label: "Are there any pets at the property?",
    type: "choice",
    options: YES_NO,
    required: true,
  },
  {
    key: "existingEvCharger",
    label: "Existing EV charger",
    type: "choice",
    options: YES_NO,
    required: true,
  },
  {
    key: "existingSolarOrBattery",
    label: "Existing solar PV or EESS (battery storage)",
    type: "choice",
    options: YES_NO,
    required: true,
  },
  {
    key: "mpan",
    label: "MPAN",
    type: "text",
    format: "mpan",
    required: true,
    helpImage: {
      src: "/solar-survey/MPAN.png",
      alt: 'Example MPAN label: the "S" and top row are not needed — enter the 13 digits from the four white sections along the bottom (91 0112 1214 151).',
    },
    help: 'Find the MPAN on your electricity bill or statement. Enter the 13 digits from the four white sections along the bottom of the example, reading left to right, without spaces. Do not include the "S" or any numbers from the top row.',
  },
  {
    key: "energySupplier",
    label: "Energy supplier",
    type: "select",
    options: ENERGY_SUPPLIER_OPTIONS,
    required: true,
  },
  {
    key: "meterPhase",
    label: "Meter phase type",
    type: "select",
    options: METER_PHASE_OPTIONS,
    help: "If you specifically know this, tell us. Otherwise we can get this information from your image uploads.",
  },
  {
    key: "roofCount",
    label: "How many separate roofs will have panels?",
    type: "choice",
    options: ROOF_COUNT_OPTIONS,
    required: true,
    help: "Count the main house, an extension or a garage separately. Several panel arrays on the same roof count as one roof. Select 3 if there are more, then record the extra roofs at the end of Roof C.",
  },
];

export const SOLAR_ROOF_QUESTIONS: SolarSurveyRoofQuestion[] = [
  {
    key: "name",
    label: "Which roof is this?",
    type: "text",
    format: "sentence",
    required: true,
    help: "For example: main house, rear extension or garage. Add array numbers if they are shown on the design.",
  },
  {
    key: "height",
    label: "Height of this roof",
    type: "choice",
    options: ROOF_HEIGHT_OPTIONS,
    required: true,
    help: "Use this part of the building, so a single-storey extension can differ from the main house.",
  },
  {
    key: "shape",
    label: "Roof shape",
    type: "choice",
    options: ROOF_SHAPE_OPTIONS,
    optionImages: ROOF_SHAPE_IMAGES,
    required: true,
    help: "Choose the shape of this roof.",
  },
  {
    key: "covering",
    label: "Roof covering",
    type: "choice",
    options: ROOF_COVERING_OPTIONS,
    optionImages: ROOF_COVERING_IMAGES,
    required: true,
    help: "Choose the covering on this roof. Note any areas with a different covering in Roof notes.",
  },
  {
    key: "suspectedAsbestos",
    label: "Is any covering suspected to contain asbestos?",
    type: "choice",
    options: YES_NO_UNKNOWN,
    required: true,
  },
  {
    key: "roomsInRoof",
    label: "Are there rooms within this roof?",
    type: "choice",
    options: YES_NO_UNKNOWN,
    required: true,
  },
  {
    key: "timbersCut",
    label: "Have timbers been cut, removed or notched?",
    type: "choice",
    options: YES_NO_UNKNOWN,
    required: true,
    help: "For example, for a dormer, rooflight, hatch or flue.",
  },
  {
    key: "heavierCovering",
    label: "Has a heavier roof covering replaced the original?",
    type: "choice",
    options: YES_NO_UNKNOWN,
    required: true,
    help: "For example, slate replaced with concrete. Choose Unknown if the history is not known.",
  },
  {
    key: "damage",
    label: "Any sagging, cracking, water staining or damaged covering?",
    type: "choice",
    options: YES_NO_UNKNOWN,
    required: true,
    help: "Put concerns and their locations in Roof notes; include them in your roof photos.",
  },
  {
    key: "loftAccess",
    label: "Can you enter the loft / roof space?",
    type: "choice",
    options: YES_NO,
    required: true,
  },
  {
    key: "notes",
    label: "Roof notes / exceptions",
    type: "textarea",
    format: "sentence",
    help: "Describe any flagged concerns, alterations, covering changes or differences in timber sizes and spans. State what is unknown.",
  },
];

export const SOLAR_LOCATION_QUESTIONS: SolarSurveyTopLevelQuestion[] = [
  {
    key: "meterLocation",
    label: "Electricity meter location",
    type: "textarea",
    format: "sentence",
    required: true,
    help: "Please accurately describe the room and location of the meter. If outside, specify exactly where it is located.",
  },
  {
    key: "consumerUnitLocation",
    label: "Consumer unit / mains board location",
    type: "textarea",
    format: "sentence",
    required: true,
    help: "Please accurately describe the room and location of the consumer unit or mains board.",
  },
  {
    key: "inverterLocation",
    label: "Inverter / battery installation location",
    type: "textarea",
    format: "sentence",
    required: true,
    help: "Please list at least two possible outdoor locations where you would like the inverter and battery to be installed.",
  },
];

export const SOLAR_NOTES_QUESTIONS: SolarSurveyTopLevelQuestion[] = [
  { key: "notes", label: "Notes", type: "textarea", format: "sentence" },
];

// ─────────────────────────────────────────────────────────────────────────
// File uploads (photos / videos / documents)
// ─────────────────────────────────────────────────────────────────────────

export type SolarSurveyFileKind = "photos" | "photos_video" | "video" | "files";

export interface SolarSurveyFileItem {
  key: string;
  label: string;
  kind: SolarSurveyFileKind;
  required: boolean;
  help: string;
  /** Makes the first occurrence of `text` inside `help` a link. */
  helpLink?: { text: string; href: string };
}

export const FILE_KIND_ACCEPT: Record<SolarSurveyFileKind, string> = {
  photos: "image/*",
  photos_video: "image/*,video/*",
  video: "video/*",
  files: "image/*,application/pdf",
};

export const FILE_KIND_BADGE: Record<SolarSurveyFileKind, string> = {
  photos: "Photos",
  photos_video: "Photos / video",
  video: "Video",
  files: "Photo or PDF",
};

export function roofPhotoItemKey(roofIndex: number): string {
  return `roof_${ROOF_LETTERS[roofIndex].toLowerCase()}_photos`;
}

export const ROOF_PHOTO_ITEMS: SolarSurveyFileItem[] = ROOF_LETTERS.map(
  (letter, index) => ({
    key: roofPhotoItemKey(index),
    label: `Roof ${letter} and access photos`,
    kind: "photos",
    required: true,
    help: "Show every face receiving panels, the roof covering and any damage. Include access or obstructions relevant to scaffolding. One set covers all arrays on this roof.",
  }),
);

export const GENERAL_PHOTO_ITEMS: SolarSurveyFileItem[] = [
  {
    key: "house_front",
    label: "House (front)",
    kind: "photos",
    required: true,
    help: "Take a photo showing the full extent of the front of the property. Use multiple images to capture the whole front of the property.",
  },
  {
    key: "house_rear",
    label: "House (rear)",
    kind: "photos",
    required: true,
    help: "Take a photo showing the full extent of the rear of the property. Use multiple images to capture the whole rear of the property.",
  },
  {
    key: "house_side",
    label: "House (side)",
    kind: "photos",
    required: true,
    help: "Take a picture of the side of the property — this is used for assessing scaffolding access. Please take multiple photos and pay attention to any gates or restrictions that affect transporting the scaffolding.",
  },
  {
    key: "energy_bill",
    label: "Energy statement / bill",
    kind: "files",
    required: true,
    help: "Please upload your most recent energy bill, no more than six months old, as a PDF or photograph. It must show the unit rate and estimated 12-month consumption.",
  },
  {
    key: "electricity_meter",
    label: "Electricity meter",
    kind: "photos",
    required: true,
    help: "This is generally located in your meter box. We need a photo of the box open and closed.",
  },
  {
    key: "consumer_unit",
    label: "Open consumer unit / mains board / fuse box",
    kind: "photos",
    required: true,
    help: "We need a photo of the general location of the consumer unit and an image of the cover of the box open so we can see inside.",
  },
  {
    key: "proposed_inverter_location",
    label: "Proposed inverter / battery installation location",
    kind: "photos_video",
    required: true,
    help: "Please take photo(s) or a video of the locations you would like to have the inverter/battery installed.",
  },
  {
    key: "wifi_signal",
    label: "Wi-Fi signal strength at proposed inverter/battery location",
    kind: "photos",
    required: false,
    helpLink: {
      text: "Google speed test",
      href: "https://www.google.com/search?q=internet+speed+test",
    },
    help: "Please use a tool such as Google speed test and then upload a screenshot of the speed at the location.",
  },
];

export const VIDEO_ITEMS: SolarSurveyFileItem[] = [
  {
    key: "video_inverter_to_meter",
    label: "Inverter to meter",
    kind: "video",
    required: true,
    help: "Please take a video showing you walking from the outside location(s) you would like the inverter to be installed to your meter location. Please point the camera in front of you — narration is helpful too!",
  },
  {
    key: "video_walkaround",
    label: "External walkaround",
    kind: "video",
    required: true,
    help: "Please take a video of the full property, walking around all access points so that we can understand all aspects of the house.",
  },
];

export const ADDITIONAL_MEDIA_ITEMS: SolarSurveyFileItem[] = [
  {
    key: "preexisting_damage",
    label: "Pre-existing property damage",
    kind: "photos_video",
    required: false,
    help: "Please take photos of all examples of existing damage to the areas of the property that we will be working at.",
  },
  {
    key: "incoming_utilities",
    label: "Incoming cables / utilities",
    kind: "photos_video",
    required: false,
    help: "Please capture images or video of third-party utility lines entering the property, showing where they come from on the street and how they connect to your house. This includes power, telephony and any other service you can see connecting aerially to the house.",
  },
  {
    key: "other_media",
    label: "Other images / video",
    kind: "photos_video",
    required: false,
    help: "The more information you can provide the better — it removes the chance of any surprises on the day!",
  },
];

export const ALL_SOLAR_FILE_ITEMS: SolarSurveyFileItem[] = [
  ...ROOF_PHOTO_ITEMS,
  ...GENERAL_PHOTO_ITEMS,
  ...VIDEO_ITEMS,
  ...ADDITIONAL_MEDIA_ITEMS,
];

export const SOLAR_FILE_ITEM_KEYS = new Set(
  ALL_SOLAR_FILE_ITEMS.map((item) => item.key),
);

export function getSolarFileItem(key: string): SolarSurveyFileItem | undefined {
  return ALL_SOLAR_FILE_ITEMS.find((item) => item.key === key);
}

/** Whether a file's MIME type is allowed for an item of this kind. */
export function isContentTypeAllowed(
  kind: SolarSurveyFileKind,
  contentType: string,
): boolean {
  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  const isPdf = contentType === "application/pdf";
  switch (kind) {
    case "photos":
      return isImage;
    case "video":
      return isVideo;
    case "photos_video":
      return isImage || isVideo;
    case "files":
      return isImage || isPdf;
  }
}

/** The file items that apply given how many roofs the customer said have panels. */
export function applicableFileItems(roofCount: string): SolarSurveyFileItem[] {
  const roofs = Math.min(Math.max(Number(roofCount) || 0, 0), 3);
  return ALL_SOLAR_FILE_ITEMS.filter((item) => {
    const roofIndex = ROOF_PHOTO_ITEMS.findIndex(
      (roofItem) => roofItem.key === item.key,
    );
    return roofIndex === -1 || roofIndex < roofs;
  });
}

/**
 * What's still missing for the form to be complete — returns human-readable
 * labels. Used client-side to block submit and server-side as a backstop.
 */
export function findMissingRequired(
  answers: SolarSurveyAnswers,
  uploadedItemKeys: Set<string>,
): string[] {
  const missing: string[] = [];

  for (const question of SOLAR_PROPERTY_QUESTIONS) {
    if (question.required && !answers[question.key].trim())
      missing.push(question.label);
  }

  if (
    answers.energySupplier === "Other" &&
    !answers.energySupplierOther.trim()
  ) {
    missing.push("Energy supplier name");
  }

  if (answers.mpan.trim() && !isValidMpan(answers.mpan.trim())) {
    missing.push("MPAN (must be exactly 13 digits)");
  }

  const roofs = Math.min(Math.max(Number(answers.roofCount) || 0, 0), 3);
  for (let index = 0; index < roofs; index += 1) {
    for (const question of SOLAR_ROOF_QUESTIONS) {
      if (question.required && !answers.roofs[index][question.key].trim()) {
        missing.push(`Roof ${ROOF_LETTERS[index]}: ${question.label}`);
      }
    }
  }

  for (const question of SOLAR_LOCATION_QUESTIONS) {
    if (question.required && !answers[question.key].trim())
      missing.push(question.label);
  }

  for (const item of applicableFileItems(answers.roofCount)) {
    if (item.required && !uploadedItemKeys.has(item.key))
      missing.push(item.label);
  }

  if (!answers.completedBy.trim()) missing.push("Your name");
  return missing;
}
