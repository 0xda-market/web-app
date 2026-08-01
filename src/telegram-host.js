const localeMap = Object.freeze({ en: "en_US", uk: "uk_UA", ru: "ru_RU", fr: "fr_FR", es: "es_ES", de: "de_DE" });

export function createTelegramHost(telegram = globalThis.Telegram?.WebApp) {
  return Object.freeze({
    initialize() {
      telegram?.ready();
      telegram?.expand?.();
      telegram?.setHeaderColor?.("secondary_bg_color");
      telegram?.setBackgroundColor?.("secondary_bg_color");
    },
    initData() { return telegram?.initData || ""; },
    locale() {
      const language = telegram?.initDataUnsafe?.user?.language_code || navigator.language || "en";
      const code = String(language).toLowerCase().split(/[-_]/, 1)[0];
      return localeMap[code] || "en_US";
    },
    viewportHeight() { return telegram?.viewportStableHeight || window.innerHeight; },
    selectionFeedback() { telegram?.HapticFeedback?.selectionChanged(); },
    notificationFeedback(type) { telegram?.HapticFeedback?.notificationOccurred(type); },
    onViewportChanged(callback) {
      window.addEventListener("resize", callback, { passive: true });
      telegram?.onEvent?.("viewportChanged", callback);
    }
  });
}
