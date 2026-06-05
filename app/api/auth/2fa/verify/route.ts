import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify2FAToken } from '@/lib/totp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, token } = body; // token user ka 6-digit dynamic authenticator code hoga

    // Validation: Input arguments check karein
    if (!merchantId || !token) {
      return NextResponse.json(
        { success: false, error: 'Merchant ID aur 6-digit Authenticator Token dono zaroori hain!' },
        { status: 400 }
      );
    }

    // Database se merchant ka temporary secret get karein
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { tempTwoFactorSecret: true },
    });

    if (!merchant || !merchant.tempTwoFactorSecret) {
      return NextResponse.json(
        { success: false, error: 'Pehle setup API call kijiye, active temporary secret nahi mila.' },
        { status: 400 }
      );
    }

    // Cryptographic validation logic call karein interval parameters ke sath
    const isValid = verify2FAToken(token, merchant.tempTwoFactorSecret);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Galti code! OTP match nahi hua ya toh code expire ho gaya hai.' },
        { status: 401 }
      );
    }

    // OTP validity check successful, ab database me final parameters write karein
    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        twoFactorSecret: merchant.tempTwoFactorSecret,
        twoFactorEnabled: true,
        tempTwoFactorSecret: null, // confirmation ke baad temporary buffer clear karein
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Mubarak ho bhai! Two-Factor Authentication (2FA) safe and secure active ho chuka hai.',
    });

  } catch (error: unknown) {
    console.error('💥 [2FA Verification API Error]:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal Server Error';
}
