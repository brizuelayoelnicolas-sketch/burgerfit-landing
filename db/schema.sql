-- Burgerfit · esquema para Neon (PostgreSQL)
-- Ejecutalo en el SQL Editor de Neon. Los nombres coinciden con src/lib/store.ts.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  username      text not null unique,
  password_hash text not null,               -- guardar con bcrypt/argon2, nunca en texto plano
  role          text not null default 'cocina' check (role in ('admin','cocina','reparto')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- "Publicaciones" de la web: hamburguesa por unidad y combos
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('unidad','combo')),
  qty         int  not null default 1 check (qty > 0),   -- hamburguesas que incluye
  price       int  not null check (price >= 0),          -- en pesos
  description text not null default '',
  active      boolean not null default true,             -- visible en la web
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  number          serial unique,                          -- número corto para el cliente
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text,
  delivery_method text not null check (delivery_method in ('envio','retiro','colegio')),
  address         text,
  zone            text,
  reference       text,
  school_info     text,                                   -- colegio / curso / recreo
  payment_method  text not null check (payment_method in ('efectivo','transferencia','mercadopago')),
  cash_with       int,                                    -- con cuánto paga (efectivo)
  paid            boolean not null default false,
  notes           text,
  total           int not null,
  status          text not null default 'pendiente'
                  check (status in ('pendiente','preparando','listo','entregado','cancelado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,       -- copia del nombre al momento de la compra
  qty        int  not null check (qty > 0),
  unit_price int  not null
);

create index if not exists orders_status_idx  on orders (status, created_at desc);
create index if not exists order_items_order  on order_items (order_id);

insert into products (name, kind, qty, price, description) values
  ('Hamburguesa Burgerfit', 'unidad', 1, 2000, 'Carne, queso, lechuga, tomate, mayonesa y pan de hamburguesa.'),
  ('Combo x3',              'combo',  3, 5500, 'Tres hamburguesas Burgerfit.'),
  ('Combo x5',              'combo',  5, 8500, 'Cinco hamburguesas Burgerfit.')
on conflict do nothing;

-- Control de stock (planilla del administrador)
create table if not exists stock_items (id uuid primary key default gen_random_uuid(), sort serial, name text not null unique, initial int not null default 0 check (initial >= 0), minimum int not null default 0 check (minimum >= 0), unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0), created_at timestamptz not null default now());

create table if not exists stock_entries (id uuid primary key default gen_random_uuid(), item_id uuid not null references stock_items(id) on delete cascade, entry_date date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date, qty int not null check (qty > 0), price int not null default 0 check (price >= 0), supplier text not null default '', pay_method text not null default 'efectivo' check (pay_method in ('efectivo','transferencia','mercadopago')), created_at timestamptz not null default now());

create table if not exists sales (id uuid primary key default gen_random_uuid(), order_id uuid unique references orders(id) on delete set null, sale_date date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date, customer text not null default '', product text not null, burgers int not null check (burgers > 0), price int not null default 0, total int not null default 0, created_at timestamptz not null default now());

-- Cada hamburguesa vendida descuenta 1 unidad de cada insumo.
-- Stock actual = stock inicial + entradas (stock_entries) - salidas (suma de sales.burgers)
insert into stock_items (name, minimum, unit_cost) values
  ('Carne',30,346),('Panes',30,200),('Queso',30,227.33),('Lechuga y tomate',30,183.33),
  ('Mayonesa',30,100),('Papel aluminio',30,241.67),('Papel autoadhesivo',30,62.5)
on conflict do nothing;
