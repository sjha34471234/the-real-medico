/*
 * ============================================================
 * FILE: app/layout.tsx
 * PURPOSE: Root layout — Navbar, Footer, fonts, analytics, currency sync
 * LAST CHANGED: May 15, 2026
 * ============================================================
 * CHANGE LOG
 * ============================================================
 * May 10 2026: Removed Google Fonts — fonts self-hosted
 * May 10 2026: Razorpay moved to lazyOnload
 * May 11 2026: Font preloads added — fixes 1,054ms chain delay
 * May 11 2026: Admin Navbar/Footer suppression added
 * May 11 2026: Fixed admin detection — x-next-url works on all domains
 * May 15 2026: Razorpay removed from layout — moved to checkout/page.tsx
 *   REASON: isCheckout relied on x-next-url header which returns empty on
 *   some Vercel deployments → script never loaded → window.Razorpay undefined
 *   → payment threw "Something went wrong". checkout/page.tsx now loads it
 *   directly via <Script strategy="afterInteractive"> — guaranteed to load.
 * May 15 2026: Added CurrencySyncTrigger client component
 *   REASON: Currency rates need to be synced from open.er-api.com and stored
 *   as peak rates in Supabase (ratchet rule: prices only go up, never down).
 *   Trigger fires once per hour max — gated server-side by updated_at timestamp.
 *   Fire-and-forget: never blocks render, never shows errors to user.
 *
 * ⚠️ DO NOT remove font preload links — fixes 1,054ms chain delay
 * ⚠️ DO NOT add Razorpay back here — it lives in app/checkout/page.tsx now
 * ⚠️ DO NOT remove isAdmin check — admin has its own sidebar layout
 * ⚠️ crossOrigin="anonymous" REQUIRED on font preloads
 * ⚠️ DO NOT remove CurrencySyncTrigger — it keeps peak rates current sitewide
 * ============================================================
 */

import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import { headers } from 'next/headers'
import CurrencySyncTrigger from '@/components/CurrencySyncTrigger'

export const metadata: Metadata = {
  title: 'The Real Medico — Medical Merchandise Store',
  description: 'Premium medical-themed merchandise for healthcare professionals. Shop t-shirts, hoodies, mugs and more — made in India, delivered worldwide.',
  keywords: 'medical merchandise, doctor gifts, nurse gifts, medical apparel, healthcare clothing, nursing gifts, medical t-shirts, doctor hoodie, india medical store',
  verification: {
    google: '4uzPndMqPUBAsl4nVaG2KXg5qYLIUnT7vQEu18nJ4ec',
  },
  openGraph: {
    title: 'The Real Medico — Medical Merchandise Store',
    description: 'Premium medical-themed merchandise for healthcare professionals. Made in India, delivered worldwide.',
    type: 'website',
    url: 'https://therealmedico.store',
    siteName: 'The Real Medico',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Real Medico — Medical Merchandise Store',
    description: 'Premium medical-themed merchandise for healthcare professionals.',
  },
  alternates: {
    canonical: 'https://therealmedico.store',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()

  // [May 11, 2026] REASON: x-next-url is most reliable across Vercel preview URLs,
  // custom domains, and local dev. Falls back through multiple options.
  const rawUrl =
    headersList.get('x-next-url') ||
    headersList.get('x-invoke-path') ||
    headersList.get('x-pathname') ||
    ''

  let pathname = ''
  try {
    pathname = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl
  } catch {
    pathname = rawUrl
  }

  // [May 11, 2026] Admin has own sidebar layout — store nav must NOT render there
  const isAdmin = pathname.startsWith('/admin')

  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white' rx='12'/><text y='72' x='8' font-size='58' font-weight='900' font-family='Georgia,serif' fill='%231A3A8F'>M+</text></svg>"
        />
        <link rel="dns-prefetch" href="https://images.printify.com" />
        <link rel="preconnect" href="https://images.printify.com" crossOrigin="anonymous" />

        {/* Critical font preloads — DO NOT REMOVE — fixes 1,054ms chain delay */}
        <link rel="preload" href="/fonts/Inter_18pt-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_24pt-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_28pt-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_28pt-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Merriweather-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Merriweather%20UltraBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "The Real Medico",
              "url": "https://therealmedico.store",
              "logo": "https://therealmedico.store/logo.png",
              "description": "Premium medical-themed merchandise for healthcare professionals.",
              "contactPoint": {
                "@type": "ContactPoint",
                "email": "support@therealmedico.store",
                "contactType": "customer service",
                "availableLanguage": "English"
              },
              "sameAs": ["https://instagram.com/therealmedico"],
              "areaServed": "Worldwide",
              "foundingLocation": "India"
            })
          }}
        />
      </head>
      <body>
        {!isAdmin && <Navbar />}
        <main className="min-h-screen">
          {children}
        </main>
        {!isAdmin && <Footer />}
        <Toaster position="bottom-right" />

        {/*
          May 15, 2026: Silent currency sync — DO NOT REMOVE
          Fires /api/currency/sync in the background on every page load.
          Server gates it to once per hour via updated_at check — no hammering.
          Keeps peak rates current so prices reflect the ratcheted maximum.
          Never blocks render. Never shows errors to users.
          Excluded on admin pages — no need to sync on every admin action.
        */}
        {!isAdmin && <CurrencySyncTrigger />}

        {/* May 15, 2026: Razorpay removed from here — now lives in app/checkout/page.tsx
            isCheckout detection via headers was unreliable on Vercel */}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-N68DENGZD2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-N68DENGZD2');
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wo9hkyhyop");
          `}
        </Script>
      </body>
    </html>
  )
}
