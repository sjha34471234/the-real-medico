/*
 * ============================================================
 * CHANGE LOG — May 11, 2026 — FONT PRELOADS + CONDITIONAL RAZORPAY
 * ============================================================
 *
 * WHAT CHANGED:
 *   1. Added <link rel="preload"> for 6 critical WOFF2 fonts in <head>
 *   2. Razorpay script now only loads on /checkout (not every page)
 *   3. [May 11, 2026 - Admin] Navbar/Footer hidden on /admin/* routes
 *
 * WHY:
 *   Font preloads: Network dependency tree showed fonts chaining behind CSS.
 *   Browser was discovering fonts only AFTER CSS parsed = 1,054ms delay.
 *   Preload tells browser to fetch fonts immediately on first byte = parallel.
 *
 *   Razorpay conditional: PageSpeed showed 236 KiB unused JS + 21.7 KiB
 *   unused CSS loading on product pages where payment is never triggered.
 *   Now only loads on /checkout where it's actually needed.
 *
 *   Admin layout: /admin/* has its own sidebar layout — store Navbar/Footer
 *   must not render there or they overlap the admin shell.
 *
 * FONTS NOT PRELOADED (intentional):
 *   Inter_18pt-Light (weight 300) — rarely used above the fold
 *   Merriweather-Regular (weight 400) — body text, loaded after LCP
 *
 * RULE FOR FUTURE CLAUDE:
 *   DO NOT remove the font preload links — they fix the 1,054ms chain.
 *   DO NOT move Razorpay back to loading on all pages.
 *   DO NOT remove the isAdmin check — admin has its own layout.
 *   crossOrigin="anonymous" is REQUIRED on font preloads — without it
 *   the browser fetches the font twice (preload + actual use).
 *
 * PREVIOUS HISTORY:
 *   May 10 2026: Removed Google Fonts <link> tags — fonts self-hosted
 *   May 10 2026: Razorpay moved from <head> to lazyOnload
 *   May 11 2026: Font preloads added, Razorpay made conditional
 *   May 11 2026: Admin Navbar/Footer suppression added
 * ============================================================
 */

import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import { headers } from 'next/headers'

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
  // [May 11, 2026] REASON: Read pathname server-side to conditionally load Razorpay
  // Only /checkout needs Razorpay — loading it everywhere wastes 236 KiB on product pages
  const headersList = headers()
  const pathname = headersList.get('x-invoke-path') || headersList.get('x-pathname') || ''
  const isCheckout = pathname === '/checkout'

  // [May 11, 2026] REASON: Admin has its own sidebar layout in app/admin/layout.tsx
  // Store Navbar + Footer must NOT render on /admin/* — they overlap the admin shell
  const isAdmin = pathname.startsWith('/admin')

  return (
    <html lang="en">
      <head>
        {/* ── Favicon — inline SVG, zero network request ── */}
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white' rx='12'/><text y='72' x='8' font-size='58' font-weight='900' font-family='Georgia,serif' fill='%231A3A8F'>M+</text></svg>"
        />

        {/*
         * ── Printify CDN preconnect ──
         * WHY: All product images are served from images.printify.com
         * Pre-establishes TCP connection before browser discovers image URLs.
         * SAVES: ~200ms on first product image load
         * RULE: Keep these — removing them slows down shop/product pages
         */}
        <link rel="dns-prefetch" href="https://images.printify.com" />
        <link rel="preconnect" href="https://images.printify.com" crossOrigin="anonymous" />

        {/*
         * ── Critical font preloads ──
         * [May 11, 2026] ADDED: Fixes 1,054ms font chain delay found in PageSpeed
         *
         * WHY THIS WORKS:
         *   Without preload: browser loads HTML → loads CSS → parses CSS → discovers fonts → downloads fonts
         *   With preload:    browser loads HTML → immediately starts downloading fonts IN PARALLEL with CSS
         *   Saves the entire CSS parse time (~829ms) from the font download critical path.
         *
         * WHY crossOrigin="anonymous" IS REQUIRED:
         *   Fonts are loaded with CORS mode. If preload crossOrigin doesn't match actual fetch,
         *   browser fetches the font TWICE — once for preload (wasted), once for real use.
         *   crossOrigin="anonymous" must be on every font preload link.
         *
         * ⚠️ DO NOT REMOVE THESE — removing reverts the 1,054ms chain delay
         */}
        <link rel="preload" href="/fonts/Inter_18pt-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_24pt-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_28pt-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Inter_28pt-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Merriweather-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Merriweather%20UltraBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        {/* ── Schema.org structured data ── */}
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
              "sameAs": [
                "https://instagram.com/therealmedico"
              ],
              "areaServed": "Worldwide",
              "foundingLocation": "India"
            })
          }}
        />
      </head>
      <body>
        {/* [May 11, 2026] REASON: isAdmin check — admin has own layout with sidebar */}
        {!isAdmin && <Navbar />}
        <main className="min-h-screen">
          {children}
        </main>
        {!isAdmin && <Footer />}
        <Toaster position="bottom-right" />

        {/*
         * ── Razorpay — conditional, only on /checkout ──
         * [May 11, 2026] CHANGED: Was loading on every page (lazyOnload)
         * NOW: Only loads when pathname === '/checkout'
         * ⚠️ DO NOT move back to loading on all pages
         */}
        {isCheckout && (
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
          />
        )}

        {/*
         * ── Google Analytics — strategy="afterInteractive" ──
         * GA ID: G-N68DENGZD2
         * KNOWN LIMITATION: 153 KiB — unavoidable. Accept PageSpeed warning.
         */}
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

        {/*
         * ── Microsoft Clarity — strategy="afterInteractive" ──
         * Clarity ID: wo9hkyhyop
         */}
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
