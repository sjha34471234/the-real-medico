/*
 * ============================================================
 * CHANGE LOG — May 10, 2026 — FONT SELF-HOSTING
 * ============================================================
 *
 * WHAT CHANGED:
 *   REMOVED the 3 Google Fonts <link> tags that were previously
 *   added here (preconnect + stylesheet).
 *
 * WHY:
 *   Fonts are now self-hosted in /public/fonts/ via @font-face
 *   in globals.css. No external CDN needed at all.
 *   Eliminates ~750ms Google Fonts CDN round trips on mobile.
 *
 * WHAT IS STILL HERE (do not remove these):
 *   - Printify CDN preconnect — product images still come from
 *     images.printify.com, this saves ~200ms on first image load
 *   - Razorpay lazyOnload — payment script, must stay lazyOnload
 *   - Google Analytics afterInteractive — tracking, stays deferred
 *   - Microsoft Clarity afterInteractive — session recording, deferred
 *
 * RULE FOR FUTURE CLAUDE:
 *   DO NOT add Google Fonts <link> or preconnect tags back here.
 *   Fonts are handled entirely by globals.css @font-face.
 *   If you see <link rel="stylesheet" href="fonts.googleapis.com">
 *   anywhere in this project — DELETE IT, it is a regression.
 *
 * FULL HISTORY:
 *   Phase 1 (May 10 2026): @import removed from globals.css → moved to <link> here
 *   Phase 2 (May 10 2026): <link> removed from here → fonts fully self-hosted in globals.css
 * ============================================================
 */

import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'

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
         * This pre-establishes the TCP connection before the browser
         * discovers the image URLs in the page HTML.
         * SAVES: ~200ms on first product image load
         * RULE: Keep these — removing them slows down shop/product pages
         */}
        <link rel="dns-prefetch" href="https://images.printify.com" />
        <link rel="preconnect" href="https://images.printify.com" crossOrigin="anonymous" />

        {/*
         * ── NO Google Fonts link tags here ──
         * Fonts (Inter + Merriweather) are self-hosted via @font-face in globals.css
         * Files live in /public/fonts/ on our own Vercel domain
         * DO NOT add Google Fonts <link> tags back here — it is a performance regression
         * See globals.css for full explanation and file list
         */}

        {/* ── Schema.org structured data — helps Google understand the site ── */}
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
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Toaster position="bottom-right" />

        {/*
         * ── Razorpay — strategy="lazyOnload" ──
         * WHY: Was previously a raw <script> in <head> which blocked ALL rendering
         * lazyOnload = loads after the page is fully idle
         * Razorpay is only needed when user reaches checkout, not on page load
         * SAVES: Removes 56 KiB blocking script from critical path
         * RULE: Never move back to <head>. Never use strategy="beforeInteractive".
         *
         * KNOWN LIMITATION (cannot fix):
         * Razorpay's checkout.js includes 203 KiB of legacy polyfills — their code.
         * Shows as PageSpeed warning. Accept it, cannot be removed.
         */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        {/*
         * ── Google Analytics — strategy="afterInteractive" ──
         * GA ID: G-N68DENGZD2
         * WHY afterInteractive: loads after hydration, does not block render
         * KNOWN LIMITATION: GA script is 153 KiB — shows in PageSpeed unused JS.
         * Unavoidable if you want Google Analytics. Accept this warning.
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
         * WHY afterInteractive: session recording script, not needed for render
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
