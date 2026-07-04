create index queue_items_user_id_idx
on public.queue_items (user_id);

create index queue_items_user_id_created_at_idx
on public.queue_items (user_id, created_at desc);

create index queue_items_user_id_media_type_idx
on public.queue_items (user_id, media_type);

create index queue_items_user_id_status_idx
on public.queue_items (user_id, status);

create index queue_items_user_id_priority_idx
on public.queue_items (user_id, priority);
