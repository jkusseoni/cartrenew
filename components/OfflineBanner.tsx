"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity via the online/offline events.
 * Returns true during SSR so the banner never flashes on first paint.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Fixed banner shown whenever the browser loses network connectivity.
 * Mounted once in the locale layout so every page gets it for free.
 * Shows a brief "Back online" confirmation when connectivity returns.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-full px-5 py-2.5 text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-2 transition-colors ${
        isOnline
          ? "bg-emerald-950/90 text-emerald-300 border border-emerald-800/50"
          : "bg-red-950/90 text-red-300 border border-red-800/50"
      }`}
    >
      <span
        className={`inline-flex h-2 w-2 rounded-full ${
          isOnline ? "bg-emerald-400" : "bg-red-400 animate-pulse"
        }`}
        aria-hidden
      />
      {isOnline ? "Back online" : "Connection lost — retrying when network returns…"}
    </div>
  );
}
