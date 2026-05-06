import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'The Real Medico — Medical Merchandise Store',
  description: 'Premium medical-themed merchandise for healthcare professionals.',
  keywords: 'medical merchandise, doctor gifts, nurse gifts, medical apparel',
  openGraph: {
    title: 'The Real Medico',
    description: 'Premium medical-themed merchandise',
    type: 'website',
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
        <script
          src="https://checkout.razorpay.com/v1/checkout.js"
          async
        />
      </head>
      <body>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
