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
  if (diff > 1) return { label: `Due in ${diff}d`, className: 'text-white/50' }
  return { label: `Overdue by ${Math.abs(diff)}d`, className: 'text-red-400' }
}

export default function Tasks() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [dueDate, setDueDate] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a new task..."
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/30 border border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
        />
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value} className="bg-[#111111]">
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10 focus:outline-none"
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
              : 'bg-white/10 text-white/70 hover:bg-white/20'
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
                : 'bg-white/10 text-white/70 hover:bg-white/20'
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
          return (
            <div
              key={todo.id}
              className={`flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10 transition-all ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo)}
                className="w-5 h-5 rounded accent-[#e7f900] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                {editingId === todo.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                    onBlur={() => saveEdit(todo.id)}
                    autoFocus
                    className="w-full px-2 py-1 rounded-lg bg-white/10 text-white border border-[#e7f900] focus:outline-none"
                  />
                ) : (
                  <>
                    <p
                      className={`text-white truncate ${
                        todo.completed ? 'line-through text-white/50' : ''
                      }`}
                    >
                      {todo.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {catInfo && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            categoryColors[todo.category] ?? 'bg-white/10 text-white/50'
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyTodo(todo)}
                  className="p-1.5 text-white/40 hover:text-white/80 transition-colors"
                  title="Copy"
                >
                  📋
                </button>
                <button
                  onClick={() => startEdit(todo)}
                  className="p-1.5 text-white/40 hover:text-white/80 transition-colors"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
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
        <p className="text-center text-white/30 py-8">No tasks yet. Add one above!</p>
      )}
    </div>
  )
}
