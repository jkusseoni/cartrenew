import { Bot, Terminal, Shield, Cpu } from 'lucide-react';

export default function RagChatbot() {
  return (
    <div className="bg-neutral-950/40 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
          <Bot className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">3. RAG-Based Smart Chatbot</h3>
          <p className="text-xs text-neutral-500">Knowledge-Base Vector Embedding Router</p>
        </div>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed mb-6">
        Normal generic automated text reply ke badle hum use karte hain **Retrieval-Augmented Generation (RAG)**. Supabase Vector (`pgvector`) pipeline directly link rehti hai shopify store settings se, jisse chatbot instant size mismatch aur custom tax structures handle kar leta hai.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-center">
          <Terminal className="h-4 w-4 mx-auto text-indigo-400 mb-1" />
          <span className="text-[10px] font-medium text-neutral-400 block">Embeddings Matrix</span>
          <span className="text-xs font-bold text-white mt-0.5 block">1536 dim</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-center">
          <Shield className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <span className="text-[10px] font-medium text-neutral-400 block">Context Injected</span>
          <span className="text-xs font-bold text-white mt-0.5 block">Strict Match</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-center">
          <Cpu className="h-4 w-4 mx-auto text-pink-400 mb-1" />
          <span className="text-[10px] font-medium text-neutral-400 block">Avg Response Time</span>
          <span className="text-xs font-bold text-white mt-0.5 block">&lt; 1.2s</span>
        </div>
      </div>
    </div>
  );
}
