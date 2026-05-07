'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch('/api/printify/products')
        const data = await res.json()
        const found = data.products?.find((p: any) => p.id === id)
        if (found) {
          setProduct(found)
          setSelectedVariant(found.variants?.[0])
        }
      } catch {
        console.error('Failed to fetch product')
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  const handleAddToCart = () => {
    if (!product) return
    addItem({
      id: `${product.id}-${selectedVariant?.id || 'default'}`,
      productId: product.id,
      variantId: selectedVariant?.id || 'default',
      title: product.title,
      image: product.image,
      price: selectedVariant?.price || product.price,
      size: selectedVariant?.title || 'M',
      quantity,
    })
    toast.success('Added to cart!')
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="w-full h-96 bg-slate-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 bg-slate-200 rounded w-3/4" />
          <div className="h-6 bg-slate-200 rounded w-1/4" />
          <div className="h-24 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  )

  if (!product) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-6xl mb-4">😕</div>
      <h2 className="text-2xl font-bold text-primary mb-4">Product not found</h2>
      <Link href="/shop" className="btn-primary inline-block">Back to Shop</Link>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/shop" className="text-primary text-sm hover:underline mb-6 inline-block">
        ← Back to Shop
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-4">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-96 object-cover rounded-2xl"
          />
          {product.images?.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {product.images.slice(0, 5).map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  alt={`${product.title} ${i + 1}`}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer border-2 border-transparent hover:border-primary"
                />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-text-dark mb-2">
              {product.title}
            </h1>
            <p className="text-3xl font-bold text-primary">
              ${selectedVariant?.price || product.price}
            </p>
          </div>

          <p className="text-text-slate leading-relaxed">
            {product.description || 'Premium quality medical-themed merchandise.'}
          </p>

          {/* Variant Selector */}
          {product.variants?.length > 0 && (
            <div>
              <p className="font-semibold mb-3">
                Size: <span className="text-primary">{selectedVariant?.title}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    disabled={!v.available}
                    className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-primary bg-primary text-white'
                        : v.available
                        ? 'border-slate-200 hover:border-primary'
                        : 'border-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <p className="font-semibold">Quantity:</p>
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="font-bold text-lg">-</button>
              <span className="w-8 text-center font-bold">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="font-bold text-lg">+</button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button onClick={handleAddToCart} className="btn-primary flex-1">
              Add to Cart
            </button>
            <Link href="/cart" className="btn-secondary flex-1 text-center">
              View Cart
            </Link>
          </div>

          {/* Shipping info */}
          <div className="bg-accent rounded-xl p-4 space-y-2 text-sm text-text-slate">
            <p>🚚 Free shipping on orders over ₹2000</p>
            <p>🖨️ Printed on demand — ships in 3-5 business days</p>
            <p>↩️ 30-day return policy</p>
          </div>
        </div>
      </div>
    </div>
  )
}
