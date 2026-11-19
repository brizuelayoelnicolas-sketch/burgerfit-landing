// Capa de datos del navegador: habla con la API (src/pages/api) que guarda en Neon.

export type Product = { id: string; name: string; kind: "unidad" | "combo"; qty: number; price: number; description: string; active: boolean };
export type OrderStatus = "pendiente" | "preparando" | "listo" | "entregado" | "cancelado";
export type DeliveryMethod = "envio" | "retiro" | "colegio";
export type PaymentMethod = "efectivo" | "transferencia" | "mercadopago";
export type OrderItem = { productId: string; name: string; qty: number; unitPrice: number };
export type Order = {
  id: string; number: number; createdAt: string; status: OrderStatus;
  customer: { name: string; phone: string; email: string };
  items: OrderItem[];
  delivery: { method: DeliveryMethod; address: string; zone: string; reference: string; schoolInfo: string };
  payment: { method: PaymentMethod; cashWith: number | null; paid: boolean };
  notes: string; total: number;
};
export type User = { id: string; name: string; username: string; password?: string; role: "admin" | "cocina" | "reparto"; active: boolean };
export type StockItem = { id: string; name: string; initial: number; minimum: number; unit_cost: number };
export type StockEntry = { id: string; item_id: string; date: string; qty: number; price: number; supplier: string; pay_method: PaymentMethod };
export type Sale = { id: string; order_id: string | null; date: string; customer: string; product: string; burgers: number; price: number; total: number };
export const money = (n: number) => `$${n.toLocaleString("es-AR")}`;
/** Clave estable de un producto para los botones de la web: "unidad", "combo-3", "combo-5". */
export const productKey = (p: Product) => (p.kind === "unidad" ? "unidad" : `combo-${p.qty}`);

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || "Ocurrió un error. Probá de nuevo.");
  return data as T;
}

export const api = {
  listProducts: (onlyActive = false) => call<Product[]>("GET", onlyActive ? "products" : "products?all=1"),
  saveProduct: (p: Partial<Product> & { name: string }) => (p.id ? call<Product>("PUT", `products/${p.id}`, p) : call<Product>("POST", "products", p)),
  deleteProduct: (id: string) => call("DELETE", `products/${id}`),

  listOrders: () => call<Order[]>("GET", "orders"),
  createOrder: (data: Omit<Order, "id" | "number" | "createdAt" | "status">) => call<Order>("POST", "orders", data),
  updateOrder: (id: string, patch: { status?: OrderStatus; paid?: boolean }) => call("PATCH", `orders/${id}`, patch),
  deleteOrder: (id: string) => call("DELETE", `orders/${id}`),

  listUsers: () => call<User[]>("GET", "users"),
  saveUser: (u: Partial<User> & { name: string; username: string }) => (u.id ? call<User>("PUT", `users/${u.id}`, u) : call<User>("POST", "users", u)),
  deleteUser: (id: string) => call("DELETE", `users/${id}`),

  stockAll: () => call<{ items: StockItem[]; entries: StockEntry[]; sales: Sale[] }>("GET", "stock/all"),
  saveStockItem: (i: Partial<StockItem> & { name: string }) => (i.id ? call("PUT", `stock/items/${i.id}`, i) : call("POST", "stock/items", i)),
  deleteStockItem: (id: string) => call("DELETE", `stock/items/${id}`),
  addStockEntries: (e: object | object[]) => call("POST", "stock/entries", e),
  deleteStockEntry: (id: string) => call("DELETE", `stock/entries/${id}`),
  addSale: (s: { date: string; customer: string; productId: string; qty: number }) => call("POST", "stock/sales", s),
  deleteSale: (id: string) => call("DELETE", `stock/sales/${id}`),

  login: async (username: string, password: string): Promise<User | null> => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (r.status === 401) return null;
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || "No se pudo conectar con el servidor.");
    return data as User;
  },
  currentUser: () => call<User | null>("GET", "auth/me").catch(() => null),
  logout: () => call("POST", "auth/logout", {}).catch(() => null),
};
