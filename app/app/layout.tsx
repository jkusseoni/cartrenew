import GlobalApiStatusBar from "@/components/global-api-status";
import { brand } from "@/lib/brand";
import { PINGZA_PRIVACY_PATH, PINGZA_TERMS_PATH } from "@/lib/legal/pingza";

/**
 * Embedded Shopify App Home layout.
 * App Bridge CDN is injected first in the root layout <head> (see app/layout.tsx)
 * when proxy sets x-shopify-embed — do NOT add another App Bridge <script> here.
 * No Clerk providers in this layout.
 */
export default function EmbeddedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {brand.isDefault ? <GlobalApiStatusBar /> : null}
      {children}
      {brand.isDefault ? null : (
        <nav className="flex gap-4 px-4 py-3 text-xs font-bold text-neutral-500">
          <a
            href={PINGZA_PRIVACY_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-800"
          >
            Privacy Policy
          </a>
          <a
            href={PINGZA_TERMS_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-800"
          >
            Terms of Service
          </a>
        </nav>
      )}
    </>
  );
}
