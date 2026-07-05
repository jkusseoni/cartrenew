"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ShoppingCart, MessageSquare, DollarSign } from "lucide-react";

import {
  formatInr,
  type LanguageMetric,
} from "@/lib/fetch-dashboard-analytics";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

type DashboardAnalyticsProps = {
  totalAbandoned: number;
  messagesSent: number;
  recoveredRevenue: number;
  recoveredRate: number;
  languageData: LanguageMetric[];
  loading?: boolean;
};

export default function DashboardAnalytics({
  totalAbandoned,
  messagesSent,
  recoveredRevenue,
  recoveredRate,
  languageData,
  loading = false,
}: DashboardAnalyticsProps) {
  const chartData = languageData.length > 0 ? languageData : [{ name: "No data", counts: 0, revenue: 0 }];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total Abandoned</CardTitle>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : totalAbandoned.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Messages Sent</CardTitle>
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : messagesSent.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 mt-1">Recovery outreach volume</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Recovered Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatInr(recoveredRevenue)}
            </div>
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              {loading ? "…" : `${recoveredRate}% recovery rate`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Recovery Rate</CardTitle>
            <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Live
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : `${recoveredRate}%`}</div>
            <p className="text-xs text-slate-400 mt-1">Recovered vs abandoned carts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Language Metrics Breakdown</CardTitle>
            <CardDescription className="text-slate-400">
              Volume handled by each localized recovery layer
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading analytics…
              </div>
            ) : languageData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No language data yet — carts will appear after recovery runs.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      color: "#f8fafc",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="counts" name="Abandoned Carts" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Share by Language</CardTitle>
            <CardDescription className="text-slate-400">
              Which linguistic layer brings back more revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {loading ? (
              <div className="text-sm text-slate-400">Loading analytics…</div>
            ) : languageData.length === 0 ? (
              <div className="text-sm text-slate-400">No recovered revenue yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatInr(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
