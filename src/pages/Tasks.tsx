import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Todo {
  id: string
  title: string
  completed: boolean
  completed_at: string | null
  category: string
  due_date: string | null
  created_at: string
  description: string
  ai_description: string | null
  ai_solution: string | null
  ai_description_at: string | null
  ai_solution_at: string | null
}

const categories = [
  { value: 'general', label: '📋 General' },
  { value: 'work', label: '💼 Work' },
  { value: 'personal', label: '🏠 Personal' },
  { value: 'crypto', label: '₿ Crypto' },
  { value: 'urgent', label: '🔥 Urgent' },
]

const categoryColors: Record<string, string> = {
  general: 'bg-blue-500/20 text-blue-400',
  work: 'bg-purple-500/20 text-purple-400',
  personal: 'bg-green-500/20 text-green-400',
  crypto: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
}

function getDueLabel(dueDate: string | null): { label: string; className: string } {
  if (!dueDate) return { label: '', className: '' }
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return { label: 'Today', className: 'text-[#e7f900]' }
  if (diff === 1) return { label: 'Tomorrow', className: 'text-[#e7f900]' }
  if (diff > 1) return { label: `Due in ${diff}d`, className: 'text-gray-400 dark:text-white/50' }
  return { label: `Overdue by ${Math.abs(diff)}d`, className: 'text-red-400' }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Pending AI Preview ─── */
function AiPreview({ text, onAccept, onReject }: {
  text: string
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#e7f900]/50 dark:border-[#e7f900]/30 overflow-hidden">
      <div className="p-4 bg-[#e7f900]/5 dark:bg-[#e7f900]/5">
        <p className="text-sm text-gray-700 dark:text-white/80 whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
      <div className="flex border-t border-[#e7f900]/30">
        <button
          onClick={onAccept}
          disabled={text.startsWith('⚠️')}
          className="flex-1 py-2.5 text-xs font-bold text-[#111111] bg-[#e7f900] hover:brightness-110 disabled:opacity-40 transition-all"
        >
          ✅ Accept
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-2.5 text-xs font-bold text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/5 transition-all border-l border-[#e7f900]/30"
        >
          ✕ Discard
        </button>
      </div>
    </div>
  )
}

/* ─── Task Modal ─── */
function TaskModal({ todo, onClose, onUpdate }: {
  todo: Todo
  onClose: () => void
  onUpdate: (updated: Todo) => void
}) {
  const [description, setDescription] = useState(todo.description || '')
  const [descDirty, setDescDirty] = useState(false)

  // Saved (committed) solution
  const [savedSolution, setSavedSolution] = useState(todo.ai_solution)

  // Pending AI content (awaiting accept/reject)
  const [pendingDesc, setPendingDesc] = useState<string | null>(null)
  const [pendingSol, setPendingSol] = useState<string | null>(null)

  const [loadingDesc, setLoadingDesc] = useState(false)
  const [loadingSol, setLoadingSol] = useState(false)
  const [saving, setSaving] = useState(false)

  /* ── Generate AI Description ── */
  const generateDescription = async () => {
    setLoadingDesc(true)
    try {
      const prompt = `You are a task analysis AI embedded in a productivity app. Given the following task, write a clear, structured description of what it involves. Break it down into sub-tasks if appropriate. Be specific and actionable. Use bullet points. Keep it concise — under 200 words. No preamble, no "Here is...", just the description directly.\n\nTask: ${todo.title}\nCategory: ${todo.category}`

      const { data } = await supabase.functions.invoke('ai-generate', {
        body: { prompt, type: 'description' },
      })

      const text = data?.text ?? data?.choices?.[0]?.message?.content ?? null
      setPendingDesc(text || '⚠️ AI generation returned empty. Try again.')
    } catch {
      setPendingDesc('⚠️ AI generation failed. Check your edge function configuration.')
    }
    setLoadingDesc(false)
  }

  /* ── Generate AI Solution ── */
  const generateSolution = async () => {
    setLoadingSol(true)
    try {
      const prompt = `You are an expert problem-solving AI embedded in a productivity app. Given the following task, provide the BEST possible solution or approach to complete it efficiently. Include specific tools, numbered steps, and pro tips. Keep it concise — under 200 words. No preamble, no "Here is...", just the solution directly.\n\nTask: ${todo.title}\nCategory: ${todo.category}\n${description ? 'Context: ' + description : ''}`

      const { data } = await supabase.functions.invoke('ai-generate', {
        body: { prompt, type: 'solution' },
      })

      const text = data?.text ?? data?.choices?.[0]?.message?.content ?? null
      setPendingSol(text || '⚠️ AI generation returned empty. Try again.')
    } catch {
      setPendingSol('⚠️ AI generation failed. Check your edge function configuration.')
    }
    setLoadingSol(false)
  }

  /* ── Accept pending description → fill textarea ── */
  const acceptDesc = () => {
    if (pendingDesc && !pendingDesc.startsWith('⚠️')) {
      setDescription(pendingDesc)
      setDescDirty(true)
      setPendingDesc(null)
    }
  }

  /* ── Accept pending solution → save locally ── */
  const acceptSol = () => {
    if (pendingSol && !pendingSol.startsWith('⚠️')) {
      setSavedSolution(pendingSol)
      setPendingSol(null)
    }
  }

  /* ── Save: commit everything to Supabase ── */
  const saveAll = async () => {
    setSaving(true)
    const updates: Record<string, unknown> = {}

    if (description !== (todo.description || '')) {
      updates.description = description
    }
    if (savedSolution !== todo.ai_solution) {
      updates.ai_solution = savedSolution
      updates.ai_solution_at = savedSolution ? new Date().toISOString() : null
    }
    // Track if description was AI-generated
    if (descDirty && description !== todo.description) {
      updates.ai_description = description
      updates.ai_description_at = new Date().toISOString()
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('todos').update(updates).eq('id', todo.id)
      todo.description = description
      todo.ai_solution = savedSolution
      todo.ai_description = description
      if ('ai_description_at' in updates) todo.ai_description_at = updates.ai_description_at as string | null
      if ('ai_solution_at' in updates) todo.ai_solution_at = updates.ai_solution_at as string | null
      onUpdate(todo)
    }

    setDescDirty(false)
    setSaving(false)
  }

  const hasChanges = descDirty || savedSolution !== todo.ai_solution

  const due = getDueLabel(todo.due_date)
  const catInfo = categories.find((c) => c.value === todo.category)

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className={`text-xl font-bold text-gray-900 dark:text-white ${todo.completed ? 'line-through opacity-60' : ''}`}>
              {todo.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {catInfo && (
                <span className={`text-xs px-2.5 py-1 rounded-full ${categoryColors[todo.category] ?? 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}>
                  {catInfo.label}
                </span>
              )}
              {due.label && (
                <span className={`text-xs ${due.className}`}>{due.label}</span>
              )}
              <span className="text-xs text-gray-400 dark:text-white/30">
                Created {formatDate(todo.created_at)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── Description ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-white/70">📝 Description</label>
              <button
                onClick={generateDescription}
                disabled={loadingDesc}
                className="px-3 py-1.5 text-xs font-bold bg-[#e7f900] text-[#111111] rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {loadingDesc ? (
                  <><span className="animate-spin">⚡</span> Generating...</>
                ) : (
                  <><span>✨</span> AI Fill</>
                )}
              </button>
            </div>

            {/* Textarea — always visible */}
            {!pendingDesc && (
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDescDirty(true) }}
                placeholder="Add notes, context, or let AI fill this in..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors resize-none text-sm"
              />
            )}

            {/* Loading skeleton */}
            {loadingDesc && (
              <div className="p-4 rounded-xl border border-dashed border-[#e7f900]/30 bg-[#e7f900]/5 animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
              </div>
            )}

            {/* Pending preview — accept fills textarea, discard restores it */}
            {pendingDesc && !loadingDesc && (
              <AiPreview
                text={pendingDesc}
                onAccept={acceptDesc}
                onReject={() => setPendingDesc(null)}
              />
            )}
          </div>

          {/* ── Best Solution ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-white/70">💡 Best Solution</label>
              <button
                onClick={generateSolution}
                disabled={loadingSol}
                className="px-3 py-1.5 text-xs font-bold bg-[#e7f900] text-[#111111] rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {loadingSol ? (
                  <><span className="animate-spin">⚡</span> Generating...</>
                ) : (
                  <><span>💡</span> {savedSolution || pendingSol ? 'Regenerate' : 'Generate'}</>
                )}
              </button>
            </div>

            {/* Saved solution */}
            {savedSolution && !pendingSol && !loadingSol && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#e7f900]/5 to-green-500/5 dark:from-[#e7f900]/10 dark:to-green-500/10 border border-[#e7f900]/30 dark:border-[#e7f900]/20">
                <p className="text-sm text-gray-700 dark:text-white/80 whitespace-pre-wrap leading-relaxed">{savedSolution}</p>
                {todo.ai_solution_at && (
                  <p className="text-[10px] text-gray-400 dark:text-white/25 mt-2">Saved {formatDate(todo.ai_solution_at)}</p>
                )}
              </div>
            )}

            {/* Loading skeleton */}
            {loadingSol && (
              <div className="p-4 rounded-xl border border-dashed border-[#e7f900]/30 bg-[#e7f900]/5 animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
              </div>
            )}

            {/* Pending preview */}
            {pendingSol && !loadingSol && (
              <AiPreview
                text={pendingSol}
                onAccept={acceptSol}
                onReject={() => setPendingSol(null)}
              />
            )}

            {/* Empty placeholder */}
            {!savedSolution && !pendingSol && !loadingSol && (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-white/10 text-center">
                <p className="text-sm text-gray-400 dark:text-white/25">Click 💡 Generate to get the best possible solution</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — Save button */}
        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-white/25">v0.2.0 Akuma</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAll}
              disabled={!hasChanges || saving}
              className="px-5 py-2 text-sm font-bold bg-[#e7f900] text-[#111111] rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? (
                <><span className="animate-spin">⚡</span> Saving...</>
              ) : (
                <><span>💾</span> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Tasks Page ─── */
export default function Tasks() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [dueDate, setDueDate] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchTodos = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setTodos(data as Todo[])
  }, [user])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const addTodo = async () => {
    if (!title.trim() || !user) return
    await supabase.from('todos').insert({
      user_id: user.id,
      title: title.trim(),
      category,
      due_date: dueDate || null,
      completed: false,
    })
    setTitle('')
    setDueDate('')
    fetchTodos()
  }

  const toggleTodo = async (todo: Todo) => {
    const completed = !todo.completed
    await supabase
      .from('todos')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', todo.id)
    fetchTodos()
  }

  const deleteTodo = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    if (selectedTodo?.id === id) setSelectedTodo(null)
    fetchTodos()
  }

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditTitle(todo.title)
  }

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return
    await supabase.from('todos').update({ title: editTitle.trim() }).eq('id', id)
    setEditingId(null)
    setEditTitle('')
    fetchTodos()
  }

  const copyTodo = (todo: Todo) => {
    navigator.clipboard.writeText(todo.title)
  }

  const handleTodoUpdate = (updated: Todo) => {
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  const filtered = filterCat
    ? todos.filter((t) => t.category === filterCat)
    : todos

  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return 0
  })

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Add task form */}
      <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-3 shadow-sm dark:shadow-none">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a new task..."
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
        />
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value} className="bg-white dark:bg-[#111111]">
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:outline-none"
          />
          <button
            onClick={addTodo}
            disabled={!title.trim()}
            className="px-4 py-2 bg-[#e7f900] text-[#111111] font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCat('')}
          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
            filterCat === ''
              ? 'bg-[#e7f900] text-[#111111] font-semibold'
              : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCat(filterCat === c.value ? '' : c.value)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              filterCat === c.value
                ? 'bg-[#e7f900] text-[#111111] font-semibold'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {sorted.map((todo) => {
          const due = getDueLabel(todo.due_date)
          const catInfo = categories.find((c) => c.value === todo.category)
          const hasAi = todo.ai_description || todo.ai_solution
          return (
            <div
              key={todo.id}
              onClick={() => { if (editingId !== todo.id) setSelectedTodo(todo) }}
              className={`flex items-center gap-3 bg-white dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none transition-all cursor-pointer hover:border-[#e7f900]/50 dark:hover:border-[#e7f900]/30 ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={(e) => { e.stopPropagation(); toggleTodo(todo) }}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded accent-[#e7f900] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                {editingId === todo.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                    onBlur={() => saveEdit(todo.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="w-full px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white border border-[#e7f900] focus:outline-none"
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-gray-900 dark:text-white truncate ${
                          todo.completed ? 'line-through text-gray-400 dark:text-white/50' : ''
                        }`}
                      >
                        {todo.title}
                      </p>
                      {hasAi && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e7f900]/20 text-[#e7f900] font-bold flex-shrink-0">AI</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {catInfo && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            categoryColors[todo.category] ?? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
                          }`}
                        >
                          {catInfo.label}
                        </span>
                      )}
                      {due.label && (
                        <span className={`text-[10px] ${due.className}`}>
                          {due.label}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => copyTodo(todo)}
                  className="p-1.5 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/80 transition-colors"
                  title="Copy"
                >
                  📋
                </button>
                <button
                  onClick={() => startEdit(todo)}
                  className="p-1.5 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/80 transition-colors"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-1.5 text-gray-400 dark:text-white/40 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 dark:text-white/30 py-8">No tasks yet. Add one above!</p>
      )}

      {/* Task Detail Modal */}
      {selectedTodo && (
        <TaskModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onUpdate={handleTodoUpdate}
        />
      )}
    </div>
  )
}
