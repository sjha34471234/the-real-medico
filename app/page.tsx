import Link from 'next/link'
import ProductGrid from '@/components/ProductGrid'

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-heading font-black mb-6 leading-tight">
            Wear Your Passion<br />for Medicine
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Premium merchandise for healthcare heroes. Designed with pride, built for comfort.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop" className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:bg-accent transition-all">
              Shop Now
            </Link>
            <Link href="/about" className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-primary transition-all">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-accent px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center text-primary mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Browse', desc: 'Explore our medical-themed collection designed for healthcare professionals.' },
              { step: '02', title: 'Order', desc: 'Choose your size, color and quantity. Secure checkout in seconds.' },
              { step: '03', title: 'Delivered', desc: 'Your order is printed and shipped directly to your door.' },
            ].map((item) => (
              <div key={item.step} className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="text-5xl font-black text-primary mb-4">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-text-slate">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center text-primary mb-4">
            Featured Products
          </h2>
          <p className="text-center text-text-slate mb-12">
            Bestsellers loved by healthcare professionals
          </p>
          <ProductGrid featured={true} />
          <div className="text-center mt-10">
            <Link href="/shop" className="btn-primary inline-block">
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-primary text-white px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-heading font-bold mb-4">
            Stay in the Loop
          </h2>
          <p className="text-blue-100 mb-8">
            Get updates on new products and exclusive offers for healthcare workers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 px-4 py-3 rounded-lg text-text-dark focus:outline-none"
            />
            <button className="bg-white text-primary px-6 py-3 rounded-lg font-bold hover:bg-accent transition-all">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
