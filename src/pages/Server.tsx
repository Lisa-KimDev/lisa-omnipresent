import { useState, useEffect, useCallback } from 'react'

interface SystemStats {
  hostname: string
  platform: string
  uptimeSeconds: number
  cpuCores: number
  cpuModel: string
  loadAverage: { '1min': number; '5min': number; '15min': number }
  memory: { totalBytes: number; usedBytes: number; freeBytes: number; usePercent: number }
  disk: { filesystem: string; totalBytes: number; usedBytes: number; availableBytes: number; usePercent: string; mount: string }
}

interface SoonSnapStats {
  captures: { path: string; fileCount: number; totalSizeBytes: number }
  videos: { path: string; fileCount: number; totalSizeBytes: number }
  thumbnails: { path: string; fileCount: number; totalSizeBytes: number }
}

interface WorkerStats {
  service: string
  active: boolean
  status: string
  pid: number
}

interface StatsResponse {
  timestamp: string
  system: SystemStats
  soonsnap: SoonSnapStats
  worker: WorkerStats
}

const STATS_URL = 'http://173.249.36.76:8090/'
const POLL_INTERVAL = 5000

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getStatusColor(percent: number): string {
  if (percent >= 90) return '#ef4444'
  if (percent >= 75) return '#f59e0b'
  return '#22c55e'
}

function GaugeRing({ percent, label, detail, color, size = 80 }: {
  percent: number; label: string; detail: string; color: string; size?: number
}) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            className="text-gray-200 dark:text-white/10"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{Math.round(percent)}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-white/60">{label}</span>
      <span className="text-[10px] text-gray-400 dark:text-white/40">{detail}</span>
    </div>
  )
}

function StatCard({ title, children, alert }: { title: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${
      alert
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5'
    }`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
        alert ? 'text-red-400' : 'text-gray-400 dark:text-white/40'
      }`}>{title}</h3>
      {children}
    </div>
  )
}

export default function Server() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [history, setHistory] = useState<{ t: number; ram: number; cpu: number }[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(STATS_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: StatsResponse = await res.json()
      setStats(data)
      setError(null)
      setLastRefresh(new Date())
      
      // Keep last 20 data points for sparkline
      const ramPct = data.system.memory.usePercent
      const loadPct = Math.min(100, (data.system.loadAverage['1min'] / data.system.cpuCores) * 100)
      setHistory(prev => [...prev.slice(-19), { t: Date.now(), ram: ramPct, cpu: loadPct }])
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (error && !stats) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-4xl mb-3">💀</div>
        <p className="text-red-400 font-medium">Can't reach server</p>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-[#e7f900] text-black rounded-lg font-semibold text-sm hover:bg-[#d5e000] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="text-[#e7f900] text-xl font-bold animate-pulse">Connecting...</div>
      </div>
    )
  }

  const { system, soonsnap, worker } = stats
  const diskPercent = parseInt(system.disk.usePercent)
  const cpuLoadPercent = Math.min(100, (system.loadAverage['1min'] / system.cpuCores) * 100)
  const isAlert = system.memory.usePercent >= 85 || diskPercent >= 90 || cpuLoadPercent >= 80

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111111] dark:text-[#e7f900]">Server</h1>
          <p className="text-xs text-gray-400 dark:text-white/40">{system.hostname} · {system.cpuModel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 dark:text-white/30">
            {lastRefresh.toLocaleTimeString()}
          </span>
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            isAlert ? 'bg-red-400' : 'bg-green-400'
          }`} />
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-3 gap-2">
        <GaugeRing
          percent={cpuLoadPercent}
          label="CPU"
          detail={`${system.loadAverage['1min'].toFixed(1)} / ${system.cpuCores} cores`}
          color={getStatusColor(cpuLoadPercent)}
        />
        <GaugeRing
          percent={system.memory.usePercent}
          label="RAM"
          detail={`${formatBytes(system.memory.usedBytes)} / ${formatBytes(system.memory.totalBytes)}`}
          color={getStatusColor(system.memory.usePercent)}
        />
        <GaugeRing
          percent={diskPercent}
          label="Disk"
          detail={`${formatBytes(system.disk.availableBytes)} free`}
          color={getStatusColor(diskPercent)}
        />
      </div>

      {/* Sparkline */}
      {history.length > 2 && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
          <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider mb-2">Load History</p>
          <svg viewBox="0 0 200 40" className="w-full h-10">
            {/* CPU line */}
            <polyline
              fill="none"
              stroke="#e7f900"
              strokeWidth={1.5}
              strokeLinejoin="round"
              points={history.map((h, i) =>
                `${(i / (history.length - 1)) * 200},${40 - (h.cpu / 100) * 38}`
              ).join(' ')}
            />
            {/* RAM line */}
            <polyline
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeLinejoin="round"
              opacity={0.7}
              points={history.map((h, i) =>
                `${(i / (history.length - 1)) * 200},${40 - (h.ram / 100) * 38}`
              ).join(' ')}
            />
          </svg>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[#e7f900]">● CPU</span>
            <span className="text-[9px] text-purple-400">● RAM</span>
          </div>
        </div>
      )}

      {/* Uptime */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-white/50">Uptime</span>
        <span className="text-sm font-mono font-bold text-[#111111] dark:text-white">
          {formatUptime(system.uptimeSeconds)}
        </span>
      </div>

      {/* SoonSnap */}
      <StatCard title="SoonSnap Worker" alert={!worker.active}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${worker.active ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-sm font-semibold text-[#111111] dark:text-white">
              {worker.active ? 'Running' : 'Stopped'}
            </span>
          </div>
          {worker.pid && <span className="text-xs text-gray-400 font-mono">PID {worker.pid}</span>}
        </div>
      </StatCard>

      {/* Storage */}
      <StatCard title="SoonSnap Storage">
        <div className="space-y-2">
          {[
            { label: 'Videos', data: soonsnap.videos, icon: '🎬' },
            { label: 'Captures', data: soonsnap.captures, icon: '📸' },
            { label: 'Thumbnails', data: soonsnap.thumbnails, icon: '🖼️' },
          ].map(({ label, data, icon }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-white/70">
                {icon} {label}
              </span>
              <span className="text-xs font-mono text-gray-400 dark:text-white/40">
                {data.fileCount} files · {formatBytes(data.totalSizeBytes)}
              </span>
            </div>
          ))}
        </div>
      </StatCard>

      {/* Load Average */}
      <StatCard title="Load Average">
        <div className="flex gap-4">
          {[
            { label: '1m', value: system.loadAverage['1min'] },
            { label: '5m', value: system.loadAverage['5min'] },
            { label: '15m', value: system.loadAverage['15min'] },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 text-center">
              <div className="text-lg font-mono font-bold text-[#111111] dark:text-white">
                {value.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </StatCard>

      {/* Refresh button */}
      <button
        onClick={fetchStats}
        className="w-full py-2.5 rounded-xl bg-[#e7f900] text-black font-semibold text-sm hover:bg-[#d5e000] transition-colors"
      >
        Refresh Now
      </button>
    </div>
  )
}
