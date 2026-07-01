import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'

// The book viewer pulls in pdf.js and the flipbook engine, both fairly
// large. Splitting it into its own chunk keeps the landing page snappy.
const Book = lazy(() => import('./pages/Book.jsx'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/book/:id"
        element={
          <Suspense fallback={<RouteFallback />}>
            <Book />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink">
      <div className="h-16 w-12 animate-pulse rounded-sm bg-gradient-to-br from-wine to-ink-deep shadow-book" />
    </main>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
      <p className="font-display text-3xl italic text-parchment">Nothing on this page</p>
      <p className="max-w-sm text-sm text-mist">
        The address doesn’t match a book or the home page.
      </p>
      <a
        href="/"
        className="mt-4 rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-[0.2em] text-gold-bright transition-colors hover:border-gold-bright hover:bg-gold/10"
      >
        Go home
      </a>
    </main>
  )
}
