"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// GSAP प्लगइन रजिस्टर करें
gsap.registerPlugin(ScrollTrigger);

export default function AdvancedFeatures() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // कार्ड्स के लिए एनीमेशन
      gsap.fromTo(
        ".feature-card",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".features-grid",
            start: "top 85%",
            toggleActions: "play none none none"
          }
        }
      );
    }, sectionRef);

    return () => ctx.revert(); // क्लीनअप
  }, []);

  return (
    <section ref={sectionRef} className="w-full bg-transparent relative py-24 overflow-hidden border-t border-slate-200/60 z-10">
      
      {/* बैकग्राउंड ग्लो */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-blue-100/40 blur-[130px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] bg-pink-100/40 blur-[140px] rounded-full mix-blend-multiply" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* हेडर */}
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

        {/* ग्रिड कंटेनर - 'features-grid' क्लास दी है */}
        <div className="features-grid grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1 */}
          <div className="feature-card bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl hover:border-pink-300 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-500 font-bold shadow-sm">📹</div>
              <h3 className="text-base font-black text-slate-900">1. Personalized Video Messaging</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-6">यह फीचर स्टैंडर्ड टेक्स्ट मैसेज को रिच मल्टीमीडिया में बदलता है।</p>
          </div>

          {/* Card 2 */}
          <div className="feature-card bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl hover:border-emerald-300 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-500 font-bold shadow-sm">💬</div>
              <h3 className="text-base font-black text-slate-900">2. In-Chat Conversational Checkout</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-6">WhatsApp API के माध्यम से बिना ब्राउज़र के सीधे पेमेंट संभव।</p>
          </div>

          {/* Card 3 */}
          <div className="feature-card bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl hover:border-blue-300 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-500 font-bold shadow-sm">🤖</div>
              <h3 className="text-base font-black text-slate-900">3. RAG-Based Smart Chatbot</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-6">Retrieval-Augmented Generation के साथ AI रिस्पॉन्स।</p>
          </div>

          {/* Card 4 */}
          <div className="feature-card bg-white/70 border border-slate-200/80 p-6 rounded-2xl backdrop-blur-xl hover:border-amber-300 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm">📊</div>
              <h3 className="text-base font-black text-slate-900">4. Audience Segmentation & A/B Testing</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-5">ऑटोमेशन फ्लो ऑप्टिमाइज़ करने के लिए डायनेमिक सेगमेंट राउटिंग।</p>
          </div>

        </div>
      </div>
    </section>
  );
}