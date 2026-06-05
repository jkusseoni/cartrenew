if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
  console.warn("⚠️ ShipRocket configuration credentials missing in .env");
}

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export async function getShipRocketToken(): Promise<string | null> {
  // Token valid hai aur expire nahi hua hai (with 5 min safety buffer) तो cached copy return karein
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL || "dummy_email@example.com",
        password: process.env.SHIPROCKET_PASSWORD || "dummy_password",
      }),
    });

    if (!response.ok) throw new Error("ShipRocket authentication endpoint rejected credentials");
    
    const data = await response.json();
    if (data && data.token) {
      cachedToken = data.token;
      // ShipRocket token is valid for 10 days, setting a safe threshold locally
      tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; 
      return cachedToken;
    }
    return null;
  } catch (error) {
    console.error("❌ Failed to fetch or structure ShipRocket Token:", error);
    return null;
  }
}