import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Surface a clear, actionable error instead of a cryptic network failure
  // the first time someone tries to upload a book.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase credentials. Create a .env file with VITE_SUPABASE_URL ' +
      'and VITE_SUPABASE_ANON_KEY — see README.md for setup instructions.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

export const BOOKS_TABLE = 'books'
export const PDF_BUCKET = 'pdfs'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
