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
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } 
    }
  };

  return (
    // 🌸 सॉफ़्ट लाइट थीम कंटेनर (bg-transparent ताकि मेन लेआउट का ग्लो ग्रिड दिखे)
    <section className="w-full bg-transparent relative py-24 overflow-hidden border-t border-slate-200/60 z-10">
      
      {/* 🔮 लोकल लाइट-थीम एम्बिएंट ग्लो (पिंक और ब्लू का कोमल टच) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-blue-100/40 blur-[130px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] bg-pink-100/40 blur-[140px] rounded-full mix-blend-multiply" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-left space-y-4 mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
            ⚡ Advanced Automation Layer
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Future-ready recovery features for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-600">
              global SaaS scale
            </span>
          </h2>
          <p className="text-slate-500 text-sm max-w-2xl leading-relaxed font-medium">
            Expand the core cart recovery stack with rich media, checkout-native conversations, context-aware AI support, and segmentation testing for cross-border merchants.
          </p>
        </div>

        {/* 📊 GRID OF 4 PREMIUM LIGHT CARDS */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          
          {/* Card 1: Personalized Video Messaging */}
          <motion.div variants={cardVariants} className="bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-pink-300 hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-500 font-bold shadow-sm">📹</div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">1. Personalized Video Messaging</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium mb-6">
              यह फीचर स्टैंडर्ड टेक्स्ट मैसेज को रिच कस्टम मल्टीमीडिया वर्कफ्लो में बदल देता है। जैसे ही कोई यूजर कार्ट छोड़ता है, बैकग्राउंड वर्कर वीडियो रिक्वेस्ट जनरेट करता है: <span className="text-pink-600 font-mono font-bold bg-pink-50 px-1 rounded">"Hey {`{Name}`}, your cart is waiting!"</span>.
            </p>
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold">AI Video Render Sandbox</span>
              <button className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-black text-[10px] rounded-lg transition-colors shadow-sm">Simulate AI Video</button>
            </div>
          </motion.div>

          {/* Card 2: In-Chat Conversational Checkout */}
          <motion.div variants={cardVariants} className="bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-500 font-bold shadow-sm">💬</div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">2. In-Chat Conversational Checkout</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium mb-6">
              कस्टमर को लिंक पर क्लिक करके दोबारा ब्राउज़र लोडिंग के झंझट से नहीं जूझना पड़ेगा। WhatsApp Business API सैंडबॉक्स के अंदर पेमेंट गेटवे इंटीग्रेशन लॉजिक सीधे कम्प्लीट कार्ड क्लियरेंस रनटाइम को इनवोक करता है।
            </p>
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 text-[11px] text-emerald-700 font-bold flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Your Shopify Cart has 1 Product waiting. Would you like to check out natively?
            </div>
          </motion.div>

          {/* Card 3: RAG-Based Smart Chatbot */}
          <motion.div variants={cardVariants} className="bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-500 font-bold shadow-sm">🤖</div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">3. RAG-Based Smart Chatbot</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium mb-6">
              नॉर्मल जेनेरिक ऑटोमेटेड टेक्स्ट रिप्लाई के बदले हम यूज़ करते हैं <span className="text-blue-600 font-black">Retrieval-Augmented Generation (RAG)</span>। Supabase Vector (pgvector) पाइपलाइन सीधे स्टोर सेटिंग्स से कनेक्टेड है, जिससे बॉट इंसेंटिव साइज़ को मैच कर सकता है।
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono font-bold">
              <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-slate-600">Vector: <span className="text-blue-600">Synced</span></div>
              <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-slate-600">Context: <span className="text-emerald-600">94%</span></div>
              <div className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg text-slate-600">Avg Resp: <span className="text-indigo-600">&lt; 1.2s</span></div>
            </div>
          </motion.div>

          {/* Card 4: Audience Segmentation & A/B Testing */}
          <motion.div variants={cardVariants} className="bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl relative group hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm">📊</div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">4. Audience Segmentation & A/B Testing</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium mb-5">
              ऑटोमेशन फ्लो ऑप्टिमाइज़ करने के लिए डायनेमिक सेगमेंट राउटिंग। हाई-टिकट वैल्यू ऑर्डर्स को सीधे हाई-प्रायोरिटी नोड्स पर ऑटोमैटिक राउट करेंगे, जबकि अल्टरनेटिव अकाउंट स्ट्रिंग्स ऑटोमैटिक A/B टेस्ट स्प्लिट एक्ज़ीक्यूट करेंगी।
            </p>
            <div className="space-y-2 bg-slate-50 border border-slate-200/60 p-3 rounded-xl shadow-sm">
              <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Template A (10% Offer Hook)</span> <span className="text-emerald-600 font-black">72% CR</span></div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '72%' }} /></div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Template B (FOMO Countdown)</span> <span className="text-amber-600 font-black">51% CR</span></div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: '51%' }} /></div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}