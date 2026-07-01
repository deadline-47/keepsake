-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- It creates the "books" table that maps a shareable ID to a PDF stored in
-- Supabase Storage, and sets up Row Level Security so the app can read and
-- write it using only the public "anon" key (no server, no secret key).

create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled book',
  file_path text not null,
  page_count integer,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

-- Anyone with the link can read a book's metadata. The id is a random
-- UUID, so a book is only discoverable by someone who was given the URL.
drop policy if exists "Books are publicly readable" on public.books;
create policy "Books are publicly readable"
  on public.books for select
  using (true);

-- Anyone can create a new book. This matches the brief (no login, upload
-- and go). If you later add authentication, tighten this to
-- `auth.uid() is not null`.
drop policy if exists "Anyone can create a book" on public.books;
create policy "Anyone can create a book"
  on public.books for insert
  with check (true);

-- Allows the app to backfill page_count after it renders a PDF for the
-- first time.
drop policy if exists "Anyone can update page count" on public.books;
create policy "Anyone can update page count"
  on public.books for update
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------
-- The bucket itself is created from the Dashboard (Storage -> New bucket
-- -> name it "pdfs" -> toggle "Public bucket" on) because bucket creation
-- via SQL requires the service role. The policies below make sure the
-- anon key can upload and read objects in that bucket once it exists.

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read access to PDFs" on storage.objects;
create policy "Public read access to PDFs"
  on storage.objects for select
  using (bucket_id = 'pdfs');

drop policy if exists "Anyone can upload a PDF" on storage.objects;
create policy "Anyone can upload a PDF"
  on storage.objects for insert
  with check (bucket_id = 'pdfs');
