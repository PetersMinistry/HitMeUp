const DEFAULT_SETTINGS = {
  notifyOnDue: true,
  markUnreadOnDue: true,
  moveToInboxOnDue: true,
  testDelaySeconds: 10,
  defaultReminderHours: 1,
  defaultReminderDays: 1
};

const fields = {
  notifyOnDue: document.getElementById("notify-on-due"),
  markUnreadOnDue: document.getElementById("mark-unread-on-due"),
  moveToInboxOnDue: document.getElementById("move-to-inbox-on-due"),
  testDelaySeconds: document.getElementById("test-delay-seconds"),
  defaultReminderHours: document.getElementById("default-reminder-hours"),
  defaultReminderDays: document.getElementById("default-reminder-days")
};

const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const savedMessage = document.getElementById("saved-message");

function normalizeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function fillForm(settings) {
  fields.notifyOnDue.checked = settings.notifyOnDue;
  fields.markUnreadOnDue.checked = settings.markUnreadOnDue;
  fields.moveToInboxOnDue.checked = settings.moveToInboxOnDue;
  fields.testDelaySeconds.value = settings.testDelaySeconds;
  fields.defaultReminderHours.value = settings.defaultReminderHours;
  fields.defaultReminderDays.value = settings.defaultReminderDays;
}

function readForm() {
  return {
    notifyOnDue: fields.notifyOnDue.checked,
    markUnreadOnDue: fields.markUnreadOnDue.checked,
    moveToInboxOnDue: fields.moveToInboxOnDue.checked,
    testDelaySeconds: clampNumber(fields.testDelaySeconds.value, 1, 300, DEFAULT_SETTINGS.testDelaySeconds),
    defaultReminderHours: clampNumber(fields.defaultReminderHours.value, 1, 48, DEFAULT_SETTINGS.defaultReminderHours),
    defaultReminderDays: clampNumber(fields.defaultReminderDays.value, 1, 30, DEFAULT_SETTINGS.defaultReminderDays)
  };
}

function showSaved() {
  savedMessage.hidden = false;
  window.setTimeout(() => {
    savedMessage.hidden = true;
  }, 1800);
}

async function saveSettings(settings) {
  await browser.storage.local.set({ settings });
  await browser.runtime.sendMessage({ type: "settings-updated" });
  showSaved();
}

browser.storage.local.get("settings").then((stored) => {
  fillForm(normalizeSettings(stored.settings));
});

saveButton.addEventListener("click", () => {
  const settings = readForm();
  fillForm(settings);
  saveSettings(settings);
});

resetButton.addEventListener("click", () => {
  fillForm(DEFAULT_SETTINGS);
  saveSettings(DEFAULT_SETTINGS);
});
