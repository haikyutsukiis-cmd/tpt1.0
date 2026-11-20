create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operator', 'admin', 'boss')),
  display_name text not null,
  created_at timestamptz not null default now(),
  check (
    role <> 'operator'
    or display_name in ('AMRI', 'M. RIPAI', 'ERWIN', 'AGUS', 'SIGIT', 'HAFIDZ')
  )
);

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id),
  operator_name text not null,
  shift_date date not null,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  verification_status text not null default 'Pending'
    check (verification_status in ('Pending', 'Terverifikasi', 'Tidak disetujui')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (operator_id, shift_date)
);

create table if not exists public.production_reports (
  id uuid primary key default gen_random_uuid(),
  spk_code text not null unique default ('SPK-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  operator_id uuid not null references public.profiles(id),
  operator_name text not null,
  machine text not null,
  item_name text not null,
  op_name text not null,
  qty_oke integer not null default 0 check (qty_oke >= 0),
  qty_repair integer not null default 0 check (qty_repair >= 0),
  qty_ng integer not null default 0 check (qty_ng >= 0),
  verification_status text not null default 'Pending'
    check (verification_status in ('Pending', 'Terverifikasi', 'Tidak disetujui')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.master_data (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  item_name text not null,
  quantity integer not null check (quantity >= 0),
  po_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.tools_inventory (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  specification text not null,
  quantity integer not null check (quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tool_usage (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools_inventory(id) on delete restrict,
  operator_id uuid not null references public.profiles(id),
  operator_name text not null,
  machine text not null,
  quantity integer not null check (quantity > 0),
  item_condition text not null check (item_condition in ('Baru', 'Bekas')),
  usage_status text not null default 'Dipakai'
    check (usage_status in ('Dipakai', 'Dikembalikan')),
  return_condition text
    check (return_condition in ('Tumpul', 'Patah', 'Masih Layak / Bekas')),
  created_at timestamptz not null default now(),
  returned_at timestamptz
);

create index if not exists attendance_records_shift_date_idx
  on public.attendance_records (shift_date desc);
create index if not exists production_reports_created_at_idx
  on public.production_reports (created_at desc);
create index if not exists master_data_created_at_idx
  on public.master_data (created_at desc);
create index if not exists tools_inventory_created_at_idx
  on public.tools_inventory (created_at desc);
create index if not exists tool_usage_tool_status_idx
  on public.tool_usage (tool_id, usage_status);
create index if not exists tool_usage_operator_created_at_idx
  on public.tool_usage (operator_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.attendance_records enable row level security;
alter table public.production_reports enable row level security;
alter table public.master_data enable row level security;
alter table public.tools_inventory enable row level security;
alter table public.tool_usage enable row level security;

drop policy if exists "users can read their own profile" on public.profiles;
drop policy if exists "operators and managers can read attendance" on public.attendance_records;
drop policy if exists "admins can review attendance" on public.attendance_records;
drop policy if exists "operators and managers can read production" on public.production_reports;
drop policy if exists "admins can review production" on public.production_reports;
drop policy if exists "admins can manage master data" on public.master_data;
drop policy if exists "admins can manage tools inventory" on public.tools_inventory;
drop policy if exists "operators can read tools inventory" on public.tools_inventory;
drop policy if exists "operators and admins can read tool usage" on public.tool_usage;

create policy "users can read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_profile_role() = 'admin');

create policy "operators and managers can read attendance"
  on public.attendance_records for select to authenticated
  using (
    public.current_profile_role() in ('admin', 'boss')
    or operator_id = auth.uid()
  );

create policy "admins can review attendance"
  on public.attendance_records for update to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "operators and managers can read production"
  on public.production_reports for select to authenticated
  using (
    public.current_profile_role() in ('admin', 'boss')
    or operator_id = auth.uid()
  );

create policy "admins can review production"
  on public.production_reports for update to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "admins can manage master data"
  on public.master_data for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "admins can manage tools inventory"
  on public.tools_inventory for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "operators can read tools inventory"
  on public.tools_inventory for select to authenticated
  using (public.current_profile_role() = 'operator');

create policy "operators and admins can read tool usage"
  on public.tool_usage for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or operator_id = auth.uid()
  );

grant select on public.profiles to authenticated;
grant select on public.attendance_records to authenticated;
grant update (verification_status, reviewed_at) on public.attendance_records to authenticated;
grant select on public.production_reports to authenticated;
grant update (verification_status, reviewed_at) on public.production_reports to authenticated;
grant select, insert, update, delete on public.master_data to authenticated;
grant select, insert, update, delete on public.tools_inventory to authenticated;
grant select on public.tool_usage to authenticated;

create or replace function public.operator_clock_in(p_shift_date date)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.attendance_records;
  profile_name text;
begin
  if public.current_profile_role() <> 'operator' then
    raise exception 'Only operator accounts can clock in';
  end if;

  select display_name into profile_name
  from public.profiles where id = auth.uid();

  insert into public.attendance_records (operator_id, operator_name, shift_date)
  values (auth.uid(), profile_name, p_shift_date)
  on conflict (operator_id, shift_date) do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.attendance_records
    where operator_id = auth.uid() and shift_date = p_shift_date;
  end if;
  return result;
end;
$$;

create or replace function public.operator_clock_out(p_attendance_id uuid)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.attendance_records;
begin
  if public.current_profile_role() <> 'operator' then
    raise exception 'Only operator accounts can clock out';
  end if;

  if not exists (
    select 1 from public.production_reports
    where operator_id = auth.uid()
      and (created_at at time zone 'Asia/Jakarta')::date =
        (now() at time zone 'Asia/Jakarta')::date
  ) then
    raise exception 'Submit a production report before clocking out';
  end if;

  update public.attendance_records
  set check_out = now()
  where id = p_attendance_id
    and operator_id = auth.uid()
    and check_out is null
  returning * into result;

  if result.id is null then
    raise exception 'Attendance record not found or already clocked out';
  end if;
  return result;
end;
$$;

create or replace function public.operator_submit_production_report(
  p_machine text,
  p_item_name text,
  p_op_name text,
  p_qty_oke integer,
  p_qty_repair integer,
  p_qty_ng integer
)
returns public.production_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.production_reports;
  profile_name text;
begin
  if public.current_profile_role() <> 'operator' then
    raise exception 'Only operator accounts can submit production reports';
  end if;

  if not exists (
    select 1 from public.attendance_records
    where operator_id = auth.uid()
      and shift_date = (now() at time zone 'Asia/Jakarta')::date
      and check_out is null
  ) then
    raise exception 'Clock in before submitting a production report';
  end if;

  select display_name into profile_name
  from public.profiles where id = auth.uid();

  insert into public.production_reports (
    operator_id, operator_name, machine, item_name, op_name,
    qty_oke, qty_repair, qty_ng
  ) values (
    auth.uid(), profile_name, trim(p_machine), trim(p_item_name), trim(p_op_name),
    p_qty_oke, p_qty_repair, p_qty_ng
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.operator_take_tool(
  p_tool_id uuid,
  p_quantity integer,
  p_machine text,
  p_item_condition text
)
returns public.tool_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.tool_usage;
  profile_name text;
begin
  if public.current_profile_role() <> 'operator' then
    raise exception 'Only operator accounts can take tools';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Tool quantity must be greater than zero';
  end if;
  if nullif(trim(p_machine), '') is null then
    raise exception 'Machine is required';
  end if;
  if p_item_condition is null or p_item_condition not in ('Baru', 'Bekas') then
    raise exception 'Invalid tool condition';
  end if;

  update public.tools_inventory
  set quantity = quantity - p_quantity
  where id = p_tool_id and quantity >= p_quantity;
  if not found then
    raise exception 'Tool not found or available stock is insufficient';
  end if;

  select display_name into profile_name
  from public.profiles where id = auth.uid();

  insert into public.tool_usage (
    tool_id, operator_id, operator_name, machine, quantity, item_condition
  ) values (
    p_tool_id, auth.uid(), profile_name, trim(p_machine), p_quantity, p_item_condition
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.operator_return_tool(
  p_usage_id uuid,
  p_return_condition text
)
returns public.tool_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_record public.tool_usage;
  result public.tool_usage;
begin
  if public.current_profile_role() <> 'operator' then
    raise exception 'Only operator accounts can return tools';
  end if;
  if p_return_condition is null or
     p_return_condition not in ('Tumpul', 'Patah', 'Masih Layak / Bekas') then
    raise exception 'Invalid return condition';
  end if;

  select * into usage_record
  from public.tool_usage
  where id = p_usage_id and operator_id = auth.uid() and usage_status = 'Dipakai'
  for update;
  if not found then
    raise exception 'Active tool usage record not found';
  end if;

  update public.tool_usage
  set usage_status = 'Dikembalikan',
      return_condition = p_return_condition,
      returned_at = now()
  where id = usage_record.id
  returning * into result;

  if p_return_condition = 'Masih Layak / Bekas' then
    update public.tools_inventory
    set quantity = quantity + usage_record.quantity
    where id = usage_record.tool_id;
  end if;
  return result;
end;
$$;

revoke all on function public.operator_clock_in(date) from public;
revoke all on function public.operator_clock_out(uuid) from public;
revoke all on function public.operator_submit_production_report(text, text, text, integer, integer, integer) from public;
revoke all on function public.operator_take_tool(uuid, integer, text, text) from public;
revoke all on function public.operator_return_tool(uuid, text) from public;
grant execute on function public.operator_clock_in(date) to authenticated;
grant execute on function public.operator_clock_out(uuid) to authenticated;
grant execute on function public.operator_submit_production_report(text, text, text, integer, integer, integer) to authenticated;
grant execute on function public.operator_take_tool(uuid, integer, text, text) to authenticated;
grant execute on function public.operator_return_tool(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_records'
  ) then
    execute 'alter publication supabase_realtime add table public.attendance_records';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'production_reports'
  ) then
    execute 'alter publication supabase_realtime add table public.production_reports';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tools_inventory'
  ) then
    execute 'alter publication supabase_realtime add table public.tools_inventory';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tool_usage'
  ) then
    execute 'alter publication supabase_realtime add table public.tool_usage';
  end if;
end
$$;