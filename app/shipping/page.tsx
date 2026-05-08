export const metadata = {
  title: 'Shipping & Returns — The Real Medico',
  description: 'Shipping times, costs, and return policy for The Real Medico.',
}

export default function ShippingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-heading font-bold text-primary mb-2">
        Shipping & Returns
      </h1>
      <p className="text-text-slate mb-12">
        Everything you need to know about getting your order.
      </p>

      <div className="space-y-8">
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">🚚 Shipping</h2>
          <div className="space-y-4 text-text-slate">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Production Time', value: '3-5 business days', icon: '🖨️' },
                { label: 'Delivery (India)', value: '5-10 business days', icon: '📦' },
                { label: 'International', value: '10-20 business days', icon: '✈️' },
              ].map(item => (
                <div key={item.label} className="bg-accent rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="font-semibold text-text-dark text-sm">{item.label}</p>
                  <p className="text-primary font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm">Free shipping on orders over ₹2000. Standard shipping ₹99 for orders below ₹2000.</p>
            <p className="text-sm">You will receive a tracking number by email once your order ships.</p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">↩️ Returns & Refunds</h2>
          <div className="space-y-3 text-text-slate text-sm">
            <p>Since all products are custom printed on demand specifically for you, we have a limited return policy:</p>
            <div className="space-y-2">
              {[
                '✅ Damaged or defective items — full replacement or refund',
                '✅ Wrong item received — full replacement',
                '✅ Item not delivered — full refund after investigation',
                '❌ Change of mind returns — not accepted',
                '❌ Size exchange — not accepted (please check size chart before ordering)',
              ].map((item, i) => (
                <p key={i} className={`font-medium ${item.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
                  {item}
                </p>
              ))}
            </div>
            <p className="mt-4">To initiate a return, email <strong>support@therealmedico.store</strong> within 7 days of delivery with your order number and photos.</p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">💳 Payment & Security</h2>
          <div className="space-y-3 text-text-slate text-sm">
            <p>All payments are processed securely by Razorpay. We accept:</p>
            <div className="flex flex-wrap gap-3 mt-3">
              {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Digital Wallets', 'EMI'].map(method => (
                <span key={method} className="bg-accent text-primary font-medium px-3 py-1 rounded-full text-xs">
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-6 bg-accent">
          <h2 className="text-xl font-bold mb-2">📋 Legal Information</h2>
          <div className="text-text-slate text-sm space-y-1">
            <p><strong>Business Name:</strong> The Real Medico</p>
            <p><strong>Contact:</strong> support@therealmedico.store</p>
            <p><strong>Website:</strong> therealmedico.store</p>
            <p className="mt-2 text-xs">In compliance with Consumer Protection (E-Commerce) Rules 2020, India.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
