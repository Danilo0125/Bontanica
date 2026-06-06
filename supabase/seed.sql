-- ============================================================================
-- Botánica RestoBar — schema + seed
-- Ejecutar en Supabase SQL Editor (proyecto wemyyuujnvqllmzwpozg).
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT donde corresponde.
-- ============================================================================

-- ── 1. Extensiones ─────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ── 2. Tablas ──────────────────────────────────────────────────────────────

create table if not exists public.products (
  id              text primary key,
  category_id     text not null,
  category_name   text not null,
  category_tag    text,
  name            text not null,
  description     text,
  price           numeric(10,2) not null check (price >= 0),
  sort_order      int not null default 0,
  is_active       bool not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_category_sort_idx
  on public.products (category_id, sort_order);

create table if not exists public.tables_pos (
  id         int primary key,
  name       text not null,
  is_active  bool not null default true
);

create table if not exists public.servers (
  id            text primary key,
  display_name  text not null,
  is_active     bool not null default true
);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  table_id          int not null references public.tables_pos(id),
  status            text not null default 'open'
                      check (status in ('open','paid','cancelled')),
  server_id         text references public.servers(id),
  total             numeric(10,2) not null default 0,
  payment_method    text check (payment_method in ('efectivo','qr')),
  received_amount   numeric(10,2),
  opened_at         timestamptz not null default now(),
  paid_at           timestamptz,
  notes             text
);
create unique index if not exists orders_one_open_per_table
  on public.orders (table_id)
  where status = 'open';
create index if not exists orders_status_opened_idx
  on public.orders (status, opened_at);
create index if not exists orders_table_status_idx
  on public.orders (table_id, status);

create table if not exists public.order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  product_id              text not null references public.products(id),
  product_name_snapshot   text not null,
  unit_price_snapshot     numeric(10,2) not null,
  qty                     int not null check (qty > 0),
  status                  text not null default 'pending'
                            check (status in ('pending','ready','cancelled')),
  server_id               text references public.servers(id),
  batch_id                uuid not null,
  sent_at                 timestamptz not null default now(),
  ready_at                timestamptz,
  notes                   text
);
create index if not exists order_items_order_idx
  on public.order_items (order_id);
create index if not exists order_items_status_sent_idx
  on public.order_items (status, sent_at);
create index if not exists order_items_batch_idx
  on public.order_items (batch_id);

-- ── 3. Trigger: updated_at en products ─────────────────────────────────────
-- search_path fijo en '' como buena práctica de seguridad (evita hijacking).
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.tg_set_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────

alter table public.products    enable row level security;
alter table public.tables_pos  enable row level security;
alter table public.servers     enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- products: lectura pública de activos, escritura solo service role
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to anon, authenticated using (is_active = true);

-- tables_pos: lectura pública de activas
drop policy if exists tables_pos_select on public.tables_pos;
create policy tables_pos_select on public.tables_pos
  for select to anon, authenticated using (is_active = true);

-- servers: lectura pública de activos
drop policy if exists servers_select on public.servers;
create policy servers_select on public.servers
  for select to anon, authenticated using (is_active = true);

-- orders: anon puede leer todo, insertar (con status='open'), y actualizar
-- columnas válidas (status open→paid/cancelled, total, payment_method,
-- received_amount, paid_at, notes).
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to anon, authenticated using (true);

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to anon, authenticated
  with check (status = 'open' and payment_method is null);

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to anon, authenticated
  using (status = 'open')
  with check (
    status in ('open','paid','cancelled')
    and (payment_method is null or payment_method in ('efectivo','qr'))
    and total >= 0
  );

-- order_items: anon puede leer todo, insertar (validando precio contra
-- products.price) y actualizar status / ready_at / notes.
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to anon, authenticated using (true);

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and qty > 0
    and unit_price_snapshot = (
      select price from public.products where id = product_id
    )
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.status = 'open'
    )
  );

-- Solo se puede actualizar items 'pending' (cocina marca como 'ready' o 'cancelled').
-- Esto bloquea revertir un item ya marcado.
drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
  for update to anon, authenticated
  using (status = 'pending')
  with check (status in ('pending','ready','cancelled'));

-- ── 5. Realtime publication ────────────────────────────────────────────────
-- Habilita propagar cambios de orders/order_items a clientes suscritos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'order_items'
  ) then
    execute 'alter publication supabase_realtime add table public.order_items';
  end if;
end$$;

-- ── 6. Seed ────────────────────────────────────────────────────────────────

-- Servers
insert into public.servers (id, display_name) values
  ('ochito','Ochito'),
  ('nath','Nath')
on conflict (id) do update set display_name = excluded.display_name;

-- Mesas (18)
insert into public.tables_pos (id, name)
select i, 'Mesa ' || i from generate_series(1, 18) as i
on conflict (id) do nothing;

-- Productos (los actuales del data.js)
insert into public.products
  (id, category_id, category_name, category_tag, name, description, price, sort_order)
values
  ('sangria',       'cocteles',  'Cócteles & Sangrías','Refrescante','Sangría en vaso','Vino tinto, frutas de estación y un toque cítrico.', 25,  1),
  ('mojito-vaso',   'cocteles',  'Cócteles & Sangrías','Refrescante','Mojito en vaso','Ron, hierbabuena fresca, lima y soda.',                30,  2),
  ('mojito-jarra',  'cocteles',  'Cócteles & Sangrías','Refrescante','Mojito en jarra','Para compartir · rinde 4 vasos.',                      80,  3),
  ('copa-vino',     'vinos',     'Vinos','De la casa','Copa de vino','Tinto o blanco de la casa.',                                            25,  1),
  ('botella-vino',  'vinos',     'Vinos','De la casa','Vino en botella','Botella cerrada para la mesa.',                                     150,  2),
  ('pizza-tajada',  'compartir', 'Para compartir','Cocina','Pizza por tajada','Masa madre, horneada al momento.',                             15,  1),
  ('pizza-entera',  'compartir', 'Para compartir','Cocina','Pizza entera','8 porciones · ideal para la mesa.',                                90,  2),
  ('tablitas',      'compartir', 'Para compartir','Cocina','Tablitas','Selección de quesos, fiambres y encurtidos.',                          65,  3)
on conflict (id) do update set
  category_id   = excluded.category_id,
  category_name = excluded.category_name,
  category_tag  = excluded.category_tag,
  name          = excluded.name,
  description   = excluded.description,
  price         = excluded.price,
  sort_order    = excluded.sort_order;
