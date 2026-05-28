import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Agent {
  id: string
  name: string
  specialty: string
  server_address: string
  status: string
  avatar: string
  created_at: string
  updated_at: string
}

interface AgentTodo {
  id: string
  title: string
  completed: boolean
  category: string
  due_date: string | null
  assigned_agent_id: string | null
}

const statusColors: Record<string, string> = {
  online: 'bg-green-400',
  offline: 'bg-gray-400 dark:bg-white/30',
  busy: 'bg-orange-400',
  error: 'bg-red-400',
}

const statusLabels: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  error: 'Error',
}

const avatarOptions = ['🤖', '💃', '🖖', '📊', '🎬', '🧠', '⚡', '🔥', '🛡️', '🚀', '👾', '🎯']

/* ─── Agent Card ─── */
function AgentCard({ agent, todos, onEdit, onAssign }: {
  agent: Agent
  todos: AgentTodo[]
  onEdit: () => void
  onAssign: () => void
}) {
  const agentTodos = todos.filter(t => t.assigned_agent_id === agent.id)
  const activeTodos = agentTodos.filter(t => !t.completed)
  const doneTodos = agentTodos.filter(t => t.completed)

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden transition-all hover:border-[#e7f900]/40 dark:hover:border-[#e7f900]/30">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="relative">
          <span className="text-3xl">{agent.avatar}</span>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1a1a1a] ${statusColors[agent.status] || statusColors.offline}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">{agent.name}</h3>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5 truncate">{agent.specialty}</p>
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5 font-mono truncate">{agent.server_address}</p>
        </div>
        <button onClick={onEdit} className="p-2 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/80 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
          ✏️
        </button>
      </div>

      {/* Todo summary */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 dark:text-white/50">
            {activeTodos.length > 0 ? (
              <><span className="text-[#e7f900] font-bold">{activeTodos.length}</span> active task{activeTodos.length !== 1 ? 's' : ''}</>
            ) : (
              <span className="text-gray-400 dark:text-white/25">No active tasks</span>
            )}
          </span>
          {doneTodos.length > 0 && (
            <span className="text-gray-400 dark:text-white/30">· {doneTodos.length} done</span>
          )}
        </div>
      </div>

      {/* Assigned tasks */}
      {activeTodos.length > 0 && (
        <div className="border-t border-gray-100 dark:border-white/5 px-4 py-2.5 space-y-1.5 max-h-40 overflow-y-auto">
          {activeTodos.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e7f900] flex-shrink-0" />
              <span className="text-gray-700 dark:text-white/70 truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-gray-100 dark:border-white/5 p-2 flex gap-2">
        <button
          onClick={onAssign}
          className="flex-1 py-2 text-xs font-bold text-[#111111] bg-[#e7f900] rounded-lg hover:brightness-110 transition-all"
        >
          Assign Task
        </button>
      </div>
    </div>
  )
}

/* ─── Edit Agent Modal ─── */
function EditAgentModal({ agent, onClose, onSave }: {
  agent: Agent
  onClose: () => void
  onSave: (updated: Agent) => void
}) {
  const [name, setName] = useState(agent.name)
  const [specialty, setSpecialty] = useState(agent.specialty)
  const [serverAddress, setServerAddress] = useState(agent.server_address)
  const [status, setStatus] = useState(agent.status)
  const [avatar, setAvatar] = useState(agent.avatar)
  const [saving, setSaving] = useState(false)
  const [showAvatars, setShowAvatars] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const updates = { name: name.trim(), specialty: specialty.trim(), server_address: serverAddress.trim(), status, avatar, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('agents').update(updates).eq('id', agent.id)
    if (!error) {
      onSave({ ...agent, ...updates })
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Agent</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-2">Avatar</label>
            <button
              onClick={() => setShowAvatars(!showAvatars)}
              className="text-3xl p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#e7f900] transition-colors"
            >
              {avatar}
            </button>
            {showAvatars && (
              <div className="flex flex-wrap gap-2 mt-2">
                {avatarOptions.map(a => (
                  <button
                    key={a}
                    onClick={() => { setAvatar(a); setShowAvatars(false) }}
                    className={`text-2xl p-2 rounded-lg transition-all ${avatar === a ? 'bg-[#e7f900]/20 border-2 border-[#e7f900]' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
            />
          </div>

          {/* Specialty */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Specialty</label>
            <input
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
            />
          </div>

          {/* Server Address */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Server Address</label>
            <input
              value={serverAddress}
              onChange={e => setServerAddress(e.target.value)}
              placeholder="host:port or URL"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white font-mono text-sm border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-2">Status</label>
            <div className="flex gap-2">
              {['online', 'offline', 'busy', 'error'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    status === s
                      ? 'bg-[#e7f900] text-[#111111]'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusColors[s]}`} />
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-white/50">Cancel</button>
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="px-5 py-2 text-sm font-bold bg-[#e7f900] text-[#111111] rounded-xl hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Add Agent Modal ─── */
function AddAgentModal({ onClose, onSave }: {
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [serverAddress, setServerAddress] = useState('')
  const [avatar, setAvatar] = useState('🤖')
  const [saving, setSaving] = useState(false)
  const [showAvatars, setShowAvatars] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const save = async () => {
    if (!name.trim() || !user) return
    setSaving(true)
    const { error } = await supabase.from('agents').insert({
      user_id: user.id,
      name: name.trim(),
      specialty: specialty.trim(),
      server_address: serverAddress.trim(),
      avatar,
      status: 'offline',
    })
    if (!error) onSave()
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Agent</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-2">Avatar</label>
            <button onClick={() => setShowAvatars(!showAvatars)} className="text-3xl p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">{avatar}</button>
            {showAvatars && (
              <div className="flex flex-wrap gap-2 mt-2">
                {avatarOptions.map(a => (
                  <button key={a} onClick={() => { setAvatar(a); setShowAvatars(false) }} className={`text-2xl p-2 rounded-lg ${avatar === a ? 'bg-[#e7f900]/20 border-2 border-[#e7f900]' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}>{a}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Agent name" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Specialty</label>
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="What does this agent do?" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/70 block mb-1.5">Server Address</label>
            <input value={serverAddress} onChange={e => setServerAddress(e.target.value)} placeholder="host:port or URL" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white font-mono text-sm border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-white/50">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving} className="px-5 py-2 text-sm font-bold bg-[#e7f900] text-[#111111] rounded-xl hover:brightness-110 disabled:opacity-40 transition-all">
            {saving ? 'Adding...' : '➕ Add Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Assign Task Modal ─── */
function AssignTaskModal({ agent, onClose, onAssigned }: {
  agent: Agent
  onClose: () => void
  onAssigned: () => void
}) {
  const [user, setUser] = useState<User | null>(null)
  const [unassigned, setUnassigned] = useState<AgentTodo[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const categories = [
    { value: 'general', label: '📋 General' },
    { value: 'work', label: '💼 Work' },
    { value: 'personal', label: '🏠 Personal' },
    { value: 'crypto', label: '₿ Crypto' },
    { value: 'urgent', label: '🔥 Urgent' },
  ]

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase
          .from('todos')
          .select('id, title, completed, category, due_date, assigned_agent_id')
          .eq('user_id', data.user.id)
          .eq('completed', false)
          .is('assigned_agent_id', null)
          .order('created_at', { ascending: false })
          .then(({ data: todos }) => {
            setUnassigned((todos || []) as AgentTodo[])
            setLoading(false)
          })
      }
    })
  }, [])

  const assignExisting = async (todoId: string) => {
    await supabase.from('todos').update({ assigned_agent_id: agent.id }).eq('id', todoId)
    onAssigned()
    onClose()
  }

  const createAndAssign = async () => {
    if (!title.trim() || !user) return
    setCreating(true)
    await supabase.from('todos').insert({
      user_id: user.id,
      title: title.trim(),
      category,
      assigned_agent_id: agent.id,
      completed: false,
    })
    onAssigned()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md max-h-[80vh] bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Assign to {agent.avatar} {agent.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Create new task */}
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-white/10">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Create new task..."
              onKeyDown={e => e.key === 'Enter' && createAndAssign()}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none text-sm"
            />
            <div className="flex gap-2">
              <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 text-gray-900 dark:text-white text-xs border border-gray-200 dark:border-white/10 focus:outline-none">
                {categories.map(c => <option key={c.value} value={c.value} className="bg-white dark:bg-[#111]">{c.label}</option>)}
              </select>
              <button onClick={createAndAssign} disabled={!title.trim() || creating} className="px-3 py-1.5 text-xs font-bold bg-[#e7f900] text-[#111111] rounded-lg hover:brightness-110 disabled:opacity-40">
                {creating ? '...' : 'Create + Assign'}
              </button>
            </div>
          </div>

          {/* Existing unassigned tasks */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : unassigned.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-white/50 mb-2">Or assign an existing task:</p>
              <div className="space-y-1.5">
                {unassigned.map(t => (
                  <button
                    key={t.id}
                    onClick={() => assignExisting(t.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#e7f900]/50 transition-colors text-sm text-gray-700 dark:text-white/70"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-center text-gray-400 dark:text-white/25 py-4">No unassigned tasks — create one above!</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Agents Page ─── */
export default function Agents() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [todos, setTodos] = useState<AgentTodo[]>([])
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [assigningAgent, setAssigningAgent] = useState<Agent | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchAgents = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('agents').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (data) setAgents(data as Agent[])
  }, [user])

  const fetchTodos = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('todos')
      .select('id, title, completed, category, due_date, assigned_agent_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setTodos(data as AgentTodo[])
  }, [user])

  useEffect(() => { fetchAgents() }, [fetchAgents])
  useEffect(() => { fetchTodos() }, [fetchTodos])

  const handleAgentUpdate = (updated: Agent) => {
    setAgents(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Remove ${agent.name}? Their assigned tasks will become unassigned.`)) return
    await supabase.from('agents').delete().eq('id', agent.id)
    setAgents(prev => prev.filter(a => a.id !== agent.id))
    fetchTodos()
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agents</h2>
          <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{agents.length} agent{agents.length !== 1 ? 's' : ''} · {todos.filter(t => !t.completed && t.assigned_agent_id).length} active tasks</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 text-xs font-bold bg-[#e7f900] text-[#111111] rounded-xl hover:brightness-110 transition-all"
        >
          ➕ Add Agent
        </button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {agents.map(agent => (
          <div key={agent.id} className="relative group">
            <AgentCard
              agent={agent}
              todos={todos}
              onEdit={() => setEditingAgent(agent)}
              onAssign={() => setAssigningAgent(agent)}
            />
            {/* Delete button on hover */}
            <button
              onClick={() => handleDelete(agent)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 dark:text-white/30 hover:text-red-400 bg-white dark:bg-[#1a1a1a] rounded-full shadow text-xs"
              title="Remove agent"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-gray-400 dark:text-white/30">No agents yet. Add one to get started!</p>
        </div>
      )}

      {/* Modals */}
      {editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleAgentUpdate}
        />
      )}
      {assigningAgent && (
        <AssignTaskModal
          agent={assigningAgent}
          onClose={() => setAssigningAgent(null)}
          onAssigned={() => { fetchTodos(); fetchAgents() }}
        />
      )}
      {showAdd && (
        <AddAgentModal
          onClose={() => setShowAdd(false)}
          onSave={() => { fetchAgents(); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
