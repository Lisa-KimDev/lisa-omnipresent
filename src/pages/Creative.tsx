import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Generation {
  id: string
  prompt: string
  style: string
  image_url: string
  width: number
  height: number
  created_at: string
}

const stylePresets = [
  'Cyberpunk',
  'Pixel Art',
  'Photorealistic',
  'Anime',
  'Oil Painting',
  'Sci-Fi',
  'Meme',
  'NFT Art',
  'Logo',
  'Album Cover',
]

const styleKeywords: Record<string, string> = {
  Cyberpunk: 'cyberpunk neon futuristic city lights digital art',
  'Pixel Art': 'pixel art retro 8-bit sprite style',
  Photorealistic: 'photorealistic ultra detailed 8k photography',
  Anime: 'anime manga style japanese illustration',
  'Oil Painting': 'oil painting classical fine art canvas texture',
  'Sci-Fi': 'science fiction futuristic space technology concept art',
  Meme: 'internet meme style humorous pop culture',
  'NFT Art': 'NFT art digital collectible vibrant trending',
  Logo: 'professional logo design vector clean minimal',
  'Album Cover': 'album cover art music design vinyl artwork',
}

const sizes = ['512x512', '1024x1024', '1024x1792', '1792x1024']

export default function Creative() {
  const [user, setUser] = useState<User | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('')
  const [selectedSize, setSelectedSize] = useState('1024x1024')
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState('')
  const [history, setHistory] = useState<Generation[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setHistory(data)
  }, [user])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const [errorMsg, setErrorMsg] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGeneratedImage('')
    setErrorMsg('')

    const keywords = selectedStyle ? styleKeywords[selectedStyle] ?? '' : ''
    const fullPrompt = keywords ? `${prompt}, ${keywords}` : prompt
    const [w, h] = selectedSize.split('x').map(Number)
    const seed = Date.now()
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`

    // 60s timeout — Pollinations hangs forever on blocked prompts
    const timeout = setTimeout(() => {
      setGenerating(false)
      setErrorMsg('⏱️ Request timed out. The prompt may have been blocked or the service is busy. Try rephrasing.')
    }, 60000)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      clearTimeout(timeout)
      setGeneratedImage(imageUrl)
      setGenerating(false)

      if (user) {
        await supabase.from('generations').insert({
          user_id: user.id,
          prompt: prompt,
          style: selectedStyle || 'None',
          image_url: imageUrl,
          provider: 'pollinations',
          width: w,
          height: h,
        })
        fetchHistory()
      }
    }
    img.onerror = () => {
      clearTimeout(timeout)
      setGenerating(false)
      setErrorMsg('❌ Generation failed. Try a different prompt.')
    }
    img.src = imageUrl
  }

  const handleDownload = () => {
    if (!generatedImage) return
    const a = document.createElement('a')
    a.href = generatedImage
    a.download = `lisa-creative-${Date.now()}.png`
    a.target = '_blank'
    a.click()
  }

  const handleShare = async () => {
    if (!generatedImage) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lisa Creative', url: generatedImage })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(generatedImage)
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to create..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-[#e7f900] focus:outline-none resize-none transition-colors"
        />

        {/* Style presets */}
        <div className="flex flex-wrap gap-2">
          {stylePresets.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(selectedStyle === style ? '' : style)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                selectedStyle === style
                  ? 'bg-[#e7f900] text-[#111111] font-semibold'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Size selector */}
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                selectedSize === size
                  ? 'bg-[#e7f900]/20 text-[#e7f900] border border-[#e7f900]/50'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-white/50 border border-gray-200 dark:border-white/10'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full py-3 bg-[#e7f900] text-[#111111] font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? '🎨 Generating...' : '✨ Generate Image'}
        </button>

        {errorMsg && (
          <p className="text-red-400 text-sm text-center py-2">{errorMsg}</p>
        )}
      </div>

      {/* Generated image */}
      {generatedImage && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
            <img
              src={generatedImage}
              alt="Generated"
              className="w-full h-auto"
              crossOrigin="anonymous"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              📥 Download
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              📤 Share
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-white/80">History</h2>
          <div className="grid grid-cols-2 gap-3">
            {history.map((gen) => (
              <div key={gen.id} className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
                <img
                  src={gen.image_url}
                  alt={gen.prompt}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-gray-600 dark:text-white/70 truncate">{gen.prompt}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] px-2 py-0.5 bg-[#e7f900]/20 text-[#e7f900] rounded-full">
                      {gen.style}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-white/40">
                      {new Date(gen.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
