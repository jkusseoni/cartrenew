"use client"; // 🌟 क्लर्क के डायनामिक पाथ और हुक्स के लिए क्लाइंट कंपोनेंट होना ज़रूरी है

import { SignUp } from "@clerk/nextjs";
import { useLocale } from "next-intl"; // 🌟 करंट भाषा (locale) पता करने के लिए

export default function SignUpPage() {
  const locale = useLocale(); // यह अपने आप 'en' या जो भी करंट भाषा है, वो निकाल लेगा

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F17] px-4 py-12">
      {/* ⚡ अब पाथ डायनामिक हो गया, /en/sign-up या /hi/sign-up दोनों पर क्लर्क परफेक्ट काम करेगा */}
      <SignUp 
        path={`/${locale}/sign-up`} 
        routing="path" 
        signInUrl={`/${locale}/sign-in`} 
      />
    </div>
  );
}