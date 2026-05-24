import { useState, useEffect, useCallback } from 'react'

// ─── Config ───────────────────────────────────────────
const SUPABASE_URL = 'http://173.249.36.76:8000'
const STATS_URL = 'http://173.249.36.76:8090/'

// We need the service_role key for admin operations
// Fetch it from a tiny server-side proxy
const ADMIN_API = '/api/admin'

// ─── Types ────────────────────────────────────────────
interface AppUser {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  credits: { balance: number; total_purchased: number; total_used: number } | null
  tier: string
  project_count: number
}

interface AppConfig {
  key: string
  value: Record<string, any>
  description: string | null
  updated_at: string
}

interface VideoJob {
  id: string
  project_id: string
  job_type: string
  status: string
  progress: number
  error_message: string | null
  attempts: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  site_url: string
  user_email: string
}

type Tab = 'users' | 'llm' | 'queue'

// ─── Helpers ──────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const statusColors: Record<string, string> = {
  queued: 'bg-yellow-400',
  running: 'bg-blue-400 animate-pulse',
  capturing: 'bg-blue-400 animate-pulse',
  composing: 'bg-purple-400 animate-pulse',
  rendering: 'bg-orange-400 animate-pulse',
  complete: 'bg-green-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
}

const statusBadge: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  capturing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  composing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  rendering: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// ─── LLM Model Presets ────────────────────────────────
const LLM_PRESETS = [
  { id: 'nvidia-nemotron-nano', name: 'Nemotron Nano 8B', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'nvidia/llama-3.1-nemotron-nano-8b-v1', cost: 'Free', tier: 'budget' },
  { id: 'nvidia-llama-33-70b', name: 'Llama 3.3 70B', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.3-70b-instruct', cost: 'Free', tier: 'mid' },
  { id: 'nvidia-gemma-3-27b', name: 'Gemma 3 27B', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'google/gemma-3-27b-it', cost: 'Free', tier: 'mid' },
  { id: 'nvidia-nemotron-ultra', name: 'Nemotron Ultra 253B', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', cost: 'Free', tier: 'premium' },
  { id: 'nvidia-deepseek-v4-flash', name: 'DeepSeek V4 Flash', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'deepseek-v4-flash', cost: '$0.18/M', tier: 'mid' },
  { id: 'nvidia-deepseek-v4-pro', name: 'DeepSeek V4 Pro', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'deepseek-v4-pro', cost: '$0.90/M', tier: 'premium' },
  { id: 'openrouter-auto', name: 'OpenRouter Auto', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openrouter/auto', cost: 'Varies', tier: 'mid' },
  { id: 'custom', name: 'Custom...', url: '', model: '', cost: '', tier: 'custom' },
]

// ─── Sub-components ───────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5">
      <span className="text-[10px] text-gray-400 dark:text-white/40 uppercase">{label}</span>
      <span className={`text-sm font-bold ${color || 'text-[#111111] dark:text-white'}`}>{value}</span>
    </div>
  )
}

// ─── Users Panel ──────────────────────────────────────
function UsersPanel({ users, onRefresh, onCreditChange }: {
  users: AppUser[]
  onRefresh: () => void
  onCreditChange: (userId: string, amount: number) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState('10')
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const selectedUser = users.find(u => u.id === selected)

  async function handleCredit(action: 'add' | 'remove') {
    if (!selected) return
    setActionLoading(true)
    const amount = parseInt(creditAmount) || 0
    await onCreditChange(selected, action === 'add' ? amount : -amount)
    setActionLoading(false)
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-[#111111] dark:text-white placeholder-gray-400"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{filtered.length}</span>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          ↻
        </button>
      </div>

      {/* User list */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
        {filtered.map(user => (
          <button
            key={user.id}
            onClick={() => setSelected(selected === user.id ? null : user.id)}
            className={`w-full text-left rounded-xl p-3 border transition-all ${
              selected === user.id
                ? 'border-[#e7f900]/50 bg-[#e7f900]/5'
                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#e7f900]/20 flex items-center justify-center text-xs font-bold text-[#e7f900] shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111111] dark:text-white truncate">{user.email}</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/40">{formatDate(user.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {user.credits && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#e7f900]/10 text-[#e7f900]">
                    {user.credits.balance} cr
                  </span>
                )}
                {user.tier !== 'free' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {user.tier}
                  </span>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {selected === user.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs font-bold text-[#111111] dark:text-white">{user.credits?.balance ?? 0}</p>
                    <p className="text-[9px] text-gray-400">Balance</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#111111] dark:text-white">{user.credits?.total_purchased ?? 0}</p>
                    <p className="text-[9px] text-gray-400">Purchased</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#111111] dark:text-white">{user.project_count}</p>
                    <p className="text-[9px] text-gray-400">Videos</p>
                  </div>
                </div>

                {/* Credit controls */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-center text-[#111111] dark:text-white"
                    min="1"
                    max="1000"
                  />
                  <button
                    onClick={() => handleCredit('add')}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    + Add
                  </button>
                  <button
                    onClick={() => handleCredit('remove')}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    − Remove
                  </button>
                </div>

                <p className="text-[9px] text-gray-400 dark:text-white/30 font-mono truncate">ID: {user.id}</p>
              </div>
            )}
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-white/30 text-sm">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LLM Picker Panel ─────────────────────────────────
function LLMPickerPanel({ config, onConfigUpdate }: {
  config: AppConfig[]
  onConfigUpdate: (key: string, value: Record<string, any>) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [showKeyFree, setShowKeyFree] = useState(false)
  const [showKeyPaid, setShowKeyPaid] = useState(false)

  const freeConfig = config.find(c => c.key === 'soonsnap_llm_free')
  const paidConfig = config.find(c => c.key === 'soonsnap_llm_paid')
  const rateFree = config.find(c => c.key === 'soonsnap_rate_free')
  const ratePaid = config.find(c => c.key === 'soonsnap_rate_paid')
  const maintenance = config.find(c => c.key === 'maintenance_mode')

  function updateField(configKey: string, field: string, value: any) {
    const existing = config.find(c => c.key === configKey)
    const current = existing?.value || {}
    setSaving(`${configKey}-${field}`)
    onConfigUpdate(configKey, { ...current, [field]: value })
    setSaving(null)
  }

  function applyPreset(configKey: string, presetId: string) {
    const preset = LLM_PRESETS.find(p => p.id === presetId)
    if (!preset || preset.id === 'custom') return
    const existing = config.find(c => c.key === configKey)
    const current = existing?.value || {}
    setSaving(configKey)
    // Don't overwrite api_key when applying a preset — keep existing key
    onConfigUpdate(configKey, {
      ...current,
      url: preset.url,
      model: preset.model,
    })
    setSaving(null)
  }

  function maskKey(key: string | undefined): string {
    if (!key) return ''
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  // Detect which preset matches current config
  function detectPreset(cfg: AppConfig | undefined): string {
    if (!cfg) return 'custom'
    const { url, model } = cfg.value
    const match = LLM_PRESETS.find(p => p.url === url && p.model === model)
    return match?.id || 'custom'
  }

  return (
    <div className="space-y-4">
      {/* ─── LLM Config Card ──────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-4">
          🤖 SoonSnap AI Model
        </h3>

        {/* Free Tier */}
        <TierConfigEditor
          label="Free Tier"
          config={freeConfig}
          saving={saving}
          showKey={showKeyFree}
          onToggleKey={() => setShowKeyFree(!showKeyFree)}
          onApplyPreset={(id) => applyPreset('soonsnap_llm_free', id)}
          onUpdateField={(field, val) => updateField('soonsnap_llm_free', field, val)}
          detectedPreset={detectPreset(freeConfig)}
          maskKey={maskKey}
          defaultTokens={4096}
        />

        {/* Paid Tier */}
        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-white/5">
          <TierConfigEditor
            label="Paid Tier"
            config={paidConfig}
            saving={saving}
            showKey={showKeyPaid}
            onToggleKey={() => setShowKeyPaid(!showKeyPaid)}
            onApplyPreset={(id) => applyPreset('soonsnap_llm_paid', id)}
            onUpdateField={(field, val) => updateField('soonsnap_llm_paid', field, val)}
            detectedPreset={detectPreset(paidConfig)}
            maskKey={maskKey}
            defaultTokens={16384}
          />
        </div>
      </div>

      {/* Rate Limits */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40 mb-3">
          🚦 Rate Limits
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-500 dark:text-white/50">Free — Videos/day</span>
            <input
              type="number"
              value={rateFree?.value?.max_videos_day ?? 3}
              onChange={e => onConfigUpdate('soonsnap_rate_free', { max_videos_day: parseInt(e.target.value) || 3 })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-sm text-[#111111] dark:text-white"
            />
          </div>
          <div>
            <span className="text-xs text-gray-500 dark:text-white/50">Paid — Videos/day</span>
            <input
              type="number"
              value={ratePaid?.value?.max_videos_day ?? 50}
              onChange={e => onConfigUpdate('soonsnap_rate_paid', { max_videos_day: parseInt(e.target.value) || 50 })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-sm text-[#111111] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[#111111] dark:text-white">🔧 Maintenance Mode</h3>
          <p className="text-[10px] text-gray-400 dark:text-white/30">Disable video generation for all users</p>
        </div>
        <button
          onClick={() => onConfigUpdate('maintenance_mode', { enabled: !(maintenance?.value?.enabled ?? false) })}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            maintenance?.value?.enabled ? 'bg-red-500' : 'bg-gray-300 dark:bg-white/20'
          }`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            maintenance?.value?.enabled ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    </div>
  )
}

// ─── Tier Config Editor Sub-component ─────────────────
function TierConfigEditor({ label, config, saving, showKey, onToggleKey, onApplyPreset, onUpdateField, detectedPreset, maskKey, defaultTokens }: {
  label: string
  config: AppConfig | undefined
  saving: string | null
  showKey: boolean
  onToggleKey: () => void
  onApplyPreset: (presetId: string) => void
  onUpdateField: (field: string, value: any) => void
  detectedPreset: string
  maskKey: (key: string | undefined) => string
  defaultTokens: number
}) {
  const val = config?.value || {}
  const isSaving = saving?.startsWith(config?.key || '__') || false

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#111111] dark:text-white">{label}</span>
        {isSaving && <span className="text-[10px] text-[#e7f900] animate-pulse">Saving...</span>}
      </div>

      {/* Preset Quick-Pick */}
      <select
        value={detectedPreset}
        onChange={e => onApplyPreset(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-sm text-[#111111] dark:text-white"
      >
        <optgroup label="Quick Presets">
          {LLM_PRESETS.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.cost ? `(${p.cost})` : ''}
            </option>
          ))}
        </optgroup>
      </select>

      {/* API URL */}
      <div>
        <label className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">API URL</label>
        <input
          type="url"
          value={val.url || ''}
          onChange={e => onUpdateField('url', e.target.value)}
          placeholder="https://integrate.api.nvidia.com/v1/chat/completions"
          className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-xs font-mono text-[#111111] dark:text-white placeholder-gray-300 dark:placeholder-white/20"
        />
      </div>

      {/* Model */}
      <div>
        <label className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">Model ID</label>
        <input
          type="text"
          value={val.model || ''}
          onChange={e => onUpdateField('model', e.target.value)}
          placeholder="nvidia/llama-3.1-nemotron-nano-8b-v1"
          className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-xs font-mono text-[#111111] dark:text-white placeholder-gray-300 dark:placeholder-white/20"
        />
      </div>

      {/* API Key */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider">API Key</label>
          <button
            onClick={onToggleKey}
            className="text-[10px] text-[#e7f900] hover:underline"
          >
            {showKey ? 'Hide' : (val.api_key ? 'Show' : 'Set key')}
          </button>
        </div>
        {showKey ? (
          <input
            type="text"
            value={val.api_key || ''}
            onChange={e => onUpdateField('api_key', e.target.value)}
            placeholder="nvapi-... or sk-... (leave blank to use server env NVIDIA_API_KEY)"
            className="w-full mt-0.5 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-900/10 text-xs font-mono text-[#111111] dark:text-white placeholder-gray-300 dark:placeholder-white/20"
          />
        ) : (
          <div className="mt-0.5 px-3 py-2 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] text-xs font-mono text-gray-400 dark:text-white/30 truncate">
            {val.api_key ? `🔑 ${maskKey(val.api_key)}` : '🔑 Using server env key (default)'}
          </div>
        )}
      </div>

      {/* Tokens + Temp row */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Max Tokens</span>
          <input
            type="number"
            value={val.max_tokens || defaultTokens}
            onChange={e => onUpdateField('max_tokens', parseInt(e.target.value) || defaultTokens)}
            className="w-20 px-2 py-1.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-xs text-center text-[#111111] dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Temp</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={val.temperature ?? 0.7}
            onChange={e => onUpdateField('temperature', parseFloat(e.target.value) || 0.7)}
            className="w-14 px-2 py-1.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] text-xs text-center text-[#111111] dark:text-white"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Video Queue Panel ────────────────────────────────
function VideoQueuePanel({ jobs, onRefresh }: {
  jobs: VideoJob[]
  onRefresh: () => void
}) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)
  const counts = {
    all: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => ['running', 'capturing', 'composing', 'rendering'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'complete' || j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {(['all', 'queued', 'running', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[#e7f900] text-black'
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            {f} {counts[f] > 0 && `(${counts[f]})`}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onRefresh}
          className="shrink-0 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs hover:bg-gray-50 dark:hover:bg-white/5"
        >
          ↻
        </button>
      </div>

      {/* Job list */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
        {filtered.map(job => (
          <div
            key={job.id}
            className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[job.status] || 'bg-gray-400'}`} />
                <span className="text-xs font-medium text-[#111111] dark:text-white truncate">{job.site_url}</span>
              </div>
              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${statusBadge[job.status] || 'bg-gray-100 text-gray-500'}`}>
                {job.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-white/30">
              <span>{job.user_email}</span>
              <span>{formatTimeAgo(job.created_at)}</span>
            </div>
            {job.error_message && (
              <p className="mt-1 text-[10px] text-red-400 bg-red-50 dark:bg-red-900/10 rounded px-2 py-1 break-all">
                {job.error_message.slice(0, 200)}
              </p>
            )}
            {job.progress > 0 && (
              <div className="mt-2 h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#e7f900] rounded-full transition-all" style={{ width: `${job.progress}%` }} />
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-white/30 text-sm">
            {filter === 'all' ? 'No jobs yet' : `No ${filter} jobs`}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Apps Page ───────────────────────────────────
export default function Apps() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [config, setConfig] = useState<AppConfig[]>([])
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Direct Supabase REST calls with service_role key
  // We read the key from the server stats API (it has access to env)
  const [adminHeaders, setAdminHeaders] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    // Build admin headers using the service role key from env
    async function init() {
      try {
        // The stats API reads env vars — we'll add an endpoint to get the service role key
        // For now, fetch it via the server stats API proxy
        const res = await fetch(`${STATS_URL}admin-key`)
        if (res.ok) {
          const { key } = await res.json()
          setAdminHeaders({
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          })
        } else {
          // Fallback: fetch directly from Supabase with anon key (limited)
          setError('Admin key unavailable')
        }
      } catch {
        setError('Cannot connect to server')
      }
    }
    init()
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!adminHeaders) return
    try {
      // Get auth users
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        headers: { 'apikey': adminHeaders['apikey'], 'Authorization': adminHeaders['Authorization'] }
      })
      const authData = await authRes.json()
      const authUsers: any[] = authData.users || []

      // Get credits
      const creditsRes = await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_credits?select=*`, { headers: adminHeaders })
      const creditsData: any[] = await creditsRes.json()

      // Get project counts
      const projectsRes = await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_projects?select=user_id`, { headers: adminHeaders })
      const projectsData: any[] = await projectsRes.json()

      // Get wallets (tier info)
      const walletsRes = await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_wallets?select=user_id,tier`, { headers: adminHeaders })
      const walletsData: any[] = await walletsRes.json()

      const creditMap = new Map(creditsData.map(c => [c.user_id, c]))
      const projectCounts = new Map<string, number>()
      projectsData.forEach(p => projectCounts.set(p.user_id, (projectCounts.get(p.user_id) || 0) + 1))
      const walletMap = new Map(walletsData.map(w => [w.user_id, w.tier]))

      const merged: AppUser[] = authUsers.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        credits: creditMap.has(u.id)
          ? { balance: creditMap.get(u.id).balance, total_purchased: creditMap.get(u.id).total_purchased, total_used: creditMap.get(u.id).total_used }
          : null,
        tier: walletMap.get(u.id) || 'free',
        project_count: projectCounts.get(u.id) || 0,
      }))

      setUsers(merged)
    } catch (err: any) {
      setError(err.message)
    }
  }, [adminHeaders])

  const fetchConfig = useCallback(async () => {
    if (!adminHeaders) return
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=*&order=key.asc`, { headers: adminHeaders })
      const data: AppConfig[] = await res.json()
      setConfig(data)
    } catch (err: any) {
      setError(err.message)
    }
  }, [adminHeaders])

  const fetchJobs = useCallback(async () => {
    if (!adminHeaders) return
    try {
      // Get recent jobs with project info
      const jobsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/soonsnap_jobs?select=*,soonsnap_projects(url,user_id)&order=created_at.desc&limit=50`,
        { headers: adminHeaders }
      )
      const jobsData: any[] = await jobsRes.json()

      // Resolve user emails
      const userEmailMap = new Map(users.map(u => [u.id, u.email]))

      const mapped: VideoJob[] = jobsData.map(j => ({
        id: j.id,
        project_id: j.project_id,
        job_type: j.job_type,
        status: j.status,
        progress: j.progress || 0,
        error_message: j.error_message,
        attempts: j.attempts || 0,
        created_at: j.created_at,
        started_at: j.started_at,
        completed_at: j.completed_at,
        site_url: j.soonsnap_projects?.url || 'unknown',
        user_email: userEmailMap.get(j.soonsnap_projects?.user_id) || 'unknown',
      }))

      setJobs(mapped)
    } catch (err: any) {
      setError(err.message)
    }
  }, [adminHeaders, users])

  // Initial load
  useEffect(() => {
    if (!adminHeaders) return
    setLoading(true)
    Promise.all([fetchUsers(), fetchConfig()]).then(() => setLoading(false))
  }, [adminHeaders, fetchUsers, fetchConfig])

  // Load jobs after users (needs email map)
  useEffect(() => {
    if (users.length > 0) fetchJobs()
  }, [users, fetchJobs])

  // Credit change handler
  async function handleCreditChange(userId: string, amount: number) {
    if (!adminHeaders) return

    // Check if user has credits row
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_credits?user_id=eq.${userId}&select=*`, { headers: adminHeaders })
    const existing = await checkRes.json()

    if (existing.length > 0) {
      // Update existing
      const newBalance = Math.max(0, (existing[0].balance || 0) + amount)
      const newPurchased = amount > 0 ? (existing[0].total_purchased || 0) + amount : existing[0].total_purchased
      const newUsed = amount < 0 ? (existing[0].total_used || 0) + Math.abs(amount) : existing[0].total_used

      await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_credits?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ balance: newBalance, total_purchased: newPurchased, total_used: newUsed, updated_at: new Date().toISOString() }),
      })
    } else if (amount > 0) {
      // Create new row
      await fetch(`${SUPABASE_URL}/rest/v1/soonsnap_credits`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ user_id: userId, balance: amount, total_purchased: amount, total_used: 0 }),
      })
    }

    await fetchUsers()
  }

  // Config update handler
  async function handleConfigUpdate(key: string, value: Record<string, any>) {
    if (!adminHeaders) return
    await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.${key}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
    })
    await fetchConfig()
  }

  // ─── Render ─────────────────────────────────────────
  if (!adminHeaders && !error) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="text-[#e7f900] text-xl font-bold animate-pulse">Connecting...</div>
      </div>
    )
  }

  if (error && users.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-red-400 font-medium">Admin access unavailable</p>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
      </div>
    )
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'users', icon: '👥', label: 'Users' },
    { id: 'llm', icon: '🤖', label: 'LLM' },
    { id: 'queue', icon: '🎬', label: 'Queue' },
  ]

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111111] dark:text-[#e7f900]">Apps</h1>
        <div className="flex items-center gap-2">
          <StatBadge label="Users" value={users.length} />
          <StatBadge label="Videos" value={jobs.filter(j => j.status === 'completed' || j.status === 'complete').length} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-[#e7f900] text-black shadow-sm'
                : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-[#e7f900] text-lg animate-pulse">Loading...</div>
        </div>
      ) : (
        <>
          {tab === 'users' && (
            <UsersPanel users={users} onRefresh={fetchUsers} onCreditChange={handleCreditChange} />
          )}
          {tab === 'llm' && (
            <LLMPickerPanel config={config} onConfigUpdate={handleConfigUpdate} />
          )}
          {tab === 'queue' && (
            <VideoQueuePanel jobs={jobs} onRefresh={fetchJobs} />
          )}
        </>
      )}
    </div>
  )
}
