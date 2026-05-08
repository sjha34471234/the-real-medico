export const metadata = {
  title: 'FAQ — The Real Medico',
  description: 'Frequently asked questions about shipping, returns, sizing and more.',
}

const faqs = [
  {
    category: 'Orders & Shipping',
    items: [
      { q: 'How long does shipping take?', a: 'Orders are printed in 3-5 business days. Delivery within India takes 5-10 business days. International shipping takes 10-20 business days depending on your country.' },
      { q: 'Do you ship internationally?', a: 'Yes! We ship worldwide. If your country is not listed at checkout, international shipping is coming to your region soon — contact us and we will try to help.' },
      { q: 'Can I track my order?', a: 'Yes! You will receive a tracking number via email once your order ships.' },
      { q: 'What shipping carriers do you use?', a: 'We use trusted carriers including Delhivery, BlueDart, and FedEx depending on your location.' },
    ]
  },
  {
    category: 'Products & Sizing',
    items: [
      { q: 'What sizes do you offer?', a: 'We offer XS through 3XL for most apparel. Each product page has a detailed size chart.' },
      { q: 'How do I choose the right size?', a: 'We recommend checking the size chart on each product page. When in doubt, size up for a relaxed fit.' },
      { q: 'Are the colors accurate?', a: 'We try to represent colors as accurately as possible. Slight variations may occur due to monitor settings.' },
      { q: 'What material are the products made of?', a: 'Most t-shirts are 100% combed cotton or cotton-polyester blends. Full material details are on each product page.' },
    ]
  },
  {
    category: 'Returns & Refunds',
    items: [
      { q: 'What is your return policy?', a: 'We are currently not offering returns or exchanges. However, a full return and exchange policy is coming very soon! If your item arrived damaged or defective, we will always make it right — contact us with photos.' },
      { q: 'My item arrived damaged. What do I do?', a: 'Email us at support@therealmedico.store with photos of the damage within 7 days of delivery. We will send a replacement at no cost.' },
      { q: 'Can I cancel my order?', a: 'Orders can be cancelled within 24 hours of placement. After that, production has begun and cancellation is not possible.' },
      { q: 'How long do refunds take?', a: 'Approved refunds are processed within 5-7 business days to your original payment method.' },
    ]
  },
  {
    category: 'Payments',
    items: [
      { q: 'What payment methods do you accept?', a: 'We accept UPI, credit/debit cards, net banking, and all major digital wallets via Razorpay. International cards are also accepted.' },
      { q: 'Is my payment information secure?', a: 'Yes. All payments are processed by Razorpay, a PCI-DSS compliant payment gateway. We never store your card details.' },
      { q: 'Do you offer Cash on Delivery (COD)?', a: 'COD is not currently available. We are working on adding this option soon.' },
    ]
  },
  {
    category: 'Real Medico+ Membership',
    items: [
      { q: 'What is Real Medico+?', a: 'Real Medico+ is our premium membership for ₹415/month (~$5). Members get early access to new products, 15% discount on all orders, free shipping, and exclusive community access.' },
      { q: 'How do I join Real Medico+?', a: 'Go to your Account page and tap the "Real Medico+" tab. Membership is invite-only and exclusively for verified healthcare professionals and students.' },
      { q: 'Can I cancel my membership?', a: 'Yes, you can cancel anytime from your Account page. Your benefits continue until the end of the billing period.' },
    ]
  },
]

export default function FAQPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-heading font-bold text-primary mb-2">
        Frequently Asked Questions
      </h1>
      <p className="text-text-slate mb-12">
        Everything you need to know about The Real Medico.
      </p>

      <div className="space-y-10">
        {faqs.map((section) => (
          <div key={section.category}>
            <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b border-slate-100">
              {section.category}
            </h2>
            <div className="space-y-3">
              {section.items.map((faq, i) => (
                <details key={i} className="card p-4 cursor-pointer group">
                  <summary className="font-semibold text-text-dark list-none flex justify-between items-center">
                    {faq.q}
                    <span className="text-primary text-lg group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="text-text-slate text-sm mt-3 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 card p-6 bg-accent text-center">
        <p className="font-semibold text-text-dark mb-2">Still have questions?</p>
        <p className="text-text-slate text-sm mb-4">Our team responds within 24 hours</p>
        <a href="/contact" className="btn-primary inline-block">Contact Us</a>
      </div>
    </div>
  )
}
