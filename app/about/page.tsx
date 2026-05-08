import Link from 'next/link'

export const metadata = {
  title: 'About Us — The Real Medico',
  description: 'The story behind The Real Medico — premium merchandise for healthcare professionals.',
}

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-heading font-bold text-primary mb-6">
        About The Real Medico
      </h1>

      <div className="space-y-8 text-text-slate leading-relaxed">
        <p className="text-xl text-text-dark">
          We are a medical merchandise brand built by healthcare professionals, for healthcare professionals.
        </p>

        <p>
          The Real Medico was born from a simple idea — the people who dedicate their lives to healing others deserve to wear their passion with pride. Whether you're a doctor, nurse, medical student, paramedic, or healthcare worker of any kind, we create premium quality merchandise that celebrates what you do.
        </p>

        <p>
          Every product is carefully designed with authentic medical themes, printed on demand with the highest quality materials, and shipped directly to your door anywhere in India.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
          {[
            { icon: '🏥', title: 'For Healthcare Heroes', desc: 'Designed specifically for medical professionals and students who want to show their pride.' },
            { icon: '🖨️', title: 'Print on Demand', desc: 'Every item printed fresh for you — no excess inventory, always sustainable.' },
            { icon: '❤️', title: 'Made with Pride', desc: 'Premium materials and designs that last as long as your dedication to medicine.' },
          ].map(item => (
            <div key={item.title} className="card p-6 text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-text-dark mb-2">{item.title}</h3>
              <p className="text-text-slate text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="card p-6 bg-accent">
          <h2 className="text-xl font-bold text-primary mb-3">Our Mission</h2>
          <p>
            To create a community where healthcare professionals feel seen, celebrated, and connected — starting with what they wear. Medicine is not just a job; it's an identity. We exist to help you wear that identity with pride.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-primary mb-3">Legal Information</h2>
          <div className="text-sm space-y-1">
            <p><strong>Brand:</strong> The Real Medico</p>
            <p><strong>Website:</strong> therealmedico.store</p>
            <p><strong>Email:</strong> support@therealmedico.store</p>
            <p><strong>Country:</strong> India</p>
            <p className="text-xs text-text-slate mt-2">
              In compliance with Consumer Protection (E-Commerce) Rules 2020.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link href="/shop" className="btn-primary inline-block mr-4">
            Shop Now
          </Link>
          <Link href="/contact" className="btn-secondary inline-block">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}
