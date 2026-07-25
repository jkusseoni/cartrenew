import { prisma } from "@/lib/prisma";

/**
 * Resolve (or create) the Prisma Merchant row for a Shopify shop domain.
 * shopDomain is the tenant key for embedded /api/app/* routes.
 */
export async function findOrCreateMerchantByShopDomain(shopDomain: string) {
  const existing = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  if (existing) return existing;

  const userId = `shopify_${shopDomain.replace(/[^a-z0-9]/gi, "_")}`;

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${shopDomain.replace(/\.myshopify\.com$/i, "")}@shopify.cartrenew.local`,
      firstName: "Shopify",
      lastName: shopDomain,
    },
    update: {},
  });

  return prisma.merchant.upsert({
    where: { shopDomain },
    create: {
      userId,
      storeName: shopDomain,
      shopDomain,
    },
    update: {},
  });
}

export async function findMerchantByShopDomain(shopDomain: string) {
  return prisma.merchant.findUnique({
    where: { shopDomain },
  });
}
