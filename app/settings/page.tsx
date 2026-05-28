'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { supabaseClient } from '@/lib/supabase'

interface StoreSettings {
  id: string
  shopify_domain: string
  shopify_connected: boolean
  whatsapp_phone_id: string
  whatsapp_connected: boolean
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [store, setStore] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Form state
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('')
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('')
  const [whatsappBusinessId, setWhatsappBusinessId] = useState('')

  useEffect(() => {
    if (isLoaded && user) fetchStore()
  }, [isLoaded, user])

  const fetchStore = async () => {
    try {
      const { data } = await supabaseClient
        .from('stores')
        .select('*')
        .eq('clerk_user_id', user!.id)
        .single()

      if (data) {
        setStore(data)
        setShopifyDomain(data.shopify_domain || '')
        setWhatsappPhoneId(data.whatsapp_phone_id || '')
        setWhatsappAccessToken(data.whatsapp_access_token || '')
        setWhatsappBusinessId(data.whatsapp_business_account_id || '')
      }
    } catch (e) {
      console.log('No store yet')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')

    try {
      const payload = {
        clerk_user_id: user!.id,
        shopify_domain: shopifyDomain,
        whatsapp_phone_id: whatsappPhoneId || null,
        whatsapp_access_token: whatsappAccessToken || null,
        whatsapp_business_account_id: whatsappBusinessId || null,
      }

      if (store) {
        await supabaseClient
          .from('stores')
          .update(payload)
          .eq('id', store.id)
      } else {
        await supabaseClient.from('stores').insert(payload)
      }

      setMessage('Settings saved successfully!')
      fetchStore()
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Shopify OAuth URL
  const getShopifyAuthUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback`
    const scopes = 'read_orders,read_customers,read_checkouts'
    return `https://${shopifyDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user?.id}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <a href="/dashboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Shopify Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.058-.121-.074l-.914 21.104h.023zM11.71 11.305s-1.148.623-1.148.692.264 4.604.264 4.604l3.248-1.266-2.364-4.03z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Shopify Store</h2>
              <p className="text-sm text-gray-500">Connect your Shopify store to track abandoned carts</p>
            </div>
            {store?.shopify_connected && (
              <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Connected
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shopify Store Domain
              </label>
              <input
                type="text"
                value={shopifyDomain}
                onChange={(e) => setShopifyDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Format: your-store.myshopify.com</p>
            </div>

            {shopifyDomain && !store?.shopify_connected && (
              <a
                href={getShopifyAuthUrl()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Connect with Shopify
              </a>
            )}
          </div>
        </div>

        {/* WhatsApp Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp Business API</h2>
              <p className="text-sm text-gray-500">Connect WhatsApp to send cart recovery messages</p>
            </div>
            {store?.whatsapp_connected && (
              <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Connected
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Phone Number ID
              </label>
              <input
                type="text"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                placeholder="123456789012345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Access Token
              </label>
              <input
                type="password"
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
                placeholder="EAAB..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Business Account ID
              </label>
              <input
                type="text"
                value={whatsappBusinessId}
                onChange={(e) => setWhatsappBusinessId(e.target.value)}
                placeholder="123456789012345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">How to get these credentials:</p>
              <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                <li>Go to <a href="https://business.facebook.com" target="_blank" className="underline">Meta Business Manager</a></li>
                <li>Create a WhatsApp Business account</li>
                <li>Add a phone number</li>
                <li>Go to <strong>WhatsApp → API Setup</strong> to get Phone ID & Access Token</li>
                <li>Add webhook URL: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp</code></li>
                <li>Verify token: <code className="bg-blue-100 px-1 rounded">{process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your-verify-token'}</code></li>
              </ol>
            </div>
          </div>
        </div>

        {/* Message Template */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Template</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recovery Message
              </label>
              <textarea
                rows={6}
                defaultValue={`Hi {{customer_name}}! 👋

You left something in your cart:

{{item_list}}

Total: {{cart_value}}

Complete your order: {{checkout_url}}

Need help? Just reply!`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Variables: {'{{customer_name}}'} {'{{cart_value}}'} {'{{item_list}}'} {'{{checkout_url}}'}
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}