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

function normalizeProposal(resource) {
  const attributes = resource?.attributes || {};
  return {
    sku: String(resource?.id || ""),
    name: String(attributes.name || attributes.short_name || resource?.id || ""),
    position: Number(attributes.position),
    currentAmount: attributes.current_amount_usdt == null ? "" : String(attributes.current_amount_usdt),
    previousAmount: attributes.previous_amount_usdt == null ? "" : String(attributes.previous_amount_usdt),
    currentAppliedAt: attributes.current_applied_at || null,
    currentEditedByUserId: attributes.current_edited_by_user_id || null
  };
}

function normalizeHistory(resource) {
  const attributes = resource?.attributes || {};
  return {
    id: String(resource?.id || ""),
    sku: String(attributes.sku || ""),
    amount: String(attributes.amount_usdt || ""),
    source: String(attributes.source || ""),
    editedByUserId: attributes.edited_by_user_id || null,
    appliedAt: attributes.applied_at || null
  };
}

function assertDocument(document, name) {
  if (!document || !Array.isArray(document.data) || !document.meta || typeof document.meta !== "object") {
    throw new TypeError(`${name} response must contain data and meta`);
  }
  return document;
}

function assertTransport(transport) {
  for (const method of ["getAdminPriceProposal", "applyAdminPrices", "listAdminPriceHistory"]) {
    if (typeof transport?.[method] !== "function") throw new TypeError(`transport.${method} must be a function`);
  }
}

function normalizedAmount(value) {
  const amount = String(value || "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
    throw new TypeError("every price must be a positive decimal with at most 6 fractional digits");
  }
  return amount;
}

export function createAdminPricingController({ transport, locale = "en_US", historyLimit = 20 }) {
  assertTransport(transport);
  let entries = [];
  let history = [];
  let revision = 0;
  let generatedAt = null;
  const drafts = new Map();

  async function load() {
    const [proposalDocument, historyDocument] = await Promise.all([
      transport.getAdminPriceProposal({ locale }),
      transport.listAdminPriceHistory({ limit: historyLimit })
    ]);
    const proposal = assertDocument(proposalDocument, "price proposal");
    const historical = assertDocument(historyDocument, "price history");
    entries = proposal.data.map(normalizeProposal).sort((left, right) => left.position - right.position || left.sku.localeCompare(right.sku));
    history = historical.data.map(normalizeHistory);
    revision = Number(proposal.meta.revision);
    generatedAt = proposal.meta.generated_at || null;
    drafts.clear();
    for (const entry of entries) drafts.set(entry.sku, entry.currentAmount);
    return state();
  }

  function state() {
    return {
      revision,
      generatedAt,
      entries: entries.map((entry) => ({ ...entry, amount: drafts.get(entry.sku) || "" })),
      history: history.map((entry) => ({ ...entry }))
    };
  }

  return {
    load,
    setPrice(sku, amount) {
      const id = String(sku || "");
      if (!entries.some((entry) => entry.sku === id)) throw new RangeError(`price proposal entry is unavailable: ${id}`);
      drafts.set(id, String(amount || ""));
      return state();
    },
    application() {
      return entries.map((entry) => ({
        sku: entry.sku,
        amount_usdt: normalizedAmount(drafts.get(entry.sku))
      }));
    },
    async apply() {
      const prices = this.application();
      await transport.applyAdminPrices({ revision, prices });
      return load();
    },
    state
  };
}

export function mountAdminPrices({ document, session, transport, locale = "en_US", container = document?.body }) {
  if (session?.role !== "admin") return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!container?.append) throw new TypeError("admin prices container is required");

  const i18n = createI18n(locale);
  const controller = createAdminPricingController({ transport, locale: i18n.locale });
  const root = element(document, "section", { id: "admin-prices", className: "admin-prices" });
  const heading = element(document, "h3", {}, i18n.t("prices.title"));
  const description = element(document, "p", {}, i18n.t("prices.description"));
  const status = element(document, "p", { className: "admin-prices-status", role: "status" }, i18n.t("prices.loading"));
  const form = element(document, "form", { className: "admin-price-form" });
  const rows = element(document, "div", { className: "admin-price-rows" });
  const applyButton = element(document, "button", { type: "submit" }, i18n.t("prices.review"));
  const historyHeading = element(document, "h4", {}, i18n.t("prices.history"));
  const historyList = element(document, "div", { className: "admin-price-history" });
  let armed = false;

  function resetConfirmation() {
    armed = false;
    applyButton.textContent = i18n.t("prices.review");
  }

  function renderHistory(items) {
    historyList.replaceChildren(...items.map((entry) => {
      const row = element(document, "article", { className: "admin-price-history-row" });
      row.append(
        element(document, "strong", {}, entry.sku),
        element(document, "span", {}, `${entry.amount} USDT`),
        element(document, "time", {}, entry.appliedAt || i18n.t("prices.unknownTime"))
      );
      return row;
    }));
  }

  function render() {
    const state = controller.state();
    rows.replaceChildren(...state.entries.map((entry) => {
      const row = element(document, "label", { className: "admin-price-row" });
      const input = element(document, "input", {
        type: "text",
        inputmode: "decimal",
        "data-sku": entry.sku,
        "aria-label": i18n.t("prices.inputLabel", { name: entry.name })
      });
      input.value = entry.amount;
      input.addEventListener("input", (event) => {
        controller.setPrice(entry.sku, event.currentTarget.value);
        resetConfirmation();
      });
      row.append(
        element(document, "strong", {}, entry.name),
        element(document, "span", {}, i18n.t("prices.currentPrevious", {
          current: entry.currentAmount || "—",
          previous: entry.previousAmount || "—"
        })),
        input
      );
      return row;
    }));
    renderHistory(state.history);
    status.textContent = i18n.t("prices.summary", { count: state.entries.length, revision: state.revision });
    resetConfirmation();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const prices = controller.application();
      if (!armed) {
        armed = true;
        applyButton.textContent = i18n.t("prices.confirm", { count: prices.length });
        status.textContent = i18n.t("prices.reviewRevision", { revision: controller.state().revision });
        return;
      }
      applyButton.disabled = true;
      status.textContent = i18n.t("prices.applying");
      await controller.apply();
      render();
      status.textContent = i18n.t("prices.applied");
    } catch (error) {
      status.textContent = error.message;
      resetConfirmation();
    } finally {
      applyButton.disabled = false;
    }
  });

  form.append(rows, applyButton);
  root.append(heading, description, status, form, historyHeading, historyList);
  container.append(root);

  const ready = controller.load().then(() => {
    render();
    return controller.state();
  }).catch((error) => {
    status.textContent = error.message;
    throw error;
  });

  return { root, status, form, rows, applyButton, historyList, controller, ready };
}
