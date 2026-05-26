import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  starred: boolean
  webViewLink: string
  iconLink: string
  owners?: { displayName: string }[]
}

interface SheetMeta {
  sheets: { properties: { title: string; sheetId: number } }[]
}

interface SheetData {
  values: string[][]
}

// ── API helper ──
async function gproxy(action: string, params: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke('google-proxy', {
    body: { action, ...params },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// ── Icons ──
function fileIcon(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return '📁'
  if (mimeType === 'application/vnd.google-apps.document') return '📄'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return '📊'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📕'
  return '📎'
}

function fileTypeName(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'Folder'
  if (mimeType === 'application/vnd.google-apps.document') return 'Doc'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Sheet'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType === 'application/pdf') return 'PDF'
  return 'File'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Doc Viewer ──
function DocViewer({ fileId, fileName, onBack }: { fileId: string; fileName: string; onBack: () => void }) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    gproxy('doc_get', { fileId })
      .then((doc) => {
        const text = renderDocContent(doc)
        setContent(text)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fileId])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[#e7f900] text-sm font-bold hover:underline">← Back</button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{fileName}</h3>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse p-4">
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  )
}

function renderDocContent(doc: Record<string, unknown>): string {
  const body = doc.body as { content: Record<string, unknown>[] } | undefined
  if (!body?.content) return '<p><em>Empty document</em></p>'

  let html = ''
  for (const elem of body.content) {
    if (elem.paragraph) {
      const para = elem.paragraph as { elements: Record<string, unknown>[]; paragraphStyle?: { namedStyleType?: string } }
      const style = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT'
      const tag = style === 'HEADING_1' ? 'h1' : style === 'HEADING_2' ? 'h2' : style === 'HEADING_3' ? 'h3' : 'p'

      let text = ''
      for (const el of para.elements || []) {
        const run = el.textRun
        if (run) {
          const r = run as { content?: string; textStyle?: { bold?: boolean; italic?: boolean; link?: { url: string } } }
          let t = (r.content || '').replace(/\n/g, '<br/>')
          if (r.textStyle?.bold) t = `<strong>${t}</strong>`
          if (r.textStyle?.italic) t = `<em>${t}</em>`
          if (r.textStyle?.link) t = `<a href="${r.textStyle.link.url}" class="text-[#e7f900] underline" target="_blank">${t}</a>`
          text += t
        }
      }

      if (text.trim()) {
        const cls = tag === 'p' ? 'class="text-sm text-gray-700 dark:text-white/80 leading-relaxed mb-2"' : `class="text-lg font-bold text-gray-900 dark:text-white mb-1 mt-4"`
        html += `<${tag} ${cls}>${text}</${tag}>`
      }
    }
  }
  return html || '<p><em>No renderable content</em></p>'
}

// ── Sheet Viewer ──
function SheetViewer({ fileId, fileName, onBack }: { fileId: string; fileName: string; onBack: () => void }) {
  const [sheets, setSheets] = useState<{ title: string; sheetId: number }[]>([])
  const [activeSheet, setActiveSheet] = useState('')
  const [data, setData] = useState<string[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    gproxy('sheet_meta', { fileId })
      .then((meta: SheetMeta) => {
        const list = meta.sheets?.map((s) => s.properties) || []
        setSheets(list)
        if (list.length > 0) {
          setActiveSheet(list[0].title)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fileId])

  useEffect(() => {
    if (!activeSheet) return
    setLoading(true)
    setError('')
    gproxy('sheet_get', { fileId, range: activeSheet })
      .then((d: SheetData) => {
        setData(d.values || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fileId, activeSheet])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[#e7f900] text-sm font-bold hover:underline">← Back</button>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{fileName}</h3>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {sheets.map((s) => (
            <button
              key={s.sheetId}
              onClick={() => setActiveSheet(s.title)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                activeSheet === s.title
                  ? 'bg-[#e7f900] text-[#111111]'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse p-4">
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/5">
                {data[0]?.map((cell, i) => (
                  <th key={i} className="px-3 py-2 text-left font-bold text-gray-700 dark:text-white/70 border-b border-gray-200 dark:border-white/10 whitespace-nowrap">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(1).map((row, ri) => (
                <tr key={ri} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-700 dark:text-white/70 whitespace-nowrap max-w-[200px] truncate">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-white/30 text-center py-4">Empty sheet</p>
      )}
    </div>
  )
}

// ── Shared File type (from Lisa API / Supabase Storage) ──
interface SharedFile {
  name: string
  id: string
  size: number
  mimeType: string
  createdAt: string
  url: string
}

// ── Main Docs Page ──
type ViewMode = 'list' | 'doc' | 'sheet'
type TabMode = 'drive' | 'shared'

export default function Docs() {
  const [tabMode, setTabMode] = useState<TabMode>('drive')
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([])
  const [sharedLoading, setSharedLoading] = useState(false)
  const [sharedError, setSharedError] = useState('')
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'docs' | 'sheets' | 'folders' | 'starred' | 'recent'>('all')
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }])

  // Viewer state
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [viewFile, setViewFile] = useState<DriveFile | null>(null)

  const currentFolder = breadcrumbs[breadcrumbs.length - 1].id

  const fetchFiles = async () => {
    setLoading(true)
    setError('')
    try {
      let result
      if (filter === 'starred') {
        result = await gproxy('drive_starred')
      } else if (filter === 'recent') {
        result = await gproxy('drive_recent')
      } else if (search) {
        const mimeTypeFilter = filter === 'docs' ? 'docs' : filter === 'sheets' ? 'sheets' : filter === 'folders' ? 'folders' : ''
        result = await gproxy('drive_search', { query: search, mimeTypeFilter })
      } else {
        let query = `'${currentFolder}' in parents and trashed = false`
        if (filter === 'docs') query += " and mimeType = 'application/vnd.google-apps.document'"
        else if (filter === 'sheets') query += " and mimeType = 'application/vnd.google-apps.spreadsheet'"
        else if (filter === 'folders') query += " and mimeType = 'application/vnd.google-apps.folder'"
        result = await gproxy('drive_list', { folderId: currentFolder, query: filter !== 'all' ? query : '' })
      }
      setFiles(result.files || [])
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchFiles() }, [currentFolder, filter])

  // Fetch shared files from Lisa API
  const fetchSharedFiles = async () => {
    setSharedLoading(true)
    setSharedError('')
    try {
      const baseUrl = import.meta.env.DEV ? 'http://localhost:8082' : `http://${window.location.hostname}/docs-api`
      const res = await fetch(`${baseUrl}/list`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to load shared files')
      const data = await res.json()
      setSharedFiles(data.files || [])
    } catch (e) {
      setSharedError((e as Error).message)
    }
    setSharedLoading(false)
  }

  useEffect(() => { if (tabMode === 'shared') fetchSharedFiles() }, [tabMode])

  const handleSearch = () => {
    if (search.trim()) fetchFiles()
  }

  const openFile = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }])
      setFilter('all')
      setSearch('')
      return
    }
    if (file.mimeType === 'application/vnd.google-apps.document') {
      setViewFile(file)
      setViewMode('doc')
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      setViewFile(file)
      setViewMode('sheet')
    } else {
      window.open(file.webViewLink, '_blank')
    }
  }

  const goBack = () => {
    setViewMode('list')
    setViewFile(null)
  }

  const navigateUp = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs(breadcrumbs.slice(0, -1))
    }
  }

  const toggleStar = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation()
    await gproxy('file_star', { fileId: file.id, starred: String(!file.starred) })
    fetchFiles()
  }

  const filters: { key: typeof filter; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: '📁' },
    { key: 'docs', label: 'Docs', icon: '📄' },
    { key: 'sheets', label: 'Sheets', icon: '📊' },
    { key: 'starred', label: 'Starred', icon: '⭐' },
    { key: 'recent', label: 'Recent', icon: '🕐' },
  ]

  // ── Render viewer ──
  if (viewMode === 'doc' && viewFile) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <DocViewer fileId={viewFile.id} fileName={viewFile.name} onBack={goBack} />
      </div>
    )
  }

  if (viewMode === 'sheet' && viewFile) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <SheetViewer fileId={viewFile.id} fileName={viewFile.name} onBack={goBack} />
      </div>
    )
  }

  // ── Render file list ──
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Tab toggle: Drive / Shared */}
      <div className="flex gap-2">
        <button
          onClick={() => setTabMode('drive')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            tabMode === 'drive' ? 'bg-[#e7f900] text-[#111111]' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
          }`}
        >
          📁 Drive
        </button>
        <button
          onClick={() => setTabMode('shared')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            tabMode === 'shared' ? 'bg-[#e7f900] text-[#111111]' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
          }`}
        >
          🤖 Shared from Agents
        </button>
      </div>

      {/* ── Shared Files Tab ── */}
      {tabMode === 'shared' && (
        <div className="space-y-2">
          {sharedLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 animate-pulse">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3 mb-1" />
                    <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {sharedError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{sharedError}</p>
            </div>
          )}
          {!sharedLoading && !sharedError && sharedFiles.map(f => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#e7f900]/50 dark:hover:border-[#e7f900]/30 transition-all"
            >
              <span className="text-xl flex-shrink-0">
                {f.mimeType === 'application/pdf' ? '📕' : f.mimeType.startsWith('image/') ? '🖼️' : '📎'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {f.name.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+_/, '')}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-white/30">
                    {(f.size / 1024).toFixed(f.size > 1024 * 1024 ? 1 : 0)}{f.size > 1024 * 1024 ? 'MB' : 'KB'}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-white/30">{timeAgo(f.createdAt)}</span>
                </div>
              </div>
              <span className="text-gray-300 dark:text-white/20 text-lg">↗</span>
            </a>
          ))}
          {!sharedLoading && !sharedError && sharedFiles.length === 0 && (
            <p className="text-center text-gray-400 dark:text-white/30 py-8">No shared files yet. Data can upload here!</p>
          )}
        </div>
      )}

      {/* ── Google Drive Tab ── */}
      {tabMode === 'drive' && (<>
      {/* Search */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search Drive..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 border border-gray-200 dark:border-white/10 focus:border-[#e7f900] focus:outline-none transition-colors text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={!search.trim()}
          className="px-4 py-2 bg-[#e7f900] text-[#111111] font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all text-sm"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); fetchFiles() }}
            className="px-3 py-2 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/80 transition-colors text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-[#e7f900] text-[#111111]'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/20'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {breadcrumbs.map((bc, i) => (
            <span key={bc.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-400 dark:text-white/30">/</span>}
              <button
                onClick={() => setBreadcrumbs(breadcrumbs.slice(0, i + 1))}
                className={`hover:text-[#e7f900] transition-colors ${
                  i === breadcrumbs.length - 1 ? 'text-[#e7f900] font-semibold' : 'text-gray-500 dark:text-white/50'
                }`}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Back button for folders */}
      {breadcrumbs.length > 1 && (
        <button
          onClick={navigateUp}
          className="text-sm text-[#e7f900] font-semibold hover:underline"
        >
          ← Back to {breadcrumbs[breadcrumbs.length - 2]?.name || 'My Drive'}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 animate-pulse">
              <div className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3 mb-1" />
                <div className="h-2 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchFiles} className="text-xs text-red-300 hover:underline mt-1">Retry</button>
        </div>
      )}

      {/* File list */}
      {!loading && !error && (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => openFile(file)}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#e7f900]/50 dark:hover:border-[#e7f900]/30 cursor-pointer transition-all"
            >
              <span className="text-xl flex-shrink-0">{fileIcon(file.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-white/30">{fileTypeName(file.mimeType)}</span>
                  <span className="text-[10px] text-gray-400 dark:text-white/30">{timeAgo(file.modifiedTime)}</span>
                  {file.owners?.[0] && (
                    <span className="text-[10px] text-gray-400 dark:text-white/30">{file.owners[0].displayName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => toggleStar(file, e)}
                className={`p-1.5 text-sm transition-colors flex-shrink-0 ${
                  file.starred ? 'text-yellow-400' : 'text-gray-300 dark:text-white/20 hover:text-yellow-400'
                }`}
              >
                {file.starred ? '⭐' : '☆'}
              </button>
            </div>
          ))}

          {files.length === 0 && (
            <p className="text-center text-gray-400 dark:text-white/30 py-8">
              {search ? 'No results found' : filter === 'starred' ? 'No starred files' : 'No files in this folder'}
            </p>
          )}
        </div>
      )}
      </>)}
    </div>
  )
}
