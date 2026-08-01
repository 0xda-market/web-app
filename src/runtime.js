const defaults = Object.freeze({
  apiBaseUrl: "/bot/webapp",
  webAppCoreUrl: "/webapp-core/index.js"
});

export function runtimeConfig(location = window.location) {
  const configured = globalThis.__ZERO_X_DA_MARKET__ || {};
  const apiBaseUrl = String(configured.apiBaseUrl || defaults.apiBaseUrl).replace(/\/$/, "");
  const webAppCoreUrl = String(configured.webAppCoreUrl || defaults.webAppCoreUrl);

  return Object.freeze({
    apiBaseUrl,
    webAppCoreUrl: new URL(webAppCoreUrl, location.origin).href
  });
}
