import { assertHost, assertTransport } from "./contracts.js";
import * as bundledEngine from "./engine.js";
import { createI18n, normalizeLocale } from "./i18n.js";
import { mountMobileInputVisibility } from "./mobile-inputs.js";
import { paymentPendingMessage } from "./payment-status.js";
import { setSectionPending } from "./pending-section.js";

function immutable(value) {
  if (Array.isArray(value)) value.forEach(immutable);
  else if (value && typeof value === "object") Object.values(value).forEach(immutable);
  return value && typeof value === "object" ? Object.freeze(value) : value;
}

function currencyCode(resource) {
  return String(resource?.attributes?.code || resource?.attributes?.short_name || resource?.id || "").trim().toUpperCase();
}

export function createBootstrapContext(document, engine = bundledEngine, locale = document?.meta?.locale) {
  const catalog = engine.createCatalogSnapshot(document);
  const metadata = document.meta || {};
  const rawSession = metadata.session || metadata.user || {};
  const currencies = Array.isArray(metadata.currencies)
    ? metadata.currencies.map(currencyCode).filter(Boolean)
    : [];

  return immutable({
    catalog,
    locale: normalizeLocale(locale || metadata.locale),
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
  mountMobileInputVisibility({ document });

  const i18n = createI18n(host.locale());
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

  function checkoutQuantityControl() {
    const existing = document.querySelector("#checkout-quantity");
    if (existing) return existing;

    const label = document.createElement("label");
    label.className = "checkout-quantity-field";
    const caption = document.createElement("span");
    caption.textContent = i18n.t("checkout.quantity");
    const input = document.createElement("input");
    input.id = "checkout-quantity";
    input.name = "quantity";
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0.000000000001";
    input.step = "any";
    input.required = true;
    input.value = "1";
    input.setAttribute("aria-label", i18n.t("checkout.quantity"));
    label.append(caption, input);
    elements.dialog.append(label);
    return input;
  }

  elements.quantity = checkoutQuantityControl();

  const checkout = new engine.CheckoutController({
    quote: (sku, quantity) => transport.quote({ sku, quantity, locale: i18n.locale }),
    accept: (quoteId) => transport.acceptQuote({ quoteId }),
    refresh: (orderId) => transport.refreshOrder({ orderId })
  });
  const pageSize = () => engine.pageSizeForViewport(host.viewport());

  function localizeShell() {
    document.documentElement?.setAttribute?.("lang", i18n.locale.replace("_", "-"));
    const title = document.querySelector("#market-title");
    if (title) title.textContent = i18n.t("market.title");
    elements.snapshot.textContent = i18n.t("market.loading");
    elements.search.placeholder = i18n.t("search.placeholder");
    elements.search.setAttribute("aria-label", i18n.t("search.placeholder"));
    elements.category.setAttribute("aria-label", i18n.t("category.label"));
    elements.products.setAttribute("aria-label", i18n.t("catalog.productsLabel"));
    elements.status.textContent = i18n.t("catalog.loading");
    elements.previous.setAttribute("aria-label", i18n.t("navigation.previous"));
    elements.next.setAttribute("aria-label", i18n.t("navigation.next"));
    elements.home.textContent = i18n.t("navigation.categories");
    elements.closeDialog.setAttribute("aria-label", i18n.t("checkout.close"));
    elements.quantity.setAttribute("aria-label", i18n.t("checkout.quantity"));
    elements.action.textContent = i18n.t("checkout.requestQuote");
    document.querySelector(".navigation")?.setAttribute?.("aria-label", i18n.t("navigation.pages"));
  }

  function productCard(product) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product";
    button.disabled = !product.attributes.price;
    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = i18n.category(product.category.id, product.category.label);
    const name = document.createElement("strong");
    name.textContent = product.attributes.button_label || product.attributes.name;
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = engine.formatPrice(product) || i18n.t("catalog.unavailable");
    button.append(category, name, price);
    button.addEventListener("click", () => openCheckout(product));
    return button;
  }

  function renderCatalog() {
    const view = store.view();
    elements.products.replaceChildren(...view.products.map(productCard));
    elements.previous.disabled = !view.hasPrevious;
    elements.next.disabled = !view.hasNext;
    elements.status.textContent = i18n.t("catalog.summary", {
      count: view.totalProducts,
      page: view.page,
      pageCount: view.pageCount
    });
  }

  function renderCheckout() {
    const state = checkout.state;
    const rows = {
      idle: [i18n.t("checkout.validate"), i18n.t("checkout.requestQuote"), false],
      quoting: [i18n.t("checkout.requesting"), i18n.t("checkout.requestQuote"), true],
      accepting: [i18n.t("checkout.creating"), i18n.t("checkout.confirm"), true],
      refreshing: [i18n.t("checkout.refreshing"), i18n.t("checkout.refresh"), true],
      payment_pending: [paymentPendingMessage(state.order, i18n.locale), i18n.t("checkout.refresh"), false],
      pending: [i18n.t("checkout.processing"), i18n.t("checkout.refresh"), false],
      accepted: [i18n.t("checkout.processing"), i18n.t("checkout.refresh"), false],
      succeeded: [i18n.t("checkout.completed"), i18n.t("checkout.requestNew"), false],
      failed: [state.error || i18n.t("checkout.failed"), i18n.t("checkout.retry"), false]
    };
    const quotedTotal = state.quote?.attributes?.total_price_usdt;
    const quotedCurrency = state.quote?.attributes?.currency || "USDT";
    const row = state.status === "quoted"
      ? [i18n.t("checkout.quoteSummary", {
        quantity: state.quantity,
        total: quotedTotal || "—",
        currency: quotedCurrency,
        time: new Date(state.quote.attributes.expires_at).toLocaleTimeString(i18n.locale.replace("_", "-"))
      }), i18n.t("checkout.confirm"), false]
      : (rows[state.status] || rows.idle);
    [elements.dialogStatus.textContent, elements.action.textContent, elements.action.disabled] = row;
    elements.quantity.disabled = !["idle", "failed", "succeeded"].includes(state.status);
  }

  function openCheckout(product) {
    selectedProduct = product;
    checkout.reset(product);
    elements.quantity.value = "1";
    elements.dialogCategory.textContent = i18n.category(product.category.id, product.category.label);
    elements.dialogName.textContent = product.attributes.name;
    elements.dialogPrice.textContent = engine.formatPrice(product) || i18n.t("catalog.unavailable");
    renderCheckout();
    elements.dialog.showModal();
    host.selectionFeedback();
  }

  async function performCheckout() {
    const status = checkout.state.status;
    const operation = ["idle", "failed", "succeeded"].includes(status)
      ? checkout.quote(selectedProduct, elements.quantity.value)
      : status === "quoted" ? checkout.accept()
      : ["payment_pending", "pending", "accepted"].includes(status) ? checkout.refresh() : null;
    if (!operation) return;
    setSectionPending(elements.dialog, true);
    renderCheckout();
    try {
      await operation;
      renderCheckout();
    } finally {
      setSectionPending(elements.dialog, false);
    }
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
    localizeShell();
    const bootstrapDocument = await transport.bootstrap({ locale: i18n.locale });
    bootstrapContext = createBootstrapContext(bootstrapDocument, engine, i18n.locale);
    store = new engine.CatalogStore(bootstrapContext.catalog, { pageSize: pageSize() });
    elements.snapshot.textContent = `${bootstrapContext.catalog.id.slice(0, 8)} · ${bootstrapContext.catalog.count}`;
    const all = document.createElement("option");
    all.value = "";
    all.textContent = i18n.t("category.all");
    elements.category.replaceChildren(all);
    for (const category of bootstrapContext.catalog.categories) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = i18n.category(category.id, category.label);
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

export { createI18n, normalizeLocale } from "./i18n.js";
export { paymentPendingMessage } from "./payment-status.js";
export { setSectionPending } from "./pending-section.js";
export { mountMobileInputVisibility } from "./mobile-inputs.js";
export { mountBrokerWorkspace, brokerStorageKey } from "./broker-workspace.js";
export { mountAdminWorkspace, adminWorkspaceSummary } from "./admin-workspace.js";
export { createAdminCatalogController, mountAdminProducts } from "./admin-products.js";
export { createAdminProductController, mountAdminCreateProduct } from "./admin-create-product.js";
export { createAdminPricingController, mountAdminPrices } from "./admin-prices.js";
export { mountWorkspaceNavigation, workspaceSectionsForRole } from "./workspace-navigation.js";
export * from "./engine.js";
