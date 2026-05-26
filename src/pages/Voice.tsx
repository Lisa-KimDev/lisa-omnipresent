import { useState, useRef, useEffect, useCallback } from 'react'
import { generateTTS, type VoiceId, type WordTimestamp } from '../lib/tts'

const VOICE_OPTIONS: { id: VoiceId; name: string; desc: string }[] = [
  { id: 'jenny', name: 'Jenny', desc: 'Natural & warm' },
  { id: 'emma', name: 'Emma', desc: 'Multilingual' },
  { id: 'aria', name: 'Aria', desc: 'Professional' },
  { id: 'ana', name: 'Ana', desc: 'Casual & friendly' },
  { id: 'michelle', name: 'Michelle', desc: 'Clear & articulate' },
]

const SPEED_OPTIONS = [
  { value: '0.75' as const, label: '0.75×' },
  { value: '1.0' as const, label: '1×' },
  { value: '1.25' as const, label: '1.25×' },
  { value: '1.5' as const, label: '1.5×' },
  { value: '2.0' as const, label: '2×' },
]

export default function Voice() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<VoiceId>(() => {
    return (localStorage.getItem('tts-voice') as VoiceId) || 'jenny'
  })
  const [speed, setSpeed] = useState<'0.75' | '1.0' | '1.25' | '1.5' | '2.0'>('1.0')
  const [status, setStatus] = useState<'idle' | 'generating' | 'playing' | 'paused' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0) // 0-100
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [words, setWords] = useState<WordTimestamp[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string>('')
  const animFrameRef = useRef<number>(0)

  // Persist voice choice
  useEffect(() => {
    localStorage.setItem('tts-voice', voice)
  }, [voice])

  // Progress update loop
  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.duration || !isFinite(audio.duration)) return

    const ct = audio.currentTime
    const dur = audio.duration
    setCurrentTime(ct)
    setDuration(dur)
    setProgress((ct / dur) * 100)

    // Find current word
    const wordTimestamps = wordsRef.current
    let idx = -1
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (ct >= wordTimestamps[i].start && ct < wordTimestamps[i].end) {
        idx = i
        break
      }
      // If between words, highlight next upcoming
      if (ct < wordTimestamps[i].start) {
        idx = i > 0 ? i - 1 : -1
        break
      }
    }
    if (idx === -1 && wordTimestamps.length > 0 && ct >= wordTimestamps[wordTimestamps.length - 1].end) {
      idx = wordTimestamps.length - 1
    }
    setCurrentWordIndex(idx)

    if (!audio.paused && !audio.ended) {
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  // Store words in a ref for the animation loop
  const wordsRef = useRef<WordTimestamp[]>([])
  useEffect(() => {
    wordsRef.current = words
  }, [words])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = ''
    }
    setProgress(0)
    setCurrentTime(0)
    setDuration(0)
    setCurrentWordIndex(-1)
    setWords([])
    setStatus('idle')
  }, [])

  const handlePlay = async () => {
    if (!text.trim()) return

    // If paused, resume
    if (status === 'paused' && audioRef.current) {
      audioRef.current.play()
      setStatus('playing')
      animFrameRef.current = requestAnimationFrame(updateProgress)
      return
    }

    // Stop any existing
    stopPlayback()
    setError('')
    setStatus('generating')

    try {
      const result = await generateTTS({ text: text.trim(), voice, speed })

      // Create audio blob
      const binaryStr = atob(result.audio.split(',')[1])
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      setWords(result.words)
      wordsRef.current = result.words

      audio.onended = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        setProgress(100)
        setStatus('idle')
        setCurrentWordIndex(result.words.length - 1)
      }

      audio.onerror = () => {
        setError('Audio playback failed')
        setStatus('error')
      }

      await audio.play()

      // Set up media session for lock screen controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Lisa Voice Reader',
          artist: 'Lisa Kim',
          album: 'TTS',
        })
        navigator.mediaSession.setActionHandler('play', () => {
          audio.play()
          setStatus('playing')
          animFrameRef.current = requestAnimationFrame(updateProgress)
        })
        navigator.mediaSession.setActionHandler('pause', () => {
          audio.pause()
          setStatus('paused')
        })
        navigator.mediaSession.setActionHandler('stop', () => stopPlayback())
      }

      setStatus('playing')
      animFrameRef.current = requestAnimationFrame(updateProgress)
    } catch (err: any) {
      setError(err.message || 'Generation failed')
      setStatus('error')
    }
  }

  const handlePause = () => {
    if (audioRef.current && status === 'playing') {
      audioRef.current.pause()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      setStatus('paused')
    }
  }

  const handleStop = () => {
    stopPlayback()
  }

  // Seek via progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * audio.duration
    setProgress(pct * 100)
    setCurrentTime(pct * audio.duration)
  }

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Render text with word highlighting
  const renderHighlightedText = () => {
    if (words.length === 0 || status === 'idle') {
      return <span className="text-gray-700 dark:text-gray-300">{text || 'Paste your text here...'}</span>
    }

    // Reconstruct text with word boundaries highlighted
    const elements: React.ReactNode[] = []
    let charIdx = 0
    const textLower = text.toLowerCase()

    words.forEach((w, i) => {
      const wordLower = w.word.toLowerCase()
      const startIdx = textLower.indexOf(wordLower, charIdx)

      if (startIdx === -1) return

      // Add text before this word
      if (startIdx > charIdx) {
        elements.push(
          <span key={`pre-${i}`} className="text-gray-500 dark:text-gray-400">
            {text.slice(charIdx, startIdx)}
          </span>
        )
      }

      // Add the word
      const isCurrent = i === currentWordIndex
      elements.push(
        <span
          key={`w-${i}`}
          className={`transition-colors duration-150 ${
            isCurrent
              ? 'text-[#e7f900] font-bold bg-[#e7f900]/20 rounded px-0.5'
              : i < currentWordIndex
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {text.slice(startIdx, startIdx + w.word.length)}
        </span>
      )

      charIdx = startIdx + w.word.length
    })

    // Remaining text
    if (charIdx < text.length) {
      elements.push(
        <span key="rest" className="text-gray-700 dark:text-gray-300">
          {text.slice(charIdx)}
        </span>
      )
    }

    return elements
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎙️</span>
        <div>
          <h2 className="text-xl font-bold text-[#111111] dark:text-[#e7f900]">Voice Reader</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Paste text · Pick a voice · Listen</p>
        </div>
      </div>

      {/* Text Display with highlighting */}
      <div
        className="min-h-[120px] max-h-[300px] overflow-y-auto p-4 rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 cursor-text leading-relaxed text-base"
        onClick={() => {
          const ta = document.getElementById('tts-textarea')
          if (ta && status === 'idle') ta.focus()
        }}
      >
        {status === 'idle' ? (
          <div className="relative">
            <textarea
              id="tts-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full min-h-[100px] bg-transparent resize-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              disabled={status !== 'idle'}
            />
            {text.length > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
                {text.split(/\s+/).filter(Boolean).length} words · {text.length.toLocaleString()} chars
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap select-text">{renderHighlightedText()}</div>
        )}
      </div>

      {/* Voice & Speed selectors */}
      <div className="space-y-3">
        {/* Voice */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
            Voice
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                disabled={status !== 'idle'}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  voice === v.id
                    ? 'bg-[#e7f900] text-[#111111] shadow-sm'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15'
                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div>{v.name}</div>
                <div className="text-[10px] opacity-70">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speed */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
            Speed
          </label>
          <div className="flex gap-2">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                disabled={status !== 'idle'}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  speed === s.value
                    ? 'bg-[#e7f900] text-[#111111]'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {status === 'playing' ? (
          <button
            onClick={handlePause}
            className="w-14 h-14 rounded-full bg-[#e7f900] text-[#111111] flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform active:scale-95"
          >
            ⏸️
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={status === 'generating' || (!text.trim() && status === 'idle')}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform active:scale-95 ${
              status === 'generating'
                ? 'bg-gray-300 dark:bg-gray-600 animate-pulse cursor-wait'
                : 'bg-[#e7f900] text-[#111111] hover:scale-105'
            } disabled:opacity-40`}
          >
            {status === 'generating' ? '⏳' : '▶️'}
          </button>
        )}

        {(status === 'playing' || status === 'paused') && (
          <button
            onClick={handleStop}
            className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex items-center justify-center text-lg hover:bg-gray-300 dark:hover:bg-white/15 transition-colors"
          >
            ⏹️
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'playing' || status === 'paused') && (
        <div className="space-y-2">
          <div
            className="h-2 bg-gray-200 dark:bg-white/10 rounded-full cursor-pointer overflow-hidden"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-[#e7f900] rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {currentWordIndex >= 0 ? `Word ${currentWordIndex + 1} of ${words.length}` : ''}
            </span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Generating status */}
      {status === 'generating' && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Generating audio...
        </div>
      )}
    </div>
  )
}
