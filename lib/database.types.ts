export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          shopify_domain: string
          shopify_access_token: string | null
          webhook_ids: Json | null
          clerk_user_id: string
          whatsapp_phone_id: string | null
          whatsapp_access_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shopify_domain: string
          shopify_access_token?: string | null
          webhook_ids?: Json | null
          clerk_user_id: string
          whatsapp_phone_id?: string | null
          whatsapp_access_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shopify_domain?: string
          shopify_access_token?: string | null
          webhook_ids?: Json | null
          clerk_user_id?: string
          whatsapp_phone_id?: string | null
          whatsapp_access_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      abandoned_carts: {
        Row: {
          id: string
          store_id: string
          shopify_cart_token: string
          customer_phone: string | null
          customer_email: string | null
          customer_name: string | null
          cart_value: number
          items: Json
          checkout_url: string | null
          status: 'pending' | 'messaged' | 'recovered' | 'lost' | 'opted_out'
          message_sent_at: string | null
          message_delivered_at: string | null
          message_read_at: string | null
          recovery_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          shopify_cart_token: string
          customer_phone?: string | null
          customer_email?: string | null
          customer_name?: string | null
          cart_value?: number
          items?: Json
          checkout_url?: string | null
          status?: 'pending' | 'messaged' | 'recovered' | 'lost' | 'opted_out'
          message_sent_at?: string | null
          message_delivered_at?: string | null
          message_read_at?: string | null
          recovery_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          shopify_cart_token?: string
          customer_phone?: string | null
          customer_email?: string | null
          customer_name?: string | null
          cart_value?: number
          items?: Json
          checkout_url?: string | null
          status?: 'pending' | 'messaged' | 'recovered' | 'lost' | 'opted_out'
          message_sent_at?: string | null
          message_delivered_at?: string | null
          message_read_at?: string | null
          recovery_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          cart_id: string
          store_id: string
          phone: string
          template_name: string
          body: string | null
          status: 'sent' | 'delivered' | 'read' | 'failed' | 'queued' | 'pending'
          whatsapp_message_id: string | null
          error_message: string | null
          attempt_count: number
          next_retry_at: string | null
          sent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          store_id: string
          phone: string
          template_name: string
          body?: string | null
          status?: 'sent' | 'delivered' | 'read' | 'failed' | 'queued' | 'pending'
          whatsapp_message_id?: string | null
          error_message?: string | null
          attempt_count?: number
          next_retry_at?: string | null
          sent_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          store_id?: string
          phone?: string
          template_name?: string
          body?: string | null
          status?: 'sent' | 'delivered' | 'read' | 'failed' | 'queued' | 'pending'
          whatsapp_message_id?: string | null
          error_message?: string | null
          attempt_count?: number
          next_retry_at?: string | null
          sent_at?: string
          created_at?: string
        }
      }
      message_templates: {
        Row: {
          id: string
          store_id: string
          name: string
          body: string
          variables: Json
          is_active: boolean
          delay_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          body: string
          variables?: Json
          is_active?: boolean
          delay_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          body?: string
          variables?: Json
          is_active?: boolean
          delay_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
      analytics: {
        Row: {
          id: string
          store_id: string
          date: string
          carts_created: number
          messages_sent: number
          messages_delivered: number
          messages_read: number
          carts_recovered: number
          revenue_recovered: number
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          date: string
          carts_created?: number
          messages_sent?: number
          messages_delivered?: number
          messages_read?: number
          carts_recovered?: number
          revenue_recovered?: number
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          date?: string
          carts_created?: number
          messages_sent?: number
          messages_delivered?: number
          messages_read?: number
          carts_recovered?: number
          revenue_recovered?: number
          created_at?: string
        }
      }
      cart_delivery_metrics: {
        Row: {
          id: string
          cart_id: string
          merchant_id: string
          user_id: string | null
          store_name: string | null
          country: string
          country_code: string | null
          primary_channel: string
          attempted_channel: string
          status:
            | 'SUCCESS_WHATSAPP'
            | 'SUCCESS_WHATSAPP_WEB_LINK'
            | 'SUCCESS_SMS'
            | 'SUCCESS_EMAIL'
            | 'FAILED'
            | 'FAILED_POLICY'
          provider: string | null
          provider_message_id: string | null
          error_message: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          merchant_id: string
          user_id?: string | null
          store_name?: string | null
          country: string
          country_code?: string | null
          primary_channel: string
          attempted_channel: string
          status:
            | 'SUCCESS_WHATSAPP'
            | 'SUCCESS_WHATSAPP_WEB_LINK'
            | 'SUCCESS_SMS'
            | 'SUCCESS_EMAIL'
            | 'FAILED'
            | 'FAILED_POLICY'
          provider?: string | null
          provider_message_id?: string | null
          error_message?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          merchant_id?: string
          user_id?: string | null
          store_name?: string | null
          country?: string
          country_code?: string | null
          primary_channel?: string
          attempted_channel?: string
          status?:
            | 'SUCCESS_WHATSAPP'
            | 'SUCCESS_WHATSAPP_WEB_LINK'
            | 'SUCCESS_SMS'
            | 'SUCCESS_EMAIL'
            | 'FAILED'
            | 'FAILED_POLICY'
          provider?: string | null
          provider_message_id?: string | null
          error_message?: string | null
          payload?: Json
          created_at?: string
        }
      }
    }
  }
}
