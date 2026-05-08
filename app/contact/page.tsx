'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill all fields')
      return
    }
    setSending(true)
    await new Promise(r => setTimeout(r, 1000))
    toast.success('Message sent! We will reply within 24 hours.')
    setForm({ name: '', email: '', message: '' })
    setSending(false)
  }

  const faqs = [
    { q: 'How long does shipping take?', a: 'Orders are printed and shipped within 3-5 business days. Delivery takes 5-10 days within India and 10-20 days internationally.' },
    { q: 'Do you ship internationally?', a: 'Yes! We ship worldwide. If your country is not listed at checkout, shipping is coming to your region soon — reach out and we will try to help.' },
    { q: 'What is your return policy?', a: 'We are currently not offering returns or exchanges, but a full return policy is coming very soon! If your item arrived damaged or defective, contact us with photos and we will make it right.' },
    { q: 'Can I track my order?', a: 'Yes! You will receive a tracking number via email once your order ships.' },
    { q: 'What sizes do you offer?', a: 'We offer XS through 3XL for most apparel items. Check individual product pages for size charts.' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-heading font-bold text-primary mb-2">Contact Us</h1>
      <p className="text-text-slate mb-12">We would love to hear from you. Send us a message!</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="card p-6 space-y-4 h-fit">
          <h2 className="text-xl font-bold">Send a Message</h2>
          <input name="name" placeholder="Your Name" value={form.name} onChange={update} className="input-field" />
          <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={update} className="input-field" />
          <textarea
            name="message"
            placeholder="Your message..."
            value={form.message}
            onChange={update}
            rows={5}
            className="input-field resize-none"
          />
          <button onClick={handleSubmit} disabled={sending} className="btn-primary w-full">
            {sending ? 'Sending...' : 'Send Message'}
          </button>
          <div className="pt-4 space-y-2 text-sm text-text-slate">
            <p>📧 support@therealmedico.store</p>
            <p>⏰ Response within 24 hours</p>
            <p>🌍 Serving customers worldwide</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="card p-4 cursor-pointer">
                <summary className="font-semibold text-text-dark">{faq.q}</summary>
                <p className="text-text-slate text-sm mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
