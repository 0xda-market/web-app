import { createI18n } from "./i18n.js";
import { setSectionPending } from "./pending-section.js";

const LIFECYCLE_STEPS = Object.freeze(["requested", "accepted", "payment", "fulfillment", "completion"]);

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

// Order state is a lifecycle, not a flat list of buttons. Every step is emitted
// for every order so the rail keeps its geometry; only the step states change.
// The server contract remains authoritative: this reads reported state, it
// never advances it.
export function orderLifecycle(order = {}) {
  const status = String(order.status || "requested");
  const orderStatus = String(order.orderStatus || "");
  const paymentStatus = String(order.paymentStatus || "");
  const failed = [status, orderStatus, paymentStatus].includes("failed");
  const completed = status === "completed" || orderStatus === "succeeded";
  const accepted = completed || status === "accepted";
  const paid = completed || paymentStatus === "confirmed";
  const reached = { requested: true, accepted, payment: paid, fulfillment: completed, completion: completed };
  const current = LIFECYCLE_STEPS.find((step) => !reached[step]) || null;
  return LIFECYCLE_STEPS.map((step) => ({
    step,
    state: reached[step] ? "complete"
      : failed && (step === current || step === "completion") ? "failed"
      : step === current ? "current"
      : "upcoming"
  }));
}

function lifecycleRail(document, i18n, order) {
  const rail = element(document, "ol", {
    className: "order-lifecycle-rail",
    "data-order-lifecycle": order.id,
    "aria-label": i18n.t("orders.lifecycle")
  });
  for (const { step, state } of orderLifecycle(order)) {
    const item = element(document, "li", {
      className: "order-lifecycle-step",
      "data-lifecycle-step": step,
      "data-lifecycle-state": state
    });
    if (state === "current") item.setAttribute("aria-current", "step");
    item.append(element(document, "span", { className: "order-lifecycle-step-label" }, i18n.t(
      step === "completion" && state === "failed" ? "orders.step.failure" : `orders.step.${step}`
    )));
    rail.append(item);
  }
  return rail;
}

export async function mountBrokerOrders({ document, session, transport, locale = "en_US", container }) {
  if (!["broker", "admin"].includes(session?.role) || !supported(transport)) return null;
  const i18n = createI18n(locale);
  const root = element(document, "section", { id: "broker-orders", className: "broker-orders" });
  const status = element(document, "p", { className: "broker-orders-status", role: "status" }, i18n.t("orders.loading"));
  const list = element(document, "div", { className: "broker-order-list" });
  let orders = [];
  setSectionPending(root, false);

  async function transition(order, operation) {
    setSectionPending(root, true);
    status.textContent = i18n.t(operation === "accept" ? "orders.accepting" : "orders.completing");
    try {
      const resource = operation === "accept"
        ? await transport.acceptBrokerOrder({ orderId: order.id, version: order.version })
        : await transport.completeBrokerOrder({ orderId: order.id, version: order.version });
      const updated = normalize(resource);
      orders = orders.map((entry) => entry.id === updated.id ? updated : entry);
      render();
      status.textContent = i18n.t(operation === "accept" ? "orders.accepted" : "orders.completed");
    } catch (error) { status.textContent = error.message; }
    finally { setSectionPending(root, false); }
  }

  // An action is rendered only where the server contract permits the next
  // transition; a step the operator cannot take yet is expressed by the rail.
  function orderActions(order) {
    const actions = element(document, "div", { className: "broker-order-actions" });
    const permitted = order.status === "requested"
      ? ["accept", i18n.t("orders.accept")]
      : order.status === "accepted" && order.paymentStatus === "confirmed"
        ? ["complete", i18n.t("orders.complete")]
        : null;
    if (!permitted) return actions;
    const [operation, label] = permitted;
    const button = element(document, "button", {
      type: "button",
      className: "broker-order-action",
      "data-order-action": operation
    }, label);
    button.addEventListener("click", () => transition(order, operation));
    actions.append(button);
    return actions;
  }

  function orderCard(order) {
    const card = element(document, "article", {
      className: "broker-order",
      "data-order": order.id,
      "data-order-status": order.status,
      "data-payment-status": order.paymentStatus
    });
    const header = element(document, "header", { className: "broker-order-header" });
    header.append(
      element(document, "strong", { className: "broker-order-product" }, order.name),
      element(document, "span", { className: "broker-order-summary" }, i18n.t("orders.summary", {
        quantity: order.quantity,
        total: order.total,
        currency: order.currency
      }))
    );
    card.append(header, lifecycleRail(document, i18n, order), orderActions(order));
    return card;
  }

  function render() {
    if (!orders.length) {
      list.replaceChildren(element(document, "p", { className: "broker-order-empty" }, i18n.t("orders.empty")));
      return;
    }
    list.replaceChildren(...orders.map(orderCard));
  }

  root.append(
    element(document, "h3", {}, i18n.t("orders.title")),
    element(document, "p", {}, i18n.t("orders.description")),
    status,
    list
  );
  container.append(root);
  try {
    const resources = await transport.listBrokerOrders();
    if (!Array.isArray(resources)) throw new TypeError("broker orders response must be an array");
    orders = resources.map(normalize); render();
    status.textContent = i18n.t("orders.count", { count: orders.length });
  } catch (error) { render(); status.textContent = error.message; }
  return { root, status, list, getOrders: () => [...orders] };
}
