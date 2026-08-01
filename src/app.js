import { runtimeConfig } from "./runtime.js";
import { createTelegramHost } from "./telegram-host.js";

const runtime = runtimeConfig();
const host = createTelegramHost();
const { CatalogStore, CheckoutController, createCatalogSnapshot, formatPrice, pageSizeForViewport } = await import(runtime.webAppCoreUrl);

const $ = (selector) => document.querySelector(selector);
const elements = {
  action: $("#checkout-action"), category: $("#category"), closeDialog: $("#close-dialog"),
  dialog: $("#checkout-dialog"), dialogCategory: $("#dialog-category"), dialogName: $("#dialog-name"),
  dialogPrice: $("#dialog-price"), dialogStatus: $("#dialog-status"), home: $("#home"), next: $("#next"),
  previous: $("#previous"), products: $("#products"), search: $("#search"), snapshot: $("#snapshot"), status: $("#status")
};
let store;
let selectedProduct;
let catalogLoaded = false;

async function api(path, options = {}) {
  const initData = host.initData();
  if (!initData) throw new Error("Open this Mini App inside Telegram.");
  const response = await fetch(`${runtime.apiBaseUrl}${path}`, {
    ...options,
    headers: { accept: "application/json", "content-type": "application/json", "x-telegram-init-data": initData, ...(options.headers || {}) }
  });
  const document = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(document.message || document.error || `HTTP ${response.status}`);
  return document;
}

const checkout = new CheckoutController({
  quote: (sku) => api("/quotes", { method: "POST", body: JSON.stringify({ sku, locale: host.locale() }) }).then((x) => x.data),
  accept: (id) => api(`/quotes/${encodeURIComponent(id)}/accept`, { method: "POST", body: "{}" }).then((x) => x.data),
  refresh: (id) => api(`/orders/${encodeURIComponent(id)}`).then((x) => x.data)
});

function pageSize() { return pageSizeForViewport({ width: innerWidth, height: host.viewportHeight() }); }
function renderCatalog() {
  const view = store.view();
  elements.products.replaceChildren(...view.products.map(productCard));
  elements.previous.disabled = !view.hasPrevious;
  elements.next.disabled = !view.hasNext;
  elements.status.textContent = `${view.totalProducts} products · ${view.page}/${view.pageCount}`;
}
function productCard(product) {
  const button = document.createElement("button");
  button.type = "button"; button.className = "product"; button.disabled = !product.attributes.price;
  button.innerHTML = `<span class="product-category"></span><strong></strong><span class="product-price"></span>`;
  button.children[0].textContent = product.category.label;
  button.children[1].textContent = product.attributes.button_label || product.attributes.name;
  button.children[2].textContent = formatPrice(product) || "Unavailable";
  button.addEventListener("click", () => openCheckout(product));
  return button;
}
function openCheckout(product) {
  selectedProduct = product; checkout.reset(product);
  elements.dialogCategory.textContent = product.category.label;
  elements.dialogName.textContent = product.attributes.name;
  elements.dialogPrice.textContent = formatPrice(product) || "Unavailable";
  renderCheckout(); elements.dialog.showModal(); host.selectionFeedback();
}
function renderCheckout() {
  const state = checkout.state;
  const presentation = {
    idle: ["The current price will be validated before purchase.", "Request quote", false],
    quoting: ["Requesting current quote…", "Request quote", true],
    accepting: ["Creating order…", "Confirm purchase", true],
    refreshing: ["Refreshing order…", "Refresh order", true],
    pending: ["Order is being processed.", "Refresh order", false],
    accepted: ["Order is being processed.", "Refresh order", false],
    succeeded: ["Purchase completed ✅", "Request new quote", false],
    failed: [state.error || "The operation failed.", "Try again", false]
  };
  const row = state.status === "quoted"
    ? [`Quote expires ${new Date(state.quote.attributes.expires_at).toLocaleTimeString()}.`, "Confirm purchase", false]
    : (presentation[state.status] || presentation.idle);
  [elements.dialogStatus.textContent, elements.action.textContent, elements.action.disabled] = row;
}
async function performCheckout() {
  const status = checkout.state.status;
  const operation = ["idle", "failed", "succeeded"].includes(status) ? checkout.quote(selectedProduct)
    : status === "quoted" ? checkout.accept()
    : ["pending", "accepted"].includes(status) ? checkout.refresh() : null;
  if (!operation) return;
  renderCheckout(); await operation; renderCheckout();
}
async function start() {
  host.initialize();
  if (catalogLoaded) throw new Error("Catalog bootstrap already completed.");
  catalogLoaded = true;
  const snapshot = await api(`/bootstrap?${new URLSearchParams({ locale: host.locale() })}`).then(createCatalogSnapshot);
  store = new CatalogStore(snapshot, { pageSize: pageSize() });
  elements.snapshot.textContent = `${snapshot.id.slice(0, 8)} · ${snapshot.count}`;
  for (const category of snapshot.categories) elements.category.add(new Option(category.label, category.id));
  renderCatalog();
}

elements.search.addEventListener("input", (event) => { store.setQuery(event.currentTarget.value); renderCatalog(); });
elements.category.addEventListener("change", (event) => { store.setCategory(event.currentTarget.value); renderCatalog(); });
elements.previous.addEventListener("click", () => { store.previous(); renderCatalog(); host.selectionFeedback(); });
elements.next.addEventListener("click", () => { store.next(); renderCatalog(); host.selectionFeedback(); });
elements.home.addEventListener("click", () => { elements.category.value = ""; store.setCategory(null); store.home(); renderCatalog(); });
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.action.addEventListener("click", () => performCheckout().catch((error) => { elements.dialogStatus.textContent = error.message; elements.action.disabled = false; }));
host.onViewportChanged(() => { if (store) { store.setPageSize(pageSize()); renderCatalog(); } });
start().catch((error) => { elements.status.textContent = error.message; elements.status.dataset.error = "true"; });
