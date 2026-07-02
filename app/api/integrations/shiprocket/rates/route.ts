export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getShipRocketToken } from "@/lib/shiprocket";
import { NextResponse } from "next/server";

type ShiprocketRatesBody = {
  deliveryPincode?: unknown;
  pickupPincode?: unknown;
  pickup_pincode?: unknown;
  weightInKg?: unknown;
  cartValue?: unknown;
};

type RatesInput = {
  deliveryPincode: string;
  pickupPincode: string;
  weightInKg: number;
  cartValue: number;
};

type RateOption = {
  freight_charge?: unknown;
  rate?: unknown;
  courier_name?: unknown;
  courierName?: unknown;
  estimated_delivery_days?: unknown;
  etd?: unknown;
};

const SHIPROCKET_SERVICEABILITY_URL =
  "https://apiv2.shiprocket.in/v1/external/courier/serviceability";
const FALLBACK_SHIPPING_RATE = 59;
const FALLBACK_COURIER_NAME = "Standard Shipping";
const FALLBACK_ESTIMATED_DELIVERY_DAYS = 5;
const DEFAULT_WEIGHT_IN_KG = 0.5;
const DEFAULT_CART_VALUE = 0;
const DEFAULT_PICKUP_PINCODE = "110001";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ShiprocketRatesBody;
    const input = parseRatesBody(body);
    const token = await getShipRocketToken();

    if (!token) {
      return fallbackRatesResponse();
    }

    const serviceabilityUrl = buildServiceabilityUrl(input);
    const response = await fetch(serviceabilityUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`ShipRocket serviceability failed with status ${response.status}`);
    }

    const data = await response.json();
    const rateOptions = extractRateOptions(data);
    const lowestRateOption = findLowestRateOption(rateOptions);

    if (!lowestRateOption) {
      return fallbackRatesResponse();
    }

    return NextResponse.json({
      success: true,
      lowestRate: lowestRateOption.lowestRate,
      courierName: lowestRateOption.courierName,
      estimatedDeliveryDays: lowestRateOption.estimatedDeliveryDays,
    });
  } catch (error) {
    // Bad input is the caller's problem — return 400 instead of masking it
    // behind a successful fallback rate.
    if (error instanceof RouteValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    console.warn("ShipRocket rates route fallback used:", getLoggableError(error));

    return fallbackRatesResponse();
  }
}

function parseRatesBody(body: ShiprocketRatesBody): RatesInput {
  return {
    deliveryPincode: parseRequiredPincode(body.deliveryPincode, "deliveryPincode"),
    pickupPincode: parseOptionalPincode(body.pickupPincode ?? body.pickup_pincode) ?? getConfiguredPickupPincode(),
    weightInKg: parseOptionalNumber(body.weightInKg) ?? DEFAULT_WEIGHT_IN_KG,
    cartValue: parseOptionalNumber(body.cartValue) ?? DEFAULT_CART_VALUE,
  };
}

function parseRequiredPincode(value: unknown, fieldName: string) {
  const pincode = parseOptionalPincode(value);

  if (!pincode) {
    throw new RouteValidationError(`${fieldName} must be a valid 6-digit pincode`);
  }

  return pincode;
}

function parseOptionalPincode(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const pincode = String(value).trim();

  if (!/^\d{6}$/.test(pincode)) {
    throw new RouteValidationError("pincode must be a valid 6-digit value");
  }

  return pincode;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RouteValidationError("numeric fields must be non-negative numbers");
  }

  return parsedValue;
}

function getConfiguredPickupPincode() {
  return (
    process.env.SHIPROCKET_PICKUP_PINCODE?.trim() ||
    process.env.MERCHANT_PICKUP_PINCODE?.trim() ||
    DEFAULT_PICKUP_PINCODE
  );
}

function buildServiceabilityUrl(input: RatesInput) {
  const params = new URLSearchParams({
    pickup_postcode: input.pickupPincode,
    pickup_pincode: input.pickupPincode,
    delivery_postcode: input.deliveryPincode,
    delivery_pincode: input.deliveryPincode,
    weight: String(input.weightInKg),
    cod: "0",
    order_value: String(input.cartValue),
    orders: String(input.cartValue),
  });

  return `${SHIPROCKET_SERVICEABILITY_URL}?${params.toString()}`;
}

function extractRateOptions(data: unknown): RateOption[] {
  if (!isRecord(data)) {
    return [];
  }

  const nestedData = data.data;

  if (isRecord(nestedData)) {
    if (Array.isArray(nestedData.available_courier_companies)) {
      return nestedData.available_courier_companies;
    }

    if (Array.isArray(nestedData.courier_data)) {
      return nestedData.courier_data;
    }
  }

  if (Array.isArray(data.available_courier_companies)) {
    return data.available_courier_companies;
  }

  if (Array.isArray(data.courier_data)) {
    return data.courier_data;
  }

  return [];
}

function findLowestRateOption(rateOptions: RateOption[]) {
  return rateOptions.reduce<{
    lowestRate: number;
    courierName: string;
    estimatedDeliveryDays: number;
  } | null>((lowestOption, option) => {
    const candidateRate = getRate(option);

    if (candidateRate === undefined) {
      return lowestOption;
    }

    if (lowestOption && candidateRate >= lowestOption.lowestRate) {
      return lowestOption;
    }

    return {
      lowestRate: candidateRate,
      courierName: getCourierName(option),
      estimatedDeliveryDays: getEstimatedDeliveryDays(option),
    };
  }, null);
}

function getRate(option: RateOption) {
  const rate = parseRateValue(option.freight_charge ?? option.rate);

  return rate === undefined ? undefined : Math.abs(rate);
}

function parseRateValue(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function getCourierName(option: RateOption) {
  const courierName = option.courier_name ?? option.courierName;

  return typeof courierName === "string" && courierName.trim()
    ? courierName.trim()
    : FALLBACK_COURIER_NAME;
}

function getEstimatedDeliveryDays(option: RateOption) {
  const estimate = option.estimated_delivery_days ?? option.etd;

  if (typeof estimate === "number" && Number.isFinite(estimate)) {
    return Math.max(0, Math.round(estimate));
  }

  if (typeof estimate === "string") {
    const dayMatch = estimate.match(/\d+/);

    if (dayMatch) {
      return Number(dayMatch[0]);
    }
  }

  return FALLBACK_ESTIMATED_DELIVERY_DAYS;
}

function fallbackRatesResponse() {
  return NextResponse.json({
    success: true,
    lowestRate: FALLBACK_SHIPPING_RATE,
    courierName: FALLBACK_COURIER_NAME,
    estimatedDeliveryDays: FALLBACK_ESTIMATED_DELIVERY_DAYS,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return String(error);
}

class RouteValidationError extends Error {}
