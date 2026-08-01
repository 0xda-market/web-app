const STORAGE_KEY = "0xda-market.broker-offers.v1";
const CURRENCIES = ["USDT", "USD", "EUR", "UAH", "TON", "BTC", "ETH"];

function sessionRole(snapshot) {
  return snapshot?.metadata?.role || snapshot?.meta?.role || snapshot?.user?.role || snapshot?.session?.role || null;
}

function productsFrom(snapshot) {
  return Array.isArray(snapshot?.products) ? snapshot.products : [];
}

function readOffers(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOffers(storage, offers) {
  storage.setItem(STORAGE_KEY, JSON.stringify(offers));
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

export function mountBrokerWorkspace({ document, snapshot, storage = globalThis.localStorage }) {
  const role = sessionRole(snapshot);
  if (!["broker", "admin"].includes(role)) return null;

  const products = productsFrom(snapshot);
  const root = element(document, "section", { id: "broker-workspace", className: "broker-workspace" });
  const title = element(document, "h2", {}, "Broker workspace");
  const description = element(document, "p", {}, "Create and update local offer drafts. Product, quantity, amount and quote currency remain editable.");
  const form = element(document, "form", { id: "broker-offer-form" });
  const product = element(document, "select", { name: "product", required: "required" });
  const quantity = element(document, "input", { name: "quantity", type: "number", min: "1", step: "1", value: "1", required: "required" });
  const amount = element(document, "input", { name: "amount", type: "number", min: "0", step: "0.000001", inputmode: "decimal", required: "required" });
  const currency = element(document, "select", { name: "currency", required: "required" });
  const save = element(document, "button", { type: "submit" }, "Save offer");
  const status = element(document, "p", { id: "broker-offer-status", role: "status" });
  const list = element(document, "div", { id: "broker-offer-list" });
  let editingId = null;
  let offers = readOffers(storage);

  for (const entry of products) {
    const option = element(document, "option");
    option.value = entry.id;
    option.textContent = entry?.attributes?.name || entry?.attributes?.button_label || entry.id;
    product.append(option);
  }
  for (const code of CURRENCIES) {
    const option = element(document, "option", { value: code }, code);
    currency.append(option);
  }

  function field(labelText, control) {
    const label = element(document, "label");
    label.append(element(document, "span", {}, labelText), control);
    return label;
  }

  function render() {
    list.replaceChildren();
    if (!offers.length) {
      list.append(element(document, "p", {}, "No offer drafts yet."));
      return;
    }
    for (const offer of offers) {
      const productEntry = products.find((entry) => entry.id === offer.productId);
      const card = element(document, "article", { className: "broker-offer" });
      card.append(
        element(document, "strong", {}, productEntry?.attributes?.name || offer.productId),
        element(document, "span", {}, `${offer.quantity} × ${offer.amount} ${offer.currency}`)
      );
      const edit = element(document, "button", { type: "button" }, "Edit");
      edit.addEventListener("click", () => {
        editingId = offer.id;
        product.value = offer.productId;
        quantity.value = String(offer.quantity);
        amount.value = String(offer.amount);
        currency.value = offer.currency;
        save.textContent = "Update offer";
        status.textContent = "Editing offer draft.";
      });
      const remove = element(document, "button", { type: "button" }, "Delete");
      remove.addEventListener("click", () => {
        offers = offers.filter((entry) => entry.id !== offer.id);
        writeOffers(storage, offers);
        render();
        status.textContent = "Offer draft deleted.";
      });
      card.append(edit, remove);
      list.append(card);
    }
  }

  form.append(
    field("Product", product),
    field("Quantity", quantity),
    field("Amount", amount),
    field("Currency", currency),
    save
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const offer = {
      id: editingId || globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      productId: product.value,
      quantity: Number(quantity.value),
      amount: Number(amount.value),
      currency: currency.value,
      updatedAt: new Date().toISOString()
    };
    if (!offer.productId || !Number.isFinite(offer.quantity) || offer.quantity <= 0 || !Number.isFinite(offer.amount) || offer.amount < 0) {
      status.textContent = "Enter a valid product, quantity and amount.";
      return;
    }
    const index = offers.findIndex((entry) => entry.id === offer.id);
    if (index >= 0) offers[index] = offer;
    else offers.unshift(offer);
    writeOffers(storage, offers);
    editingId = null;
    save.textContent = "Save offer";
    form.reset();
    quantity.value = "1";
    currency.value = "USDT";
    status.textContent = "Offer draft saved locally.";
    render();
  });

  root.append(title, description, form, status, list);
  (document.querySelector("main") || document.body).append(root);
  render();
  return { root, getOffers: () => [...offers] };
}
