alter table public.queue_items
add column tags text[] not null default '{}'::text[];

create index queue_items_tags_idx
on public.queue_items using gin (tags);
