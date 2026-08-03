import { createI18n } from "./i18n.js";

function element(document, tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else if (key === "type") node.type = value;
    else node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

function normalizeLocalization(resource) {
  const attributes = resource?.attributes || {};
  return {
    id: String(resource?.id || ""),
    locale: String(attributes.locale || ""),
    fullName: String(attributes.full_name || ""),
    buttonLabel: String(attributes.button_label || ""),
    version: Number(attributes.version)
  };
}

function normalizeProduct(resource) {
  const attributes = resource?.attributes || {};
  return {
    id: String(resource?.id || ""),
    shortName: String(attributes.short_name || ""),
    status: String(attributes.status || ""),
    position: Number(attributes.position),
    marketable: Boolean(attributes.marketable),
    metadata: attributes.metadata && typeof attributes.metadata === "object" ? attributes.metadata : {},
    version: Number(attributes.version),
    localizations: Array.isArray(attributes.localizations)
      ? attributes.localizations.map(normalizeLocalization)
      : []
  };
}

function assertTransport(transport) {
  for (const method of ["listAdminProducts", "updateAdminProduct", "saveAdminProductLocalization"]) {
    if (typeof transport?.[method] !== "function") throw new TypeError(`transport.${method} must be a function`);
  }
}

export function createAdminCatalogController({ transport, locale = "en_US" }) {
  assertTransport(transport);
  let products = [];
  let selectedId = null;

  function selected() {
    return products.find((product) => product.id === selectedId) || null;
  }

  function replaceProduct(resource) {
    const product = normalizeProduct(resource);
    const index = products.findIndex((entry) => entry.id === product.id);
    if (index >= 0) products[index] = product;
    else products.push(product);
    selectedId = product.id;
    return product;
  }

  return {
    async load() {
      const resources = await transport.listAdminProducts({ locale });
      if (!Array.isArray(resources)) throw new TypeError("admin products response must be an array");
      products = resources.map(normalizeProduct);
      selectedId = products[0]?.id || null;
      return this.state();
    },
    select(productId) {
      const id = String(productId || "");
      if (!products.some((product) => product.id === id)) throw new RangeError(`admin product is unavailable: ${id}`);
      selectedId = id;
      return selected();
    },
    async updateProduct(attributes) {
      const current = selected();
      if (!current) throw new Error("select a product first");
      return replaceProduct(await transport.updateAdminProduct({
        sku: current.id,
        version: current.version,
        attributes
      }));
    },
    async saveLocalization({ locale: localizationLocale, fullName, buttonLabel }) {
      const current = selected();
      if (!current) throw new Error("select a product first");
      const normalizedLocale = String(localizationLocale || "").trim().replaceAll("-", "_");
      const existing = current.localizations.find((entry) => entry.locale === normalizedLocale);
      const resource = await transport.saveAdminProductLocalization({
        sku: current.id,
        locale: normalizedLocale,
        fullName,
        buttonLabel,
        ...(existing ? { version: existing.version } : {})
      });
      const localization = normalizeLocalization(resource);
      const index = current.localizations.findIndex((entry) => entry.locale === localization.locale);
      if (index >= 0) current.localizations[index] = localization;
      else current.localizations.push(localization);
      current.localizations.sort((left, right) => left.locale.localeCompare(right.locale));
      return localization;
    },
    state() {
      return {
        products: products.map((product) => ({ ...product, localizations: product.localizations.map((item) => ({ ...item })) })),
        selected: selected() && { ...selected(), localizations: selected().localizations.map((item) => ({ ...item })) }
      };
    }
  };
}

export function mountAdminProducts({ document, session, transport, locale = "en_US", container = document?.body }) {
  if (session?.role !== "admin") return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!container?.append) throw new TypeError("admin products container is required");

  const i18n = createI18n(locale);
  const controller = createAdminCatalogController({ transport, locale: i18n.locale });
  const root = element(document, "section", { id: "admin-products", className: "admin-products" });
  const heading = element(document, "h3", {}, i18n.t("products.title"));
  const description = element(document, "p", {}, i18n.t("products.description"));
  const status = element(document, "p", { className: "admin-products-status", role: "status" }, i18n.t("products.loading"));
  const productSelect = element(document, "select", { "aria-label": i18n.t("products.product") });
  const productForm = element(document, "form", { className: "admin-product-form" });
  const shortName = element(document, "input", { name: "short_name", required: "required", maxlength: "64" });
  const productStatus = element(document, "select", { name: "status" });
  for (const value of ["active", "inactive"]) {
    productStatus.append(element(document, "option", { value }, i18n.t(`products.${value}`)));
  }
  const position = element(document, "input", { name: "position", type: "number", min: "0", step: "1", required: "required" });
  const marketable = element(document, "input", { name: "marketable", type: "checkbox" });
  const metadata = element(document, "textarea", { name: "metadata", rows: "6" });
  const saveProduct = element(document, "button", { type: "submit" }, i18n.t("products.save"));
  const localizationForm = element(document, "form", { className: "admin-localization-form" });
  const localizationLocale = element(document, "input", { name: "locale", required: "required", placeholder: "uk_UA" });
  const fullName = element(document, "input", { name: "full_name", required: "required", maxlength: "160" });
  const buttonLabel = element(document, "input", { name: "button_label", required: "required", maxlength: "64" });
  const saveLocalization = element(document, "button", { type: "submit" }, i18n.t("products.saveLocalization"));
  const localizationList = element(document, "div", { className: "admin-localization-list" });

  function field(label, control) {
    const wrapper = element(document, "label");
    wrapper.append(element(document, "span", {}, label), control);
    return wrapper;
  }

  function fillLocalization(localization = null) {
    localizationLocale.value = localization?.locale || "";
    fullName.value = localization?.fullName || "";
    buttonLabel.value = localization?.buttonLabel || "";
  }

  function renderSelected() {
    const current = controller.state().selected;
    if (!current) {
      productForm.hidden = true;
      localizationForm.hidden = true;
      localizationList.replaceChildren();
      return;
    }
    productForm.hidden = false;
    localizationForm.hidden = false;
    productSelect.value = current.id;
    shortName.value = current.shortName;
    productStatus.value = current.status;
    position.value = String(current.position);
    marketable.checked = current.marketable;
    metadata.value = JSON.stringify(current.metadata, null, 2);
    localizationList.replaceChildren(...current.localizations.map((localization) => {
      const button = element(document, "button", { type: "button", "data-locale": localization.locale }, localization.locale);
      button.addEventListener("click", () => fillLocalization(localization));
      return button;
    }));
    fillLocalization(current.localizations.find((entry) => entry.locale === i18n.locale) || current.localizations[0]);
  }

  function renderProducts() {
    const state = controller.state();
    productSelect.replaceChildren(...state.products.map((product) =>
      element(document, "option", { value: product.id }, `${product.shortName} · ${i18n.t(`products.${product.status}`)}`)
    ));
    renderSelected();
  }

  productSelect.addEventListener("change", (event) => {
    controller.select(event.currentTarget.value);
    renderSelected();
  });
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveProduct.disabled = true;
    status.textContent = i18n.t("products.saving");
    try {
      const parsedMetadata = JSON.parse(metadata.value || "{}");
      if (!parsedMetadata || Array.isArray(parsedMetadata) || typeof parsedMetadata !== "object") {
        throw new TypeError(i18n.t("products.metadataError"));
      }
      await controller.updateProduct({
        short_name: shortName.value.trim(),
        status: productStatus.value,
        position: Number(position.value),
        marketable: Boolean(marketable.checked),
        metadata: parsedMetadata
      });
      renderProducts();
      status.textContent = i18n.t("products.saved");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      saveProduct.disabled = false;
    }
  });
  localizationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveLocalization.disabled = true;
    status.textContent = i18n.t("products.savingLocalization");
    try {
      await controller.saveLocalization({
        locale: localizationLocale.value,
        fullName: fullName.value.trim(),
        buttonLabel: buttonLabel.value.trim()
      });
      renderSelected();
      status.textContent = i18n.t("products.localizationSaved");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      saveLocalization.disabled = false;
    }
  });

  productForm.append(
    field(i18n.t("products.shortName"), shortName),
    field(i18n.t("products.status"), productStatus),
    field(i18n.t("products.position"), position),
    field(i18n.t("products.marketable"), marketable),
    field(i18n.t("products.metadata"), metadata),
    saveProduct
  );
  localizationForm.append(
    field(i18n.t("products.locale"), localizationLocale),
    field(i18n.t("products.fullName"), fullName),
    field(i18n.t("products.buttonLabel"), buttonLabel),
    saveLocalization
  );
  root.append(heading, description, status, productSelect, productForm, localizationList, localizationForm);
  container.append(root);

  const ready = controller.load().then(() => {
    renderProducts();
    status.textContent = i18n.t("products.count", { count: controller.state().products.length });
    return controller.state();
  }).catch((error) => {
    status.textContent = error.message;
    throw error;
  });

  return { root, status, productSelect, productForm, localizationForm, controller, ready };
}
