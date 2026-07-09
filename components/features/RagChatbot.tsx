import { Bot, Terminal, Shield, Cpu } from "lucide-react";

export default function RagChatbot() {
  return (
    <div className="min-h-[280px] rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50">
          <Bot className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">3. RAG-Based Smart Chatbot</h3>
          <p className="text-xs text-slate-500">Knowledge-Base Vector Embedding Router</p>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        Instead of generic auto-replies, CartRenew uses Retrieval-Augmented Generation (RAG). A
        Supabase Vector (`pgvector`) pipeline stays linked to Shopify store settings so the chatbot
        can handle size mismatches and custom tax structures instantly.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <Terminal className="mx-auto mb-1 h-4 w-4 text-indigo-600" />
          <span className="block text-[10px] font-medium text-slate-500">Embeddings Matrix</span>
          <span className="mt-0.5 block text-xs font-bold text-slate-900">1536 dim</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <Shield className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
          <span className="block text-[10px] font-medium text-slate-500">Context Injected</span>
          <span className="mt-0.5 block text-xs font-bold text-slate-900">Strict Match</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <Cpu className="mx-auto mb-1 h-4 w-4 text-pink-500" />
          <span className="block text-[10px] font-medium text-slate-500">Avg Response Time</span>
          <span className="mt-0.5 block text-xs font-bold text-slate-900">&lt; 1.2s</span>
        </div>
      </div>
    </div>
  );
}
