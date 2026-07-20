/**
 * CartRenew - Live WhatsApp Automation Service
 */

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendRecoveryMessage(
  phone: string,
  customerName: string,
  cartUrl: string,
  totalAmount: number
): Promise<WhatsAppResponse> {
  // Environment Variables से API डिटेल्स लें
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("❌ WhatsApp API missing credentials in environment variables");
    return { success: false, error: "Configuration error" };
  }

  try {
    const message = `Hey ${customerName}! 👋 Humne dekha ki aapka checkout miss ho gaya hai. Aapke cart me products ready hain aur order total ₹${totalAmount} hai. Is deal ko miss mat kijiye aur apna order yahan click karke complete karein: ${cartUrl}`;

    // Meta Graph API को कॉल करें
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone, // यह नंबर इंटरनेशनल फॉर्मेट में होना चाहिए (जैसे: 919876543210)
        type: 'text',
        text: { body: message }
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ WhatsApp Message Sent Successfully:", data.messages[0].id);
      return { success: true, messageId: data.messages[0].id };
    } else {
      console.error("❌ WhatsApp API Error:", data.error);
      return { success: false, error: data.error?.message || "Unknown error" };
    }
  } catch (error) {
    console.error("❌ WhatsApp transmission failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}