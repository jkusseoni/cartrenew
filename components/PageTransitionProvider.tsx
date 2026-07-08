"use client";

export default function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col w-full">{children}</div>;
}