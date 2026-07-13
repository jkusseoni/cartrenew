export type DeliveryChannel =
  | "WHATSAPP_OFFICIAL"
  | "WHATSAPP_WEB_LINK"
  | "SMS"
  | "EMAIL";

export type DeliverySuccessStatus =
  | "SUCCESS_WHATSAPP"
  | "SUCCESS_WHATSAPP_WEB_LINK"
  | "SUCCESS_SMS"
  | "SUCCESS_EMAIL";

export type DeliveryFailureStatus = "FAILED" | "FAILED_POLICY";
export type DeliveryStatus = DeliverySuccessStatus | DeliveryFailureStatus;

export type WhatsAppPolicy = "ALLOWED" | "RESTRICTED" | "WEB_LINK_ONLY";

export interface GeoStrategy {
  country: string;
  region: "APAC" | "EU" | "GLOBAL" | "NORTH_AMERICA" | "OCEANIA" | "UK" | "WEST_ASIA";
  countryCode: string;
  normalizedPhone: string;
  e164Phone: string;
  allowWhatsAppOfficial: boolean;
  primaryChannel: DeliveryChannel;
  fallbackChannel: DeliveryChannel | "NONE";
  fallbackChannels: DeliveryChannel[];
  whatsappPolicy: WhatsAppPolicy;
  restrictionReason: string;
  isKnownPolicy: boolean;
}

type GeoPolicyEntry = {
  country: string;
  region: GeoStrategy["region"];
  countryCode: string;
  allowWhatsAppOfficial: boolean;
  primaryChannel: DeliveryChannel;
  fallbackChannels: DeliveryChannel[];
  whatsappPolicy: WhatsAppPolicy;
  restrictionReason: string;
};

const EU_RESTRICTED_REASON =
  "WhatsApp official delivery is restricted for this policy group; route through consent-safe email or regulated SMS fallback.";

const euPolicy = (
  country: string,
  countryCode: string
): GeoPolicyEntry => ({
  country,
  region: "EU",
  countryCode,
  allowWhatsAppOfficial: false,
  primaryChannel: "EMAIL",
  fallbackChannels: ["SMS"],
  whatsappPolicy: "RESTRICTED",
  restrictionReason: EU_RESTRICTED_REASON,
});

const GEO_POLICY_ENTRIES: GeoPolicyEntry[] = [
  {
    country: "India",
    region: "APAC",
    countryCode: "91",
    allowWhatsAppOfficial: true,
    // Official Twilio/Meta WhatsApp must be primary — WEB_LINK_ONLY marked
    // recovery as "success" without ever delivering a message.
    primaryChannel: "WHATSAPP_OFFICIAL",
    fallbackChannels: ["WHATSAPP_WEB_LINK", "EMAIL", "SMS"],
    whatsappPolicy: "ALLOWED",
    restrictionReason:
      "India-first recovery: send via official WhatsApp, then fall back to web-link / email / SMS.",
  },
  {
    country: "United States and Canada",
    region: "NORTH_AMERICA",
    countryCode: "1",
    allowWhatsAppOfficial: true,
    primaryChannel: "SMS",
    fallbackChannels: ["EMAIL", "WHATSAPP_OFFICIAL"],
    whatsappPolicy: "ALLOWED",
    restrictionReason:
      "WhatsApp official delivery is allowed, but SMS is the default recovery rail for +1 numbers.",
  },
  {
    country: "United Kingdom",
    region: "UK",
    countryCode: "44",
    allowWhatsAppOfficial: false,
    primaryChannel: "EMAIL",
    fallbackChannels: ["SMS"],
    whatsappPolicy: "RESTRICTED",
    restrictionReason:
      "United Kingdom traffic is routed away from WhatsApp official API for geo-policy and consent controls.",
  },
  {
    country: "Japan",
    region: "APAC",
    countryCode: "81",
    allowWhatsAppOfficial: false,
    primaryChannel: "EMAIL",
    fallbackChannels: ["SMS"],
    whatsappPolicy: "RESTRICTED",
    restrictionReason:
      "Japan traffic is routed away from WhatsApp official API because local messaging policy and adoption make email-first safer.",
  },
  {
    country: "South Korea",
    region: "APAC",
    countryCode: "82",
    allowWhatsAppOfficial: false,
    primaryChannel: "SMS",
    fallbackChannels: ["EMAIL"],
    whatsappPolicy: "RESTRICTED",
    restrictionReason:
      "South Korea traffic is routed away from WhatsApp official API and into SMS-first recovery.",
  },
  {
    country: "Turkey",
    region: "WEST_ASIA",
    countryCode: "90",
    allowWhatsAppOfficial: false,
    primaryChannel: "SMS",
    fallbackChannels: ["EMAIL"],
    whatsappPolicy: "RESTRICTED",
    restrictionReason:
      "Turkey traffic is routed away from WhatsApp official API for data-residency and platform-policy controls.",
  },
  {
    country: "Australia",
    region: "OCEANIA",
    countryCode: "61",
    allowWhatsAppOfficial: false,
    primaryChannel: "EMAIL",
    fallbackChannels: ["SMS"],
    whatsappPolicy: "RESTRICTED",
    restrictionReason:
      "Australia traffic is routed away from WhatsApp official API to avoid verification and compliance friction.",
  },
  euPolicy("Greece", "30"),
  euPolicy("Netherlands", "31"),
  euPolicy("Belgium", "32"),
  euPolicy("France", "33"),
  euPolicy("Spain", "34"),
  euPolicy("Hungary", "36"),
  euPolicy("Italy", "39"),
  euPolicy("Romania", "40"),
  euPolicy("Austria", "43"),
  euPolicy("Denmark", "45"),
  euPolicy("Sweden", "46"),
  euPolicy("Poland", "48"),
  euPolicy("Germany", "49"),
  euPolicy("Portugal", "351"),
  euPolicy("Luxembourg", "352"),
  euPolicy("Ireland", "353"),
  euPolicy("Malta", "356"),
  euPolicy("Cyprus", "357"),
  euPolicy("Finland", "358"),
  euPolicy("Bulgaria", "359"),
  euPolicy("Lithuania", "370"),
  euPolicy("Latvia", "371"),
  euPolicy("Estonia", "372"),
  euPolicy("Croatia", "385"),
  euPolicy("Slovenia", "386"),
  euPolicy("Czechia", "420"),
  euPolicy("Slovakia", "421"),
];

const DEFAULT_POLICY: GeoPolicyEntry = {
  country: "International General",
  region: "GLOBAL",
  countryCode: "",
  allowWhatsAppOfficial: true,
  primaryChannel: "WHATSAPP_OFFICIAL",
  fallbackChannels: ["EMAIL", "SMS"],
  whatsappPolicy: "ALLOWED",
  restrictionReason:
    "No explicit geo restriction found; attempt WhatsApp official first, then email or SMS.",
};

const POLICY_BY_CODE = new Map(
  GEO_POLICY_ENTRIES.map((entry) => [entry.countryCode, entry] as const)
);

const SORTED_COUNTRY_CODES = [...POLICY_BY_CODE.keys()].sort(
  (left, right) => right.length - left.length
);

export const GEO_POLICY_MAP: Readonly<Record<string, GeoPolicyEntry>> =
  Object.freeze(
    GEO_POLICY_ENTRIES.reduce<Record<string, GeoPolicyEntry>>((acc, entry) => {
      acc[entry.countryCode] = Object.freeze({ ...entry });
      return acc;
    }, {})
  );

export function getGeoDeliveryStrategy(customerPhone: string): GeoStrategy {
  const normalizedPhone = normalizePhoneDigits(customerPhone);
  const countryCode = findCountryCode(normalizedPhone);
  const policy = countryCode ? POLICY_BY_CODE.get(countryCode) : undefined;

  return buildStrategy(policy ?? DEFAULT_POLICY, normalizedPhone, Boolean(policy));
}

export function getDeliveryChannelOrder(strategy: GeoStrategy): DeliveryChannel[] {
  const channels = [strategy.primaryChannel, ...strategy.fallbackChannels];
  const uniqueChannels = channels.filter(
    (channel, index) => channels.indexOf(channel) === index
  );

  return uniqueChannels.filter(
    (channel) => channel !== "WHATSAPP_OFFICIAL" || strategy.allowWhatsAppOfficial
  );
}

export function getSuccessStatusForChannel(
  channel: DeliveryChannel
): DeliverySuccessStatus {
  switch (channel) {
    case "EMAIL":
      return "SUCCESS_EMAIL";
    case "SMS":
      return "SUCCESS_SMS";
    case "WHATSAPP_WEB_LINK":
      return "SUCCESS_WHATSAPP_WEB_LINK";
    case "WHATSAPP_OFFICIAL":
      return "SUCCESS_WHATSAPP";
  }
}

function buildStrategy(
  policy: GeoPolicyEntry,
  normalizedPhone: string,
  isKnownPolicy: boolean
): GeoStrategy {
  return {
    ...policy,
    normalizedPhone,
    e164Phone: normalizedPhone ? `+${normalizedPhone}` : "",
    fallbackChannel: policy.fallbackChannels[0] ?? "NONE",
    fallbackChannels: [...policy.fallbackChannels],
    isKnownPolicy,
  };
}

function findCountryCode(normalizedPhone: string) {
  return SORTED_COUNTRY_CODES.find((countryCode) =>
    normalizedPhone.startsWith(countryCode)
  );
}

function normalizePhoneDigits(customerPhone: string) {
  let digits = customerPhone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}
