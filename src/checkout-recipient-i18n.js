const COPY = Object.freeze({
  en: Object.freeze({ recipient: "Recipient", self: "For me", usernameMode: "Username", username: "Telegram username" }),
  uk: Object.freeze({ recipient: "Одержувач", self: "Собі", usernameMode: "За username", username: "Username у Telegram" }),
  ru: Object.freeze({ recipient: "Получатель", self: "Себе", usernameMode: "По username", username: "Username в Telegram" })
});

export function checkoutRecipientCopy(locale) {
  const language = String(locale || "en").toLowerCase().split(/[-_]/, 1)[0];
  return COPY[language] || COPY.en;
}
