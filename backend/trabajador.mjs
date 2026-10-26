// COPHONE: API para Cloudflare Pages + D1. No requiere paquetes externos.
const COOKIE = "__Host-cophone_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
const ORDER_STATUSES = ["recibida", "en_revision", "confirmada", "cancelada"];
const securityHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Vary": "Cookie, Origin"
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {...securityHeaders, ...headers}});
const now = () => Math.floor(Date.now() / 1000);
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async text => hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};
function settings(env) {
  try {
    const value = JSON.parse(env.COPHONE_CONFIG || "{}");
    if (!value.passwordPepper || !value.adminEmail || !value.adminSetupHash) throw new Error();
    return value;
  } catch { fail(503, "Las cuentas están en mantenimiento. Inténtalo más tarde."); }
}
function text(value, label, maximum = 120, minimum = 0) {
  if (typeof value !== "string") fail(400, `${label}: valor no válido.`);
  const clean = value.trim();
  if (clean.length < minimum || clean.length > maximum || /[\u0000-\u001f]/.test(clean)) fail(400, `${label}: revisa la longitud o los caracteres.`);
  return clean;
}
function email(value) {
  const clean = text(value, "Correo", 254, 5).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) fail(400, "Introduce un correo válido.");
  return clean;
}
function password(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) fail(400, "La contraseña debe tener entre 12 y 128 caracteres.");
  return value;
}
async function passwordHash(value, salt, pepper) {
  const pepperKey = await crypto.subtle.importKey("raw", encoder.encode(pepper), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const material = await crypto.subtle.sign("HMAC", pepperKey, encoder.encode(value));
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(salt),iterations:100000}, key, 256));
}
async function readBody(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) fail(415, "Se requiere JSON.");
  if (Number(request.headers.get("Content-Length")) > 32768) fail(413, "La solicitud es demasiado grande.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Faltan los datos.");
  const chunks = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > 32768) { await reader.cancel(); fail(413, "La solicitud es demasiado grande."); }
    chunks.push(chunk.value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder().decode(data));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { fail(400, "Los datos enviados no son válidos."); }
}
function guardOrigin(request, url) {
  if (["GET", "HEAD"].includes(request.method)) return;
  if (request.headers.get("Origin") !== url.origin || request.headers.get("X-Cophone-Request") !== "1") fail(403, "Origen no permitido.");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") fail(403, "Origen no permitido.");
}
async function limit(db, request, bucket, maximum, seconds, suffix = "") {
  const stamp = now();
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const key = await digest(`${bucket}:${ip}:${suffix}:${Math.floor(stamp / seconds)}`);
  const row = await db.prepare("INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 WHERE hits<? RETURNING hits").bind(key, stamp + seconds * 2, maximum).first();
  if (!row) fail(429, "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
}
function publicUser(user) {
  return {id:user.id,email:user.email,name:user.name,phone:user.phone,city:user.city,address:user.address,role:user.role,createdAt:user.created_at};
}
function parseCookie(request) {
  const token = (request.headers.get("Cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token || "") ? token : null;
}
async function session(db, request, required = true) {
  const token = parseCookie(request);
  if (!token) { if (required) fail(401, "Inicia sesión para continuar."); return null; }
  const hash = await digest(token);
  const user = await db.prepare("SELECT u.*,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0").bind(hash, now()).first();
  if (!user && required) fail(401, "Tu sesión caducó. Vuelve a entrar.");
  return user;
}
async function administrator(db, request) {
  const user = await session(db, request);
  if (user.role !== "admin") fail(403, "Esta acción requiere una cuenta administradora.");
  return user;
}
async function newSession(db, userId) {
  const token = random();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at<=? OR (user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 4))").bind(now(), userId, userId),
    db.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await digest(token), userId, now(), now()+SESSION_SECONDS),
    db.prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at<? LIMIT 100)").bind(now())
  ]);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}
function productOutput(row) {
  return {id:row.id,name:row.name,category:row.category,tag:row.tag,price:row.price_cents/100,storage:row.storage,spec:row.spec,features:JSON.parse(row.features_json),device:row.color,wallpaper:`linear-gradient(145deg,#102342,${row.color} 60%,#bddcf2)`,stock:row.stock,active:Boolean(row.active)};
}
function productInput(data, existingId = null) {
  const id = existingId || text(data.id, "Identificador", 40, 2);
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) fail(400, "Usa letras minúsculas, números y guiones en el identificador.");
  const category = text(data.category, "Categoría", 20, 1);
  if (!["premium","fold","value"].includes(category)) fail(400, "Categoría no válida.");
  if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 1 || data.price > 999999) fail(400, "Precio no válido.");
  if (!Number.isInteger(data.stock) || data.stock < 0 || data.stock > 99999) fail(400, "Stock no válido.");
  if (typeof data.active !== "boolean") fail(400, "Estado de producto no válido.");
  const features = data.features;
  if (!Array.isArray(features) || features.length < 1 || features.length > 8) fail(400, "Añade de 1 a 8 características.");
  const color = text(data.color, "Color", 7, 7);
  if (!/^#[a-f0-9]{6}$/i.test(color)) fail(400, "Color no válido.");
  return [id,text(data.name,"Nombre",100,2),category,text(data.tag,"Etiqueta",40),Math.round(data.price*100),text(data.storage,"Almacenamiento",30,1),text(data.spec,"Resumen",200,1),JSON.stringify(features.map(value => text(value,"Característica",140,1))),color,data.stock,data.active?1:0,now()];
}
function stateInput(data) {
  const favorites = data.favorites;
  const cart = data.cart;
  if (!Array.isArray(favorites) || favorites.length > 100 || !Array.isArray(cart) || cart.length > 50) fail(400, "La selección es demasiado grande.");
  const validId = id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/.test(id);
  if (favorites.some(id => !validId(id)) || cart.some(item => !item || !validId(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)) fail(400, "Selección no válida.");
  const unique = new Map(cart.map(item => [item.id,{id:item.id,qty:item.qty}]));
  return {favorites:[...new Set(favorites)],cart:[...unique.values()]};
}
function orderOutput(row) {
  return {id:row.id,userId:row.user_id,name:row.customer_name,email:row.customer_email,items:JSON.parse(row.items_json),total:row.total_cents/100,status:row.status,paymentStatus:"proximamente",createdAt:row.created_at,note:row.note};
}

async function api(request, env, url) {
  if (!env.DB) fail(503, "Las cuentas están en mantenimiento. Inténtalo más tarde.");
  const db = env.DB;
  guardOrigin(request, url);
  const route = `${request.method} ${url.pathname}`;
  if (route === "GET /api/health") return json({ok:true,service:"cophone",payments:"proximamente"});
  if (route === "GET /api/products") {
    const rows = await db.prepare("SELECT * FROM products WHERE active=1 ORDER BY sort_order,id LIMIT 200").all();
    return json({products:rows.results.map(productOutput)});
  }
  if (route === "POST /api/auth/register") {
    await limit(db,request,"register",5,3600);
    const config = settings(env);
    const data = await readBody(request);
    const address = email(data.email);
    const name = text(data.name,"Nombre",80,2);
    const pass = password(data.password);
    const owner = address === config.adminEmail.toLowerCase();
    if (owner && !safeEqual(await digest(String(data.setupCode || "")),config.adminSetupHash)) fail(403,"Este correo está reservado. Introduce el código privado de activación del administrador.");
    if (await db.prepare("SELECT id FROM users WHERE email=?").bind(address).first()) fail(409,"No se pudo crear la cuenta con ese correo. Prueba iniciar sesión.");
    if (owner && await db.prepare("SELECT value FROM settings WHERE key='admin_activated'").first()) fail(409,"La administración ya fue activada.");
    const id = crypto.randomUUID();
    const salt = random();
    const hash = await passwordHash(pass,salt,config.passwordPepper);
    const insert = db.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,address,name,hash,salt,owner?"admin":"user",now(),now());
    try {
      if (owner) await db.batch([db.prepare("INSERT INTO settings (key,value) VALUES ('admin_activated',?)").bind(id),insert]);
      else await insert.run();
    } catch (error) {
      if (String(error).includes("UNIQUE")) fail(409,"No se pudo crear la cuenta. Prueba iniciar sesión.");
      throw error;
    }
    const cookie = await newSession(db,id);
    const user = await db.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
    return json({user:publicUser(user),state:{cart:[],favorites:[]}},201,{"Set-Cookie":cookie});
  }
  if (route === "POST /api/auth/login") {
    await limit(db,request,"login",12,900);
    const data = await readBody(request);
    const address = email(data.email);
    const pass = password(data.password);
    await limit(db,request,"login-account",8,900,address);
    const config = settings(env);
    const user = await db.prepare("SELECT * FROM users WHERE email=?").bind(address).first();
    const hash = await passwordHash(pass,user?.password_salt || "cophone-invalid-user-salt",config.passwordPepper);
    if (!user || user.disabled || !safeEqual(hash,user.password_hash)) fail(401,"Correo o contraseña incorrectos.");
    const cookie = await newSession(db,user.id);
    return json({user:publicUser(user),state:JSON.parse(user.state_json)},200,{"Set-Cookie":cookie});
  }
  if (route === "POST /api/auth/logout") {
    const token = parseCookie(request);
    if (token) await db.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
  }
  if (route === "GET /api/me") {
    const user = await session(db,request,false);
    return json(user ? {user:publicUser(user),state:JSON.parse(user.state_json)} : {user:null});
  }
  if (route === "PATCH /api/me") {
    const user = await session(db,request);
    await limit(db,request,"profile",30,3600,user.id);
    const data = await readBody(request);
    await db.prepare("UPDATE users SET name=?,phone=?,city=?,address=?,updated_at=? WHERE id=?").bind(text(data.name,"Nombre",80,2),text(data.phone||"","Teléfono",25),text(data.city||"","Ciudad",80),text(data.address||"","Dirección",200),now(),user.id).run();
    return json({user:publicUser(await db.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first())});
  }
  if (route === "PUT /api/me/state") {
    const user = await session(db,request);
    await limit(db,request,"state",120,3600,user.id);
    const selection = stateInput(await readBody(request));
    await db.prepare("UPDATE users SET state_json=? WHERE id=?").bind(JSON.stringify(selection),user.id).run();
    return json({ok:true});
  }
  if (route === "POST /api/me/password") {
    const user = await session(db,request);
    await limit(db,request,"password",5,3600,user.id);
    const data = await readBody(request);
    const config = settings(env);
    if (!safeEqual(await passwordHash(password(data.currentPassword),user.password_salt,config.passwordPepper),user.password_hash)) fail(401,"La contraseña actual no es correcta.");
    const salt = random();
    const hash = await passwordHash(password(data.newPassword),salt,config.passwordPepper);
    await db.batch([db.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?").bind(hash,salt,now(),user.id),db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)]);
    return json({ok:true},200,{"Set-Cookie":await newSession(db,user.id)});
  }
  if (route === "GET /api/me/orders") {
    const user = await session(db,request);
    const rows = await db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 50").bind(user.id).all();
    return json({orders:rows.results.map(orderOutput)});
  }
  if (route === "POST /api/orders") {
    const user = await session(db,request);
    await limit(db,request,"orders",12,3600,user.id);
    const data = await readBody(request);
    const key = text(data.idempotencyKey,"Referencia",80,16);
    const selection = stateInput({cart:data.items,favorites:[]});
    if (!selection.cart.length || selection.cart.length > 20) fail(400,"Selecciona entre 1 y 20 modelos.");
    const note = text(data.note || "","Nota",500);
    const fingerprint = await digest(JSON.stringify({items:selection.cart,note}));
    const prior = await db.prepare("SELECT * FROM orders WHERE user_id=? AND idempotency_key=?").bind(user.id,key).first();
    if (prior) {
      if (prior.request_hash !== fingerprint) fail(409,"Esta referencia ya pertenece a otra solicitud.");
      return json({order:orderOutput(prior)});
    }
    const ids = selection.cart.map(item => item.id);
    const rows = await db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(()=>"?").join(",")}) AND active=1`).bind(...ids).all();
    const items = selection.cart.map(item => {
      const product = rows.results.find(row => row.id === item.id);
      if (!product || product.stock < item.qty) fail(409,"Uno de los modelos ya no tiene disponibilidad suficiente. Revisa el catálogo.");
      return {id:product.id,name:product.name,qty:item.qty,price:product.price_cents/100};
    });
    const total = items.reduce((sum,item)=>sum+Math.round(item.price*100)*item.qty,0);
    if (!Number.isSafeInteger(data.expectedTotalCents) || data.expectedTotalCents !== total) fail(409,"Los precios cambiaron. Actualiza el catálogo y revisa el total antes de volver a enviar.");
    const id = crypto.randomUUID();
    try {
      await db.prepare("INSERT INTO orders (id,user_id,customer_name,customer_email,items_json,total_cents,status,note,idempotency_key,request_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,'recibida',?,?,?,?,?)").bind(id,user.id,user.name,user.email,JSON.stringify(items),total,note,key,fingerprint,now(),now()).run();
    } catch(error) {
      if (!String(error).includes("UNIQUE")) throw error;
      const duplicate = await db.prepare("SELECT * FROM orders WHERE user_id=? AND idempotency_key=?").bind(user.id,key).first();
      if (!duplicate || duplicate.request_hash !== fingerprint) fail(409,"La solicitud ya fue enviada con otros datos.");
      return json({order:orderOutput(duplicate)});
    }
    return json({order:orderOutput(await db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first())},201);
  }
  if (url.pathname.startsWith("/api/admin/")) {
    const admin = await administrator(db,request);
    if (route === "GET /api/admin/overview") {
      const results = await db.batch([db.prepare("SELECT COUNT(*) AS total FROM users WHERE disabled=0"),db.prepare("SELECT COUNT(*) AS total FROM products WHERE active=1"),db.prepare("SELECT COUNT(*) AS total FROM orders WHERE status='recibida'")]);
      return json({users:results[0].results[0].total,products:results[1].results[0].total,requests:results[2].results[0].total,payments:"proximamente"});
    }
    if (route === "GET /api/admin/products") return json({products:(await db.prepare("SELECT * FROM products ORDER BY sort_order,id LIMIT 200").all()).results.map(productOutput)});
    if (route === "POST /api/admin/products") {
      await limit(db,request,"admin-write",120,3600,admin.id);
      const values = productInput(await readBody(request));
      try { await db.prepare("INSERT INTO products (id,name,category,tag,price_cents,storage,spec,features_json,color,stock,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(...values).run(); }
      catch(error) { if (String(error).includes("UNIQUE")) fail(409,"Ya existe un producto con ese identificador."); throw error; }
      return json({ok:true},201);
    }
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([a-z0-9-]{2,40})$/);
    if (request.method === "PATCH" && productMatch) {
      await limit(db,request,"admin-write",120,3600,admin.id);
      const values = productInput(await readBody(request),productMatch[1]);
      const result = await db.prepare("UPDATE products SET name=?,category=?,tag=?,price_cents=?,storage=?,spec=?,features_json=?,color=?,stock=?,active=?,updated_at=? WHERE id=?").bind(...values.slice(1),values[0]).run();
      if (!result.meta.changes) fail(404,"Producto no encontrado.");
      return json({ok:true});
    }
    if (route === "GET /api/admin/orders") {
      const cursor = url.searchParams.get("cursor") || "";
      const rows = await db.prepare("SELECT * FROM orders WHERE id>? ORDER BY id LIMIT 26").bind(cursor).all();
      const visible = rows.results.slice(0,25);
      return json({orders:visible.map(orderOutput),next:rows.results.length>25?visible.at(-1).id:null});
    }
    const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})$/);
    if (request.method === "PATCH" && orderMatch) {
      const data = await readBody(request);
      if (!ORDER_STATUSES.includes(data.status)) fail(400,"Estado no válido.");
      const result = await db.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(data.status,now(),orderMatch[1]).run();
      if (!result.meta.changes) fail(404,"Solicitud no encontrada.");
      return json({ok:true});
    }
    if (route === "GET /api/admin/users") {
      const cursor = url.searchParams.get("cursor") || "";
      const rows = await db.prepare("SELECT id,email,name,role,disabled,created_at FROM users WHERE id>? ORDER BY id LIMIT 26").bind(cursor).all();
      return json({users:rows.results.slice(0,25),next:rows.results.length>25?rows.results[24].id:null});
    }
    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([a-f0-9-]{36})$/);
    if (request.method === "PATCH" && userMatch) {
      const data = await readBody(request);
      if (typeof data.disabled !== "boolean") fail(400,"Estado no válido.");
      if (userMatch[1] === admin.id) fail(400,"No puedes suspender tu propia cuenta.");
      const target = await db.prepare("SELECT role FROM users WHERE id=?").bind(userMatch[1]).first();
      if (!target) fail(404,"Cuenta no encontrada.");
      if (target.role === "admin") fail(400,"Las cuentas administradoras no pueden suspenderse desde este panel.");
      await db.batch([db.prepare("UPDATE users SET disabled=?,updated_at=? WHERE id=?").bind(data.disabled?1:0,now(),userMatch[1]),db.prepare("DELETE FROM sessions WHERE user_id=?").bind(userMatch[1])]);
      return json({ok:true});
    }
  }
  fail(404,"Esta ruta no existe.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try { return await api(request,env,url); }
    catch(error) {
      if (error instanceof ApiError) return json({error:error.message},error.status,error.status===429?{"Retry-After":"900"}:{});
      console.error("COPHONE API:", String(error?.message || "Error interno").replace(/(password|cookie|token|secret)[^\s]*/gi,"[redactado]"));
      return json({error:"El servicio no está disponible temporalmente. No se ha realizado ningún cobro."},503);
    }
  }
};
