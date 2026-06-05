"use client";

import { useState } from "react";
import { Video, Sparkles, RefreshCw } from "lucide-react";

export default function VideoMessaging() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoStatus, setVideoStatus] = useState('Idle');

  const triggerTestGeneration = () => {
    setIsGenerating(true);
    setVideoStatus('Rendering Avatar...');
    setTimeout(() => {
      setVideoStatus('Syncing Audio Voiceover...');
      setTimeout(() => {
        setIsGenerating(false);
        setVideoStatus('Generated Successfully! (Ready to dispatch)');
      }, 1500);
    }, 1500);
  };

  return (
    <div className="bg-neutral-950/40 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center">
          <Video className="h-6 w-6 text-pink-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">1. Personalized Video Messaging</h3>
          <p className="text-xs text-neutral-500">Generative AI Video Recovery Engine</p>
        </div>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed mb-6">
        Yeh feature standard text message ko rich custom multimedia workflow me convert karta hai. Jaise hi koi user cart leave karega, background worker avatar request initiate karega: <code className="text-pink-300 bg-pink-950/30 px-1.5 py-0.5 rounded">&quot;Hey [Name], your cart is waiting!&quot;</code>.
      </p>

      {/* Live Simulation Sandbox */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-3">
          AI Video Rendering Sandbox
        </span>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-sm font-medium text-neutral-300">Status: {videoStatus}</span>
          </div>
          <button
            onClick={triggerTestGeneration}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-md shadow-pink-600/10"
          >
            {isGenerating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Simulate AI Video Build
          </button>
        </div>
      </div>
    </div>
  );
}
