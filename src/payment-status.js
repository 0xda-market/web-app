function normalizedLocale(locale) {
  return String(locale || "en_US").toLowerCase().startsWith("uk") ? "uk_UA" : "en_US";
}

function formattedTime(value, locale) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale.replace("_", "-"));
}

export function paymentPendingMessage(order, locale = "en_US") {
  const attributes = order?.attributes || {};
  const payment = attributes.payment || {};
  const resolvedLocale = normalizedLocale(locale);
  const amount = payment.amount && payment.currency
    ? `${payment.amount} ${payment.currency}`
    : null;
  const expiresAt = formattedTime(payment.expires_at, resolvedLocale);

  if (resolvedLocale === "uk_UA") {
    const parts = [amount, expiresAt && `підтвердити до ${expiresAt}`].filter(Boolean);
    return parts.length
      ? `Очікуємо підтвердження платежу: ${parts.join(" · ")}.`
      : "Очікуємо підтвердження платежу. Товар залишається зарезервованим.";
  }

  const parts = [amount, expiresAt && `confirm by ${expiresAt}`].filter(Boolean);
  return parts.length
    ? `Waiting for payment confirmation: ${parts.join(" · ")}.`
    : "Waiting for payment confirmation. Inventory remains reserved.";
}
