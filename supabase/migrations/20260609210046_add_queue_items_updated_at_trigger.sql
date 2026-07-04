create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_queue_items_updated_at
before update on public.queue_items
for each row
execute function public.set_updated_at();
