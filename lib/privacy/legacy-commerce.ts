/**
 * WooCommerce ingestion and the COD order webhook belong to CartRenew.
 * A non-default brand (Pingza) must not open them. When this returns true
 * the route continues into its existing handler.
 */
export function legacyCommerceRouteEnabled(isDefaultBrand: boolean): boolean {
  return isDefaultBrand
}
