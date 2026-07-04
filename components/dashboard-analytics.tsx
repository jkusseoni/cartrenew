"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ShoppingCart, MessageSquare, DollarSign } from "lucide-react";

// Mock Data - Yeh baad mein aapki Prisma/Postgres API se fetch hoga
const languageData = [
  { name: "Hinglish", counts: 540, revenue: 269400 },
  { name: "English", counts: 210, revenue: 104800 },
  { name: "Kannada", counts: 95, revenue: 47400 },
  { name: "Hindi", counts: 320, revenue: 159600 },
];

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

export default function DashboardAnalytics() {
  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CartRenew Dashboard</h1>
          <p className="text-slate-400">Real-time WhatsApp Autonomous Recovery Insights</p>
        </div>
      </div>

      {/* 1. Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total Abandoned</CardTitle>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,165</div>
            <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +12% since last week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Messages Sent</CardTitle>
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,080</div>
            <p className="text-xs text-slate-400 mt-1">92.7% automation match</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Recovered Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹5,81,200</div>
            <p className="text-xs text-emerald-400 mt-1">68% recovery benchmark hit</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">AI Trust Score</CardTitle>
            <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Sovereign</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-slate-400 mt-1">Zero fallback localization</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Bar Chart: Language Wise Conversions */}
        <Card className="col-span-4 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Language Metrics Breakdown</CardTitle>
            <CardDescription className="text-slate-400">Total volume handled by each localized model layer</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={languageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                />
                <Legend />
                <Bar dataKey="counts" name="Abandoned Carts" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart: Revenue Distribution */}
        <Card className="col-span-3 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Share by Language</CardTitle>
            <CardDescription className="text-slate-400">Which linguistic layer brings back more money</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="revenue"
                >
                  {languageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
