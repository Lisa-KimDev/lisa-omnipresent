import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Settings() {
  const [user, setUser] = useState<User | null>(null)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [defaultStyle, setDefaultStyle] = useState(() => {
    return localStorage.getItem('defaultStyle') || 'Photorealistic'
  })
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  const styles = [
    'Cyberpunk', 'Pixel Art', 'Photorealistic', 'Anime',
    'Oil Painting', 'Sci-Fi', 'Meme', 'NFT Art', 'Logo', 'Album Cover',
  ]

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    const root = document.documentElement
    if (next) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const changeStyle = (style: string) => {
    setDefaultStyle(style)
    localStorage.setItem('defaultStyle', style)
  }

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordMsg(`Error: ${error.message}`)
    } else {
      setPasswordMsg('Password updated!')
      setNewPassword('')
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      {/* Appearance */}
      <section className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-white/70">Dark Mode</span>
          <button
            onClick={toggleDark}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              dark ? 'bg-[#e7f900]' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                dark ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Default Style */}
      <section className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">Default Image Style</h2>
        <select
          value={defaultStyle}
          onChange={(e) => changeStyle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/10 focus:border-[#e7f900] focus:outline-none"
        >
          {styles.map((s) => (
            <option key={s} value={s} className="bg-[#111111]">
              {s}
            </option>
          ))}
        </select>
      </section>

      {/* Account */}
      <section className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">Account</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">Email</span>
            <span className="text-white text-sm">{user?.email ?? '—'}</span>
          </div>
          <div className="space-y-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors placeholder-white/30"
            />
            <button
              onClick={changePassword}
              disabled={!newPassword || newPassword.length < 6}
              className="px-4 py-2 bg-[#e7f900] text-[#111111] font-bold rounded-xl text-sm hover:brightness-110 disabled:opacity-50 transition-all"
            >
              Change Password
            </button>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {passwordMsg}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
        <p className="text-white/50 text-sm">
          Lisa Omnipresent v1.0 — Built with 💛 by Lisa Kim
        </p>
      </section>
    </div>
  )
}
