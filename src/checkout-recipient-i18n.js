const COPY = Object.freeze({
  en: Object.freeze({
    recipient: "Recipient",
    self: "For me",
    other: "Someone else",
    choose: "Choose in Telegram",
    change: "Change",
    manual: "Enter @username",
    selected: "Selected recipient"
  }),
  uk: Object.freeze({
    recipient: "Одержувач",
    self: "Собі",
    other: "Іншому",
    choose: "Обрати в Telegram",
    change: "Змінити",
    manual: "Ввести @username",
    selected: "Обраний одержувач"
  }),
  ru: Object.freeze({
    recipient: "Получатель",
    self: "Себе",
    other: "Другому",
    choose: "Выбрать в Telegram",
    change: "Изменить",
    manual: "Ввести @username",
    selected: "Выбранный получатель"
  })
});

export function checkoutRecipientCopy(locale) {
  const language = String(locale || "en").toLowerCase().split(/[-_]/, 1)[0];
  return COPY[language] || COPY.en;
}
