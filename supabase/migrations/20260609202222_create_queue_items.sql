create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  media_type text not null check (media_type in ('book', 'movie', 'tv', 'music')),
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'finished', 'abandoned')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  source text,
  source_url text,
  notes text,
  cover_image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.queue_items enable row level security;

create policy "Users can read their own queue items"
on public.queue_items
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own queue items"
on public.queue_items
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own queue items"
on public.queue_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own queue items"
on public.queue_items
for delete
to authenticated
using (user_id = auth.uid());
