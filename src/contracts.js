export function assertHost(host) {
  for (const method of ["locale", "viewport", "onViewportChanged", "selectionFeedback"]) {
    if (typeof host?.[method] !== "function") throw new TypeError(`host.${method} must be a function`);
  }
  return host;
}

export function assertTransport(transport) {
  for (const method of ["bootstrap", "quote", "acceptQuote", "refreshOrder"]) {
    if (typeof transport?.[method] !== "function") throw new TypeError(`transport.${method} must be a function`);
  }
  return transport;
}

export function normalizeLocale(value) {
  const code = String(value || "en").toLowerCase().split(/[-_]/, 1)[0];
  return ({ en: "en_US", uk: "uk_UA", ru: "ru_RU", fr: "fr_FR", es: "es_ES", de: "de_DE" })[code] || "en_US";
}
