export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import CartRow, { type CartRowData } from "@/components/CartRow";
import { prisma } from "@/lib/prisma";

const skipClerk =
  process.env.NODE_ENV === "development" ||
  process.env.SKIP_CLERK === "true" ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

  async function DashboardMetrics() {
    const userId = await getDashboardUserId();
  
    if (!userId) {
      return (
        <p className="p-10 text-center font-bold text-red-500">
          Unauthorized Access
        </p>
      );
    }
  
    // 1. In dono variables ko try block se pehle declare karein (Scope Lift)
    let merchant = null;
    let carts = [];
  
    try {
      merchant = await prisma.merchant.findFirst({
        where: { userId },
        include: {
          carts: { orderBy: { createdAt: "desc" } },
        },
      });
      
      if (merchant && merchant.carts) {
        carts = merchant.carts;
      }
    } catch (dbError) {
      console.error("Vercel Database Connection Error: ", dbError);
    }
  
    // 2. Baaki ka metrics calculation block
    const cartRows: CartRowData[] = carts.map((cart) => ({
      cartUrl: cart.cartUrl || "",
      customerName: cart.customerName || "Unknown",
      customerPhone: cart.customerPhone || "N/A",
      id: cart.id,
      status: cart.status,
      totalAmount: cart.totalAmount || 0,
    }));
  
    const recoveredCarts = carts.filter((cart) => cart.status === "RECOVERED");
    const abandonedCarts = carts.filter((cart) => cart.status === "ABANDONED");
  
    const totalRecovered = recoveredCarts.reduce((total, cart) => total + (cart.totalAmount || 0), 0);
    const totalAbandoned = abandonedCarts.reduce((total, cart) => total + (cart.totalAmount || 0), 0);
  
    const conversionRate = carts.length > 0 
      ? ((recoveredCarts.length / carts.length) * 100).toFixed(1) 
      : "0.0";
  
    return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            CartRenew Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Real-time AI WhatsApp Cart Recovery Tracker
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
          Store: {merchant?.storeName || "Demo Sandbox Store"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Recovered Revenue</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            Rs. {totalRecovered.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Unrecovered Lost Amount</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            Rs. {totalAbandoned.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">
            Recovery Conversion Rate
          </p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            {conversionRate}%
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow">
        <div className="border-b p-5">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Cart Recovery Logs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Target Link
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Action Engine
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {cartRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    No abandoned carts registered yet. Active triggers listening on
                    checkout hooks.
                  </td>
                </tr>
              ) : (
                cartRows.map((cart) => <CartRow key={cart.id} cart={cart} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Suspense
        fallback={
          <div className="p-10 text-center text-gray-500">
            Loading Dashboard Data Analytics Engine...
          </div>
        }
      >
        <DashboardMetrics />
      </Suspense>
    </div>
  );
}

async function getDashboardUserId() {
  if (skipClerk) {
    return "local-dev";
  }

  const { userId } = await auth();
  return userId;
}
