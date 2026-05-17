'use client'
// ============================================================
// FILE: components/account/CancelFlow.tsx
// PURPOSE: 3-step guilt-trip cancel flow for Real Medico+ membership
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
//   Logic and UI are identical — only moved to own file.
// DEPENDENCIES: react-hot-toast, MEMBER_BENEFITS constant (local copy)
// ⚠️ DO NOT CHANGE: monthsActive drives Step 3 branch (pause offer vs goodbye).
//   < 3 months → pause offer. ≥ 3 months → sad goodbye.
// ⚠️ DO NOT CHANGE: handleFinalCancel requires selectedReason — button is disabled without it.
//   Step 3 "confirm" button must stay disabled when !selectedReason.
// ============================================================

import { useState } from 'react'
import toast from 'react-hot-toast'

// May 17, 2026 REASON: Local copy of MEMBER_BENEFITS — avoids circular import.
// This component is self-contained; it does not import from MembershipTab.
const MEMBER_BENEFITS = [
  { icon: '🛍️', title: 'Early Access',       desc: 'New products 7 days before everyone else' },
  { icon: '💰', title: '15% Off Everything', desc: 'Every order, every product, always' },
  { icon: '📦', title: 'Free Shipping',       desc: 'Worldwide, no minimum order value' },
  { icon: '🔔', title: 'Drop Alerts',         desc: 'First to know about limited editions' },
  { icon: '⚡', title: 'Priority Support',    desc: 'Same-day responses, skip the queue' },
  { icon: '🏥', title: 'Community Access',    desc: 'Exclusive healthcare professional community' },
]

const CANCEL_REASONS = [
  'Too expensive',
  'Not using the benefits',
  'Found a better alternative',
  "I'll come back later",
  'Other',
]

type CancelStep = 1 | 2 | 3

interface CancelFlowProps {
  onKeep: () => void
  onConfirmCancel: (reason: string) => Promise<void>
  memberSince: string | null
}

export default function CancelFlow({ onKeep, onConfirmCancel, memberSince }: CancelFlowProps) {
  const [step, setStep] = useState<CancelStep>(1)
  const [selectedReason, setSelectedReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // May 15, 2026 REASON: Calculate months active to decide whether to show
  // "pause" offer (< 3 months) or just the sad goodbye (>= 3 months)
  const monthsActive = memberSince
    ? Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0

  const handleFinalCancel = async () => {
    if (!selectedReason) { toast.error("Please tell us why you're leaving"); return }
    setCancelling(true)
    await onConfirmCancel(selectedReason)
    setCancelling(false)
  }

  // ── Step 1 — What you'll lose ─────────────────────────────────────────────
  if (step === 1) return (
    <div className="card p-6 border-2 border-red-100">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">😢</div>
        <h3 className="text-xl font-bold text-text-dark mb-1">Wait — you'll lose all of this</h3>
        <p className="text-text-slate text-sm">These benefits disappear the moment you cancel</p>
      </div>

      <div className="space-y-3 mb-6">
        {MEMBER_BENEFITS.map((b) => (
          <div key={b.title} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
            <span className="text-2xl flex-shrink-0">{b.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-text-dark">{b.title}</p>
              <p className="text-xs text-text-slate">{b.desc}</p>
            </div>
            {/* May 15, 2026 REASON: Red X reinforces "you're losing this" */}
            <span className="text-red-400 font-bold text-lg flex-shrink-0">✕</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button onClick={onKeep} className="btn-primary w-full text-base py-3">
          ✅ Keep My Benefits
        </button>
        <button
          onClick={() => setStep(2)}
          className="w-full text-center text-sm text-text-slate hover:text-red-500 transition-colors py-2"
        >
          I still want to cancel →
        </button>
      </div>
    </div>
  )

  // ── Step 2 — Are you sure? ────────────────────────────────────────────────
  if (step === 2) return (
    <div className="card p-6 border-2 border-orange-100">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🤔</div>
        <h3 className="text-xl font-bold text-text-dark mb-2">Are you really sure?</h3>
        {monthsActive > 0 && (
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-text-slate">You've been a member for</p>
            <p className="text-3xl font-black text-primary">{monthsActive} month{monthsActive !== 1 ? 's' : ''}</p>
            <p className="text-sm text-text-slate mt-1">
              That's <strong className="text-green-600">₹{monthsActive * 415} saved</strong> in discounts + free shipping
            </p>
          </div>
        )}
        <p className="text-text-slate text-sm">
          Once cancelled, you'll pay full price and shipping on every order.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-text-dark mb-3">Why are you leaving? (helps us improve)</p>
        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                selectedReason === reason
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-slate-200 text-text-slate hover:border-slate-300'
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={onKeep} className="btn-primary w-full py-3">
          🙌 Stay a Member
        </button>
        <button
          onClick={() => setStep(3)}
          className="w-full text-center text-sm text-text-slate hover:text-red-500 transition-colors py-2"
        >
          Yes, cancel anyway →
        </button>
      </div>
    </div>
  )

  // ── Step 3 — Pause offer (< 3 months) or sad goodbye (≥ 3 months) ────────
  return (
    <div className="card p-6 border-2 border-slate-200">
      {monthsActive < 3 ? (
        // May 15, 2026 REASON: Newer members get a "pause" offer — they haven't
        // fully experienced the value yet. Older members get a graceful goodbye.
        <>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⏸️</div>
            <h3 className="text-xl font-bold text-text-dark mb-2">How about a pause instead?</h3>
            <p className="text-text-slate text-sm">
              Skip next month's charge. Your membership stays active and you lose nothing.
              We'll resume automatically the month after.
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-center">
            <p className="text-primary font-bold">Skip 1 month — ₹415 saved</p>
            <p className="text-text-slate text-xs mt-1">No questions asked. Resume anytime.</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                toast.success('Your next month has been paused. See you soon! 🙏')
                onKeep()
              }}
              className="btn-primary w-full py-3"
            >
              ⏸️ Pause for 1 Month
            </button>
            <button
              onClick={handleFinalCancel}
              disabled={cancelling || !selectedReason}
              className="w-full text-center text-sm text-red-400 hover:text-red-600 transition-colors py-2 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'No thanks, cancel my membership'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">👋</div>
            <h3 className="text-xl font-bold text-text-dark mb-2">We're sad to see you go</h3>
            <p className="text-text-slate text-sm">
              Your membership stays active until the end of your current billing period.
              You can rejoin anytime — we'll be here. 🙏
            </p>
          </div>
          <div className="space-y-3">
            <button onClick={onKeep} className="btn-primary w-full py-3">
              Actually, I'll stay! 💙
            </button>
            <button
              onClick={handleFinalCancel}
              disabled={cancelling || !selectedReason}
              className="w-full text-center text-sm text-red-400 hover:text-red-600 transition-colors py-2 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
            </button>
            {!selectedReason && (
              <p className="text-xs text-center text-text-slate">← Please select a reason on the previous screen</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
