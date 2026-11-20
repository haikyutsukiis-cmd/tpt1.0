alter table public.master_data
  add column if not exists qty_in_progress integer not null default 0
    check (qty_in_progress >= 0),
  add column if not exists qty_shipped integer not null default 0
    check (qty_shipped >= 0);

create table if not exists public.material_inventory (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  material_name text not null,
  material_size text not null,
  product_name text not null,
  quantity_pcs integer not null default 0 check (quantity_pcs >= 0),
  quantity_bars integer not null default 0 check (quantity_bars >= 0),
  equivalent_pcs integer not null default 0 check (equivalent_pcs >= 0),
  check (
    (quantity_bars = 0 and equivalent_pcs = quantity_pcs)
    or (quantity_pcs = 0 and quantity_bars > 0 and equivalent_pcs > 0)
  ),
  created_at timestamptz not null default now()
);

create index if not exists material_inventory_created_at_idx
  on public.material_inventory (created_at desc);

alter table public.material_inventory enable row level security;

drop policy if exists "operators can read master data" on public.master_data;
create policy "operators can read master data"
  on public.master_data for select to authenticated
  using (public.current_profile_role() = 'operator');

drop policy if exists "admins can manage material inventory" on public.material_inventory;
create policy "admins can manage material inventory"
  on public.material_inventory for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

grant select on public.master_data to authenticated;
grant select, insert, update, delete on public.material_inventory to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'master_data'
  ) then
    execute 'alter publication supabase_realtime add table public.master_data';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'material_inventory'
  ) then
    execute 'alter publication supabase_realtime add table public.material_inventory';
  end if;
end
$$;
