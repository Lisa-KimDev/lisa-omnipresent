import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface QuickLink {
  id: string
  label: string
  url: string
  icon: string
  sort_order: number
}

const defaultLinks: Omit<QuickLink, 'id'>[] = [
  { label: 'Paperclip', url: 'http://173.249.36.76:3100', icon: '📎', sort_order: 0 },
  { label: 'Workspace Manager', url: 'http://173.249.36.76:3050', icon: '📋', sort_order: 1 },
  { label: 'Lisa Todo', url: 'http://173.249.36.76:8080', icon: '✅', sort_order: 2 },
  { label: 'GitHub', url: 'https://github.com/Lisa-KimDev', icon: '🐙', sort_order: 3 },
  { label: 'SOONAK', url: 'https://richysoonak.com', icon: '🚀', sort_order: 4 },
  { label: 'Gmail', url: 'https://mail.google.com', icon: '📧', sort_order: 5 },
]

export default function Links() {
  const [user, setUser] = useState<User | null>(null)
  const [links, setLinks] = useState<QuickLink[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formIcon, setFormIcon] = useState('🔗')
  const [formLabel, setFormLabel] = useState('')
  const [formUrl, setFormUrl] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchLinks = useCallback(async () => {
    if (!user) {
      setLinks(defaultLinks.map((l, i) => ({ ...l, id: `default-${i}` })))
      return
    }
    const { data } = await supabase
      .from('quick_links')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (data && data.length > 0) {
      setLinks(data as QuickLink[])
    } else {
      setLinks(defaultLinks.map((l, i) => ({ ...l, id: `default-${i}` })))
    }
  }, [user])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const openAdd = () => {
    setEditId(null)
    setFormIcon('🔗')
    setFormLabel('')
    setFormUrl('')
    setShowModal(true)
  }

  const openEdit = (link: QuickLink) => {
    setEditId(link.id)
    setFormIcon(link.icon)
    setFormLabel(link.label)
    setFormUrl(link.url)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formLabel.trim() || !formUrl.trim() || !user) return
    if (editId && !editId.startsWith('default-')) {
      await supabase
        .from('quick_links')
        .update({ icon: formIcon, label: formLabel.trim(), url: formUrl.trim() })
        .eq('id', editId)
    } else {
      await supabase.from('quick_links').insert({
        user_id: user.id,
        icon: formIcon,
        label: formLabel.trim(),
        url: formUrl.trim(),
        sort_order: links.length,
      })
    }
    setShowModal(false)
    fetchLinks()
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith('default-')) return
    await supabase.from('quick_links').delete().eq('id', id)
    fetchLinks()
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Links</h2>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-[#e7f900] text-[#111111] font-bold rounded-xl text-sm hover:brightness-110 transition-all"
        >
          + Add Link
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {links.map((link) => (
          <div
            key={link.id}
            className="group bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4 hover:border-[#e7f900]/30 transition-all relative shadow-sm dark:shadow-none"
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center"
            >
              <div className="text-3xl mb-2">{link.icon}</div>
              <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{link.label}</p>
              <p className="text-gray-400 dark:text-white/30 text-[10px] truncate mt-1">{link.url}</p>
            </a>
            <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
              <button
                onClick={(e) => { e.preventDefault(); openEdit(link) }}
                className="p-1 bg-gray-100 dark:bg-white/10 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
              >
                ✏️
              </button>
              {!link.id.startsWith('default-') && (
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(link.id) }}
                  className="p-1 bg-gray-100 dark:bg-white/10 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-gray-200 dark:border-white/10 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editId ? 'Edit Link' : 'Add Link'}
            </h3>
            <div className="flex gap-2">
              <input
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                className="w-14 text-center px-2 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:outline-none text-xl"
                placeholder="🔗"
              />
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Label"
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
              />
            </div>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formLabel.trim() || !formUrl.trim()}
                className="flex-1 py-2.5 bg-[#e7f900] text-[#111111] font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
