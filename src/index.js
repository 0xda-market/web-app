import { assertHost, assertTransport } from "./contracts.js";
import * as bundledEngine from "./engine.js";

function immutable(value) {
  if (Array.isArray(value)) value.forEach(immutable);
  else if (value && typeof value === "object") Object.values(value).forEach(immutable);
  return value && typeof value === "object" ? Object.freeze(value) : value;
}

function currencyCode(resource) {
  return String(resource?.attributes?.code || resource?.attributes?.short_name || resource?.id || "").trim().toUpperCase();
}

export function createBootstrapContext(document, engine = bundledEngine) {
  const catalog = engine.createCatalogSnapshot(document);
  const metadata = document.meta || {};
  const rawSession = metadata.session || metadata.user || {};
  const currencies = Array.isArray(metadata.currencies)
    ? metadata.currencies.map(currencyCode).filter(Boolean)
    : [];

  return immutable({
    catalog,
    session: {
      role: rawSession.role || null,
      status: rawSession.status || null,
      subject: rawSession.subject || null,
      environment: rawSession.environment || metadata.environment || null
    },
    currencies: [...new Set(currencies)]
  });
}

export function createMarketApp({ host, transport, engine = bundledEngine, document }) {
  assertHost(host);
  assertTransport(transport);
  if (!engine?.CatalogStore || !engine?.CheckoutController || !engine?.createCatalogSnapshot) {
    throw new TypeError("engine must provide catalog and checkout primitives");
  }
  if (!document?.querySelector || !document?.createElement) throw new TypeError("document is required");

  let store;
  let selectedProduct;
  let bootstrapContext;
  let bootstrapped = false;
  const required = (selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new TypeError(`required WebApp element is missing: ${selector}`);
    return node;
  };
  const elements = {
    action: required("#checkout-action"), category: required("#category"), closeDialog: required("#close-dialog"),
    dialog: required("#checkout-dialog"), dialogCategory: required("#dialog-category"), dialogName: required("#dialog-name"),
    dialogPrice: required("#dialog-price"), dialogStatus: required("#dialog-status"), home: required("#home"), next: required("#next"),
    previous: required("#previous"), products: required("#products"), search: required("#search"), snapshot: required("#snapshot"), status: required("#status")
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
    const bootstrapDocument = await transport.bootstrap({ locale: host.locale() });
    bootstrapContext = createBootstrapContext(bootstrapDocument, engine);
    store = new engine.CatalogStore(bootstrapContext.catalog, { pageSize: pageSize() });
    elements.snapshot.textContent = `${bootstrapContext.catalog.id.slice(0, 8)} · ${bootstrapContext.catalog.count}`;
    for (const category of bootstrapContext.catalog.categories) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      elements.category.append(option);
    }
    bind();
    renderCatalog();
    return bootstrapContext;
  }

  return {
    start,
    context() {
      if (!bootstrapContext) throw new Error("Market app has not started");
      return bootstrapContext;
    }
  };
}

export async function mountMarketApp(options) {
  const app = createMarketApp(options);
  await app.start();
  return app;
}

export { mountBrokerWorkspace, brokerStorageKey } from "./broker-workspace.js";
export { mountAdminWorkspace, adminWorkspaceSummary } from "./admin-workspace.js";
export { mountWorkspaceNavigation, workspaceSectionsForRole } from "./workspace-navigation.js";
export * from "./engine.js";
