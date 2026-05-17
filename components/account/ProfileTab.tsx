'use client'
// ============================================================
// FILE: components/account/ProfileTab.tsx
// PURPOSE: Displays user profile details — read-only view
// LAST CHANGED: May 17, 2026
// WHY IT EXISTS: Extracted from app/account/page.tsx as part of modular refactor.
// DEPENDENCIES: None beyond React
// ============================================================

interface ProfileTabProps {
  user: any
  isMember: boolean
}

export default function ProfileTab({ user, isMember }: ProfileTabProps) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-xl font-bold mb-4">Profile Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-text-slate mb-1 block">Full Name</label>
          <p className="input-field bg-slate-50">
            {user.user_metadata?.full_name || user.user_metadata?.name || '—'}
          </p>
        </div>
        <div>
          <label className="text-sm text-text-slate mb-1 block">Email</label>
          <p className="input-field bg-slate-50">{user.email}</p>
        </div>
        <div>
          <label className="text-sm text-text-slate mb-1 block">Member Since</label>
          <p className="input-field bg-slate-50">
            {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
        <div>
          <label className="text-sm text-text-slate mb-1 block">Membership</label>
          <p className="input-field bg-slate-50">
            {isMember ? '⭐ Real Medico+' : 'Free Plan'}
          </p>
        </div>
      </div>
    </div>
  )
}
