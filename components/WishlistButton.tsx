'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  product: {
    id: string
    title: string
    image: string
    price: number
  }
}

export default function WishlistButton({ product }: Props) {
  const [wishlisted, setWishlisted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('product_id', product.id)
        .single()
      if (data) setWishlisted(true)
    }
    check()
  }, [product.id])

  const toggle = async () => {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Please sign in to save to wishlist')
      return
    }
    setLoading(true)
    if (wishlisted) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', session.user.id)
        .eq('product_id', product.id)
      setWishlisted(false)
      toast.success('Removed from wishlist')
    } else {
      await supabase.from('wishlist').insert({
        user_id: session.user.id,
        product_id: product.id,
        product_title: product.title,
        product_image: product.image,
        product_price: product.price,
      })
      setWishlisted(true)
      toast.success('Added to wishlist ❤️')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`p-3 rounded-xl border-2 transition-all ${
        wishlisted
          ? 'bg-red-50 border-red-200 text-red-500'
          : 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-400'
      }`}
      title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      {wishlisted ? '❤️' : '🤍'}
    </button>
  )
}
