import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from './components/Login'
import Layout from './components/Layout'
import Creative from './pages/Creative'
import Tasks from './pages/Tasks'
import Docs from './pages/Docs'
import Inbox from './pages/Inbox'
import Links from './pages/Links'
import Voice from './pages/Voice'
import Settings from './pages/Settings'
import Server from './pages/Server'
import Apps from './pages/Apps'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Apply theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111111]">
        <div className="text-[#e7f900] text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/creative" element={<Creative />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/links" element={<Links />} />
          <Route path="/voice" element={<Voice />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/server" element={<Server />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="*" element={<Navigate to="/server" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
