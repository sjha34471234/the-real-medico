export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-heading font-bold text-primary mb-6">About The Real Medico</h1>
      <div className="prose max-w-none space-y-6 text-text-slate leading-relaxed">
        <p className="text-xl text-text-dark">
          We are a medical merchandise brand built by healthcare professionals, for healthcare professionals.
        </p>
        <p>
          The Real Medico was born from a simple idea — the people who dedicate their lives to healing others deserve to wear their passion with pride. From doctors and nurses to medical students and paramedics, we create premium quality merchandise that celebrates the medical community.
        </p>
        <p>
          Every product is carefully designed with medical themes, printed on demand with the highest quality materials, and shipped directly to your door.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {[
            { icon: '🏥', title: 'For Healthcare Heroes', desc: 'Designed specifically for medical professionals and students.' },
            { icon: '🖨️', title: 'Print on Demand', desc: 'Every item printed fresh — no waste, always in stock.' },
            { icon: '❤️', title: 'Made with Pride', desc: 'Quality materials that last as long as your dedication.' },
          ].map((item) => (
            <div key={item.title} className="card p-6 text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-text-dark mb-2">{item.title}</h3>
              <p className="text-text-slate text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
