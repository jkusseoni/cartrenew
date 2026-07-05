import { auth } from "@clerk/nextjs/server";
import { forbidden, redirect } from "next/navigation";

import Dashboard from "@/app/[locale]/dashboard/page";
import { isMerchantRole } from "@/lib/roles";

export default async function MerchantDashboardPage() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!isMerchantRole(sessionClaims)) {
    forbidden();
  }

  return <Dashboard params={Promise.resolve({ locale: "en" })} />;
}
