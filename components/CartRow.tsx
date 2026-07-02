'use client';

import { useState } from 'react';

export type CartRowData = {
  cartUrl: string;
  customerName?: string | null;
  customerPhone: string;
  id: string;
  status: string;
  totalAmount: number;
};

type CartRowProps = {
  cart: CartRowData;
};

type RecoverApiResponse = {
  cart?: {
    status?: string;
  };
  error?: string;
  success?: boolean;
  whatsappPayload?: {
    body?: string;
    text?: {
      body?: string;
    };
    to?: string;
  };
};

export default function CartRow({ cart }: CartRowProps) {
  const [status, setStatus] = useState(cart.status);
  const [loading, setLoading] = useState(false);

  const handleAIRecovery = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/cart/recover', {
        body: JSON.stringify({ cartId: cart.id }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await response.json().catch(() => null)) as RecoverApiResponse | null;

      if (!response.ok || !data?.success) {
        window.alert(`AI Agent Error: ${data?.error || 'Failed to trigger message script'}`);
        return;
      }

      const compiledMessage = data.whatsappPayload?.body || data.whatsappPayload?.text?.body;

      if (!compiledMessage) {
        window.alert('AI Agent completed, but no WhatsApp message body was returned.');
        return;
      }

      const formattedPhone = formatIndianWhatsAppPhone(cart.customerPhone);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(
        compiledMessage
      )}`;

      setStatus(data.cart?.status || 'PENDING');
      window.open(whatsappUrl, '_blank');

      window.alert(
        [
          'WhatsApp preview opened.',
          '',
          `Phone: ${formattedPhone}`,
          '',
          'AI Hinglish Message:',
          compiledMessage,
        ].join('\n')
      );
    } catch (error) {
      console.error(error);
      // TypeError from fetch = network drop; anything else is an app failure.
      const message =
        error instanceof TypeError
          ? 'Connection lost — please check your network and retry.'
          : 'Recovery request failed. Please try again.';
      window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="transition-colors hover:bg-gray-50/50">
      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
        <div>
          <p>{cart.customerName || 'Unknown customer'}</p>
          <p className="mt-1 text-xs text-gray-500">{cart.customerPhone}</p>
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
        Rs. {cart.totalAmount.toLocaleString('en-IN')}
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold leading-5 ${getStatusClass(
            status
          )}`}
        >
          {status}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-blue-600">
        <a
          href={cart.cartUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium hover:underline"
        >
          View Cart
        </a>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
        <button
          type="button"
          onClick={handleAIRecovery}
          disabled={loading || status === 'RECOVERED'}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase transition-all shadow-sm ${
            status === 'RECOVERED'
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : loading
                ? 'cursor-wait bg-indigo-200 text-indigo-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {loading ? 'Processing...' : status === 'PENDING' ? 'Open WhatsApp' : 'Send AI Recovery'}
        </button>
      </td>
    </tr>
  );
}

function formatIndianWhatsAppPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');

  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length > 10) {
    return `91${digits.slice(-10)}`;
  }

  return digits.startsWith('91') ? digits : `91${digits}`;
}

function getStatusClass(status: string) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === 'RECOVERED') {
    return 'bg-green-100 text-green-800';
  }

  if (normalizedStatus === 'PENDING') {
    return 'bg-blue-100 text-blue-800';
  }

  return 'bg-amber-100 text-amber-800';
}
