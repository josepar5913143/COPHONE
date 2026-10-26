"use strict";

// Catálogo ilustrativo: agrega modelos con un identificador único.
let products = [
  {id:"ultra",name:"COPHONE 16 Ultra",category:"premium",tag:"Nueva generación",price:4699,storage:"512 GB",spec:"Pantalla de 6.8″ · Cámara de 200 MP",features:["OLED de 6.8″ y 120 Hz","Cámara de 200 MP","512 GB de almacenamiento","Acabado titanio"],device:"#909ba7",wallpaper:"linear-gradient(145deg,#102342,#397dbb 60%,#bddcf2)"},
  {id:"pro",name:"COPHONE 16 Pro",category:"premium",tag:"Rendimiento Pro",price:4099,storage:"256 GB",spec:"OLED de 120 Hz · Chip C1 Pro",features:["OLED de 6.3″ y 120 Hz","Chip C1 Pro","256 GB de almacenamiento","Cámara de 50 MP"],device:"#b0a493",wallpaper:"linear-gradient(140deg,#332b29,#9c8063 55%,#efdbba)"},
  {id:"fold",name:"COPHONE Neo Fold",category:"fold",tag:"Más espacio",price:5199,storage:"512 GB",spec:"Pantalla flexible de 7.9″ · Multitarea",features:["Pantalla flexible de 7.9″","Multitarea con pantalla dividida","512 GB de almacenamiento","Cámara de 50 MP"],device:"#414b59",wallpaper:"linear-gradient(120deg,#122f54,#458bd2 49%,#14345e 51%,#9dc7f1)"},
  {id:"flip",name:"COPHONE Flip Pocket",category:"fold",tag:"Diseño compacto",price:3299,storage:"256 GB",spec:"Diseño plegable · Pantalla exterior",features:["Pantalla plegable de 6.7″","Pantalla exterior de 3.4″","256 GB de almacenamiento","Cámara doble de 50 MP"],device:"#b4a3c7",wallpaper:"linear-gradient(145deg,#29213c,#9982b5 55%,#e4c8ed)"},
  {id:"air",name:"COPHONE Air",category:"value",tag:"Ultraligero",price:2499,storage:"256 GB",spec:"Pantalla OLED · Cámara de 50 MP",features:["Pantalla OLED de 6.4″","Diseño ultraligero","256 GB de almacenamiento","Cámara doble de 50 MP"],device:"#b1c8db",wallpaper:"linear-gradient(150deg,#d5edf8,#609dca 55%,#1e4b76)"},
  {id:"mini",name:"COPHONE Mini SE",category:"value",tag:"Tu primer COPHONE",price:1799,storage:"128 GB",spec:"Formato compacto · Cámara de 48 MP",features:["Pantalla de 5.8″","Cámara de 48 MP","128 GB de almacenamiento","Resistencia IP68 ilustrativa"],device:"#567369",wallpaper:"linear-gradient(145deg,#133e39,#4a9f88 55%,#b1e2cf)"}
];

const $ = selector => document.querySelector(selector);
const money = value => "S/ " + new Intl.NumberFormat("es-PE", {maximumFractionDigits:2}).format(value);
const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const findProduct = id => products.find(product => product.id === id);
const CART_KEY = "cophoneCart", FAVORITES_KEY = "cophoneFavorites", MAX_QUANTITY = 99;
const state = {filter:"all",query:"",sort:"default",onlyFavorites:false,cart:[],favorites:[]};
let toastTimer, dialogReturnFocus = null;

// Persistencia: no se confía en precios ni nombres guardados previamente.
function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(storageKey(key)) || "[]"); }
  catch { return []; }
}
function loadState() {
  const savedCart = readStorage(CART_KEY);
  if (Array.isArray(savedCart)) {
    const quantities = new Map();
    savedCart.forEach(item => {
      if (!item || !findProduct(item.id) || !Number.isInteger(item.qty) || item.qty < 1) return;
      quantities.set(item.id, Math.min(MAX_QUANTITY, (quantities.get(item.id) || 0) + item.qty));
    });
    state.cart = [...quantities].map(([id,qty]) => ({id,qty}));
  }
  const savedFavorites = readStorage(FAVORITES_KEY);
  if (Array.isArray(savedFavorites)) state.favorites = [...new Set(savedFavorites.filter(id => findProduct(id)))];
}
function persist(key, value) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); scheduleSelectionSync(); }
  catch { notify("Tu selección sigue disponible durante esta visita. El navegador no permite guardarla."); }
}
function notify(message) {
  const toast = $("#toast");
  if (!toast) return;
  const open = document.querySelector("dialog[open]");
  (open || document.body).append(toast);
  toast.classList.toggle("in-dialog", Boolean(open));
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}
function art(product) {
  const shape = product.id === "fold" ? "fold" : product.id === "flip" ? "flip" : "";
  return `<span class="mini ${shape}" style="--device:${product.device};--wallpaper:${product.wallpaper}" aria-hidden="true"></span>`;
}

// Catálogo, búsqueda y favoritos.
function renderProducts() {
  const grid = $("#productGrid");
  if (!grid) return;
  const query = normalize(state.query.trim());
  const list = products.filter(product => {
    const match = normalize([product.name,product.spec,product.storage,...product.features].join(" ")).includes(query);
    return match && (state.filter === "all" || product.category === state.filter) && (!state.onlyFavorites || state.favorites.includes(product.id));
  });
  if (state.sort === "asc") list.sort((a,b) => a.price-b.price);
  if (state.sort === "desc") list.sort((a,b) => b.price-a.price);
  if (state.sort === "name") list.sort((a,b) => a.name.localeCompare(b.name,"es"));
  if ($("#resultCount")) $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "modelo" : "modelos"}${state.onlyFavorites ? (list.length === 1 ? " favorito" : " favoritos") : (list.length === 1 ? " disponible" : " disponibles")}`;
  grid.innerHTML = list.length ? list.map(product => {
    const favorite = state.favorites.includes(product.id);
    return `<article class="card" style="--device:${product.device}">
      <div class="card-top"><span class="tag">${escapeHTML(product.tag)}</span><button class="icon-button favorite" data-favorite="${product.id}" aria-label="${favorite ? "Quitar de" : "Añadir a"} favoritos: ${escapeHTML(product.name)}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button></div>
      <button class="product-art" data-detail="${product.id}" aria-label="Ver detalles de ${escapeHTML(product.name)}">${art(product)}</button>
      <div class="swatches" aria-hidden="true"><i></i><i></i><i></i></div>
      <h3><button class="detail-link" data-detail="${product.id}">${escapeHTML(product.name)}</button></h3>
      <p class="spec">${escapeHTML(product.spec)}<br>${escapeHTML(product.storage)} de almacenamiento</p>
      <div class="card-bottom"><div class="price-row"><span class="price">${money(product.price)}</span><span class="stock">${product.stock === 0 ? "Agotado" : "Disponible"}</span></div><button class="primary full" data-add="${product.id}" ${product.stock === 0 ? "disabled" : ""}>Añadir al carrito ＋</button></div>
    </article>`;
  }).join("") : '<div class="empty"><h3>No encontramos modelos.</h3><p>Prueba otra búsqueda o cambia los filtros.</p><button class="text-button" data-reset>Ver todos los celulares →</button></div>';
  document.querySelectorAll("[data-filter]").forEach(button => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  if ($("#favoriteCount")) $("#favoriteCount").textContent = state.favorites.length;
  if ($("#favoritesToggle")) $("#favoritesToggle").setAttribute("aria-pressed",String(state.onlyFavorites));
  if ($("#onlyFavorites")) $("#onlyFavorites").checked = state.onlyFavorites;
}
function resetFilters() {
  Object.assign(state,{filter:"all",query:"",sort:"default",onlyFavorites:false});
  if ($("#searchInput")) $("#searchInput").value = "";
  if ($("#sortSelect")) $("#sortSelect").value = "default";
  renderProducts();
}
function toggleFavorite(id) {
  if (!findProduct(id)) return;
  const index = state.favorites.indexOf(id);
  if (index >= 0) state.favorites.splice(index,1);
  else state.favorites.push(id);
  renderProducts();
  notify(index >= 0 ? "Producto eliminado de favoritos." : "Producto guardado en favoritos.");
  persist(FAVORITES_KEY,state.favorites);
  (document.querySelector(`[data-favorite="${id}"]`) || $("#onlyFavorites"))?.focus({preventScroll:true});
}

// Carrito: los totales siempre se calculan con el catálogo actual.
function addToCart(id) {
  if (!findProduct(id)) return;
  if (findProduct(id).stock === 0) { notify("Este modelo está agotado."); return; }
  const item = state.cart.find(entry => entry.id === id);
  if (item && item.qty >= Math.min(99,findProduct(id).stock ?? 99)) { notify("Has alcanzado la disponibilidad de este modelo."); return; }
  if (item?.qty >= MAX_QUANTITY) { notify("El máximo es de 99 unidades por modelo."); return; }
  if (item) item.qty++;
  else state.cart.push({id,qty:1});
  renderCart();
  notify(`${findProduct(id).name} añadido al carrito.`);
  persist(CART_KEY,state.cart);
}
function changeQuantity(id,delta) {
  const item = state.cart.find(entry => entry.id === id);
  if (!item || ![-1,1].includes(delta)) return;
  const next = item.qty+delta;
  if (delta > 0 && next > (findProduct(id).stock ?? 99)) { notify("Has alcanzado la disponibilidad de este modelo."); return; }
  if (next > MAX_QUANTITY) { notify("El máximo es de 99 unidades por modelo."); return; }
  if (next < 1) { removeItem(id); return; }
  item.qty = next;
  renderCart();
  const control = document.querySelector(`[data-quantity="${id}"][data-delta="${delta}"]:not(:disabled)`) || document.querySelector(`[data-quantity="${id}"][data-delta="-1"]`);
  control?.focus({preventScroll:true});
  persist(CART_KEY,state.cart);
}
function removeItem(id) {
  const index = state.cart.findIndex(item => item.id === id);
  if (index < 0) return;
  state.cart.splice(index,1);
  renderCart();
  const next = state.cart[Math.min(index,state.cart.length-1)];
  (next ? document.querySelector(`[data-remove="${next.id}"]`) : $("[data-close='cartDrawer']"))?.focus({preventScroll:true});
  notify("Producto eliminado del carrito.");
  persist(CART_KEY,state.cart);
}
function cartTotal() { return state.cart.reduce((total,item) => total+findProduct(item.id).price*item.qty,0); }
function renderCart() {
  const count = state.cart.reduce((total,item) => total+item.qty,0);
  if ($("#cartCount")) $("#cartCount").textContent = count;
  if ($("#openCart")) $("#openCart").setAttribute("aria-label",`Abrir carrito: ${count} unidades`);
  for (const selector of ["#cartSubtotal","#cartTotal"]) if ($(selector)) $(selector).textContent = money(cartTotal());
  if ($("#checkout")) $("#checkout").disabled = !count;
  const container = $("#cartItems");
  if (!container) return;
  container.innerHTML = state.cart.length ? state.cart.map(item => {
    const product = findProduct(item.id);
    return `<article class="cart-item">${art(product)}<div><h3>${escapeHTML(product.name)}</h3><p>${money(product.price)} por unidad · ${product.storage}</p><p><strong>${money(product.price*item.qty)}</strong></p><div class="cart-item-controls"><div class="quantity" role="group" aria-label="Cantidad de ${escapeHTML(product.name)}"><button data-quantity="${item.id}" data-delta="-1" aria-label="Reducir cantidad de ${escapeHTML(product.name)}">−</button><span aria-live="polite">${item.qty}</span><button data-quantity="${item.id}" data-delta="1" aria-label="Aumentar cantidad de ${escapeHTML(product.name)}" ${item.qty >= MAX_QUANTITY ? "disabled" : ""}>＋</button></div><button class="remove-button" data-remove="${item.id}" aria-label="Eliminar ${escapeHTML(product.name)} del carrito">Eliminar</button></div></div></article>`;
  }).join("") : '<div class="empty"><h3>Tu carrito está esperando.</h3><p>Explora los modelos y añade tu favorito.</p><button class="text-button" data-close="cartDrawer">Seguir explorando →</button></div>';
}

// Modales nativos: foco contenido, Escape y restauración al cerrar.
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || typeof dialog.showModal !== "function" || dialog.open) return;
  const previous = document.querySelector("dialog[open]");
  if (!previous) dialogReturnFocus = document.activeElement;
  if (previous) previous.close();
  dialog.showModal();
  document.body.classList.add("has-dialog");
}
function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}
function showDetails(id) {
  const product = findProduct(id), container = $("#productDetails");
  if (!product || !container) return;
  container.innerHTML = `<div class="detail-grid"><div class="product-art">${art(product)}</div><div><span class="tag">${escapeHTML(product.tag)}</span><h2 id="productTitle">${escapeHTML(product.name)}</h2><ul class="detail-specs">${product.features.map(feature => `<li>${escapeHTML(feature)}</li>`).join("")}</ul><p class="price">${money(product.price)}</p><button class="primary full" data-add="${id}">Añadir al carrito ＋</button><p class="fine-print">Imagen, características y precio ilustrativos.</p></div></div>`;
  openDialog("productModal");
}
function showCheckout() {
  if (!state.cart.length) { notify("Añade un producto para revisar tu selección."); return; }
  const container = $("#checkoutSummary");
  if (!container) return;
  container.innerHTML = `<ul class="summary-list">${state.cart.map(item => {
    const product = findProduct(item.id);
    return `<li><span>${escapeHTML(product.name)}<small>${item.qty} × ${money(product.price)}</small></span><strong>${money(product.price*item.qty)}</strong></li>`;
  }).join("")}</ul><div class="summary-total"><span>Total</span><span>${money(cartTotal())}</span></div>`;
  if ($("#orderFeedback")) $("#orderFeedback").textContent = "";
  if ($("#saveOrder")) { $("#saveOrder").disabled = false; $("#saveOrder").textContent = accountState.user ? "Guardar solicitud" : "Entrar y guardar solicitud"; }
  accountState.orderKey = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36);
  openDialog("checkoutModal");
}
function setMenu(open) {
  const button = $("#menuToggle"), nav = $("#mainNav");
  if (!button || !nav) return;
  nav.classList.toggle("is-open",open);
  button.setAttribute("aria-expanded",String(open));
  button.setAttribute("aria-label",open ? "Cerrar menú" : "Abrir menú");
  button.textContent = open ? "✕" : "☰";
}
function initAnimations() {
  if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }),{threshold:0.08});
  document.querySelectorAll(".reveal").forEach(element => { element.classList.add("will-reveal"); observer.observe(element); });
}

// Eventos delegados para tarjetas y elementos generados dinámicamente.
function init() {
  loadState(); renderProducts(); renderCart();
  if ($("#year")) $("#year").textContent = new Date().getFullYear();
  $("#searchInput")?.addEventListener("input",event => { state.query=event.target.value; renderProducts(); });
  $("#sortSelect")?.addEventListener("change",event => { state.sort=event.target.value; renderProducts(); });
  $("#onlyFavorites")?.addEventListener("change",event => { state.onlyFavorites=event.target.checked; renderProducts(); });
  $("#favoritesToggle")?.addEventListener("click",() => { state.onlyFavorites=!state.onlyFavorites; renderProducts(); $("#catalogo")?.scrollIntoView({block:"start"}); });
  $("#menuToggle")?.addEventListener("click",() => setMenu($("#menuToggle").getAttribute("aria-expanded")!=="true"));
  $("#openCart")?.addEventListener("click",() => openDialog("cartDrawer"));
  $("#checkout")?.addEventListener("click",showCheckout);
  $("#resetFilters")?.addEventListener("click",resetFilters);
  document.addEventListener("click",event => {
    const target = event.target.closest("button,a");
    if (target?.dataset.add) addToCart(target.dataset.add);
    else if (target?.dataset.detail) showDetails(target.dataset.detail);
    else if (target?.dataset.favorite) toggleFavorite(target.dataset.favorite);
    else if (target?.dataset.quantity) changeQuantity(target.dataset.quantity,Number(target.dataset.delta));
    else if (target?.dataset.remove) removeItem(target.dataset.remove);
    else if (target?.dataset.close) closeDialog(target.dataset.close);
    else if (target?.hasAttribute("data-reset")) resetFilters();
    else if (target?.dataset.filter) { state.filter=target.dataset.filter; renderProducts(); }
    if (event.target.closest("#mainNav a") || !event.target.closest(".nav")) setMenu(false);
  });
  document.addEventListener("keydown",event => {
    if (event.key==="Escape" && $("#menuToggle")?.getAttribute("aria-expanded")==="true") { setMenu(false); $("#menuToggle").focus(); }
  });
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click",event => {
      if (event.target!==dialog) return;
      const rect=dialog.getBoundingClientRect();
      if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
    });
    dialog.addEventListener("close",() => {
      if (document.querySelector("dialog[open]")) return;
      document.body.classList.remove("has-dialog");
      const toast=$("#toast");
      if (toast) { document.body.append(toast); toast.classList.remove("in-dialog"); }
      const target=dialogReturnFocus?.isConnected ? dialogReturnFocus : $("#openCart");
      target?.focus({preventScroll:true}); dialogReturnFocus=null;
    });
  });
  window.matchMedia("(min-width: 801px)").addEventListener("change",event => { if(event.matches) setMenu(false); });
  initAnimations();
  initializeAccount();
}
// Cuentas y administración. La autorización real siempre se verifica en la API.
const accountState = {user:null,available:false,view:"login",syncTimer:null,syncGeneration:0,orderKey:null,adminProducts:[],adminView:"products",nextOrders:null,nextUsers:null};
function storageKey(key) { return accountState.user ? `${key}:${accountState.user.id}` : key; }
async function apiRequest(path,options={}) {
  if (location.protocol === "file:") throw new Error("Las cuentas necesitan la versión publicada. Puedes explorar el catálogo sin conexión.");
  const response = await fetch(path,{credentials:"same-origin",cache:"no-store",...options,headers:{"Content-Type":"application/json","X-Cophone-Request":"1",...options.headers}});
  let data;
  try { data = await response.json(); } catch { throw new Error("El servicio de cuentas no está disponible temporalmente."); }
  if (!response.ok) {
    if (response.status === 401 && accountState.user) {
      clearTimeout(accountState.syncTimer);
      accountState.user = null;
      accountState.syncGeneration++;
      loadState(); renderProducts(); renderCart(); renderAccount();
    }
    throw new Error(data.error || "No se pudo completar la operación.");
  }
  return data;
}
function feedback(selector,message,success=false) {
  const element = $(selector);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("success",success);
}
async function withForm(form,selector,callback) {
  const submit = form.querySelector('[type="submit"]');
  if (submit?.disabled) return;
  const label = submit?.textContent;
  if (submit) { submit.disabled=true; submit.textContent="Guardando…"; }
  feedback(selector,"");
  try { await callback(Object.fromEntries(new FormData(form))); }
  catch(error) { feedback(selector,error.message); }
  finally { if (submit) { submit.disabled=false; submit.textContent=label; } }
}
function cleanSelection(selection) {
  return {
    favorites:[...new Set((Array.isArray(selection?.favorites)?selection.favorites:[]).filter(id=>findProduct(id)))].slice(0,100),
    cart:(Array.isArray(selection?.cart)?selection.cart:[]).filter(item=>item&&findProduct(item.id)&&Number.isInteger(item.qty)&&item.qty>0).map(item=>({id:item.id,qty:Math.min(99,item.qty)})).slice(0,50)
  };
}
function applySelection(selection) {
  const clean = cleanSelection(selection);
  state.cart=clean.cart; state.favorites=clean.favorites;
  try {
    localStorage.setItem(storageKey(CART_KEY),JSON.stringify(state.cart));
    localStorage.setItem(storageKey(FAVORITES_KEY),JSON.stringify(state.favorites));
  } catch {}
  renderProducts(); renderCart();
}
function scheduleSelectionSync() {
  if (!accountState.user) return;
  clearTimeout(accountState.syncTimer);
  const generation=accountState.syncGeneration;
  const owner=accountState.user.id;
  if ($("#syncStatus")) $("#syncStatus").textContent="Guardando selección…";
  accountState.syncTimer=setTimeout(async()=>{
    if (generation!==accountState.syncGeneration || accountState.user?.id!==owner) return;
    try {
      await apiRequest("/api/me/state",{method:"PUT",body:JSON.stringify({cart:state.cart,favorites:state.favorites})});
      if (generation===accountState.syncGeneration && $("#syncStatus")) $("#syncStatus").textContent="Selección sincronizada con tu cuenta.";
    } catch(error) {
      if ($("#syncStatus")) $("#syncStatus").textContent="Guardado en este navegador. No se pudo sincronizar todavía.";
    }
  },1200);
}
async function refreshCatalog() {
  const data=await apiRequest("/api/products");
  if (!Array.isArray(data.products)) throw new Error("El catálogo no está disponible.");
  products=data.products;
  applySelection({cart:state.cart,favorites:state.favorites});
}
function renderAccount() {
  const user=accountState.user;
  if ($("#authArea")) $("#authArea").hidden=Boolean(user);
  if ($("#profileArea")) $("#profileArea").hidden=!user;
  if ($("#openAccount")) $("#openAccount").textContent=user?"Mi perfil":"Mi cuenta";
  if ($("#openAdmin")) $("#openAdmin").hidden=user?.role!=="admin";
  if (!user) return;
  $("#profileName").textContent=user.name;
  $("#profileEmail").textContent=user.email;
  $("#profileRole").textContent=user.role==="admin"?"Administrador":"Usuario";
  $("#profileAvatar").textContent=user.name.slice(0,1).toUpperCase();
  const form=$("#profileForm");
  for (const field of ["name","phone","city","address"]) if(form?.elements[field]) form.elements[field].value=user[field]||"";
}
function authView(view) {
  accountState.view=view;
  if ($("#loginForm")) $("#loginForm").hidden=view!=="login";
  if ($("#registerForm")) $("#registerForm").hidden=view!=="register";
  document.querySelectorAll("[data-auth-view]").forEach(button=>{
    const active=button.dataset.authView===view;
    button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
  });
  feedback("#accountFeedback","");
}
async function authenticate(form,register) {
  await withForm(form,"#accountFeedback",async values=>{
    const guest=accountState.user?{cart:[],favorites:[]}:{cart:[...state.cart],favorites:[...state.favorites]};
    const data=await apiRequest(register?"/api/auth/register":"/api/auth/login",{method:"POST",body:JSON.stringify(values)});
    accountState.user=data.user;accountState.syncGeneration++;
    const remote=cleanSelection(data.state);
    const cart=new Map(remote.cart.map(item=>[item.id,item]));
    for (const item of guest.cart) {
      const existing=cart.get(item.id);
      cart.set(item.id,{id:item.id,qty:Math.max(existing?.qty||0,item.qty)});
    }
    applySelection({cart:[...cart.values()],favorites:[...new Set([...remote.favorites,...guest.favorites])]});
    renderAccount(); accountView("profile"); scheduleSelectionSync();
    form.reset();
    feedback("#accountFeedback",register?"Tu cuenta ya está lista. Bienvenido a COPHONE.":"Sesión iniciada.",true);
  });
}
function accountView(view) {
  document.querySelectorAll("[data-account-panel]").forEach(panel=>panel.hidden=panel.dataset.accountPanel!==view);
  document.querySelectorAll("[data-account-view]").forEach(button=>{
    const active=button.dataset.accountView===view;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
  });
  feedback("#accountFeedback","");
  if (view==="orders") loadMyOrders();
}
const statusNames={recibida:"Recibida",en_revision:"En revisión",confirmada:"Confirmada",cancelada:"Cancelada"};
const dateLabel=stamp=>new Date(stamp*1000).toLocaleDateString("es-PE",{day:"numeric",month:"short",year:"numeric"});
function orderCard(order,admin=false) {
  const stateName=statusNames[order.status]||"Recibida";
  return `<article class="request-card"><div class="request-head"><div><h4>Solicitud ${escapeHTML(order.id.slice(0,8).toUpperCase())}</h4><p>${escapeHTML(dateLabel(order.createdAt))}${admin?` · ${escapeHTML(order.name)} · ${escapeHTML(order.email)}`:""}</p></div><span class="request-status ${escapeHTML(order.status)}">${stateName}</span></div><ul>${order.items.map(item=>`<li>${escapeHTML(item.name)} · ${item.qty} × ${money(item.price)}</li>`).join("")}</ul>${order.note?`<p>Nota: ${escapeHTML(order.note)}</p>`:""}<p class="request-total">${money(order.total)}</p><p>Pagos próximamente · No se ha realizado ningún cobro.</p>${admin?`<div class="request-admin-controls"><label class="sr-only" for="status-${order.id}">Estado de solicitud</label><select id="status-${order.id}">${Object.entries(statusNames).map(([value,label])=>`<option value="${value}" ${value===order.status?"selected":""}>${label}</option>`).join("")}</select><button class="text-button" data-order-status="${order.id}">Guardar estado</button></div>`:""}</article>`;
}
async function loadMyOrders() {
  if (!$("#myOrders")) return;
  $("#myOrders").innerHTML='<p class="account-loading">Cargando solicitudes…</p>';
  try {
    const data=await apiRequest("/api/me/orders");
    $("#myOrders").innerHTML=data.orders.length?data.orders.map(order=>orderCard(order)).join(""):'<div class="empty"><h3>Aún no tienes solicitudes.</h3><p>Explora el catálogo y guarda tu primera selección.</p></div>';
  } catch(error) { $("#myOrders").textContent=error.message; }
}
async function saveOrder() {
  if (!accountState.user) {
    openDialog("accountModal"); authView("login");
    feedback("#accountFeedback","Entra o crea tu cuenta. Después vuelve al carrito para guardar tu solicitud.");return;
  }
  const button=$("#saveOrder");
  if (!button || button.disabled) return;
  button.disabled=true;button.textContent="Guardando solicitud…";feedback("#orderFeedback","");
  try {
    const data=await apiRequest("/api/orders",{method:"POST",body:JSON.stringify({items:state.cart.map(item=>({id:item.id,qty:item.qty})),note:$("#orderNote")?.value||"",idempotencyKey:accountState.orderKey,expectedTotalCents:Math.round(cartTotal()*100)})});
    feedback("#orderFeedback",`Solicitud ${data.order.id.slice(0,8).toUpperCase()} guardada. La encontrarás en Mi cuenta → Mis solicitudes. No se realizó ningún cobro.`,true);
    button.textContent="Solicitud guardada";
    state.cart=[]; persist(CART_KEY,state.cart);renderCart();
    if ($("#orderNote")) $("#orderNote").value="";
  } catch(error) { feedback("#orderFeedback",error.message);button.disabled=false;button.textContent="Volver a intentar"; }
}
async function adminStats() {
  const stats=await apiRequest("/api/admin/overview");
  $("#adminStats").innerHTML=`<div><strong>${stats.users}</strong><span>Usuarios activos</span></div><div><strong>${stats.products}</strong><span>Productos visibles</span></div><div><strong>${stats.requests}</strong><span>Solicitudes nuevas</span></div><div><strong>Próximamente</strong><span>Pagos en línea</span></div>`;
}
async function openAdministration() {
  if (accountState.user?.role!=="admin") return;
  openDialog("adminModal");
  await Promise.allSettled([adminStats(),adminView("products")]);
}
function productEditor(product=null) {
  const p=product||{id:"",name:"",category:"premium",tag:"Nuevo",price:1,storage:"256 GB",spec:"",features:[],device:"#909ba7",stock:20,active:true};
  return `<form id="productEditor" class="product-editor account-form" data-product-id="${escapeHTML(p.id)}"><h3>${product?"Editar producto":"Nuevo producto"}</h3><div class="form-grid"><label class="field">Identificador<input name="id" value="${escapeHTML(p.id)}" minlength="2" maxlength="40" pattern="[a-z0-9][a-z0-9-]{1,39}" placeholder="modelo-nuevo" ${product?"disabled":"required"}></label><label class="field">Nombre<input name="name" value="${escapeHTML(p.name)}" minlength="2" maxlength="100" required></label><label class="field">Categoría<select name="category">${[["premium","Premium"],["fold","Plegables"],["value","Calidad-precio"]].map(([id,label])=>`<option value="${id}" ${p.category===id?"selected":""}>${label}</option>`).join("")}</select></label><label class="field">Etiqueta<input name="tag" value="${escapeHTML(p.tag)}" maxlength="40"></label><label class="field">Precio en soles<input name="price" type="number" min="1" max="999999" step="0.01" value="${p.price}" required></label><label class="field">Stock disponible<input name="stock" type="number" min="0" max="99999" step="1" value="${p.stock}" required></label><label class="field">Almacenamiento<input name="storage" value="${escapeHTML(p.storage)}" maxlength="30" required></label><label class="field">Color de la ilustración<input name="color" type="color" value="${escapeHTML(p.device)}"></label><label class="field wide">Descripción breve<input name="spec" value="${escapeHTML(p.spec)}" maxlength="200" required></label><label class="field wide">Características (una por línea, máximo 8)<textarea name="features" rows="4" maxlength="1200" required>${escapeHTML(p.features.join("\n"))}</textarea></label></div><label class="checkbox-field"><input name="active" type="checkbox" ${p.active?"checked":""}>Visible en el catálogo</label><div class="editor-actions"><button class="primary" type="submit">Guardar producto</button><button class="text-button" type="button" id="cancelProductEdit">Cancelar</button></div></form>`;
}
async function adminView(view,append=false) {
  accountState.adminView=view;
  document.querySelectorAll("[data-admin-view]").forEach(button=>{const active=button.dataset.adminView===view;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  feedback("#adminFeedback","");
  const content=$("#adminContent");
  if (!append) content.innerHTML='<p class="account-loading">Cargando…</p>';
  try {
    if(view==="products") {
      const data=await apiRequest("/api/admin/products");accountState.adminProducts=data.products;
      content.innerHTML=`<div class="panel-heading"><h3>Catálogo</h3><button class="primary" id="newProduct">＋ Nuevo producto</button></div><div id="productEditorHost"></div><div class="admin-list">${data.products.map(p=>`<article class="admin-row"><div><h4>${escapeHTML(p.name)}</h4><p>${money(p.price)} · ${p.stock} unidades · ${escapeHTML(p.storage)}</p><span class="status-label ${p.active?"":"inactive"}">${p.active?"Visible":"Oculto"}</span></div><div class="admin-row-actions"><button class="text-button" data-edit-product="${p.id}">Editar</button><button class="text-button" data-toggle-product="${p.id}">${p.active?"Ocultar":"Publicar"}</button></div></article>`).join("")}</div>`;
    } else if(view==="orders") {
      const data=await apiRequest(`/api/admin/orders${append&&accountState.nextOrders?`?cursor=${encodeURIComponent(accountState.nextOrders)}`:""}`);
      accountState.nextOrders=data.next;
      const cards=data.orders.map(order=>orderCard(order,true)).join("");
      if(append){$("#loadMoreOrders")?.remove();content.insertAdjacentHTML("beforeend",cards);}else content.innerHTML=`<div class="panel-heading"><h3>Solicitudes</h3><button class="text-button" data-admin-view="orders">Actualizar</button></div>${cards||'<div class="empty">Todavía no hay solicitudes.</div>'}`;
      if(data.next) content.insertAdjacentHTML("beforeend",'<button class="text-button load-more" id="loadMoreOrders">Cargar más solicitudes</button>');
    } else if(view==="users") {
      const data=await apiRequest(`/api/admin/users${append&&accountState.nextUsers?`?cursor=${encodeURIComponent(accountState.nextUsers)}`:""}`);
      accountState.nextUsers=data.next;
      const cards=data.users.map(user=>`<article class="admin-row"><div><h4>${escapeHTML(user.name)}</h4><p>${escapeHTML(user.email)} · ${user.role==="admin"?"Administrador":"Usuario"}</p><span class="status-label ${user.disabled?"inactive":""}">${user.disabled?"Suspendido":"Activo"}</span></div>${user.role!=="admin"?`<button class="text-button" data-user-status="${user.id}" data-disabled="${!user.disabled}">${user.disabled?"Reactivar":"Suspender acceso"}</button>`:""}</article>`).join("");
      if(append){$("#loadMoreUsers")?.remove();content.insertAdjacentHTML("beforeend",cards);}else content.innerHTML=`<div class="panel-heading"><h3>Cuentas</h3><button class="text-button" data-admin-view="users">Actualizar</button></div>${cards||'<div class="empty">No hay cuentas.</div>'}`;
      if(data.next) content.insertAdjacentHTML("beforeend",'<button class="text-button load-more" id="loadMoreUsers">Cargar más cuentas</button>');
    }
  } catch(error){feedback("#adminFeedback",error.message);if(!append)content.innerHTML="";}
}
function productPayload(product) {
  return {id:product.id,name:product.name,category:product.category,tag:product.tag,price:product.price,storage:product.storage,spec:product.spec,features:product.features,color:product.device,stock:product.stock,active:product.active};
}
async function adminAction(button,action) {
  if(button.disabled)return;button.disabled=true;feedback("#adminFeedback","");
  try {await action();feedback("#adminFeedback","Cambio guardado.",true);await adminStats();}
  catch(error){feedback("#adminFeedback",error.message);}
  finally{button.disabled=false;}
}
async function initializeAccount() {
  $("#openAccount")?.addEventListener("click",()=>{renderAccount();feedback("#accountFeedback","");openDialog("accountModal");});
  $("#loginForm")?.addEventListener("submit",event=>{event.preventDefault();authenticate(event.currentTarget,false);});
  $("#registerForm")?.addEventListener("submit",event=>{event.preventDefault();authenticate(event.currentTarget,true);});
  $("#profileForm")?.addEventListener("submit",event=>{
    event.preventDefault();withForm(event.currentTarget,"#accountFeedback",async values=>{const data=await apiRequest("/api/me",{method:"PATCH",body:JSON.stringify(values)});accountState.user=data.user;renderAccount();feedback("#accountFeedback","Perfil actualizado.",true);});
  });
  $("#passwordForm")?.addEventListener("submit",event=>{
    event.preventDefault();const form=event.currentTarget;withForm(form,"#accountFeedback",async values=>{await apiRequest("/api/me/password",{method:"POST",body:JSON.stringify(values)});form.reset();feedback("#accountFeedback","Contraseña actualizada. Las demás sesiones se han cerrado.",true);});
  });
  $("#logoutAccount")?.addEventListener("click",async()=>{
    const button=$("#logoutAccount");button.disabled=true;
    try {
      clearTimeout(accountState.syncTimer);
      if(accountState.user)try{await apiRequest("/api/me/state",{method:"PUT",body:JSON.stringify({cart:state.cart,favorites:state.favorites})});}catch{}
      await apiRequest("/api/auth/logout",{method:"POST",body:"{}"});
      accountState.user=null;accountState.syncGeneration++;state.cart=[];state.favorites=[];loadState();renderProducts();renderCart();renderAccount();authView("login");feedback("#accountFeedback","Sesión cerrada.",true);
    } catch(error){feedback("#accountFeedback",error.message);}
    finally{button.disabled=false;}
  });
  $("#saveOrder")?.addEventListener("click",saveOrder);
  $("#refreshMyOrders")?.addEventListener("click",loadMyOrders);
  $("#openAdmin")?.addEventListener("click",openAdministration);
  document.addEventListener("click",event=>{
    const button=event.target.closest("button");if(!button)return;
    if(button.dataset.authView)authView(button.dataset.authView);
    else if(button.dataset.accountView)accountView(button.dataset.accountView);
    else if(button.dataset.adminView)adminView(button.dataset.adminView);
    else if(button.id==="newProduct") {$("#productEditorHost").innerHTML=productEditor();$("#productEditor input[name='id']")?.focus();}
    else if(button.dataset.editProduct) {const p=accountState.adminProducts.find(p=>p.id===button.dataset.editProduct);if(p){$("#productEditorHost").innerHTML=productEditor(p);$("#productEditor input[name='name']")?.focus();}}
    else if(button.id==="cancelProductEdit")$("#productEditorHost").innerHTML="";
    else if(button.dataset.toggleProduct)adminAction(button,async()=>{const p=accountState.adminProducts.find(p=>p.id===button.dataset.toggleProduct);await apiRequest(`/api/admin/products/${p.id}`,{method:"PATCH",body:JSON.stringify({...productPayload(p),active:!p.active})});await adminView("products");await refreshCatalog();});
    else if(button.dataset.orderStatus)adminAction(button,async()=>{const id=button.dataset.orderStatus;await apiRequest(`/api/admin/orders/${id}`,{method:"PATCH",body:JSON.stringify({status:document.getElementById(`status-${id}`).value})});await adminView("orders");});
    else if(button.dataset.userStatus)adminAction(button,async()=>{await apiRequest(`/api/admin/users/${button.dataset.userStatus}`,{method:"PATCH",body:JSON.stringify({disabled:button.dataset.disabled==="true"})});await adminView("users");});
    else if(button.id==="loadMoreOrders")adminAction(button,()=>adminView("orders",true));
    else if(button.id==="loadMoreUsers")adminAction(button,()=>adminView("users",true));
  });
  document.addEventListener("submit",event=>{
    if(event.target.id!=="productEditor")return;event.preventDefault();const form=event.target;
    withForm(form,"#adminFeedback",async values=>{
      const id=form.dataset.productId;
      const payload={...values,price:Number(values.price),stock:Number(values.stock),active:form.elements.active.checked,features:values.features.split("\n").map(line=>line.trim()).filter(Boolean)};
      await apiRequest(id?`/api/admin/products/${id}`:"/api/admin/products",{method:id?"PATCH":"POST",body:JSON.stringify(payload)});
      await adminView("products");await refreshCatalog();await adminStats();feedback("#adminFeedback","Producto guardado.",true);
    });
  });
  if(location.protocol==="file:") {renderAccount();return;}
  try {
    await refreshCatalog();
    const data=await apiRequest("/api/me");accountState.available=true;
    if(data.user){accountState.user=data.user;accountState.syncGeneration++;applySelection(data.state);}
    renderAccount();
  }catch(error){accountState.available=false;renderAccount();}
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
