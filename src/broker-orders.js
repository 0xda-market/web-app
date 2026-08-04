import { setSectionPending } from "./pending-section.js";

const COPY = Object.freeze({
  en: {
    title: "Client orders", description: "Only orders allocated to your listing appear here.",
    loading: "Loading orders…", empty: "No client orders yet.", accept: "Accept order",
    complete: "Mark completed", accepting: "Accepting order…", completing: "Completing order…",
    accepted: "Order accepted. The client was notified.", completed: "Order completed. The client was notified."
  },
  uk: {
    title: "Замовлення клієнтів", description: "Тут відображаються лише замовлення, призначені вашому оголошенню.",
    loading: "Завантаження замовлень…", empty: "Нових замовлень поки немає.", accept: "Погодитися",
    complete: "Виконано", accepting: "Погоджуємо замовлення…", completing: "Завершуємо замовлення…",
    accepted: "Замовлення погоджено. Клієнта повідомлено.", completed: "Замовлення виконано. Клієнта повідомлено."
  }
});

function copy(locale) { return COPY[String(locale).toLowerCase().startsWith("uk") ? "uk" : "en"]; }
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
function supported(transport) {
  return ["listBrokerOrders", "acceptBrokerOrder", "completeBrokerOrder"]
    .every((method) => typeof transport?.[method] === "function");
}
function normalize(resource) {
  const a = resource?.attributes || {};
  return Object.freeze({
    id: String(resource?.id || ""), status: String(a.status || "requested"),
    orderStatus: String(a.order_status || ""), paymentStatus: String(a.payment_status || ""),
    name: String(a.product_name || a.sku || ""), quantity: String(a.quantity || ""),
    total: String(a.client_total_price_usdt || ""), currency: String(a.currency || "USDT"),
    version: Number(a.version)
  });
}

export async function mountBrokerOrders({ document, session, transport, locale = "en_US", container }) {
  if (!["broker", "admin"].includes(session?.role) || !supported(transport)) return null;
  const t = copy(locale);
  const root = element(document, "section", { id: "broker-orders", className: "broker-orders" });
  const status = element(document, "p", { role: "status" }, t.loading);
  const list = element(document, "div", { className: "broker-order-list" });
  let orders = [];
  setSectionPending(root, false);

  async function transition(order, operation) {
    setSectionPending(root, true);
    status.textContent = operation === "accept" ? t.accepting : t.completing;
    try {
      const resource = operation === "accept"
        ? await transport.acceptBrokerOrder({ orderId: order.id, version: order.version })
        : await transport.completeBrokerOrder({ orderId: order.id, version: order.version });
      const updated = normalize(resource);
      orders = orders.map((entry) => entry.id === updated.id ? updated : entry);
      render();
      status.textContent = operation === "accept" ? t.accepted : t.completed;
    } catch (error) { status.textContent = error.message; }
    finally { setSectionPending(root, false); }
  }

  function render() {
    list.replaceChildren();
    if (!orders.length) { list.append(element(document, "p", {}, t.empty)); return; }
    for (const order of orders) {
      const card = element(document, "article", { className: "broker-order" });
      card.append(
        element(document, "strong", {}, order.name),
        element(document, "span", {}, `${order.quantity} · ${order.total} ${order.currency}`),
        element(document, "small", {}, `${order.status} · payment: ${order.paymentStatus}`)
      );
      if (order.status === "requested") {
        const button = element(document, "button", { type: "button" }, t.accept);
        button.addEventListener("click", () => transition(order, "accept"));
        card.append(button);
      } else if (order.status === "accepted") {
        const button = element(document, "button", { type: "button" }, t.complete);
        button.disabled = order.paymentStatus !== "confirmed";
        button.addEventListener("click", () => transition(order, "complete"));
        card.append(button);
      }
      list.append(card);
    }
  }

  root.append(element(document, "h3", {}, t.title), element(document, "p", {}, t.description), status, list);
  container.append(root);
  try {
    const resources = await transport.listBrokerOrders();
    if (!Array.isArray(resources)) throw new TypeError("broker orders response must be an array");
    orders = resources.map(normalize); render();
    status.textContent = `${orders.length}`;
  } catch (error) { render(); status.textContent = error.message; }
  return { root, status, list, getOrders: () => [...orders] };
}
