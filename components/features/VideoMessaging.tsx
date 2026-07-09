"use client";

import { useEffect, useRef, useState } from "react";
import { Video, Sparkles, RefreshCw } from "lucide-react";

type VideoStatus = "idle" | "generating" | "rendered";

const STATUS_TEXT: Record<VideoStatus, string> = {
  idle: "Status: Idle",
  generating: "Status: Generating Avatar Workspace...",
  rendered: "Status: Video Rendered successfully! (Ready to Send)",
};

const STATUS_DOT: Record<VideoStatus, string> = {
  idle: "bg-slate-400",
  generating: "bg-amber-400 animate-pulse",
  rendered: "bg-emerald-500",
};

export default function VideoMessaging() {
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isVideoRendering = videoStatus === "generating";

  const triggerTestGeneration = () => {
    if (isVideoRendering) return;
    setVideoStatus("generating");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVideoStatus("rendered");
      timeoutRef.current = null;
    }, 2500);
  };

  return (
    <div className="min-h-[280px] rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-pink-200 bg-pink-50">
          <Video className="h-6 w-6 text-pink-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">1. Personalized Video Messaging</h3>
          <p className="text-xs text-slate-500">Generative AI Video Recovery Engine</p>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        Converts standard text recovery into rich multimedia. When a shopper leaves checkout, a
        background worker can generate an avatar clip like{" "}
        <code className="rounded bg-pink-50 px-1.5 py-0.5 text-pink-600">
          &quot;Hey [Name], your cart is waiting!&quot;
        </code>
        .
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          AI Video Rendering Sandbox
        </span>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full transition-colors ${STATUS_DOT[videoStatus]}`} />
            <span className="text-sm font-medium text-slate-700">{STATUS_TEXT[videoStatus]}</span>
          </div>
          <button
            type="button"
            onClick={triggerTestGeneration}
            disabled={isVideoRendering}
            className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-600/10 transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isVideoRendering ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Simulate AI Video Build
          </button>
        </div>
      </div>
    </div>
  );
}
