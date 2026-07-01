import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone.jsx'
import ProgressRibbon from '../components/ProgressRibbon.jsx'
import { supabase, isSupabaseConfigured, BOOKS_TABLE, PDF_BUCKET } from '../lib/supabaseClient.js'

function titleFromFileName(name) {
  const withoutExtension = name.replace(/\.pdf$/i, '')
  const spaced = withoutExtension.replace(/[-_]+/g, ' ').trim()
  return spaced.length > 0 ? spaced : 'Untitled book'
}

export default function Home() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | uploading | error
  const [errorMessage, setErrorMessage] = useState('')
  const [fakeProgress, setFakeProgress] = useState(0)
  const progressTimer = useRef(null)

  useEffect(() => () => window.clearInterval(progressTimer.current), [])

  const startFakeProgress = () => {
    setFakeProgress(0.06)
    progressTimer.current = window.setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 0.92) return prev
        const step = (0.92 - prev) * 0.08 + 0.01
        return Math.min(prev + step, 0.92)
      })
    }, 180)
  }

  const stopFakeProgress = () => {
    window.clearInterval(progressTimer.current)
  }

  const handleFileSelected = useCallback(
    async (file) => {
      if (!isSupabaseConfigured) {
        setStatus('error')
        setErrorMessage(
          'Storage isn\u2019t configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY \u2014 see README.md.'
        )
        return
      }

      setStatus('uploading')
      setErrorMessage('')
      startFakeProgress()

      try {
        const id = crypto.randomUUID()
        const storagePath = `${id}.pdf`

        const { error: uploadError } = await supabase.storage
          .from(PDF_BUCKET)
          .upload(storagePath, file, {
            contentType: 'application/pdf',
            cacheControl: '31536000',
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { error: insertError } = await supabase.from(BOOKS_TABLE).insert({
          id,
          title: titleFromFileName(file.name),
          file_path: storagePath,
          page_count: null,
        })

        if (insertError) throw insertError

        setFakeProgress(1)
        window.setTimeout(() => navigate(`/book/${id}`), 260)
      } catch (err) {
        stopFakeProgress()
        setStatus('error')
        setErrorMessage(
          err?.message ||
            'Something interrupted the upload. Check your connection and try again.'
        )
      }
    },
    [navigate]
  )

  const isUploading = status === 'uploading'

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6 py-16">
      {/* Ambient candlelight glow */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-wine/30 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-10%] h-[420px] w-[420px] rounded-full bg-gold/10 blur-[130px]" />

      <div className="relative flex w-full max-w-4xl flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xs uppercase tracking-[0.35em] text-gold/80">
            A book, just for her
          </span>
          <h1 className="max-w-xl font-display text-5xl italic leading-[1.1] text-parchment sm:text-6xl">
            Turn your words into a book she can hold
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-mist sm:text-base">
            Upload a PDF and it becomes a page-turning keepsake with its own private
            link — ready to send in under a minute.
          </p>
        </div>

        <UploadZone onFileSelected={handleFileSelected} disabled={isUploading} error={status === 'error' ? errorMessage : ''} />

        {isUploading && (
          <ProgressRibbon
            label={fakeProgress >= 1 ? 'Binding your book' : 'Uploading your pages'}
            progress={fakeProgress}
          />
        )}

        <ol className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-mist/80">
          <li className="flex items-center gap-2">
            <span className="text-gold-bright">01</span> Choose a PDF
          </li>
          <li className="flex items-center gap-2">
            <span className="text-gold-bright">02</span> We bind it into a book
          </li>
          <li className="flex items-center gap-2">
            <span className="text-gold-bright">03</span> Share the link
          </li>
        </ol>
      </div>
    </main>
  )
}
