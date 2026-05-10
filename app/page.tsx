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
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white' rx='12'/><text y='72' x='8' font-size='58' font-weight='900' font-family='Georgia,serif' fill='%231A3A8F'>M+</text></svg>" />

        {/* Structured data */}
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

        {/* Razorpay */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Toaster position="bottom-right" />

        {/* Google Analytics */}
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

        {/* Microsoft Clarity */}
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
