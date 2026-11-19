import type { APIRoute } from "astro";
import { q, ensureSchema, hash, verify, makeToken, readToken } from "../../lib/server";

export const prerender = false;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

const product = (r: any) => ({ id: r.id, name: r.name, kind: r.kind, qty: r.qty, price: r.price, description: r.description, active: r.active });
const user = (r: any) => ({ id: r.id, name: r.name, username: r.username, role: r.role, active: r.active });
const order = (r: any, items: any[]) => ({
  id: r.id, number: r.number, createdAt: r.created_at, status: r.status, total: r.total, notes: r.notes || "",
  customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email || "" },
  items: items.filter((i) => i.order_id === r.id).map((i) => ({ productId: i.product_id, name: i.name, qty: i.qty, unitPrice: i.unit_price })),
  delivery: { method: r.delivery_method, address: r.address || "", zone: r.zone || "", reference: r.reference || "", schoolInfo: r.school_info || "" },
  payment: { method: r.payment_method, cashWith: r.cash_with, paid: r.paid },
});
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);

const handler: APIRoute = async ({ request, params, cookies }) => {
  try {
    if (params.route === "auth/logout") { cookies.delete("bf_session", { path: "/" }); return json({ ok: true }); }
    await ensureSchema();
    const [res, id] = (params.route || "").split("/");
    const m = request.method;
    const body: any = m === "GET" || m === "DELETE" ? {} : await request.json().catch(() => ({}));

    const me = async () => {
      const uid = readToken(cookies.get("bf_session")?.value);
      if (!uid) return null;
      const r = await q("select * from users where id = $1 and active", [uid]);
      return r[0] ? user(r[0]) : null;
    };

    // --- Sesión ---
    if (res === "auth") {
      if (id === "login" && m === "POST") {
        const r = (await q("select * from users where username = $1 and active", [str(body.username, 60)]))[0];
        if (!r || !(await verify(String(body.password || ""), r.password_hash))) return fail("Usuario o contraseña incorrectos.", 401);
        cookies.set("bf_session", makeToken(r.id), { httpOnly: true, sameSite: "lax", secure: import.meta.env.PROD, path: "/" }); // cookie de sesión: se borra al cerrar el navegador
        return json(user(r));
      }
      return json(await me());
    }

    // --- Público: catálogo y crear pedido ---
    if (res === "products" && m === "GET" && !id) {
      const admin = await me();
      const all = admin?.role === "admin" && new URL(request.url).searchParams.get("all");
      const rows = await q(`select * from products ${all ? "" : "where active"} order by kind desc, qty`);
      return json(rows.map(product));
    }
    if (res === "orders" && m === "POST") {
      const it = (body.items || [])[0];
      const prod = (await q("select * from products where id::text = $1 and active", [str(it?.productId, 60)]))[0];
      const qty = Math.min(20, Math.max(1, int(it?.qty)));
      const method = oneOf(body.delivery?.method, ["envio", "retiro", "colegio"] as const);
      const pay = oneOf(body.payment?.method, ["efectivo", "transferencia", "mercadopago"] as const);
      const c = body.customer || {}, d = body.delivery || {};
      if (!prod || !method || !pay) return fail("Pedido inválido.");
      if (str(c.name).length < 3 || str(c.phone).replace(/\D/g, "").length < 8) return fail("Faltan datos de contacto.");
      if (method === "envio" && (str(d.address).length < 4 || !str(d.zone))) return fail("Falta la dirección de envío.");
      if (method === "colegio" && str(d.schoolInfo).length < 4) return fail("Falta el colegio, curso y recreo.");
      const total = prod.price * qty; // el precio siempre se calcula en el servidor
      const o = (await q(
        `insert into orders (customer_name, customer_phone, customer_email, delivery_method, address, zone, reference, school_info, payment_method, cash_with, notes, total)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [str(c.name), str(c.phone, 30), str(c.email), method, str(d.address), str(d.zone), str(d.reference), str(d.schoolInfo), pay,
         pay === "efectivo" && body.payment?.cashWith ? int(body.payment.cashWith) : null, str(body.notes, 500), total]))[0];
      const items = await q("insert into order_items (order_id, product_id, name, qty, unit_price) values ($1,$2,$3,$4,$5) returning *", [o.id, prod.id, prod.name, qty, prod.price]);
      return json(order(o, items), 201);
    }

    // --- Panel: todo lo demás requiere sesión ---
    const admin = await me();
    if (!admin) return fail("Iniciá sesión para continuar.", 401);

    const isAdmin = admin.role === "admin";
    if (res === "orders") {
      if (m === "GET") {
        const rows = await q("select * from orders order by number desc limit 500");
        const items = rows.length ? await q("select * from order_items where order_id = any($1::uuid[])", [rows.map((r) => r.id)]) : [];
        return json(rows.map((r) => order(r, items)));
      }
      if (m === "PATCH" && id) {
        const st = body.status === undefined ? null : oneOf(body.status, ["pendiente", "preparando", "listo", "entregado", "cancelado"] as const);
        if (body.status !== undefined && !st) return fail("Estado inválido.");
        // Cocina y reparto solo avanzan el pedido; cancelar y cobrar es de administración
        if (!isAdmin && (body.paid !== undefined || !st || !["preparando", "listo", "entregado"].includes(st))) return fail("No tenés permiso para esta acción.", 403);
        await q("update orders set status = coalesce($2, status), paid = coalesce($3::boolean, paid), updated_at = now() where id = $1", [id, st, typeof body.paid === "boolean" ? body.paid : null]);
        return json({ ok: true });
      }
      if (m === "DELETE" && id) { if (!isAdmin) return fail("No tenés permiso para esta acción.", 403); await q("delete from orders where id = $1", [id]); return json({ ok: true }); }
    }

    if (res === "products") {
      if (!isAdmin) return fail("Solo un administrador puede gestionar los productos.", 403);
      if (m === "POST" || (m === "PUT" && id)) {
        const kind = oneOf(body.kind, ["unidad", "combo"] as const);
        if (str(body.name).length < 2 || !kind) return fail("Completá nombre y tipo.");
        const vals = [str(body.name), kind, Math.max(1, int(body.qty)), int(body.price), str(body.description, 300), body.active !== false];
        const r = m === "POST"
          ? await q("insert into products (name, kind, qty, price, description, active) values ($1,$2,$3,$4,$5,$6) returning *", vals)
          : await q("update products set name=$2, kind=$3, qty=$4, price=$5, description=$6, active=$7 where id=$1 returning *", [id, ...vals]);
        return json(product(r[0]));
      }
      if (m === "DELETE" && id) { await q("delete from products where id = $1", [id]); return json({ ok: true }); }
    }

    if (res === "users") {
      if (admin.role !== "admin") return fail("Solo un administrador puede gestionar usuarios.", 403);
      if (m === "GET") return json((await q("select * from users order by created_at")).map(user));
      if (m === "POST" || (m === "PUT" && id)) {
        const role = oneOf(body.role, ["admin", "cocina", "reparto"] as const);
        if (str(body.name).length < 2 || str(body.username).length < 3 || !role) return fail("Completá nombre, usuario y rol.");
        if (m === "POST" && String(body.password || "").length < 6) return fail("La contraseña debe tener al menos 6 caracteres.");
        if (m === "PUT" && id === admin.id && (body.active === false || role !== "admin")) return fail("No podés quitarte el acceso a vos mismo.");
        try {
          const r = m === "POST"
            ? await q("insert into users (name, username, password_hash, role, active) values ($1,$2,$3,$4,$5) returning *", [str(body.name), str(body.username, 60), await hash(String(body.password)), role, body.active !== false])
            : await q("update users set name=$2, username=$3, role=$4, active=$5, password_hash = coalesce($6, password_hash) where id=$1 returning *", [id, str(body.name), str(body.username, 60), role, body.active !== false, body.password ? await hash(String(body.password)) : null]);
          return json(user(r[0]));
        } catch (e: any) { return fail(/unique|duplicate/i.test(String(e?.message)) ? "Ese nombre de usuario ya existe." : "No se pudo guardar el usuario."); }
      }
      if (m === "DELETE" && id) {
        if (id === admin.id) return fail("No podés eliminar tu propio usuario.");
        await q("delete from users where id = $1", [id]); return json({ ok: true });
      }
    }
    return fail("No encontrado.", 404);
  } catch (e) {
    console.error(e);
    return fail("Error del servidor. Revisá la conexión con la base de datos.", 500);
  }
};
export const ALL = handler;
