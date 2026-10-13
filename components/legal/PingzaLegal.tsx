import type { ReactNode } from "react"
import Link from "next/link"

import {
  PINGZA_OPERATOR_NAME,
  PINGZA_PLACE,
  PINGZA_PRIVACY_PATH,
  PINGZA_SUPPORT_EMAIL,
  PINGZA_TERMS_PATH,
  PINGZA_TRADE_NAME,
} from "@/lib/legal/pingza"

const EFFECTIVE = "13 October 2026"

function Shell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#060913] px-4 py-16 text-neutral-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-white/5 bg-slate-950/40 p-8 sm:p-12">
        <div className="border-b border-white/5 pb-6">
          <Link href="/en" className="text-sm font-bold text-blue-400 hover:text-blue-300">
            ← Back to Home
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-xs text-neutral-500">Effective date: {EFFECTIVE}</p>
        </div>
        <div className="space-y-6 text-sm leading-relaxed sm:text-base">{children}</div>
      </div>
    </main>
  )
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight text-white">{children}</h2>
}

export function PingzaPrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <section className="space-y-2">
        <H>Who we are</H>
        <p>
          Pingza is operated by {PINGZA_OPERATOR_NAME}, a sole proprietor trading as {PINGZA_TRADE_NAME}.{" "}
          {PINGZA_TRADE_NAME} is not a registered company. The operator is in {PINGZA_PLACE}. Contact{" "}
          <a className="font-mono text-blue-400 hover:underline" href={`mailto:${PINGZA_SUPPORT_EMAIL}`}>
            {PINGZA_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          Pingza sends abandoned-cart reminders for a Shopify store, on WhatsApp and, when WhatsApp cannot be
          used, by email. This policy describes that service only.
        </p>
      </section>

      <section className="space-y-2">
        <H>Data we collect from Shopify</H>
        <p>When Shopify tells us a checkout was abandoned or updated, we store:</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>The customer&apos;s name, email address, and phone number, when Shopify includes them.</li>
          <li>The cart contents (product title, quantity, price, product and variant ids, and an image when Shopify sends one).</li>
          <li>The checkout URL.</li>
          <li>Whether the checkout says the customer accepts marketing. If Shopify does not send a yes or no, we do not invent one.</li>
        </ul>
        <p>We do not ask Shopify for a customer id, and we do not store a Shopify customer id.</p>
      </section>

      <section className="space-y-2">
        <H>Why we use it</H>
        <p>We use this data only to send an abandoned-cart reminder and to show the merchant what happened to it.</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>
            WhatsApp is used when the phone number can be sent. The first reminder waits until the checkout has
            been idle for 60 minutes. We stop trying 72 hours after the cart was created, and we try at most 3
            times.
          </li>
          <li>
            Email is used only when there is no sendable phone, the marketing-consent flag is yes, the address
            is not on the suppression list, and email recovery is turned on for that deployment. The email
            includes an unsubscribe link.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Who processes it</H>
        <p>We do not sell personal data. These providers process it so the service can run:</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>Shopify, which sends the checkout and handles app billing.</li>
          <li>Supabase, which stores the store, cart, and message records.</li>
          <li>Vercel, which hosts the application.</li>
          <li>WhatsApp (Meta), which delivers the WhatsApp reminder.</li>
          <li>Resend, which delivers the recovery email and tells us about bounces and spam complaints.</li>
          <li>Clerk, which handles merchant sign-in on the web app.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>How long we keep it</H>
        <p>A daily job applies these rules:</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>The checkout URL is cleared 7 days after the cart was created.</li>
          <li>
            For a cart marked messaged, recovered, lost, or skipped, the name, email, phone, checkout URL, and
            stored error text are cleared 30 days after the message was sent, the recovery was completed, or the
            send failed. If that time was never stored, the 30 days run from when the cart was created.
          </li>
          <li>Any cart, in any status, has those same fields cleared 90 days after it was created.</li>
        </ul>
        <p>
          The job does not use the cart&apos;s last-updated time. When it clears a cart, it also clears the phone,
          email, and error text on that cart&apos;s messages, and it removes product images from the cart contents.
          Until the operator turns writes on, the job only counts what it would clear and does not change stored
          data.
        </p>
        <p>
          Unsubscribe, bounce, and spam-complaint records are stored as the email address so we do not email it
          again. When a customer or shop erasure webhook runs, we replace that address with an HMAC-SHA256 hash
          and keep the hash. We do not delete the opt-out.
        </p>
      </section>

      <section className="space-y-2">
        <H>Unsubscribe and opt-out</H>
        <p>
          Each recovery email has an unsubscribe link. Opening it, or using the one-click unsubscribe header,
          adds the address to the suppression list and stops further recovery emails to it. A hard bounce or a
          spam complaint from the email provider does the same.
        </p>
        <p>
          To stop WhatsApp reminders, email {PINGZA_SUPPORT_EMAIL} with the phone number the reminder used, or
          ask the store. We do not provide a separate WhatsApp keyword in the app.
        </p>
      </section>

      <section className="space-y-2">
        <H>Access and deletion</H>
        <p>
          A customer can ask the store, or email {PINGZA_SUPPORT_EMAIL}. A merchant can email{" "}
          {PINGZA_SUPPORT_EMAIL} from the address on the store and include the shop domain.
        </p>
        <p>Shopify can also send us these webhooks. We check Shopify&apos;s signature before we act:</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>
            customers/data_request: we email a copy of the matching cart and message records to{" "}
            {PINGZA_SUPPORT_EMAIL}. The subject is a request id. We do not email the customer directly. If that
            email fails, we ask Shopify to retry.
          </li>
          <li>
            customers/redact: for that store, we match the email (ignoring capitals) or the last 10 digits of
            the phone. We clear the name, email, phone, checkout URL, cart contents, and error text on those
            carts, and the phone, email, message body, and error text on their messages. We replace the cart
            token with a random id. We hash a matching suppression row as described above.
          </li>
          <li>
            shop/redact: we hash that store&apos;s suppression rows and detach them from the store, then delete
            the store&apos;s messages, carts, templates, daily analytics, and the store record (including the
            Shopify access token).
          </li>
        </ul>
        <p>
          If we have no matching store or customer, we acknowledge the webhook and do nothing. We do not write
          the customer&apos;s email, phone, or checkout URL in our logs.
        </p>
        <p>
          Uninstalling the app stops new reminders, marks open carts as lost, cancels billing, and clears the
          Shopify access token. It does not by itself clear customer fields. Those are cleared by shop/redact or
          by the retention job once writes are on.
        </p>
      </section>

      <section className="space-y-2">
        <H>Security</H>
        <p>
          The site and APIs are served over HTTPS. Shopify webhooks are checked with Shopify&apos;s signature
          before we trust them. Admin accounts for the hosting and database are limited to the founder, and
          those accounts use two-factor authentication.
        </p>
        <p>
          If we learn of a breach that affects a merchant&apos;s customer data, we will tell that merchant
          without undue delay. Merchants can also write to {PINGZA_SUPPORT_EMAIL}.
        </p>
      </section>

      <section className="space-y-2">
        <H>Contact</H>
        <p>
          {PINGZA_OPERATOR_NAME}, {PINGZA_PLACE}. Email{" "}
          <a className="font-mono text-blue-400 hover:underline" href={`mailto:${PINGZA_SUPPORT_EMAIL}`}>
            {PINGZA_SUPPORT_EMAIL}
          </a>
          . The terms are at {PINGZA_TERMS_PATH}.
        </p>
      </section>
    </Shell>
  )
}

export function PingzaTerms() {
  return (
    <Shell title="Terms of Service">
      <section className="space-y-2">
        <H>The service</H>
        <p>
          Pingza is an app that reminds a Shopify store&apos;s customers about an abandoned checkout, on
          WhatsApp and by email as described in the <Link className="text-blue-400 hover:underline" href={PINGZA_PRIVACY_PATH}>privacy policy</Link>.
          It is operated by {PINGZA_OPERATOR_NAME}, a sole proprietor trading as {PINGZA_TRADE_NAME}, in{" "}
          {PINGZA_PLACE}. {PINGZA_TRADE_NAME} is not a registered company.
        </p>
      </section>

      <section className="space-y-2">
        <H>What the merchant must do</H>
        <p>The merchant is responsible for:</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-400">
          <li>Having a lawful basis to message the customer on WhatsApp and by email.</li>
          <li>Turning on email recovery only for customers who accepted marketing.</li>
          <li>Honoring opt-outs. Email unsubscribe is handled by the link in the message. Other opt-outs must be passed to {PINGZA_SUPPORT_EMAIL}.</li>
          <li>Following WhatsApp&apos;s and Shopify&apos;s rules.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Acceptable use</H>
        <p>
          Do not use Pingza to send unlawful, misleading, or unwanted messages, to harass anyone, or to break
          Shopify&apos;s or Meta&apos;s terms. We may stop the service for a store that does.
        </p>
      </section>

      <section className="space-y-2">
        <H>Billing</H>
        <p>
          Paid plans are billed by Shopify through the app subscription the merchant approves in Shopify admin.
          Shopify collects the payment. Uninstalling the app sets the store&apos;s billing status to cancelled
          in Pingza.
        </p>
      </section>

      <section className="space-y-2">
        <H>Ending the service</H>
        <p>
          The merchant can uninstall the app at any time. Uninstall stops new reminders, clears the Shopify
          access token, and cancels billing. Customer fields are removed when Shopify sends the shop erasure
          webhook, or by the retention job described in the privacy policy once that job is allowed to write.
          Either party can stop using the service if the other breaks these terms.
        </p>
      </section>

      <section className="space-y-2">
        <H>Liability</H>
        <p>
          Pingza is a tool for sending reminders. To the extent the law allows, {PINGZA_OPERATOR_NAME} is not
          liable for lost sales, lost profits, or indirect damages, or for a message that a provider refuses to
          deliver. Nothing in these terms limits liability that the law does not allow to be limited.
        </p>
      </section>

      <section className="space-y-2">
        <H>Law</H>
        <p>These terms are governed by the laws of India. The operator is in {PINGZA_PLACE}.</p>
      </section>

      <section className="space-y-2">
        <H>Contact</H>
        <p>
          {PINGZA_OPERATOR_NAME}, {PINGZA_PLACE}. Email{" "}
          <a className="font-mono text-blue-400 hover:underline" href={`mailto:${PINGZA_SUPPORT_EMAIL}`}>
            {PINGZA_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </Shell>
  )
}

export function PingzaDataDeletion() {
  return (
    <Shell title="Data Deletion">
      <section className="space-y-2">
        <H>How to ask</H>
        <p>
          Email{" "}
          <a className="font-mono text-blue-400 hover:underline" href={`mailto:${PINGZA_SUPPORT_EMAIL}`}>
            {PINGZA_SUPPORT_EMAIL}
          </a>{" "}
          or ask the store that sent the reminder. Include the email or phone the reminder used, and the shop
          domain if you know it. No login is required.
        </p>
      </section>
      <section className="space-y-2">
        <H>What we do</H>
        <p>
          Shopify can also send customers/data_request, customers/redact, and shop/redact. We handle those as
          described in the <Link className="text-blue-400 hover:underline" href={PINGZA_PRIVACY_PATH}>privacy policy</Link>.
          A customer erasure clears the personal fields we hold for that person at that store. A shop erasure
          deletes that store&apos;s carts, messages, and access token. An opt-out is kept as a hash so we do
          not email the address again.
        </p>
        <p>
          Uninstalling the app does not by itself clear customer fields. Please allow up to 30 days for a
          request sent to {PINGZA_SUPPORT_EMAIL} to be completed.
        </p>
      </section>
    </Shell>
  )
}
