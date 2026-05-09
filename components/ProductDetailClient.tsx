'use client'
import { useState } from 'react'
import Link from 'next/link'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import WishlistButton from './WishlistButton'
import ReviewSection from './ReviewSection'
import { useCurrencyStore } from '@/store/currencyStore'

export default function ProductDetailClient({ product }: { product: any }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0])
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState(product.image)
  const addItem = useCartStore(s => s.addItem)
  const { formatPrice } = useCurrencyStore()

  const currentPrice = selectedVariant?.price || product.price

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-${selectedVariant?.id}-${Date.now()}`,
      productId: product.id,
      variantId: String(selectedVariant?.id || 'default'),
      title: product.title,
      image: mainImage,
      price: currentPrice,
      size: selectedVariant?.title || 'M',
      quantity,
    })
    toast.success('Added to cart!')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/shop" className="text-primary text-sm hover:underline mb-6 inline-block">
        ← Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-3">
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-96 object-cover rounded-2xl border border-slate-100"
          />
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.slice(0, 6).map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  alt={`view ${i + 1}`}
                  onClick={() => setMainImage(img)}
                  className={`w-20 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer border-2 transition-all ${mainImage === img ? 'border-primary' : 'border-transparent hover:border-primary'}`}
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
              {formatPrice(currentPrice)}
            </p>
          </div>

          <div
            className="text-text-slate leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.description || 'Premium quality medical merchandise.' }}
          />

          {/* Variants */}
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
                    aria-label={`Select size ${v.title}`}
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
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="font-bold text-lg w-6"
              >-</button>
              <span className="w-8 text-center font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="font-bold text-lg w-6"
              >+</button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={handleAddToCart} className="btn-primary flex-1">
              Add to Cart
            </button>
            <WishlistButton product={{
              id: product.id,
              title: product.title,
              image: mainImage,
              price: currentPrice,
            }} />
          </div>
          <Link href="/cart" className="btn-secondary w-full text-center block">
            View Cart
          </Link>

          {/* Shipping info */}
          <div className="bg-accent rounded-xl p-4 space-y-2 text-sm text-text-slate">
            <p>🚚 Free shipping on orders over {formatPrice(24)}</p>
            <p>🖨️ Printed on demand — ships in 3-5 business days</p>
            <p>↩️ 30-day return policy</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewSection productId={product.id} />
    </div>
  )
}
