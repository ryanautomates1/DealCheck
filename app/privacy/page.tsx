'use client'

import Link from 'next/link'

/**
 * Privacy Policy for DealMetrics (getdealmetrics.com and Chrome extension).
 * Boilerplate suitable for Chrome Web Store approval.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700">
            DealMetrics
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 pb-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">1. Introduction</h2>
            <p>
              DealMetrics (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the website getdealmetrics.com and the DealMetrics Chrome extension. This Privacy Policy describes how we collect, use, and protect your information when you use our website, extension, or related services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">2. Information We Collect</h2>
            <p className="mb-2">We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> When you create an account, we collect your email address and password (stored securely by our authentication provider).</li>
              <li><strong>Deal and property data:</strong> Information you enter or import about real estate properties (e.g., addresses, prices, assumptions) to perform analyses and save deals to your dashboard.</li>
              <li><strong>Usage data:</strong> We may collect basic usage information (e.g., feature usage, errors) to improve our services. We do not sell this data.</li>
              <li><strong>Payment information:</strong> If you subscribe to a paid plan, payment processing is handled by Stripe. We do not store full payment card details; we receive only subscription status and billing identifiers from Stripe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide, operate, and maintain our website and Chrome extension</li>
              <li>Authenticate you and manage your account</li>
              <li>Store and display your saved deals and analyses</li>
              <li>Process subscriptions and payments (via Stripe)</li>
              <li>Send you important service-related communications (e.g., account or billing)</li>
              <li>Improve our services and fix errors</li>
              <li>Comply with applicable laws and protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">4. Third-Party Services</h2>
            <p className="mb-2">We use the following third-party services, each with their own privacy practices:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase:</strong> Authentication and database hosting. Your account and deal data are stored by Supabase. See <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase Privacy Policy</a>.</li>
              <li><strong>Stripe:</strong> Payment processing for subscriptions. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Stripe Privacy Policy</a>.</li>
              <li><strong>Vercel (or hosting provider):</strong> Website hosting and serverless functions. Traffic and logs may be processed by the host.</li>
            </ul>
            <p className="mt-2">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">5. Chrome Extension</h2>
            <p className="mb-2">The DealMetrics Chrome extension:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Purpose:</strong> The extension runs only on Zillow listing pages to help you analyze real estate deals and optionally save them to your DealMetrics dashboard.</li>
              <li><strong>Permissions:</strong> It requests access to Zillow (to read listing data you view), getdealmetrics.com (to sign in and save deals), and storage (to keep your sign-in token locally). It does not access other websites or your browsing history beyond these purposes.</li>
              <li><strong>Data in the extension:</strong> Your sign-in token and email may be stored in the browser&apos;s sync storage so you stay signed in. Property data you choose to save is sent to our servers and stored in your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">6. Data Storage and Security</h2>
            <p>
              We use industry-standard measures to protect your data, including encryption in transit (HTTPS) and secure authentication. Your data is stored with our infrastructure and database provider (Supabase). We retain your data for as long as your account is active or as needed to provide services and comply with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct or update your data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of certain uses of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">To exercise these rights or delete your account, contact us using the information below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">8. Cookies and Local Storage</h2>
            <p>
              Our website uses cookies and similar technologies for authentication and session management. The Chrome extension may use the browser&apos;s local or sync storage to store your sign-in token. You can clear this data via your browser or extension settings, or by signing out from the extension or website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">9. Children</h2>
            <p>
              Our services are not directed to individuals under 16. We do not knowingly collect personal information from children under 16.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">10. Changes</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the &quot;Last updated&quot; date. Continued use of our services after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">11. Contact</h2>
            <p>
              For privacy-related questions, to request access or deletion of your data, or to contact us for any reason:
            </p>
            <p className="mt-2">
              <strong>DealMetrics</strong><br />
              Website: <a href="https://getdealmetrics.com" className="text-blue-600 hover:underline">https://getdealmetrics.com</a><br />
              Email: Please use the contact or support option available on the website, or the email address provided in the Chrome Web Store listing.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
          <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">
            ← Back to DealMetrics
          </Link>
        </div>
      </main>
    </div>
  )
}
