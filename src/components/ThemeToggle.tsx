import { useEffect, useState, useCallback } from 'react'

interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const applyTheme = useCallback((isDark: boolean) => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    applyTheme(dark)
  }, [dark, applyTheme])

  return (
    <button
      onClick={() => setDark(!dark)}
      className={`p-2 rounded-xl transition-colors ${className}`}
      aria-label="Toggle theme"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
