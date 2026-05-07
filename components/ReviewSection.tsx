'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Review {
  id: string
  rating: number
  title: string
  body: string
  reviewer_name: string
  is_member: boolean
  upvotes: number
  created_at: string
  userUpvoted?: boolean
}

export default function ReviewSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: '', body: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        // Check membership
        const { data: membership } = await supabase
          .from('memberships')
          .select('active')
          .eq('email', session.user.email)
          .eq('active', true)
          .single()
        if (membership) setIsMember(true)
      }
      await loadReviews(session?.user?.id)
    }
    init()
  }, [productId])

  const loadReviews = async (userId?: string) => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (data) {
      if (userId) {
        const { data: upvoted } = await supabase
          .from('review_upvotes')
          .select('review_id')
          .eq('user_id', userId)
        const upvotedIds = upvoted?.map(u => u.review_id) || []
        setReviews(data.map(r => ({ ...r, userUpvoted: upvotedIds.includes(r.id) })))
      } else {
        setReviews(data)
      }
    }
    setLoading(false)
  }

  const handleUpvote = async (reviewId: string, userUpvoted: boolean) => {
    if (!user) { toast.error('Sign in to upvote'); return }
    const supabase = getSupabase()
    if (userUpvoted) {
      await supabase.from('review_upvotes').delete()
        .eq('user_id', user.id).eq('review_id', reviewId)
      await supabase.from('reviews').update({ upvotes: reviews.find(r => r.id === reviewId)!.upvotes - 1 }).eq('id', reviewId)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, upvotes: r.upvotes - 1, userUpvoted: false } : r))
    } else {
      await supabase.from('review_upvotes').insert({ user_id: user.id, review_id: reviewId })
      await supabase.from('reviews').update({ upvotes: reviews.find(r => r.id === reviewId)!.upvotes + 1 }).eq('id', reviewId)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, upvotes: r.upvotes + 1, userUpvoted: true } : r))
    }
  }

  const handleSubmit = async () => {
    if (!form.body.trim()) { toast.error('Please write a review'); return }
    setSubmitting(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      product_id: productId,
      rating: form.rating,
      title: form.title,
      body: form.body,
      reviewer_name: user.user_metadata?.name || user.email.split('@')[0],
      is_member: isMember,
      upvotes: 0,
    })
    if (error) {
      toast.error('Failed to submit review')
    } else {
      toast.success('Review submitted!')
      setForm({ rating: 5, title: '', body: '' })
      setShowForm(false)
      await loadReviews(user.id)
    }
    setSubmitting(false)
  }

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div className="mt-12">
      <div className="border-t pt-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-heading font-bold text-text-dark">
              Customer Reviews
            </h2>
            {avgRating && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={s <= Math.round(Number(avgRating)) ? 'text-yellow-400' : 'text-slate-200'}>★</span>
                  ))}
                </div>
                <span className="font-bold text-text-dark">{avgRating}</span>
                <span className="text-text-slate text-sm">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>
          {user ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary text-sm py-2 px-4"
            >
              {showForm ? 'Cancel' : '+ Write Review'}
            </button>
          ) : (
            <a href="/account" className="btn-secondary text-sm py-2 px-4">
              Sign in to Review
            </a>
          )}
        </div>

        {/* Write Review Form */}
        {showForm && user && (
          <div className="card p-6 mb-8 border-2 border-primary">
            <h3 className="font-bold mb-4">Write Your Review</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-slate mb-2 block">Rating</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(s => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, rating: s })}
                      className={`text-2xl transition-transform hover:scale-110 ${s <= form.rating ? 'text-yellow-400' : 'text-slate-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <input
                placeholder="Review title (optional)"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="input-field"
              />
              <textarea
                placeholder="Share your experience with this product..."
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                rows={4}
                className="input-field resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-4">
            {[1,2].map(i => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-text-slate">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm mt-1">Be the first to review this product!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {review.reviewer_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{review.reviewer_name}</span>
                        {review.is_member && (
                          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            ⭐ Member
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-sm ${s <= review.rating ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-text-slate text-xs">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.title && (
                  <p className="font-semibold text-text-dark mb-1">{review.title}</p>
                )}
                <p className="text-text-slate text-sm leading-relaxed mb-3">{review.body}</p>
                <button
                  onClick={() => handleUpvote(review.id, review.userUpvoted || false)}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all ${
                    review.userUpvoted
                      ? 'bg-primary text-white'
                      : 'bg-accent text-text-slate hover:bg-slate-200'
                  }`}
                >
                  👍 Helpful ({review.upvotes})
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
