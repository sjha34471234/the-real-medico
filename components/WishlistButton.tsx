'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const supabase = createClient(
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
  const [currentUser, setCurrentUser] = useState<any>(null)
  const checkedFor = useRef<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null
        setCurrentUser(user)

        if (user && checkedFor.current !== `${user.id}-${product.id}`) {
          checkedFor.current = `${user.id}-${product.id}`
          const { data } = await supabase
            .from('wishlist')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', product.id)
            .single()
          setWishlisted(!!data)
        }

        if (!user) {
          setWishlisted(false)
          checkedFor.current = null
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [product.id])

  const toggle = async () => {
    if (!currentUser) {
      toast.error('Please sign in to save to wishlist')
      return
    }

    setLoading(true)

    if (wishlisted) {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('product_id', product.id)
      if (!error) {
        setWishlisted(false)
        toast('Removed from wishlist', { icon: '💔' })
      } else {
        toast.error('Could not remove from wishlist')
      }
    } else {
      const { error } = await supabase.from('wishlist').insert({
        user_id: currentUser.id,
        product_id: product.id,
        product_title: product.title,
        product_image: product.image,
        product_price: product.price,
      })
      if (!error) {
        setWishlisted(true)
        toast.success('Added to wishlist ❤️')
      } else {
        toast.error('Could not save to wishlist')
      }
    }

    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`p-3 rounded-xl border-2 transition-all ${
        wishlisted
          ? 'bg-red-50 border-red-200 text-red-500'
          : 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-400'
      }`}
    >
      {wishlisted ? '❤️' : '🤍'}
    </button>
  )
}
