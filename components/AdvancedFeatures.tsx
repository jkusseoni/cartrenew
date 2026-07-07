"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function AdvancedFeatures() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  return (
    <section className="w-full bg-[#030712] relative py-24 overflow-hidden border-t border-white/5">
      
      {/* 🔮 Ambient Glow Layer Specific to Features Grid */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[140px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/15 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-left space-y-4 mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-400">
            ⚡ Advanced Automation Layer
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Future-ready recovery features for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
              global SaaS scale
            </span>
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Expand the core cart recovery stack with rich media, checkout-native conversations, context-aware AI support, and segmentation testing for cross-border merchants.
          </p>
        </div>

        {/* 📊 GRID OF 4 PREMIUM CARDS */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          
          {/* Card 1: Personalized Video Messaging */}
          <motion.div variants={cardVariants} className="bg-slate-950/40 border border-white/10 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-blue-500/30 transition-all shadow-xl shadow-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold">📹</div>
              <h3 className="text-base font-bold text-white tracking-tight">1. Personalized Video Messaging</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              यह फीचर स्टैंडर्ड टेक्स्ट मैसेज को रिच कस्टम मल्टीमीडिया वर्कफ्लो में बदल देता है। जैसे ही कोई यूजर कार्ट छोड़ता है, बैकग्राउंड वर्कर वीडियो रिक्वेस्ट जनरेट करता है: <span className="text-pink-400 font-mono">"Hey {`{Name}`}, your cart is waiting!"</span>.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs backdrop-blur-md">
              <span className="text-slate-400">AI Video Render Sandbox</span>
              <button className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] rounded-lg transition-colors">Simulate AI Video</button>
            </div>
          </motion.div>

          {/* Card 2: In-Chat Conversational Checkout */}
          <motion.div variants={cardVariants} className="bg-slate-950/40 border border-white/10 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-blue-500/30 transition-all shadow-xl shadow-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">💬</div>
              <h3 className="text-base font-bold text-white tracking-tight">2. In-Chat Conversational Checkout</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              कस्टमर को लिंक पर क्लिक करके दोबारा ब्राउज़र लोडिंग के झंझट से नहीं जूझना पड़ेगा। WhatsApp Business API सैंडबॉक्स के अंदर पेमेंट गेटवे इंटीग्रेशन लॉजिक सीधे कम्प्लीट कार्ड क्लियरेंस रनटाइम को इनवोक करता है।
            </p>
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Your Shopify Cart has 1 Product waiting. Would you like to check out natively?
            </div>
          </motion.div>

          {/* Card 3: RAG-Based Smart Chatbot */}
          <motion.div variants={cardVariants} className="bg-slate-950/40 border border-white/10 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-blue-500/30 transition-all shadow-xl shadow-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">🤖</div>
              <h3 className="text-base font-bold text-white tracking-tight">3. RAG-Based Smart Chatbot</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              नॉर्मल जेनेरिक ऑटोमेटेड टेक्स्ट रिप्लाई के बदले हम यूज़ करते हैं <b className="text-blue-400">Retrieval-Augmented Generation (RAG)</b>. Supabase Vector (pgvector) पाइपलाइन सीधे स्टोर सेटिंग्स से कनेक्टेड है, जिससे बॉट इंसेंटिव साइज़ को मैच कर सकता है।
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="bg-white/5 border border-white/5 p-2 rounded-lg text-slate-300">Vector Status: <span className="text-blue-400">Synced</span></div>
              <div className="bg-white/5 border border-white/5 p-2 rounded-lg text-slate-300">Context Match: <span className="text-emerald-400">94%</span></div>
              <div className="bg-white/5 border border-white/5 p-2 rounded-lg text-slate-300">Avg Response: <span className="text-indigo-400">&lt; 1.2s</span></div>
            </div>
          </motion.div>

          {/* Card 4: Audience Segmentation & A/B Testing */}
          <motion.div variants={cardVariants} className="bg-slate-950/40 border border-white/10 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-blue-500/30 transition-all shadow-xl shadow-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">📊</div>
              <h3 className="text-base font-bold text-white tracking-tight">4. Audience Segmentation & A/B Testing</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              ऑटोमेशन फ्लो ऑप्टिमाइज़ करने के लिए डायनेमिक सेगमेंट राउटिंग। हाई-टिकट वैल्यू ऑर्डर्स को सीधे हाई-प्रायोरिटी नोड्स पर ऑटोमैटिक राउट करेंगे, जबकि अल्टरनेटिव अकाउंट स्ट्रिंग्स ऑटोमैटिक A/B टेस्ट स्प्लिट एक्ज़ीक्यूट करेंगी।
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-slate-400"><span>Template A (10% Offer Hook)</span> <span className="text-emerald-400 font-bold">72% CR</span></div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '72%' }} /></div>
              <div className="flex justify-between text-[10px] text-slate-400"><span>Template B (FOMO Countdown Template)</span> <span className="text-amber-400 font-bold">51% CR</span></div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: '51%' }} /></div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}