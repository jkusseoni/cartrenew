export const runtime = "nodejs";

import { hashData } from "@/lib/crypto-utils";

type ServerEventUserData = {
  email?: string;
  phone?: string;
  clientIp?: string;
  clientUserAgent?: string;
};

type MetaConversionsPayload = {
  data: Array<{
    event_name: string;
    event_time: number;
    action_source: "website";
    user_data: {
      em?: string[];
      ph?: string[];
      client_ip_address?: string;
      client_user_agent?: string;
    };
    // Meta custom_data accepts arbitrary event-specific keys.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custom_data?: Record<string, any>;
  }>;
  test_event_code?: string;
};

export async function trackServerEvent(
  eventName: string,
  userData: ServerEventUserData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData?: Record<string, any>
) {
  const payload = buildMetaConversionsPayload(eventName, userData, customData);
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();

  try {
    if (!pixelId || !accessToken || isPlaceholderCredential(pixelId) || isPlaceholderCredential(accessToken)) {
      logLocalTrackingEvent(eventName, payload);
      return;
    }

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Meta Conversions API responded with ${response.status}`);
    }
  } catch (error) {
    console.warn("Meta Conversions API tracking fallback:", {
      eventName,
      error: getLoggableError(error),
    });
    logLocalTrackingEvent(eventName, payload);
  }
}

function buildMetaConversionsPayload(
  eventName: string,
  userData: ServerEventUserData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData?: Record<string, any>
): MetaConversionsPayload {
  const hashedEmail = hashData(userData.email);
  const hashedPhone = hashData(userData.phone);
  const payload: MetaConversionsPayload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        user_data: {
          ...(hashedEmail ? { em: [hashedEmail] } : {}),
          ...(hashedPhone ? { ph: [hashedPhone] } : {}),
          ...(userData.clientIp ? { client_ip_address: userData.clientIp } : {}),
          ...(userData.clientUserAgent ? { client_user_agent: userData.clientUserAgent } : {}),
        },
        ...(customData ? { custom_data: customData } : {}),
      },
    ],
  };
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  return payload;
}

function isPlaceholderCredential(value: string) {
  return /^(dummy|placeholder|test|your_|replace_|changeme)/i.test(value);
}

function logLocalTrackingEvent(eventName: string, payload: MetaConversionsPayload) {
  console.log("Meta Conversions API event logged locally:", {
    eventName,
    payload,
  });
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
