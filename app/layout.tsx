/*
 * CHANGE LOG — May 10, 2026
 *
 * CHANGE 1: Google Fonts moved from globals.css @import → <head> <link> tags
 *   WHY: @import caused a render-blocking chain (CSS → discover font → fetch font)
 *   FIX: preconnect to fonts.googleapis.com + fonts.gstatic.com declared first,
 *        then font <link> with display=optional (never blocks render even on slow 4G)
 *   display=optional means: use fallback font if not cached, don't wait for download
 *   RULE: Never move fonts back to @import in globals.css
 *
 * CHANGE 2: Printify CDN preconnect added
 *   WHY: Product images come from images.printify.com — preconnect starts the
 *        TCP handshake early so images load faster
 *
 * CHANGE 3: Razorpay script moved from <head> raw <script> → <Script strategy="lazyOnload">
 *   WHY: Raw <script> in <head> blocks ALL rendering until it downloads (56 KiB)
 *   FIX: lazyOnload loads it after everything else — Razorpay only needed at checkout
 *   RULE: Never put Razorpay back in <head> as a raw <script> tag
 *
 * CHANGE 4: Google Analytics + Microsoft Clarity use strategy="afterInteractive"
 *   WHY: These are tracking scripts, not needed for render — deferring saves ~150ms
 *
 * SCRIPTS THAT CANNOT BE OPTIMISED FURTHER (3rd party limitations):
 *   - Razorpay checkout.js includes legacy polyfills (203 KiB unused) — their code, not ours
 *   - Google Analytics gtag is 153 KiB — unavoidable if you want GA
 *   These show as warnings in PageSpeed but cannot be fixed without removing the services
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
        {/* Favicon — inline SVG so no extra network request */}
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white' rx='12'/><text y='72' x='8' font-size='58' font-weight='900' font-family='Georgia,serif' fill='%231A3A8F'>M+</text></svg>"
        />

        {/*
         * Printify CDN preconnect
         * WHY: All product images served from images.printify.com
         * This starts TCP handshake before browser discovers the image URLs
         * RULE: Keep these — removing them adds ~200ms to first product image load
         */}
        <link rel="dns-prefetch" href="https://images.printify.com" />
        <link rel="preconnect" href="https://images.printify.com" crossOrigin="anonymous" />

        {/*
         * Google Fonts — loaded here NOT in globals.css
         * WHY: @import in CSS creates a blocking chain. <link> here loads in parallel.
         * display=optional = browser uses fallback if font not cached, never waits
         * Fonts used: Merriweather (headings, font-heading class) + Inter (body, font-body class)
         * RULE: Never move these back to globals.css as @import
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=optional"
        />

        {/* Schema.org structured data — helps Google understand the site */}
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
         * Razorpay — strategy="lazyOnload"
         * WHY: Was in <head> as raw <script> which blocked ALL rendering
         * lazyOnload = loads after page is fully idle, not needed until checkout
         * RULE: Never move back to <head>. Never use strategy="beforeInteractive"
         * NOTE: Razorpay's own JS has 203 KiB of legacy polyfills — that's their
         * code, not ours. It shows as a warning in PageSpeed but cannot be fixed.
         */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        {/*
         * Google Analytics — strategy="afterInteractive"
         * GA ID: G-N68DENGZD2
         * WHY afterInteractive: loads after hydration, doesn't block render
         * NOTE: GA script is 153 KiB — shows in PageSpeed unused JS warning
         * This is unavoidable if you want Google Analytics. Accept this warning.
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
         * Microsoft Clarity — strategy="afterInteractive"
         * Clarity ID: wo9hkyhyop
         * WHY afterInteractive: session recording, not needed for render
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
