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
