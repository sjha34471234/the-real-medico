// ============================================================
// FILE: app/admin/reviews/page.tsx
// PURPOSE: Admin review management — view all reviews, post replies as The Real Medico
// LAST CHANGED: May 11, 2026
// WHY IT EXISTS: Admin needs to respond to customer reviews
// DEPENDENCIES: /api/admin/reviews
// ============================================================

'use client'
import { useState, useEffect } from 'react'
import { MessageSquare, RefreshCw, Check, X, Trash2 } from 'lucide-react'

interface Review {
  id: string
  product_id: string
  rating: number
  title: string
  body: string
  reviewer_name: string
  is_member: boolean
  verified_purchase: boolean
  admin_reply: string | null
  upvotes: number
  created_at: string
}

const FILTERS = [
  { value: 'all', label: 'All Reviews' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'answered', label: 'Answered' },
]

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews?filter=${filter}`)
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchReviews() }, [filter])

  const startReply = (review: Review) => {
    setReplyingTo(review.id)
    setReplyText(review.admin_reply || '')
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setReplyText('')
  }

  const saveReply = async (reviewId: string, reply: string | null) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, admin_reply: reply }),
      })
      if (!res.ok) throw new Error()
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, admin_reply: reply } : r
      ))
      setReplyingTo(null)
      setReplyText('')
    } catch {
      alert('Failed to save reply')
    }
    setSaving(false)
  }

  const unansweredCount = reviews.filter(r => !r.admin_reply).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Reviews</h1>
          <p className="text-text-slate text-sm mt-1">
            {unansweredCount > 0
              ? `${unansweredCount} review${unansweredCount !== 1 ? 's' : ''} awaiting reply`
              : 'All reviews answered'}
          </p>
        </div>
        <button
          onClick={fetchReviews}
          disabled={loading}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f.value
                ? 'bg-primary text-white'
                : 'bg-white border border-slate-200 text-text-slate hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-full" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card p-12 text-center text-text-slate">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reviews found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="card p-5 space-y-4">
              {/* Review header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {review.reviewer_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm">{review.reviewer_name}</span>
                      {review.is_member && (
                        <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">⭐ Member</span>
                      )}
                      {review.verified_purchase && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✅ Verified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= review.rating ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-text-slate">{new Date(review.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-text-slate mt-0.5">Product: <span className="font-mono text-xs">{review.product_id.slice(0, 8)}...</span></p>
                </div>
              </div>

              {/* Review body */}
              {review.title && <p className="font-semibold text-text-dark">{review.title}</p>}
              <p className="text-text-slate text-sm leading-relaxed">{review.body}</p>

              {/* Existing admin reply */}
              {review.admin_reply && replyingTo !== review.id && (
                <div className="bg-blue-50 border-l-4 border-primary rounded-r-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">RM</span>
                    </div>
                    <span className="text-sm font-bold text-primary">The Real Medico</span>
                    <span className="text-xs text-text-slate ml-auto">Official Reply</span>
                  </div>
                  <p className="text-sm text-text-dark leading-relaxed">{review.admin_reply}</p>
                </div>
              )}

              {/* Reply form */}
              {replyingTo === review.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">RM</span>
                    </div>
                    <span className="text-sm font-bold text-primary">Reply as The Real Medico</span>
                  </div>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write your official reply..."
                    rows={3}
                    className="input-field resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveReply(review.id, replyText.trim() || null)}
                      disabled={saving}
                      className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Reply'}
                    </button>
                    {review.admin_reply && (
                      <button
                        onClick={() => saveReply(review.id, null)}
                        disabled={saving}
                        className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Reply
                      </button>
                    )}
                    <button
                      onClick={cancelReply}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startReply(review)}
                  className={`text-sm font-medium px-4 py-2 rounded-xl transition-all ${
                    review.admin_reply
                      ? 'text-primary hover:bg-blue-50 border border-primary'
                      : 'btn-primary'
                  }`}
                >
                  {review.admin_reply ? 'Edit Reply' : '+ Reply as The Real Medico'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
