import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Product {
  id: string
  title: string
  price: number
  image: string
  category: string
  description: string
}

interface WishlistStore {
  items: Product[]
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  isInWishlist: (id: string) => boolean
  clearWishlist: () => void
}

const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const already = get().items.find((i) => i.id === product.id)
        if (!already) {
          set({ items: [...get().items, product] })
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) })
      },

      isInWishlist: (id) => {
        return !!get().items.find((i) => i.id === id)
      },

      clearWishlist: () => set({ items: [] }),
    }),
    { name: 'wishlist-storage' }
  )
)

export default useWishlistStore
