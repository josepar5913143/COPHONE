"use strict";

// Catálogo ilustrativo: agrega modelos con un identificador único.
const products = [
  {id:"ultra",name:"COPHONE 16 Ultra",category:"premium",tag:"Nueva generación",price:4699,storage:"512 GB",spec:"Pantalla de 6.8″ · Cámara de 200 MP",features:["OLED de 6.8″ y 120 Hz","Cámara de 200 MP","512 GB de almacenamiento","Acabado titanio"],device:"#909ba7",wallpaper:"linear-gradient(145deg,#102342,#397dbb 60%,#bddcf2)"},
  {id:"pro",name:"COPHONE 16 Pro",category:"premium",tag:"Rendimiento Pro",price:4099,storage:"256 GB",spec:"OLED de 120 Hz · Chip C1 Pro",features:["OLED de 6.3″ y 120 Hz","Chip C1 Pro","256 GB de almacenamiento","Cámara de 50 MP"],device:"#b0a493",wallpaper:"linear-gradient(140deg,#332b29,#9c8063 55%,#efdbba)"},
  {id:"fold",name:"COPHONE Neo Fold",category:"fold",tag:"Más espacio",price:5199,storage:"512 GB",spec:"Pantalla flexible de 7.9″ · Multitarea",features:["Pantalla flexible de 7.9″","Multitarea con pantalla dividida","512 GB de almacenamiento","Cámara de 50 MP"],device:"#414b59",wallpaper:"linear-gradient(120deg,#122f54,#458bd2 49%,#14345e 51%,#9dc7f1)"},
  {id:"flip",name:"COPHONE Flip Pocket",category:"fold",tag:"Diseño compacto",price:3299,storage:"256 GB",spec:"Diseño plegable · Pantalla exterior",features:["Pantalla plegable de 6.7″","Pantalla exterior de 3.4″","256 GB de almacenamiento","Cámara doble de 50 MP"],device:"#b4a3c7",wallpaper:"linear-gradient(145deg,#29213c,#9982b5 55%,#e4c8ed)"},
  {id:"air",name:"COPHONE Air",category:"value",tag:"Ultraligero",price:2499,storage:"256 GB",spec:"Pantalla OLED · Cámara de 50 MP",features:["Pantalla OLED de 6.4″","Diseño ultraligero","256 GB de almacenamiento","Cámara doble de 50 MP"],device:"#b1c8db",wallpaper:"linear-gradient(150deg,#d5edf8,#609dca 55%,#1e4b76)"},
  {id:"mini",name:"COPHONE Mini SE",category:"value",tag:"Tu primer COPHONE",price:1799,storage:"128 GB",spec:"Formato compacto · Cámara de 48 MP",features:["Pantalla de 5.8″","Cámara de 48 MP","128 GB de almacenamiento","Resistencia IP68 ilustrativa"],device:"#567369",wallpaper:"linear-gradient(145deg,#133e39,#4a9f88 55%,#b1e2cf)"}
];

const $ = selector => document.querySelector(selector);
const money = value => "S/ " + new Intl.NumberFormat("es-PE", {maximumFractionDigits:0}).format(value);
const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const findProduct = id => products.find(product => product.id === id);
const CART_KEY = "cophoneCart", FAVORITES_KEY = "cophoneFavorites", MAX_QUANTITY = 99;
const state = {filter:"all",query:"",sort:"default",onlyFavorites:false,cart:[],favorites:[]};
let toastTimer, dialogReturnFocus = null;

// Persistencia: no se confía en precios ni nombres guardados previamente.
function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
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
  try { localStorage.setItem(key, JSON.stringify(value)); }
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
  if ($("#resultCount")) $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "modelo" : "modelos"}${state.onlyFavorites ? " favoritos" : " disponibles"}`;
  grid.innerHTML = list.length ? list.map(product => {
    const favorite = state.favorites.includes(product.id);
    return `<article class="card" style="--device:${product.device}">
      <div class="card-top"><span class="tag">${escapeHTML(product.tag)}</span><button class="icon-button favorite" data-favorite="${product.id}" aria-label="${favorite ? "Quitar de" : "Añadir a"} favoritos: ${escapeHTML(product.name)}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button></div>
      <button class="product-art" data-detail="${product.id}" aria-label="Ver detalles de ${escapeHTML(product.name)}">${art(product)}</button>
      <div class="swatches" aria-hidden="true"><i></i><i></i><i></i></div>
      <h3><button class="detail-link" data-detail="${product.id}">${escapeHTML(product.name)}</button></h3>
      <p class="spec">${escapeHTML(product.spec)}<br>${escapeHTML(product.storage)} de almacenamiento</p>
      <div class="card-bottom"><div class="price-row"><span class="price">${money(product.price)}</span><span class="stock">Modelo de demo</span></div><button class="primary full" data-add="${product.id}">Añadir al carrito ＋</button></div>
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
  const item = state.cart.find(entry => entry.id === id);
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
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
