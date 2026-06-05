import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generate2FASecret, getOTPAuthUrl } from '@/lib/totp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId } = body;

    // Validation: Check karein ki merchantId payload me hai ya nahi
    if (!merchantId) {
      return NextResponse.json(
        { success: false, error: 'Merchant ID missing hai bhai!' },
        { status: 400 }
      );
    }

    // Database me check karein ki ye merchant exist karta hai ya nahi
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { user: { select: { email: true } } },
    });

    if (!merchant) {
      return NextResponse.json(
        { success: false, error: 'Merchant account nahi mila database me.' },
        { status: 404 }
      );
    }

    // Naya 2FA Secret Key aur standard Authenticator app url generate karein
    const secret = generate2FASecret();
    const otpAuthUrl = getOTPAuthUrl(
      merchant.user.email || `merchant_${merchantId}`,
      secret,
      'CartRenew Engine'
    );

    // Google Charts API ka use karke secure dynamic QR Code generator URL banayein
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

    // Database me temporarily secret save karein jab tak verification successfully nahi ho jata
    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        tempTwoFactorSecret: secret,
      },
    });

    return NextResponse.json({
      success: true,
      secret,
      qrCodeUrl,
      message: 'MFA setup initialized successfully. Scan this QR code in Google Authenticator.',
    });

  } catch (error: unknown) {
    console.error('💥 [2FA Setup API Error]:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal Server Error';
}
