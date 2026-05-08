'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Trash2, Star } from 'lucide-react'
import Link from 'next/link'

interface Address {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  is_default: boolean
}

const empty = { name: '', phone: '', email: '', address: '', city: '', state: '', zip: '', country: 'India', is_default: false }

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthChecked(true)
      if (user) fetchAddresses(user.id)
      else setLoading(false)
    }
    checkUser()
  }, [])

  const fetchAddresses = async (userId: string) => {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
    setAddresses(data || [])
    setLoading(false)
  }

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Enter your name'); return }
    if (!form.phone.trim()) { toast.error('Enter phone number'); return }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Enter a valid email'); return }
    if (!form.address.trim()) { toast.error('Enter street address'); return }
    if (!form.city.trim()) { toast.error('Enter city'); return }
    if (!form.zip.trim()) { toast.error('Enter ZIP / PIN code'); return }

    setSaving(true)
    if (!user) { toast.error('Please log in first'); setSaving(false); return }

    if (form.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
    }

    const { error } = await supabase.from('addresses').insert({ ...form, user_id: user.id })

    if (error) {
      toast.error('Failed to save address')
    } else {
      toast.success('Address saved!')
      setForm(empty)
      setShowForm(false)
      fetchAddresses(user.id)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('addresses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Address removed')
    if (user) fetchAddresses(user.id)
  }

  const handleSetDefault = async (id: string) => {
    if (!user) return
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
    await supabase.from('addresses').update({ is_default: true }).eq('id', id)
    toast.success('Default address updated')
    fetchAddresses(user.id)
  }

  // Still checking auth
  if (!authChecked) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-text-slate">
      Loading...
    </div>
  )

  // Not logged in — show message with link to account
  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="text-5xl mb-6">🔒</div>
      <h2 className="text-2xl font-heading font-bold text-primary mb-3">Please log in first</h2>
      <p className="text-text-slate mb-6">You need to be logged in to manage your saved addresses.</p>
      <Link href="/account" className="btn-primary inline-block">Go to Login →</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/account" className="text-sm text-text-slate hover:text-primary mb-1 inline-block">← Back to Account</Link>
          <h1 className="text-3xl font-heading font-bold text-primary">Saved Addresses</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {/* Add address form */}
      {showForm && (
        <div className="card p-6 mb-6 space-y-4">
          <h2 className="font-bold text-lg">New Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">Full Name *</label>
              <input name="name" placeholder="Dr. John Smith" value={form.name} onChange={update} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">Phone Number *</label>
              <input name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={update} className="input-field" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text-slate mb-1 block">Email Address *</label>
            <input name="email" type="email" placeholder="john@hospital.com" value={form.email} onChange={update} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-text-slate mb-1 block">Street Address *</label>
            <input name="address" placeholder="123 Medical Street, Ward No. 4" value={form.address} onChange={update} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">City *</label>
              <input name="city" placeholder="Mumbai" value={form.city} onChange={update} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">State</label>
              <input name="state" placeholder="Maharashtra" value={form.state} onChange={update} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">ZIP / PIN Code *</label>
              <input name="zip" placeholder="400001" value={form.zip} onChange={update} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-slate mb-1 block">Country</label>
              <select name="country" value={form.country} onChange={update} className="input-field">
                <option>India</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Australia</option>
                <option>UAE</option>
                <option>Singapore</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            Set as default address
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <div className="text-center py-12 text-text-slate">Loading addresses...</div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 text-text-slate">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-medium">No saved addresses yet</p>
          <p className="text-sm mt-1">Add one to speed up checkout!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <div key={addr.id} className={`card p-5 relative ${addr.is_default ? 'border-2 border-primary' : ''}`}>
              {addr.is_default && (
                <span className="absolute top-3 right-3 bg-primary text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" /> Default
                </span>
              )}
              <p className="font-bold text-text-dark">{addr.name}</p>
              <p className="text-sm text-text-slate mt-0.5">{addr.phone} · {addr.email}</p>
              <p className="text-sm text-text-slate mt-1">
                {addr.address}, {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.zip}
              </p>
              <p className="text-sm text-text-slate">{addr.country}</p>
              <div className="flex gap-3 mt-4">
                {!addr.is_default && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Star className="w-3 h-3" /> Set as default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
