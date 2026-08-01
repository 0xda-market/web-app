import { assertHost, assertTransport } from "./contracts.js";

export function createMarketApp({ host, transport, engine, document }) {
  assertHost(host);
  assertTransport(transport);
  if (!engine?.CatalogStore || !engine?.CheckoutController) throw new TypeError("engine must provide CatalogStore and CheckoutController");
  if (!document?.querySelector) throw new TypeError("document is required");

  let store;
  let selectedProduct;
  let bootstrapped = false;
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    action: $("#checkout-action"), category: $("#category"), closeDialog: $("#close-dialog"),
    dialog: $("#checkout-dialog"), dialogCategory: $("#dialog-category"), dialogName: $("#dialog-name"),
    dialogPrice: $("#dialog-price"), dialogStatus: $("#dialog-status"), home: $("#home"), next: $("#next"),
    previous: $("#previous"), products: $("#products"), search: $("#search"), snapshot: $("#snapshot"), status: $("#status")
  };

  const checkout = new engine.CheckoutController({
    quote: (sku) => transport.quote({ sku, locale: host.locale() }),
    accept: (quoteId) => transport.acceptQuote({ quoteId }),
    refresh: (orderId) => transport.refreshOrder({ orderId })
  });

  const pageSize = () => engine.pageSizeForViewport(host.viewport());

  function productCard(product) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product";
    button.disabled = !product.attributes.price;
    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = product.category.label;
    const name = document.createElement("strong");
    name.textContent = product.attributes.button_label || product.attributes.name;
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = engine.formatPrice(product) || "Unavailable";
    button.append(category, name, price);
    button.addEventListener("click", () => openCheckout(product));
    return button;
  }

  function renderCatalog() {
    const view = store.view();
    elements.products.replaceChildren(...view.products.map(productCard));
    elements.previous.disabled = !view.hasPrevious;
    elements.next.disabled = !view.hasNext;
    elements.status.textContent = `${view.totalProducts} products · ${view.page}/${view.pageCount}`;
  }

  function renderCheckout() {
    const state = checkout.state;
    const rows = {
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
      : (rows[state.status] || rows.idle);
    [elements.dialogStatus.textContent, elements.action.textContent, elements.action.disabled] = row;
  }

  function openCheckout(product) {
    selectedProduct = product;
    checkout.reset(product);
    elements.dialogCategory.textContent = product.category.label;
    elements.dialogName.textContent = product.attributes.name;
    elements.dialogPrice.textContent = engine.formatPrice(product) || "Unavailable";
    renderCheckout();
    elements.dialog.showModal();
    host.selectionFeedback();
  }

  async function performCheckout() {
    const status = checkout.state.status;
    const operation = ["idle", "failed", "succeeded"].includes(status) ? checkout.quote(selectedProduct)
      : status === "quoted" ? checkout.accept()
      : ["pending", "accepted"].includes(status) ? checkout.refresh() : null;
    if (!operation) return;
    renderCheckout();
    await operation;
    renderCheckout();
  }

  function bind() {
    elements.search.addEventListener("input", (event) => { store.setQuery(event.currentTarget.value); renderCatalog(); });
    elements.category.addEventListener("change", (event) => { store.setCategory(event.currentTarget.value); renderCatalog(); });
    elements.previous.addEventListener("click", () => { store.previous(); renderCatalog(); host.selectionFeedback(); });
    elements.next.addEventListener("click", () => { store.next(); renderCatalog(); host.selectionFeedback(); });
    elements.home.addEventListener("click", () => { elements.category.value = ""; store.setCategory(null); store.home(); renderCatalog(); });
    elements.closeDialog.addEventListener("click", () => elements.dialog.close());
    elements.action.addEventListener("click", () => performCheckout().catch((error) => {
      elements.dialogStatus.textContent = error.message;
      elements.action.disabled = false;
    }));
    host.onViewportChanged(() => {
      if (!store) return;
      store.setPageSize(pageSize());
      renderCatalog();
    });
  }

  async function start() {
    if (bootstrapped) throw new Error("Market app already started");
    bootstrapped = true;
    const snapshot = engine.createCatalogSnapshot(await transport.bootstrap({ locale: host.locale() }));
    store = new engine.CatalogStore(snapshot, { pageSize: pageSize() });
    elements.snapshot.textContent = `${snapshot.id.slice(0, 8)} · ${snapshot.count}`;
    for (const category of snapshot.categories) elements.category.add(new Option(category.label, category.id));
    bind();
    renderCatalog();
  }

  return { start };
}

export async function mountMarketApp(options) {
  const app = createMarketApp(options);
  await app.start();
  return app;
}
