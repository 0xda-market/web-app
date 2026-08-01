const LEGACY_STORAGE_PREFIX = "0xda-market.broker-offers.v2";

// Retained for hosts pinned to the previous draft-storage contract. Durable
// broker listings no longer read from or write to browser storage.
export function brokerStorageKey(session) {
  const subject = String(session?.subject || "").trim();
  const environment = String(session?.environment || "").trim();
  if (!subject) throw new TypeError("broker session subject is required");
  if (!environment) throw new TypeError("broker session environment is required");
  return `${LEGACY_STORAGE_PREFIX}:${encodeURIComponent(environment)}:${encodeURIComponent(subject)}`;
}

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

function assertListingTransport(transport) {
  for (const method of ["listBrokerListings", "createBrokerListing", "updateBrokerListing", "withdrawBrokerListing"]) {
    if (typeof transport?.[method] !== "function") throw new TypeError(`transport.${method} must be a function`);
  }
}

function positiveDecimal(value, scale) {
  const text = String(value || "").trim();
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`);
  return pattern.test(text) && /[1-9]/.test(text) ? text : null;
}

function normalizeListing(resource) {
  const attributes = resource?.attributes || {};
  return Object.freeze({
    id: String(resource?.id || ""),
    sku: String(attributes.sku || ""),
    quantity: String(attributes.quantity || ""),
    priceAmount: String(attributes.price_amount || ""),
    currency: String(attributes.currency || ""),
    status: String(attributes.status || ""),
    version: Number(attributes.version),
    updatedAt: String(attributes.updated_at || "")
  });
}

export async function mountBrokerWorkspace({ document, catalog, session, currencies, transport }) {
  if (!["broker", "admin"].includes(session?.role)) return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!Array.isArray(catalog?.products)) throw new TypeError("broker catalog is required");
  if (!Array.isArray(currencies) || currencies.length === 0) throw new TypeError("broker currencies are required");
  assertListingTransport(transport);

  const products = catalog.products;
  const root = element(document, "section", { id: "broker-workspace", className: "broker-workspace" });
  const title = element(document, "h2", {}, "Asset listings");
  const description = element(document, "p", {}, "Set the available quantity and unit price for an asset.");
  const form = element(document, "form", { id: "broker-listing-form" });
  const product = element(document, "select", { name: "product", required: "required" });
  const quantity = element(document, "input", {
    name: "quantity", type: "number", min: "0.000000000001", step: "any", inputmode: "decimal", required: "required"
  });
  const amount = element(document, "input", {
    name: "amount", type: "number", min: "0.00000001", step: "any", inputmode: "decimal", required: "required"
  });
  const currency = element(document, "select", { name: "currency", required: "required" });
  const save = element(document, "button", { type: "submit" }, "Publish listing");
  const status = element(document, "p", { id: "broker-listing-status", role: "status" }, "Loading listings…");
  const list = element(document, "div", { id: "broker-listing-list" });
  let editingId = null;
  let listings = [];

  for (const entry of products) {
    const option = element(document, "option");
    option.value = entry.id;
    option.textContent = entry?.attributes?.name || entry?.attributes?.button_label || entry.id;
    product.append(option);
  }
  for (const code of currencies) {
    const option = element(document, "option", { value: code }, code);
    currency.append(option);
  }
  quantity.value = "1";
  currency.value = currencies[0];

  function field(labelText, control) {
    const label = element(document, "label");
    label.append(element(document, "span", {}, labelText), control);
    return label;
  }

  function resetForm() {
    editingId = null;
    product.disabled = false;
    save.textContent = "Publish listing";
    form.reset();
    quantity.value = "1";
    currency.value = currencies[0];
  }

  async function withdraw(listing) {
    status.textContent = "Withdrawing listing…";
    try {
      await transport.withdrawBrokerListing({ listingId: listing.id, version: listing.version });
      listings = listings.filter((entry) => entry.id !== listing.id);
      if (editingId === listing.id) resetForm();
      render();
      status.textContent = "Listing withdrawn.";
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function render() {
    list.replaceChildren();
    if (!listings.length) {
      list.append(element(document, "p", {}, "No active listings yet."));
      return;
    }
    for (const listing of listings) {
      const productEntry = products.find((entry) => entry.id === listing.sku);
      const card = element(document, "article", { className: "broker-listing" });
      card.append(
        element(document, "strong", {}, productEntry?.attributes?.name || listing.sku),
        element(document, "span", {}, `${listing.quantity} × ${listing.priceAmount} ${listing.currency}`)
      );
      const edit = element(document, "button", { type: "button" }, "Edit");
      edit.addEventListener("click", () => {
        editingId = listing.id;
        product.value = listing.sku;
        product.disabled = true;
        quantity.value = listing.quantity;
        amount.value = listing.priceAmount;
        currency.value = listing.currency;
        save.textContent = "Update listing";
        status.textContent = "Editing listing.";
      });
      const remove = element(document, "button", { type: "button" }, "Withdraw");
      remove.addEventListener("click", () => withdraw(listing));
      card.append(edit, remove);
      list.append(card);
    }
  }

  form.append(
    field("Asset", product),
    field("Available quantity", quantity),
    field("Unit price", amount),
    field("Quote currency", currency),
    save
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedQuantity = positiveDecimal(quantity.value, 12);
    const normalizedAmount = positiveDecimal(amount.value, 8);
    if (!product.value || !normalizedQuantity || !normalizedAmount || !currencies.includes(currency.value)) {
      status.textContent = "Enter a valid asset, quantity, unit price and currency.";
      return;
    }

    save.disabled = true;
    status.textContent = editingId ? "Updating listing…" : "Publishing listing…";
    try {
      let resource;
      if (editingId) {
        const current = listings.find((entry) => entry.id === editingId);
        resource = await transport.updateBrokerListing({
          listingId: editingId,
          quantity: normalizedQuantity,
          priceAmount: normalizedAmount,
          currency: currency.value,
          version: current.version
        });
      } else {
        resource = await transport.createBrokerListing({
          sku: product.value,
          quantity: normalizedQuantity,
          priceAmount: normalizedAmount,
          currency: currency.value
        });
      }
      const listing = normalizeListing(resource);
      const index = listings.findIndex((entry) => entry.id === listing.id);
      if (index >= 0) listings[index] = listing;
      else listings.unshift(listing);
      product.disabled = false;
      resetForm();
      render();
      status.textContent = index >= 0 ? "Listing updated." : "Listing published.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });

  root.append(title, description, form, status, list);
  (document.querySelector("main") || document.body).append(root);
  try {
    const resources = await transport.listBrokerListings();
    if (!Array.isArray(resources)) throw new TypeError("broker listings response must be an array");
    listings = resources.map(normalizeListing);
    render();
    status.textContent = `${listings.length} active listing${listings.length === 1 ? "" : "s"}.`;
  } catch (error) {
    render();
    status.textContent = error.message;
  }

  return { root, form, list, status, getListings: () => [...listings] };
}
