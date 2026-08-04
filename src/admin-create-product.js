import { createI18n } from "./i18n.js";
import { setSectionPending } from "./pending-section.js";

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

function assertTransport(transport) {
  if (typeof transport?.createAdminProduct !== "function") {
    throw new TypeError("transport.createAdminProduct must be a function");
  }
}

function metadataDocument(value) {
  const parsed = JSON.parse(String(value || "{}"));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TypeError("metadata must be a JSON object");
  }
  return parsed;
}

export function createAdminProductController({ transport }) {
  assertTransport(transport);
  return Object.freeze({
    async create({ sku, shortName, position, marketable, metadata, locale, fullName, buttonLabel }) {
      const normalizedSku = String(sku || "").trim();
      if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalizedSku)) {
        throw new TypeError("SKU must use lowercase letters, numbers, underscores or hyphens");
      }
      return transport.createAdminProduct({
        sku: normalizedSku,
        attributes: {
          short_name: String(shortName || "").trim(),
          status: "inactive",
          position: Number(position),
          marketable: Boolean(marketable),
          metadata
        },
        localization: {
          locale: String(locale || "en_US").trim().replaceAll("-", "_"),
          fullName: String(fullName || "").trim(),
          buttonLabel: String(buttonLabel || "").trim()
        }
      });
    }
  });
}

export function mountAdminCreateProduct({
  document,
  session,
  transport,
  locale = "en_US",
  container = document?.body,
  onCreated = async () => {}
}) {
  if (session?.role !== "admin") return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!container?.append) throw new TypeError("admin create-product container is required");

  const i18n = createI18n(locale);
  const controller = createAdminProductController({ transport });
  const root = element(document, "section", { id: "admin-create-product", className: "admin-create-product" });
  const heading = element(document, "h3", {}, i18n.t("products.createTitle"));
  const description = element(document, "p", {}, i18n.t("products.createDescription"));
  const status = element(document, "p", { className: "admin-products-status", role: "status" }, "");
  const form = element(document, "form", { className: "admin-product-form" });
  const sku = element(document, "input", { name: "sku", required: "required", maxlength: "64", autocomplete: "off" });
  const shortName = element(document, "input", { name: "short_name", required: "required", maxlength: "64" });
  const position = element(document, "input", { name: "position", type: "number", min: "0", step: "1", required: "required" });
  const marketable = element(document, "input", { name: "marketable", type: "checkbox" });
  const metadata = element(document, "textarea", { name: "metadata", rows: "5" });
  const localizationLocale = element(document, "input", { name: "locale", required: "required", placeholder: "en_US" });
  const fullName = element(document, "input", { name: "full_name", required: "required", maxlength: "160" });
  const buttonLabel = element(document, "input", { name: "button_label", required: "required", maxlength: "64" });
  const save = element(document, "button", { type: "submit" }, i18n.t("products.create"));
  setSectionPending(root, false);

  position.value = "0";
  marketable.checked = true;
  metadata.value = "{}";
  localizationLocale.value = i18n.locale;

  function field(labelText, control) {
    const label = element(document, "label");
    label.append(element(document, "span", {}, labelText), control);
    return label;
  }

  form.append(
    field(i18n.t("products.sku"), sku),
    field(i18n.t("products.shortName"), shortName),
    field(i18n.t("products.position"), position),
    field(i18n.t("products.marketable"), marketable),
    field(i18n.t("products.metadata"), metadata),
    field(i18n.t("products.locale"), localizationLocale),
    field(i18n.t("products.fullName"), fullName),
    field(i18n.t("products.buttonLabel"), buttonLabel),
    save
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    setSectionPending(root, true);
    status.textContent = i18n.t("products.creating");
    try {
      const resource = await controller.create({
        sku: sku.value,
        shortName: shortName.value,
        position: position.value,
        marketable: marketable.checked,
        metadata: metadataDocument(metadata.value),
        locale: localizationLocale.value,
        fullName: fullName.value,
        buttonLabel: buttonLabel.value
      });
      await onCreated(resource);
      form.reset();
      position.value = "0";
      marketable.checked = true;
      metadata.value = "{}";
      localizationLocale.value = i18n.locale;
      status.textContent = i18n.t("products.createdInactive", { sku: resource?.id || sku.value });
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setSectionPending(root, false);
      save.disabled = false;
    }
  });

  root.append(heading, description, status, form);
  container.append(root);
  return { root, form, status, controller };
}
