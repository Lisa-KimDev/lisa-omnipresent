export interface WordTimestamp {
  start: number
  end: number
  word: string
}

export interface TTSResponse {
  audio: string // data:audio/mp3;base64,...
  words: WordTimestamp[]
  duration: number
}

export type VoiceId = 'jenny' | 'emma' | 'aria' | 'ana' | 'michelle'

export interface TTSOptions {
  text: string
  voice?: VoiceId
  speed?: '0.75' | '1.0' | '1.25' | '1.5' | '2.0'
}

// Dev: vite proxy /api/tts → localhost:8082/tts
// Prod: nginx on port 80 proxies /tts-api/ → localhost:8082/tts
const isDev = import.meta.env.DEV
const TTS_URL = isDev ? '/api/tts' : 'http://173.249.36.76/tts-api/'

export async function generateTTS(options: TTSOptions): Promise<TTSResponse> {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: options.text,
      voice: options.voice || 'jenny',
      speed: options.speed || '1.0',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `TTS failed: ${res.status}`)
  }

  return res.json()
}
