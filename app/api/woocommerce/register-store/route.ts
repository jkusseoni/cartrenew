import { randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface RegisterStoreBody {
  email?: string;
  site_url?: string;
  store_name?: string;
}

export function buildWooCommerceStoreRegistration({
  apiKey,
  email,
  siteUrl,
  storeName,
  userId,
}: {
  apiKey: string;
  email: string;
  siteUrl: string;
  storeName: string | null;
  userId: string;
}) {
  return {
    platform: "woocommerce",
    site_url: siteUrl,
    contact_email: email,
    store_name: storeName,
    api_key: apiKey,
    shopify_domain: null,
    clerk_user_id: userId,
    billing_status: "pending",
  };
}

function normalizeSiteUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.hash = "";
    parsed.search = "";
    // Canonical form: origin + pathname without trailing slash (except root).
    const path = parsed.pathname.replace(/\/+$/, "") || "";
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return null;
  }
}

async function getRegistrationUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === "development") {
    return "local-dev";
  }

  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getRegistrationUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RegisterStoreBody;
  try {
    body = (await req.json()) as RegisterStoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const storeName =
    typeof body.store_name === "string" ? body.store_name.trim() || null : null;
  const siteUrlRaw = typeof body.site_url === "string" ? body.site_url : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const siteUrl = normalizeSiteUrl(siteUrlRaw);
  if (!siteUrl) {
    return NextResponse.json(
      { error: "site_url must be a valid http(s) URL." },
      { status: 400 }
    );
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("stores")
    .select("id, clerk_user_id")
    .eq("site_url", siteUrl)
    .maybeSingle();

  if (lookupError) {
    console.error("[register-store] lookup failed", lookupError);
    return NextResponse.json({ error: "Failed to check existing store." }, { status: 500 });
  }

  if (existing?.id) {
    if (existing.clerk_user_id !== userId) {
      return NextResponse.json({ error: "already registered" }, { status: 409 });
    }

    return NextResponse.json(
      {
        error: "already registered",
        store_id: existing.id,
      },
      { status: 409 }
    );
  }

  const apiKey = randomBytes(24).toString("hex");

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("stores")
    .insert(
      buildWooCommerceStoreRegistration({
        apiKey,
        email,
        siteUrl,
        storeName,
        userId,
      })
    )
    .select("id")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    // Race: unique site_url conflict
    if (insertError?.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("stores")
        .select("id, clerk_user_id")
        .eq("site_url", siteUrl)
        .maybeSingle();
      if (raced?.id && raced.clerk_user_id === userId) {
        return NextResponse.json(
          { error: "already registered", store_id: raced.id },
          { status: 409 }
        );
      }
      if (raced?.id) {
        return NextResponse.json({ error: "already registered" }, { status: 409 });
      }
    }
    console.error("[register-store] insert failed", insertError);
    return NextResponse.json({ error: "Failed to create store." }, { status: 500 });
  }

  return NextResponse.json({
    store_id: inserted.id,
    api_key: apiKey,
  });
}
