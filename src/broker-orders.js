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

function supported(transport) {
  return ["listBrokerOrders", "acceptBrokerOrder", "completeBrokerOrder"]
    .every((method) => typeof transport?.[method] === "function");
}

function normalize(resource) {
  const attributes = resource?.attributes || {};
  return Object.freeze({
    id: String(resource?.id || ""),
    status: String(attributes.status || "requested"),
    orderStatus: String(attributes.order_status || ""),
    paymentStatus: String(attributes.payment_status || ""),
    sku: String(attributes.sku || ""),
    name: String(attributes.product_name || attributes.sku || ""),
    quantity: String(attributes.quantity || ""),
    total: String(attributes.client_total_price_usdt || ""),
    currency: String(attributes.currency || "USDT"),
    version: Number(attributes.version)
  });
}

export async function mountBrokerOrders({ document, session, transport, locale = "en_US", container }) {
  if (!["broker", "admin"].includes(session?.role) || !supported(transport)) return null;
  const i18n = createI18n(locale);
  const root = element(document, "section", { id: "broker-orders", className: "broker-orders" });
  const title = element(document, "h3", {}, i18n.t("brokerOrders.title"));
  const description = element(document, "p", {}, i18n.t("brokerOrders.description"));
  const status = element(document, "p", { role: "status" }, i18n.t("brokerOrders.loading"));
  const list = element(document, "div", { className: "broker-order-list" });
  let orders = [];
  setSectionPending(root, false);

  async function transition(order, operation) {
    setSectionPending(root, true);
    status.textContent = operation === "accept"
      ? i18n.t("brokerOrders.accepting")
      : i18n.t("brokerOrders.completing");
    try {
      const resource = operation === "accept"
        ? await transport.acceptBrokerOrder({ orderId: order.id, version: order.version })
        : await transport.completeBrokerOrder({ orderId: order.id, version: order.version });
      const updated = normalize(resource);
      orders = orders.map((entry) => entry.id === updated.id ? updated : entry);
      render();
      status.textContent = operation === "accept"
        ? i18n.t("brokerOrders.accepted")
        : i18n.t("brokerOrders.completed");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setSectionPending(root, false);
    }
  }

  function render() {
    list.replaceChildren();
    if (!orders.length) {
      list.append(element(document, "p", {}, i18n.t("brokerOrders.empty")));
      return;
    }
    for (const order of orders) {
      const card = element(document, "article", { className: "broker-order" });
      card.append(
        element(document, "strong", {}, order.name),
        element(document, "span", {}, i18n.t("brokerOrders.summary", {
          quantity: order.quantity,
          total: order.total,
          currency: order.currency
        })),
        element(document, "small", {}, i18n.t("brokerOrders.state", {
          status: order.status,
          payment: order.paymentStatus
        }))
      );
      if (order.status === "requested") {
        const accept = element(document, "button", { type: "button" }, i18n.t("brokerOrders.accept"));
        accept.addEventListener("click", () => transition(order, "accept"));
        card.append(accept);
      } else if (order.status === "accepted") {
        const complete = element(document, "button", { type: "button" }, i18n.t("brokerOrders.complete"));
        complete.disabled = order.paymentStatus !== "confirmed";
        card.append(complete);
        complete.addEventListener("click", () => transition(order, "complete"));
      }
      list.append(card);
    }
  }

  root.append(title, description, status, list);
  container.append(root);
  try {
    const resources = await transport.listBrokerOrders();
    if (!Array.isArray(resources)) throw new TypeError("broker orders response must be an array");
    orders = resources.map(normalize);
    render();
    status.textContent = i18n.t("brokerOrders.count", { count: orders.length });
  } catch (error) {
    render();
    status.textContent = error.message;
  }

  return { root, status, list, getOrders: () => [...orders] };
}
