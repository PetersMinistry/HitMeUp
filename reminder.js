const emptyElement = document.getElementById("empty");
const dueGroupElement = document.getElementById("due-group");
const dueRemindersElement = document.getElementById("due-reminders");
const upcomingGroupElement = document.getElementById("upcoming-group");
const upcomingRemindersElement = document.getElementById("upcoming-reminders");
const viewSwitchElement = document.getElementById("view-switch");
const dueViewButton = document.getElementById("due-view-button");
const activeViewButton = document.getElementById("active-view-button");
const settingsButton = document.getElementById("settings-button");
const dismissAllDueButton = document.getElementById("dismiss-all-due-button");
const activeSearchElement = document.getElementById("active-search");
const accountFilterElement = document.getElementById("account-filter");
const activeFilterEmptyElement = document.getElementById("active-filter-empty");

let currentView = "due";
let activeSearchTerm = "";
let accountFilterValue = "";

function sendReminderAction(type, reminderId, delayMs) {
  return browser.runtime.sendMessage({ type, reminderId, delayMs });
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function formatTimeRemaining(remindAt) {
  const msRemaining = remindAt - Date.now();
  if (msRemaining <= 0) return "Due now";

  const totalSeconds = Math.ceil(msRemaining / 1000);
  if (totalSeconds < 60) return `Due in ${totalSeconds} sec`;

  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `Due in ${totalMinutes} min`;

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 24) return `Due in ${totalHours} hr`;

  const totalDays = Math.ceil(totalHours / 24);
  return `Due in ${totalDays} day${totalDays === 1 ? "" : "s"}`;
}

function formatExactDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatLocalDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function createSnoozeControl(reminder) {
  const snoozeElement = document.createElement("div");
  snoozeElement.className = "snooze-control";

  const selectElement = document.createElement("select");
  selectElement.className = "snooze-select";
  selectElement.setAttribute("aria-label", "Choose snooze time");

  [
    ["10", "10 min"],
    ["30", "30 min"],
    ["60", "60 min"],
    ["custom", "Custom"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    selectElement.append(option);
  });

  const customInput = document.createElement("input");
  customInput.className = "custom-snooze";
  customInput.type = "datetime-local";
  customInput.hidden = true;

  const defaultCustomTime = new Date(Date.now() + 60 * 60 * 1000);
  customInput.value = formatLocalDateTimeValue(defaultCustomTime);
  customInput.min = formatLocalDateTimeValue(new Date(Date.now() + 60 * 1000));

  const snoozeButton = createButton("Snooze", "primary", () => {
    let delayMs = Number(selectElement.value) * 60 * 1000;

    if (selectElement.value === "custom") {
      const customTime = new Date(customInput.value).getTime();
      delayMs = customTime - Date.now();

      if (!Number.isFinite(customTime) || delayMs <= 0) {
        customInput.setCustomValidity("Choose a future date and time.");
        customInput.reportValidity();
        return;
      }

      customInput.setCustomValidity("");
    }

    sendReminderAction("snooze-reminder", reminder.id, delayMs);
  });

  selectElement.addEventListener("change", () => {
    customInput.hidden = selectElement.value !== "custom";
    if (!customInput.hidden) customInput.focus();
  });

  snoozeElement.append(selectElement, snoozeButton, customInput);
  return snoozeElement;
}

function createAccountPill(accountName) {
  if (!accountName) return null;

  const accountElement = document.createElement("span");
  accountElement.className = "account-pill";
  accountElement.textContent = accountName;
  accountElement.title = accountName;
  return accountElement;
}

function buildAccountOptions(reminders) {
  const accountNames = Array.from(new Set(
    reminders
      .map((reminder) => reminder.accountName)
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  accountFilterElement.hidden = accountNames.length < 2;

  if (accountFilterValue && !accountNames.includes(accountFilterValue)) {
    accountFilterValue = "";
  }

  accountFilterElement.textContent = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All accounts";
  accountFilterElement.append(allOption);

  for (const accountName of accountNames) {
    const option = document.createElement("option");
    option.value = accountName;
    option.textContent = accountName;
    accountFilterElement.append(option);
  }

  accountFilterElement.value = accountFilterValue;
}

function renderActiveReminderList(container, reminders) {
  container.textContent = "";
  for (const reminder of reminders) {
    const reminderElement = document.createElement("section");
    reminderElement.className = "reminder compact";

    const detailElement = document.createElement("div");

    const subjectElement = document.createElement("div");
    subjectElement.className = "subject";
    subjectElement.textContent = reminder.subject || "(No subject)";

    const metaElement = document.createElement("div");
    metaElement.className = "compact-meta";

    const statusElement = document.createElement("span");
    statusElement.className = "status";
    statusElement.textContent = "Active";

    const timeElement = document.createElement("span");
    timeElement.className = "time";
    timeElement.textContent = formatTimeRemaining(reminder.remindAt);
    timeElement.title = formatExactDateTime(reminder.remindAt);
    const accountElement = createAccountPill(reminder.accountName);

    const scheduleElement = document.createElement("div");
    scheduleElement.className = "exact-time";
    scheduleElement.textContent = formatExactDateTime(reminder.remindAt);

    const actionsElement = document.createElement("div");
    actionsElement.className = "compact-actions";

    actionsElement.append(
      createButton("Open", "compact-action primary", () => {
        sendReminderAction("open-reminder-message", reminder.id);
      }),
      createButton("Edit", "compact-action", () => {
        sendReminderAction("edit-reminder-time", reminder.id).then(() => {
          window.close();
        });
      }),
      createButton("Cancel", "compact-action danger", () => {
        sendReminderAction("dismiss-reminder", reminder.id);
      })
    );

    metaElement.append(statusElement, timeElement);
    if (accountElement) metaElement.append(accountElement);
    detailElement.append(subjectElement, metaElement, scheduleElement);
    reminderElement.append(detailElement, actionsElement);
    container.append(reminderElement);
  }
}

function renderDueReminderList(container, reminders) {
  container.textContent = "";
  for (const reminder of reminders) {
    const reminderElement = document.createElement("section");
    reminderElement.className = "reminder due-card";

    const statusElement = document.createElement("div");
    statusElement.className = reminder.triggered ? "status due" : "status";
    statusElement.textContent = reminder.triggered ? "Due now" : "Active";

    const headerElement = document.createElement("div");
    headerElement.className = "reminder-header";

    const subjectElement = document.createElement("div");
    subjectElement.className = "subject";
    subjectElement.textContent = reminder.subject || "(No subject)";

    const timeElement = document.createElement("div");
    timeElement.className = "time";
    timeElement.textContent = formatTimeRemaining(reminder.remindAt);
    const accountElement = createAccountPill(reminder.accountName);
    if (accountElement) accountElement.classList.add("due-account");

    const actionsElement = document.createElement("div");
    actionsElement.className = "actions";

    actionsElement.append(
      createButton("Open Email", "primary", () => {
        sendReminderAction("open-reminder-message", reminder.id);
      }),
      createButton("Dismiss", "danger", () => {
        sendReminderAction("dismiss-reminder", reminder.id).then(() => {
          window.close();
        });
      }),
      createSnoozeControl(reminder)
    );

    headerElement.append(statusElement, timeElement);
    reminderElement.append(headerElement, subjectElement);
    if (accountElement) reminderElement.append(accountElement);
    reminderElement.append(actionsElement);
    container.append(reminderElement);
  }
}

function renderReminders(reminders) {
  const dueReminders = reminders.filter((reminder) => reminder.triggered);
  const upcomingReminders = reminders
    .filter((reminder) => !reminder.triggered)
    .sort((a, b) => a.remindAt - b.remindAt);
  const visibleUpcomingReminders = upcomingReminders.filter((reminder) => {
    const subject = (reminder.subject || "").toLowerCase();
    const matchesSearch = !activeSearchTerm || subject.includes(activeSearchTerm);
    const matchesAccount = !accountFilterValue || reminder.accountName === accountFilterValue;
    return matchesSearch && matchesAccount;
  });
  const hasDueAndActive = dueReminders.length > 0 && upcomingReminders.length > 0;

  buildAccountOptions(upcomingReminders);

  if (!dueReminders.length) currentView = "active";
  if (!upcomingReminders.length) currentView = "due";

  const shouldShowDue = dueReminders.length > 0 && currentView === "due";
  const shouldShowUpcoming = upcomingReminders.length > 0 && currentView === "active";

  emptyElement.hidden = reminders.length > 0;
  viewSwitchElement.hidden = !hasDueAndActive;
  dueViewButton.classList.toggle("selected", currentView === "due");
  activeViewButton.classList.toggle("selected", currentView === "active");
  dueViewButton.textContent = `Due (${dueReminders.length})`;
  activeViewButton.textContent = `Active (${upcomingReminders.length})`;
  activeFilterEmptyElement.hidden = !shouldShowUpcoming || visibleUpcomingReminders.length > 0;

  dueGroupElement.hidden = !shouldShowDue;
  upcomingGroupElement.hidden = !shouldShowUpcoming;

  renderDueReminderList(dueRemindersElement, shouldShowDue ? dueReminders : []);
  renderActiveReminderList(upcomingRemindersElement, shouldShowUpcoming ? visibleUpcomingReminders : []);
}

function refreshReminders() {
  browser.storage.local.get("popupReminders").then((stored) => {
    renderReminders(stored.popupReminders || []);
  });
}

dueViewButton.addEventListener("click", () => {
  currentView = "due";
  refreshReminders();
});

activeViewButton.addEventListener("click", () => {
  currentView = "active";
  refreshReminders();
});

browser.storage.local.get("popupReminders").then((stored) => {
  renderReminders(stored.popupReminders || []);
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.popupReminders) {
    renderReminders(changes.popupReminders.newValue || []);
  }
});

settingsButton.addEventListener("click", () => {
  sendReminderAction("open-options");
  window.close();
});

dismissAllDueButton.addEventListener("click", () => {
  sendReminderAction("dismiss-all-due").then(() => {
    window.close();
  });
});

activeSearchElement.addEventListener("input", () => {
  activeSearchTerm = activeSearchElement.value.trim().toLowerCase();
  currentView = "active";
  refreshReminders();
});

accountFilterElement.addEventListener("change", () => {
  accountFilterValue = accountFilterElement.value;
  currentView = "active";
  refreshReminders();
});
