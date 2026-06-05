"use client";

import React, { useState, useEffect } from 'react';

// ========================================================
// 1. Premium Vector SVG Icons (Zero Dependencies Required)
// ========================================================
const SvgIcon = ({ name, className = "w-5 h-5" }) => {
  const icons = {
    demo: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    ),
    blog: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6m-6 4h5" />
    ),
    chart: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    gift: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm-2 4h4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
    ),
    code: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    ),
    map: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    ),
    whatsapp: (
      <path fill="currentColor" d="M12.01 2.003c-5.502 0-9.963 4.464-9.963 9.963 0 1.76.457 3.477 1.328 5.011L2 22l5.177-1.357c1.478.807 3.136 1.233 4.82 1.233 5.501 0 9.961-4.464 9.961-9.963 0-5.499-4.46-9.963-9.961-9.963zm5.666 14.123c-.246.696-1.22 1.285-1.685 1.365-.466.08-1.033.151-3.087-.714-2.628-1.107-4.32-3.78-4.452-3.956-.131-.175-1.055-1.402-1.055-2.677 0-1.275.656-1.902.889-2.164.233-.262.508-.328.677-.328.169 0 .339.001.487.008.157.007.369-.059.576.444.212.516.724 1.762.787 1.893.063.131.106.284.021.455-.085.171-.127.278-.254.426-.127.148-.267.33-.381.443-.127.127-.26.265-.112.519.148.254.659 1.087 1.413 1.76.97.868 1.791 1.137 2.046 1.265.254.127.402.106.551-.064.148-.171.635-.742.805-1.002.169-.26.339-.212.571-.127.233.085 1.482.698 1.736.825.254.127.423.19.487.3.063.111.063.645-.183 1.341z" />
    ),
    arrowUpRight: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    ),
    copy: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    )
  };

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[name] || <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
    </svg>
  );
};

// ========================================================
// 2. Translations Dictionary (Hinglish/Hindi & English)
// ========================================================
const t = {
  en: {
    dashboardTitle: "CartRenew Engine",
    dashboardSub: "Merchant Acquisition & Growth Activation Tools",
    liveStatus: "Live System Connected",
    syncSystem: "Sync Services",
    growthModules: "Growth & Marketing Modules",
    metaSetup: "Interactive Walkthrough Guide",
    langLabel: "English Active",
    langAction: "Hinglish में बदलें",
    toastDashboardSynced: "🚀 System synchronized with real-time queues!",
    toastLinkCopied: "📋 Referral link copied to clipboard!",
    toastSnippetCopied: "📋 Developer integration code copied!",
    toastWalkthroughFinished: "🚀 Great! Walkthrough onboarding finished successfully!",
    toastDemoSent: "🎉 Demo notification successfully triggered via BullMQ!",
    
    // Tabs
    tabDemo: "Live Demo Store",
    tabDemoSub: "Simulate WhatsApp Recovery",
    tabBlog: "SEO Blog Section",
    tabBlogSub: "Organic merchant traffic",
    tabChart: "Case Study & ROI",
    tabChartSub: "Dynamic revenue calculators",
    tabGift: "Referral Program",
    tabGiftSub: "2 Months free promo cycle",
    tabCode: "Public Developer APIs",
    tabCodeSub: "Self-serve custom SDKs",
    tabMap: "Interactive Onboarding",
    tabMapSub: "Step-by-step Meta setup",

    // Live Demo
    demoHeader: "Live Demo Store (WhatsApp Notification)",
    demoSub: "Onboard merchants in seconds by letting them experience custom WhatsApp AI-driven recoveries on their own devices.",
    demoSectionTitle: "Customer Purchase Context",
    custNameLabel: "Customer Name",
    custPhoneLabel: "WhatsApp Phone Number (With Country Code)",
    prodNameLabel: "Abandoned Product Name",
    cartValueLabel: "Cart Value",
    incentiveLabel: "Select Automated Incentive Offer",
    incentiveDiscount: "10% Discount Code",
    incentiveShipping: "Free Shipping",
    incentiveNone: "Simple Custom Reminder",
    buttonSimulate: "Simulate Live WhatsApp Recovery",
    buttonSimulating: "Processing Real-Time BullMQ Job...",
    terminalHeader: "// Background Queue Execution Output",
    terminalEmpty: "Click simulator button to track real-time queue execution details...",
    phoneHeader: "CartRenew Engine",
    phoneVerified: "Verified Business Account",

    // SEO Blog Section
    blogHeader: "SEO Content Engine (/blog)",
    blogSub: "Generate high-ranking organic pages to capture search terms like 'Shopify checkout abandonment' and convert merchants passively.",
    blogBack: "← Back to Articles",
    blogReadability: "Readability Rating:",
    blogReadMore: "Read Full Manual",
    seoRating: "SEO Optimization Score",
    seoKeywords: "Primary Target Keywords",

    // Case Study
    caseHeader: "Merchant Case Studies & ROI",
    caseSub: "Showcase solid analytical metrics to premium brands to demonstrate exactly how much lost checkout profit CartRenew saves.",
    caseBadge: "Global Scale Success Case",
    caseTitle: "How Fashion House 'Vastra-Vibes' Boosted Completion From 68% to 82%",
    caseDesc: "Leading apparel store Vastra-Vibes suffered massive database drop-offs due to third-party cookies being blocked. By installing CartRenew's serverless Meta CAPI queue paired with custom dynamic prompts, they recovered missing checks in 14 days.",
    caseInitRate: "Initial Rate",
    casePostRate: "Post-Integration",
    caseNetProfit: "Net Added Profit",
    chartTitle: "Checkout Completion Comparison Curve",
    calcHeader: "Check Your Estimated Recovered Revenue",
    calcRevenueLabel: "Monthly Store Revenue:",
    calcAbandonLabel: "Checkout Abandonment Rate:",
    calcLostLabel: "Monthly Lost Opportunity Value",
    calcSavedLabel: "Estimated Recovered",
    calcMonthlySaved: "/ Monthly Saved",
    calcEquivalent: "Equivalent Monthly Value Saved",

    // Referral Program
    refHeader: "SaaS Referral & Rewards Portal",
    refSub: "Create organic word-of-mouth loops. Let merchants refer their store owner friends—both get 2 months of premium service free.",
    refSectionTitle: "Your Unique Referral Portal",
    refCodeLabel: "Your Promo Referral Code",
    refLinkLabel: "Referral Share Link",
    refDescBox: "Send this customized tracking link to friends on Shopify, WooCommerce, or Custom Node stores. When they connect their first token, you both get 2 Months free premium credit!",
    refEstimatorHeader: "Reward Credit Estimator",
    refEstimatorInvites: "Stores you plan to invite:",
    refEstimatorFreeService: "Total Free Service Earned",
    refEstimatorValueSaved: "Equivalent Pricing Value Saved:",

    // API Docs
    apiHeader: "Developer Public APIs",
    apiSub: "Empower high-volume tech teams to skip generic dashboards. Provide clean, secure REST parameters to link custom systems.",
    apiPlayground: "API Sandbox Playground",
    apiValueLabel: "Product Price Value (INR/USD)",
    apiEventLabel: "Target Conversion Event",
    apiSnippetHeader: "Auto-Generated Integration Code Snippet",
    apiResponseLabel: "Response payload (200 OK)",

    // Onboarding Module
    onboardingHeader: "Self-Serve Setup Tutorial",
    onboardingSub: "Avoid drop-offs during onboarding. This step-by-step visual interactive wizard guides merchants on how to safely link Meta Cloud API credentials.",
    onboardingStepBadge: "Step {val} of 4",
    onboardingPortal: "Self-Serve Onboarding Portal",
    onboardingPrev: "← Previous Setup Step",
    onboardingNext: "Next Setup Step →",
    onboardingFinish: "Finish Tutorial Setup"
  },
  hi: {
    dashboardTitle: "CartRenew Engine",
    dashboardSub: "मर्चेंट एक्विज़िशन और ग्रोथ एक्टिवेशन टूल्स",
    liveStatus: "लाइव सिस्टम कनेक्टेड है",
    syncSystem: "सिस्टम सिंक करें",
    growthModules: "ग्रोथ और मार्केटिंग मॉड्यूल्स",
    metaSetup: "इंटरैक्टिव वॉकथ्रू गाइड",
    langLabel: "Hinglish एक्टिव है",
    langAction: "Switch to English",
    toastDashboardSynced: "🚀 रियल-टाइम कतारों के साथ सिस्टम सिंक हो गया है!",
    toastLinkCopied: "📋 रेफरल लिंक क्लिपबोर्ड पर कॉपी हो गया!",
    toastSnippetCopied: "📋 डेवलपर इंटीग्रेशन कोड कॉपी हो गया!",
    toastWalkthroughFinished: "🚀 बहुत बढ़िया! वॉकथ्रू ऑनबोर्डिंग पूरी हो गई है!",
    toastDemoSent: "🎉 BullMQ कतार के माध्यम से डेमो मैसेज ट्रिगर हो गया!",
    
    // Tabs
    tabDemo: "लाइव डेमो स्टोर",
    tabDemoSub: "WhatsApp रिकवरी का परीक्षण",
    tabBlog: "एसईओ ब्लॉग सेक्शन",
    tabBlogSub: "ऑर्गेनिक मर्चेंट ट्रैफ़िक",
    tabChart: "सफलता की कहानियाँ & ROI",
    tabChartSub: "डायनेमिक रेवेन्यू कैलकुलेटर",
    tabGift: "रेफरल प्रोग्राम",
    tabGiftSub: "2 महीने फ्री प्रोमो साइकिल",
    tabCode: "पब्लिक एपीआई डॉक्स",
    tabCodeSub: "डेवलपर्स के लिए कस्टम SDKs",
    tabMap: "इंटरैक्टिव ऑनबोर्डिंग",
    tabMapSub: "स्टेप-बाय-स्टेप Meta सेटअप",

    // Live Demo
    demoHeader: "लाइव डेमो स्टोर (WhatsApp Simulation)",
    demoSub: "नए मर्चेंट्स को ऑनबोर्ड करने के लिए उनके फोन पर लाइव कस्टमाइज्ड WhatsApp AI रिकवरी मैसेज का शानदार अनुभव दें।",
    demoSectionTitle: "कस्टमर परचेस डिटेल्स",
    custNameLabel: "कस्टमर का नाम",
    custPhoneLabel: "टारगेट फोन नंबर (कंट्री कोड के साथ)",
    prodNameLabel: "अबांडन्ड प्रोडक्ट का नाम",
    cartValueLabel: "कार्ट की वैल्यू",
    incentiveLabel: "ऑटोमेटेड इंसेंटिव ऑफर चुनें",
    incentiveDiscount: "10% डिस्काउंट कोड",
    incentiveShipping: "फ्री शिपिंग",
    incentiveNone: "साधारण रिमाइंडर",
    buttonSimulate: "लाइव WhatsApp रिकवरी सिम्युलेट करें",
    buttonSimulating: "कतार में बैकग्राउंड जॉब प्रोसेस हो रही है...",
    terminalHeader: "// सिस्टम रियल-टाइम कतार आउटपुट",
    terminalEmpty: "कतार की बैकग्राउंड एक्टिविटी देखने के लिए सिमुलेटर बटन दबाएं...",
    phoneHeader: "CartRenew Engine",
    phoneVerified: "वेरिफाइड बिजनेस अकाउंट",

    // SEO Blog Section
    blogHeader: "एसईओ ब्लॉग सेक्शन (/blog)",
    blogSub: "Shopify और WooCommerce मर्चेंट्स को ऑर्गेनिक सर्च से आकर्षित करने के लिए हाई-रैंकिंग ब्लॉग कंटेंट टूल्स।",
    blogBack: "← लेखों पर वापस जाएं",
    blogReadability: "रीडेबिलिटी स्कोर:",
    blogReadMore: "पूरा लेख पढ़ें",
    seoRating: "SEO ऑप्टिमाइजेशन स्कोर",
    seoKeywords: "टारगेटेड मुख्य कीवर्ड्स",

    // Case Study
    caseHeader: "सफलता की कहानियाँ & ROI",
    caseSub: "बड़े ब्रांड्स को ऑनबोर्ड करने के लिए उन्हें अपनी पिछली सफलता के आंकड़े और कैलकुलेटर के जरिए लाइव ROI दिखाएं।",
    caseBadge: "ग्लोबल सक्सेस केस",
    caseTitle: "कैसे क्लोथिंग ब्रांड 'Vastra-Vibes' ने रिकवरी दर को 68% से बढ़ाकर 82% किया",
    caseDesc: "प्रसिद्ध कपड़ों के स्टोर Vastra-Vibes की कुकीज़ ब्लॉक होने के कारण कार्ट छूट रहे थे। CartRenew के सर्वर-साइड Meta CAPI और Gemini 1.5 Flash कस्टमाइज़ज़्ड प्रॉम्प्ट्स की मदद से उन्होंने केवल 14 दिनों में भारी राजस्व बचाया।",
    caseInitRate: "शुरुआती दर",
    casePostRate: "इंटीग्रेशन के बाद",
    caseNetProfit: "शुद्ध अतिरिक्त मुनाफा",
    chartTitle: "चेकआउट कम्प्लीशन कम्पेरिजन कर्व",
    calcHeader: "अपना अनुमानित बचा हुआ राजस्व चेक करें",
    calcRevenueLabel: "मासिक स्टोर रेवेन्यू:",
    calcAbandonLabel: "चेकआउट अबांडनमेंट रेट:",
    calcLostLabel: "मासिक छूटा हुआ रेवेन्यू अवसर",
    calcSavedLabel: "अनुमानित रिकवर्ड बचत",
    calcMonthlySaved: "/ मासिक बचत",
    calcEquivalent: "बराबर मासिक मूल्य बचत",

    // Referral Program
    refHeader: "रेफरल और रिवॉर्ड्स प्रोग्राम",
    refSub: "ऑर्गेनिक रेफरल का जाल बनाएं। जब एक मर्चेंट अपने दोस्तों को लाएगा, तो दोनों को 2 महीने का प्रीमियम प्लान मुफ्त मिलेगा।",
    refSectionTitle: "आपका संक्षिप्त रेफरल पोर्टल",
    refCodeLabel: "आपका प्रोमो रेफरल कोड",
    refLinkLabel: "रेफरल शेयर लिंक",
    refDescBox: "Shopify, WooCommerce या कस्टम नोड स्टोर्स पर काम करने वाले दोस्तों को यह लिंक भेजें। उनके पहले मैसेज कतार में आते ही आप दोनों को 2 महीने का प्रीमियम क्रेडिट मिलेगा!",
    refEstimatorHeader: "रिवॉर्ड क्रेडिट एस्टीमेटर",
    refEstimatorInvites: "स्टोर जिन्हें आप आमंत्रित करना चाहते हैं:",
    refEstimatorFreeService: "अर्जित कुल मुफ्त सेवा समय",
    refEstimatorValueSaved: "बचाया गया बराबर मूल्य बचत:",

    // API Docs
    apiHeader: "डेवलपर्स के लिए पब्लिक एपीआई डॉक्स",
    apiSub: "हाई-वॉल्यूम टेक टीमों को कस्टम सिस्टम से जोड़ने के लिए सीधा REST API का सुरक्षित ढांचा उपलब्ध कराएं।",
    apiPlayground: "एपीआई सैंडबॉक्स प्लेग्राउंड",
    apiValueLabel: "प्रोडक्ट की कीमत (INR/USD)",
    apiEventLabel: "टारगेट कन्वर्जन इवेंट",
    apiSnippetHeader: "ऑटो-जेनरेटेड डेवलपर कोड स्निपेट",
    apiResponseLabel: "रिस्पांस पेलोड (200 OK)",

    // Onboarding Module
    onboardingHeader: "इंटरैक्टिव ऑनबोर्डिंग गाइड (वॉकथ्रू)",
    onboardingSub: "ऑनबोर्डिंग के दौरान मर्चेंट्स को खोने से बचाएं। यह आसान 4-स्टेप विजार्ड मर्चेंट्स को Meta API क्रेडेंशियल्स कनेक्ट करने की आसान विधि समझाता है।",
    onboardingStepBadge: "स्टेप {val} ऑफ 4",
    onboardingPortal: "मर्चेंट ऑनबोर्डिंग पोर्टल",
    onboardingPrev: "← पिछला सेटअप स्टेप",
    onboardingNext: "अगला सेटअप स्टेप →",
    onboardingFinish: "ट्यूटोरियल समाप्त करें"
  }
};

// ==========================================
// 3. Main Premium React Page Component Export
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('demo');
  const [toastMessage, setToastMessage] = useState(null);
  const [lang, setLang] = useState('en'); // Defaults to English, can easily switch to Hinglish/Hindi-Latin

  // Language based dynamic dictionary mapping
  const d = t[lang];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLangToggle = () => {
    const nextLang = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    showToast(nextLang === 'hi' ? '🇮🇳 Hinglish/Hindi भाषा चालू हो गई है!' : '🌐 English language mode enabled!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Dynamic Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl font-black text-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] tracking-tight">
              CR
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {d.dashboardTitle} 
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Growth Suite
                </span>
              </h1>
              <p className="text-xs text-slate-400">{d.dashboardSub}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Language Switcher Toggle */}
            <button
              onClick={handleLangToggle}
              className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition px-3.5 py-1.5 rounded-lg border border-slate-700/60 font-semibold"
            >
              <span className="text-sm">{lang === 'en' ? '🌐' : '🇮🇳'}</span>
              <span>{d.langLabel}</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 rounded-md">
                {lang === 'en' ? 'Hinglish' : 'English'}
              </span>
            </button>

            <button 
              onClick={() => showToast(d.toastDashboardSynced)}
              className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg transition shadow-lg shadow-emerald-500/20"
            >
              {d.syncSystem}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 sticky top-24 backdrop-blur-md">
            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3 px-2">
              {d.growthModules}
            </p>
            <nav className="space-y-1">
              {[
                { id: 'demo', label: d.tabDemo, icon: 'demo', desc: d.tabDemoSub },
                { id: 'blog', label: d.tabBlog, icon: 'blog', desc: d.tabBlogSub },
                { id: 'case-study', label: d.tabChart, icon: 'chart', desc: d.tabChartSub },
                { id: 'referral', label: d.tabGift, icon: 'gift', desc: d.tabGiftSub },
                { id: 'api-docs', label: d.tabCode, icon: 'code', desc: d.tabCodeSub },
                { id: 'onboarding', label: d.tabMap, icon: 'map', desc: d.tabMapSub },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition ${
                    activeTab === tab.id
                      ? 'bg-slate-800/80 border border-slate-700/60 text-white shadow-sm'
                      : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500'}`}>
                    <SvgIcon name={tab.icon} className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">{tab.label}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{tab.desc}</span>
                  </div>
                </button>
              ))}
            </nav>
            
            <div className="mt-6 pt-4 border-t border-slate-800/80 px-2">
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/60">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-medium px-2 py-0.5 rounded-full inline-block mb-2">
                  {d.liveStatus}
                </span>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {lang === 'en' 
                    ? "Verify system load speeds, dynamic queues, security headers, and sandbox configurations securely in multi-currency layout mode."
                    : "सिस्टम लोड स्पीड, डायनेमिक कतारों, सिक्योरिटी हेडर्स और मल्टी-करेंसी लेआउट का सुरक्षित परीक्षण करें।"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Panel Display Area */}
        <main className="flex-1 bg-slate-900/30 border border-slate-800/40 rounded-3xl p-6 lg:p-8 relative min-h-[600px] overflow-hidden">
          {activeTab === 'demo' && <DemoStoreModule d={d} lang={lang} showToast={showToast} />}
          {activeTab === 'blog' && <BlogModule d={d} lang={lang} />}
          {activeTab === 'case-study' && <CaseStudyModule d={d} lang={lang} />}
          {activeTab === 'referral' && <ReferralModule d={d} lang={lang} showToast={showToast} />}
          {activeTab === 'api-docs' && <ApiDocsModule d={d} lang={lang} showToast={showToast} />}
          {activeTab === 'onboarding' && <OnboardingModule d={d} lang={lang} showToast={showToast} />}
        </main>
      </div>

      {/* Global Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} CartRenew Engine Inc. Optimized with BullMQ, Redis Caching, and Enterprise Cryptography.</p>
      </footer>
    </div>
  );
}

// ========================================================
// 4. Module A: Live Demo Simulator (लाइव डेमो स्टोर)
// ========================================================
function DemoStoreModule({ d, lang, showToast }) {
  const [custName, setCustName] = useState('Jayant Kumar');
  const [custPhone, setCustPhone] = useState('919876543210');
  const [productName, setProductName] = useState('Puma Red Sports Shoes');
  const [cartValue, setCartValue] = useState('3499');
  const [isSending, setIsSending] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState('10% Discount Code');

  // Dynamic template rendering based on language
  const generateHinglishMessage = () => {
    if (lang === 'en') {
      if (selectedOffer === '10% Discount Code') {
        return `Hello *${custName}*! 👋 We noticed you left *${productName}* in your cart. \n\nGood news! We have locked a special 10% instant discount code for you! 🎁\n\nComplete checkout now to secure your offer:\n👉 https://cartrenew.com/checkout/test\n\nTotal Price: *USD $${(Number(cartValue) / 80).toFixed(2)}*`;
      }
      if (selectedOffer === 'Free Shipping') {
        return `Hey *${custName}*! 🚚 Your *${productName}* is still waiting in your cart. Order in the next 2 hours to get *FREE SHIPPING* automatically! \n\nClaim your order now:\n👉 https://cartrenew.com/checkout/test\n\nTotal Price: *USD $${(Number(cartValue) / 80).toFixed(2)}*`;
      }
      return `Hi *${custName}*! 😊 Just a friendly reminder that the *${productName}* in your cart is still reserved. Complete checkout securely here:\n👉 https://cartrenew.com/checkout/test`;
    } else {
      if (selectedOffer === '10% Discount Code') {
        return `Hey *${custName}*! 👋 Aapka ek high-demand premium item *${productName}* cart me reh gaya hai. \n\nCartRenew exclusive 10% instant discount coupon code humne apply kar diya hai! 🎁\n\nAbhi checkout complete karein aur order claim karein:\n👉 https://cartrenew.com/checkout/test\n\nTotal price: *INR ₹${cartValue}* only.`;
      }
      if (selectedOffer === 'Free Shipping') {
        return `Hi *${custName}*! 🚚 Aapke cart me *${productName}* waiting list me hai. Aaj hi buy karne par aapko milegi *FREE SHIPPING*! No extra delivery charges. \n\nOffer limited time ke liye valid hai:\n👉 https://cartrenew.com/checkout/test\n\nFinal Price: *INR ₹${cartValue}*`;
      }
      return `Hello *${custName}*! 😊 Aapke selection me se *${productName}* abhi bhi cart me lock hai. Abhi complete checkout option open hai:\n👉 https://cartrenew.com/checkout/test`;
    }
  };

  const handleSimulateMessage = async () => {
    setIsSending(true);
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: '⏳ Queue initializing: Processing dynamic AI prompt template...' }]);
    
    setTimeout(() => {
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: '✅ [Gemini 1.5 Flash] message parsed successfully.' }]);
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: '🚀 [BullMQ Queue] Job successfully pushed to Redis memory.' }]);
      
      setTimeout(() => {
        setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: `📬 [WhatsApp Worker] Message dispatched to country endpoint +${custPhone}!` }]);
        setIsSending(false);
        showToast(d.toastDemoSent);
      }, 1000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="demo" className="w-6 h-6" /></span>
          {d.demoHeader}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{d.demoSub}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Input parameters card */}
        <div className="md:col-span-7 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-sm">
          <p className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">{d.demoSectionTitle}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.custNameLabel}</label>
              <input 
                type="text" 
                value={custName} 
                onChange={(e) => setCustName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.custPhoneLabel}</label>
              <input 
                type="text" 
                value={custPhone} 
                onChange={(e) => setCustPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.prodNameLabel}</label>
              <input 
                type="text" 
                value={productName} 
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                {d.cartValueLabel} ({lang === 'en' ? 'USD $' : 'INR ₹'})
              </label>
              <input 
                type="number" 
                value={cartValue} 
                onChange={(e) => setCartValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.incentiveLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '10% Discount Code', label: d.incentiveDiscount },
                { id: 'Free Shipping', label: d.incentiveShipping },
                { id: 'None', label: d.incentiveNone }
              ].map((offer) => (
                <button
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    selectedOffer === offer.id 
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {offer.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSimulateMessage}
            disabled={isSending}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                {d.buttonSimulating}
              </>
            ) : (
              <>
                <SvgIcon name="whatsapp" className="w-4 h-4 fill-current" />
                {d.buttonSimulate}
              </>
            )}
          </button>

          {/* Real-time System Terminal Outputs */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[10px]">
            <p className="text-slate-500 border-b border-slate-800 pb-1 mb-1">{d.terminalHeader}</p>
            {logs.length === 0 && <p className="text-slate-600 italic">{d.terminalEmpty}</p>}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 leading-normal">
                <span className="text-slate-500 font-sans">[{log.time}]</span>
                <span className="text-slate-300">{log.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Mobile Mockup */}
        <div className="md:col-span-5 flex justify-center">
          <div className="w-64 bg-slate-950 border-4 border-slate-800 rounded-[32px] overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl flex justify-center items-center">
              <div className="w-12 h-2 rounded-full bg-slate-950" />
            </div>

            <div className="bg-slate-900 border-b border-slate-800/80 pt-5 pb-2.5 px-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[9px]">
                CR
              </div>
              <div>
                <p className="text-[10px] font-bold text-white">{d.phoneHeader}</p>
                <p className="text-[7px] text-slate-400">{d.phoneVerified}</p>
              </div>
            </div>

            <div className="h-72 p-3 bg-slate-950/90 flex flex-col justify-end space-y-3 relative overflow-hidden">
              <div className="text-center">
                <span className="text-[8px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">TODAY</span>
              </div>

              {/* Chat bubble */}
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl rounded-tl-none p-2.5 max-w-[90%] text-[10px] leading-relaxed relative animate-slide-up">
                <p className="text-slate-200 whitespace-pre-wrap">{generateHinglishMessage()}</p>
                <span className="text-[7px] text-slate-500 absolute bottom-1 right-2">3:34 PM ✓✓</span>
              </div>
            </div>

            <div className="bg-slate-900 border-t border-slate-800/80 p-2 flex items-center gap-2">
              <div className="flex-1 bg-slate-950 rounded-full px-3 py-1.5 text-[8px] text-slate-500 border border-slate-800">
                Type a message...
              </div>
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                <SvgIcon name="demo" className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. Module B: SEO Blog Hub (ब्लॉग सेक्शन)
// ==========================================
function BlogModule({ d, lang }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPost, setSelectedPost] = useState(null);

  const blogPosts = {
    en: [
      {
        id: 1,
        title: "WhatsApp Cart Recovery: Best Strategies for Global Conversion",
        category: "Tips",
        snippet: "How addressing local buyer psychology with customized dynamic messaging triggers can elevate recovery conversion margins up to 45%...",
        seoScore: 94,
        readability: "A (High-Intent Conversion)",
        content: `### Maximize Cart Completion Rates Server-Side
Traditional email recovery has dropped to sub-2% open ratios in fast-paced retail. To keep users actively engaged, direct mobile notifications like WhatsApp have proven a 98% open factor.

#### 1. Friendly and Contextual Messaging
Instead of static template scripts, craft a personal tone. Always reference the precise product name and customize options.
* **Bad Practice:** "Dear customer, your cart contains incomplete purchases. Please checkout."
* **Best Practice:** "Hey Jayant! 😊 Just noticed you left the premium *Puma Red Sports Shoes* in your shopping cart. We have secured your reservation link!"

#### 2. Introduce Logical Dynamic Incentives
Avoid spamming. Use real conditional incentives, such as immediate free delivery inside a 2-hour window, to trigger swift decision-making.`
      },
      {
        id: 2,
        title: "Shopify Checkout Abandonment Ultimate Integration Manual",
        category: "Guides",
        snippet: "Step-by-step developer tutorial on linking Shopify Webhooks directly to Serverless Meta CAPI to bypass cookie-blocking issues...",
        seoScore: 97,
        readability: "A+ (Developer Focused)",
        content: `### High-Throughput Checkout Architecture
With standard browser cookies decaying due to iOS tracking protections and privacy shields, client-side tracking pixels are dropping valuable attribution data.

#### The Server-Side Conversions API Guardrail
Using serverless API routes on Next.js, CartRenew intercepts "Checkout Initiated" triggers via secure backend Webhooks. 
Even when client-side browsers reject standard pixel codes, our BullMQ queue safely relays transaction parameters directly to Meta's graph API, allowing perfect remarketing matching.`
      }
    ],
    hi: [
      {
        id: 1,
        title: "WhatsApp Cart Recovery: भारतीय स्टोर्स के लिए 5 बेहतरीन टिप्स",
        category: "Tips",
        snippet: "भारतीय ऑनलाइन खरीदार की मानसिकता को समझें। कैसे हिंग्लिश और आसान सीओडी (COD) रिमाइंडर्स रिकवरी रेट को 45% तक बढ़ा सकते हैं...",
        seoScore: 92,
        readability: "A (हाई-इंटेंट)",
        content: `### भारतीय ग्राहकों से जुड़ने का सही तरीका
पारंपरिक ई-मेल रिकवरी की ओपन-रेट बहुत कम हो चुकी है। वहीं, WhatsApp पर 98% ओपन रेट मिलता है। लेकिन साधारण संदेश भेजना पर्याप्त नहीं है।

#### 1. हिंग्लिश का उपयोग करें (Hinglish Rocks)
शुद्ध अंग्रेजी संदेश अक्सर लोगों को स्पैम जैसे लगते हैं। हिंग्लिश एक दोस्ताना और गहरा संबंध बनाती है।
* **गलत:** "Dear Customer, you left items in your cart. Please complete your checkout."
* **सही:** "Hi Jayant! 😊 Aapka Puma Sports Shoes cart me rah gaya hai. Humne aapke liye specialized price lock kiya hai!"

#### 2. Cash On Delivery (COD) के संदेह को मिटाएं
भारत में कई खरीदार भुगतान सुरक्षा के संकोच में कार्ट छोड़ देते हैं। "पेमेंट की समस्या सुलझाने के लिए डायरेक्ट सपोर्ट कॉल" का आश्वासन देना कनवर्ट करने में मदद करता है।`
      },
      {
        id: 2,
        title: "Shopify Checkout Abandonment का बेहतरीन गाइड",
        category: "Guides",
        snippet: "Shopify वेबहुक्स को सीधे सर्वरलेस Meta CAPI से कनेक्ट करने की पूरी गाइड, ताकि कुकीज़ ब्लॉक होने के बाद भी ग्राहक का डेटा सुरक्षित रहे...",
        seoScore: 95,
        readability: "A+ (डेवलपर फोकस्ड)",
        content: `### चेकआउट कतार की जटिल समस्या
ब्राउज़र प्राइवेसी टूल्स के कारण ई-कॉमर्स स्टोर्स में 70% से ज्यादा डेटा ट्रैक नहीं हो पाता।

#### Meta CAPI हमारी कैसे मदद करता है?
क्लाइंट-साइड पिक्सेल ट्रैकर के विपरीत, हमारा Next.js बैकएंड सीधे वेबहुक्स के जरिए डेटा कैप्चर करता है। जब भी कोई कार्ट छूटता है, यह डेटा सीधे सर्वर-टू-सर्वर Meta को भेजा जाता है, जिससे विज्ञापन की लागत कम होती है और रिकवरी दर तुरंत बढ़ जाती है।`
      }
    ]
  };

  const currentPosts = blogPosts[lang] || blogPosts['en'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-col sm:flex-row gap-2">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="blog" className="w-6 h-6" /></span>
            {d.blogHeader}
          </h2>
          <p className="text-slate-400 text-xs mt-1">{d.blogSub}</p>
        </div>
        {selectedPost && (
          <button 
            onClick={() => setSelectedPost(null)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700"
          >
            {d.blogBack}
          </button>
        )}
      </div>

      {!selectedPost ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['All', 'Tips', 'Guides'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  activeCategory === cat 
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentPosts
              .filter((p) => activeCategory === 'All' || p.category === activeCategory)
              .map((post) => (
                <div 
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition flex flex-col justify-between h-56 shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold uppercase">{post.category}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">{d.seoRating}: {post.seoScore}%</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-white leading-tight mb-2 hover:text-emerald-400 transition">{post.title}</h3>
                    <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed">{post.snippet}</p>
                  </div>
                  <div className="border-t border-slate-800/80 pt-3 mt-3 flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">{d.blogReadability} <strong className="text-slate-300">{post.readability}</strong></span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">{d.blogReadMore} <SvgIcon name="arrowUpRight" className="w-3 h-3" /></span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-slide-up">
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-lg font-black text-white border-b border-slate-800 pb-3">{selectedPost.title}</h3>
            <div className="text-xs text-slate-300 leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
              {selectedPost.content}
            </div>
          </div>

          <div className="md:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.seoRating}</p>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Optimization Rank</span>
                  <span className="text-emerald-400 font-bold">{selectedPost.seoScore}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-800">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${selectedPost.seoScore}%` }} />
                </div>
              </div>

              <div className="text-[11px] space-y-2 text-slate-300">
                <p className="font-bold text-slate-400 border-b border-slate-800 pb-1">{d.seoKeywords}:</p>
                <div className="flex flex-wrap gap-1">
                  {['cart recovery', 'Shopify abandonment', 'WhatsApp push', 'Meta CAPI'].map((word) => (
                    <span key={word} className="bg-slate-900 text-[9px] text-slate-400 px-2 py-0.5 rounded border border-slate-800">{word}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 leading-normal">
                <div className="flex gap-2 items-center">
                  <span className="text-emerald-400">✓</span>
                  <span>Structured schema JSON verified</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-emerald-400">✓</span>
                  <span>H1, H2 header tags properly optimized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// 6. Module C: Case Study & Dynamic ROI Calculator
// =========================================================
function CaseStudyModule({ d, lang }) {
  const [revenue, setRevenue] = useState(lang === 'en' ? 8000 : 500000);
  const [abandonRate, setAbandonRate] = useState(70);

  const initialCheckoutTotal = Math.round(revenue / ((100 - abandonRate) / 100));
  const lostRevenueValue = initialCheckoutTotal - revenue;
  const recoveredRevenue = Math.round(lostRevenueValue * 0.14);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="chart" className="w-6 h-6" /></span>
          {d.caseHeader}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{d.caseSub}</p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-md">
        <div className="md:col-span-8 space-y-3">
          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {d.caseBadge}
          </span>
          <h3 className="text-lg font-black text-white">{d.caseTitle}</h3>
          <p className="text-slate-400 text-xs leading-relaxed">{d.caseDesc}</p>
          
          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[9px] block uppercase font-bold">{d.caseInitRate}</span>
              <span className="text-rose-400 font-black text-base">68% Drop</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[9px] block uppercase font-bold">{d.casePostRate}</span>
              <span className="text-emerald-400 font-black text-base">82% Saved</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[9px] block uppercase font-bold">{d.caseNetProfit}</span>
              <span className="text-white font-black text-base">
                {lang === 'en' ? '$4,500+' : '₹3.4 Lakhs'}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-center h-full">
          <p className="text-[9px] font-bold text-slate-500 uppercase text-center tracking-wider">{d.chartTitle}</p>
          
          <div className="w-full h-24 flex items-end justify-center gap-6 pb-2 border-b border-slate-800">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 bg-slate-800/85 hover:bg-slate-700 rounded-t h-12 relative flex justify-center text-[10px] text-slate-400 font-bold transition-all">
                <span className="absolute -top-5">32%</span>
              </div>
              <span className="text-[8px] text-slate-500 font-bold">Before</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t h-20 relative flex justify-center text-[10px] text-slate-950 font-black transition-all">
                <span className="absolute -top-5 text-emerald-400">82%</span>
              </div>
              <span className="text-[8px] text-emerald-400 font-bold">With Us</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 text-center leading-normal">
            <strong>156% average lift</strong> in transaction completion efficiency.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-2xl space-y-4">
        <h4 className="text-sm font-extrabold text-white border-b border-slate-800 pb-2">{d.calcHeader}</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">{d.calcRevenueLabel}</span>
                <span className="text-emerald-400 font-black">
                  {lang === 'en' ? `$${revenue.toLocaleString()}` : `₹${revenue.toLocaleString()}`}
                </span>
              </div>
              <input 
                type="range" 
                min={lang === 'en' ? '2000' : '50000'} 
                max={lang === 'en' ? '100000' : '5000000'} 
                step={lang === 'en' ? '2000' : '50000'}
                value={revenue} 
                onChange={(e) => setRevenue(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg border border-slate-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">{d.calcAbandonLabel}</span>
                <span className="text-rose-400 font-black">{abandonRate}%</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="90" 
                step="5"
                value={abandonRate} 
                onChange={(e) => setAbandonRate(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg border border-slate-800"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 items-center">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">{d.calcLostLabel}</p>
              <p className="text-rose-400 font-extrabold text-lg">
                {lang === 'en' ? `$${lostRevenueValue.toLocaleString()}` : `₹${lostRevenueValue.toLocaleString()}`}
              </p>
            </div>
            <div>
              <p className="text-emerald-400 text-[10px] uppercase font-black tracking-wider mb-1">{d.calcSavedLabel}</p>
              <p className="text-emerald-400 font-black text-2xl tracking-tight">
                {lang === 'en' ? `$${recoveredRevenue.toLocaleString()}` : `₹${recoveredRevenue.toLocaleString()}`} 
                <span className="text-xs font-semibold block text-slate-400">{d.calcMonthlySaved}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================================
// 7. Module D: Referral Program Panel (रेफरल)
// ========================================================
function ReferralModule({ d, lang, showToast }) {
  const [refCode, setRefCode] = useState('CART_GLOBAL_PARTNER');
  const [copied, setCopied] = useState(false);
  const [sliderVal, setSliderVal] = useState(3);

  const handleCopyLink = () => {
    const textToCopy = `https://cartrenew.com/signup?ref=${refCode}`;
    const dummyInput = document.createElement('input');
    document.body.appendChild(dummyInput);
    dummyInput.value = textToCopy;
    dummyInput.select();
    document.execCommand('copy');
    document.body.removeChild(dummyInput);

    setCopied(true);
    showToast(d.toastLinkCopied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="gift" className="w-6 h-6" /></span>
          {d.refHeader}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{d.refSub}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <p className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">{d.refSectionTitle}</p>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.refCodeLabel}</label>
            <input 
              type="text" 
              value={refCode} 
              onChange={(e) => setRefCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none font-mono tracking-wider text-emerald-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase">{d.refLinkLabel}</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 select-all truncate">
                https://cartrenew.com/signup?ref={refCode}
              </div>
              <button 
                onClick={handleCopyLink}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition shrink-0 flex items-center gap-1.5"
              >
                <SvgIcon name="copy" className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-[11px] leading-relaxed text-slate-400 flex gap-2">
            <span className="text-emerald-400">💡</span>
            <span>{d.refDescBox}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <p className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">{d.refEstimatorHeader}</p>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">{d.refEstimatorInvites}</span>
                <span className="text-emerald-400 font-extrabold">{sliderVal} Stores</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={sliderVal} 
                onChange={(e) => setSliderVal(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-lg border border-slate-800"
              />
            </div>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{d.refEstimatorFreeService}</p>
              <p className="text-emerald-400 font-black text-2xl tracking-tight">{sliderVal * 2} Months Free</p>
              <div className="w-full bg-slate-900 h-[1px] my-2" />
              <p className="text-slate-300 text-xs">
                {d.refEstimatorValueSaved}{' '}
                <strong className="text-white">
                  {lang === 'en' ? `$${sliderVal * 2 * 19}` : `₹${(sliderVal * 2 * 1499).toLocaleString()}`}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. Module E: Public API Docs Interface (एपीआई डॉक्स)
// ==========================================
function ApiDocsModule({ d, lang, showToast }) {
  const [selectedLang, setSelectedLang] = useState('curl');
  const [paramEventName, setParamEventName] = useState('AddToCart');
  const [paramValue, setParamValue] = useState(lang === 'en' ? 49 : 1499);

  const handleCopyCode = () => {
    const codeSnippet = generateCode();
    const dummyInput = document.createElement('textarea');
    document.body.appendChild(dummyInput);
    dummyInput.value = codeSnippet;
    dummyInput.select();
    document.execCommand('copy');
    document.body.removeChild(dummyInput);
    showToast(d.toastSnippetCopied);
  };

  const generateCode = () => {
    if (selectedLang === 'node') {
      return `const fetch = require('node-fetch');

const payload = {
  eventName: "${paramEventName}",
  value: ${paramValue},
  currency: "${lang === 'en' ? 'USD' : 'INR'}",
  customerName: "Jayant Kumar",
  userEmail: "jayant@cartrenew.com",
  userPhone: "919876543210"
};

fetch('https://api.cartrenew.com/v1/meta-capi', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SECURE_API_KEY'
  },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log('✅ Event Received:', data))
.catch(err => console.error('❌ Error:', err));`;
    }
    return `curl -X POST https://api.cartrenew.com/v1/meta-capi \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SECURE_API_KEY" \\
  -d '{
    "eventName": "${paramEventName}",
    "value": ${paramValue},
    "currency": "${lang === 'en' ? 'USD' : 'INR'}",
    "customerName": "Jayant Kumar",
    "userEmail": "jayant@cartrenew.com",
    "userPhone": "919876543210"
  }'`;
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="code" className="w-6 h-6" /></span>
          {d.apiHeader}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{d.apiSub}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
          <p className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">{d.apiPlayground}</p>
          
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-xs">
            <span className="bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px]">POST</span>
            <span className="font-mono text-slate-300 text-[10px] truncate ml-2">/v1/meta-capi</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.apiEventLabel}</label>
              <select 
                value={paramEventName} 
                onChange={(e) => setParamEventName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="AddToCart">AddToCart (Server Event)</option>
                <option value="InitiateCheckout">InitiateCheckout (Server Event)</option>
                <option value="Purchase">Purchase (Server Event)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">{d.apiValueLabel}</label>
              <input 
                type="number" 
                value={paramValue} 
                onChange={(e) => setParamValue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
            <p className="text-xs font-bold text-slate-300">{d.apiSnippetHeader}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedLang('curl')} 
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${selectedLang === 'curl' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                cURL
              </button>
              <button 
                onClick={() => setSelectedLang('node')} 
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${selectedLang === 'node' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                NodeJS
              </button>
            </div>
          </div>

          <div className="relative">
            <pre className="bg-slate-950 border border-slate-850 rounded-xl p-4 overflow-x-auto text-[10px] text-slate-300 font-mono leading-normal select-all">
              {generateCode()}
            </pre>
            <button 
              onClick={handleCopyCode}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Copy code"
            >
              <SvgIcon name="copy" className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase">{d.apiResponseLabel}</p>
            <pre className="bg-slate-950/60 border border-slate-850 p-3 rounded-lg text-[9px] text-emerald-400 font-mono">
{`{
  "success": true,
  "events_received": 1,
  "message": "Cart recovery event registered and background worker initiated."
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================================
// 9. Module F: Interactive Onboarding Tutorial Walkthrough
// ========================================================
function OnboardingModule({ d, lang, showToast }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = {
    en: [
      {
        title: "Generate Meta Access Token",
        desc: "Go to your Facebook Developer Console, create a Business App, and generate a long-lived User Token to initiate your data pipelines.",
        checklist: [
          "Navigate to developers.facebook.com",
          "Create App -> Select Business Intent model",
          "Generate permanent System Access Token under Business Suite Settings"
        ]
      },
      {
        title: "Configure Your Phone ID",
        desc: "Connect your verified target WhatsApp Business Phone Number ID inside your env variables so our system triggers correctly.",
        checklist: [
          "Locate WhatsApp Setup Panel inside Developer Console",
          "Copy your unique Phone Number ID parameter",
          "Store WHATSAPP_PHONE_NUMBER_ID inside your local env configurations"
        ]
      },
      {
        title: "Link CartRenew Custom Webhook Endpoint",
        desc: "Go to your Shopify or WooCommerce Settings -> Notifications and save our webhook target to stream abandoned metrics instantly.",
        checklist: [
          "Go to Shopify Dashboard -> Settings -> Notifications -> Webhooks",
          "Add webhook tracking for 'Checkout Abandoned' event actions",
          "Point target URL to: api.cartrenew.com/v1/webhooks"
        ]
      },
      {
        title: "Execute Real-Time Validation Tests",
        desc: "Keep your Meta Events Manager 'Test Events' window open. Complete a demo transaction checkout to verify your green ticks.",
        checklist: [
          "Open Events Manager -> Test Events Tab",
          "Run a sample AddToCart trigger from your active store frontend",
          "Verify your green-badge server processing tracking event logs live"
        ]
      }
    ],
    hi: [
      {
        title: "Meta Access Token प्राप्त करें",
        desc: "Facebook Developer Console में जाकर नया Business App बनाएं और स्थायी (Long-lived) टोकन जनरेट करें ताकि पाइपलाइन सुरक्षित चालू हो सके।",
        checklist: [
          "developers.facebook.com पर नेविगेट करें",
          "नया ऐप बनाएं -> Business Use Case विकल्प चुनें",
          "Business Manager के अंतर्गत स्थायी Access Token जेनरेट करें"
        ]
      },
      {
        title: "Phone ID क्रेडेंशियल्स कॉन्फ़िगर करें",
        desc: "अपने सत्यापित व्हाट्सएप नंबर के Phone Number ID को एनवायरनमेंट वेरिएबल्स (.env) में सहेजें ताकि बैकएंड कतार सटीक ट्रिगर हो।",
        checklist: [
          "व्हाट्सएप 'Getting Started' पैनल से Phone Number ID कॉपी करें",
          "अपने सेंडर मोबाइल व्हाट्सएप नंबर को सत्यापित करें",
          "क्रेडेंशियल्स को WHATSAPP_PHONE_NUMBER_ID के नाम से .env में सहेजें"
        ]
      },
      {
        title: "CartRenew Webhook URL को लिंक करें",
        desc: "Shopify या WooCommerce एडमिन पैनल में जाकर हमारे एंडपॉइंट को रजिस्टर करें ताकि कार्ट छूटते ही डेटा कतार में आए।",
        checklist: [
          "Shopify एडमिन पैनल -> Notifications -> Webhooks पर जाएं",
          "Checkout Abandoned एवं Cart Update इवेंट्स पर वेबहुक बनाएं",
          "टारगेट एंडपॉइंट URL भरें: api.cartrenew.com/v1/webhooks"
        ]
      },
      {
        title: "रियल-टाइम लाइव टेस्ट रन करें",
        desc: "Events Manager के अंतर्गत 'Test Events' टैब को खुला रखें और टेस्ट चेकआउट ट्रिगर करके ग्रीन टिक को वेरिफाइड करें!",
        checklist: [
          "Events Manager खोलें -> Test Events टैब पर जाएं",
          "कस्टम सिमुलेटर पैनल से कतार एक्टिविटी ट्रिगर करें",
          "लाइव ट्रैकिंग स्क्रीन पर 'Add to cart' का हरा निशान सत्यापित करें"
        ]
      }
    ]
  };

  const currentStepsList = steps[lang] || steps['en'];

  const handleNext = () => {
    if (currentStep < currentStepsList.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      showToast(d.toastWalkthroughFinished);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><SvgIcon name="map" className="w-6 h-6" /></span>
          {d.onboardingHeader}
        </h2>
        <p className="text-slate-400 text-xs mt-1">{d.onboardingSub}</p>
      </div>

      <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 overflow-x-auto gap-4">
        {currentStepsList.map((st, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => setCurrentStep(idx)}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border transition ${
              currentStep === idx 
                ? 'bg-emerald-500 text-slate-950 border-emerald-500' 
                : idx < currentStep 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40' 
                  : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className={`text-[10px] font-bold ${currentStep === idx ? 'text-white' : 'text-slate-500'}`}>
              {st.title.substring(0, 15)}...
            </span>
            {idx < currentStepsList.length - 1 && <div className="w-8 h-[1px] bg-slate-800" />}
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[220px] flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {d.onboardingStepBadge.replace('{val}', currentStep + 1)}
            </span>
            <span className="text-[10px] text-slate-500">{d.onboardingPortal}</span>
          </div>
          <h3 className="text-base font-extrabold text-white">{currentStepsList[currentStep].title}</h3>
          <p className="text-slate-400 text-xs leading-relaxed">{currentStepsList[currentStep].desc}</p>
          
          <div className="pt-3 space-y-2">
            {currentStepsList[currentStep].checklist.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start text-xs text-slate-300">
                <span className="text-emerald-400 text-sm leading-none mt-0.5">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 mt-6 flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-700 transition disabled:opacity-50"
          >
            {d.onboardingPrev}
          </button>
          
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
          >
            {currentStep === currentStepsList.length - 1 ? d.onboardingFinish : d.onboardingNext}
          </button>
        </div>
      </div>
    </div>
  );
}