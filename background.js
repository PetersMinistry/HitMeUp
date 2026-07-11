const CHECK_INTERVAL = 5000;
const INBOX_RETURN_RETRY_INTERVAL = 30000;
const MAX_INBOX_RETURN_RETRY_INTERVAL = 5 * 60 * 1000;
const REMINDER_CHECK_ALARM_NAME = "hitmeup-reminder-check";
const CUSTOM_POPUP_WIDTH = 420;
const CUSTOM_POPUP_HEIGHT = 420;
const CUSTOM_POPUP_URL = browser.runtime.getURL("custom_reminder.html");
const DUE_NOTIFICATION_ID = "hitmeup-reminder-due";
const REMINDER_TAG_KEY = "hitmeup-reminder";
const REMINDER_TAG_NAME = "HitMeUp Reminder";
const REMINDER_TAG_COLOR = "#CC0000";
const DEFAULT_SETTINGS = {
  notifyOnDue: true,
  markUnreadOnDue: true,
  moveToInboxOnDue: true,
  testDelaySeconds: 10,
  defaultReminderHours: 1,
  defaultReminderDays: 1
};

// John 14:6 - The way, the truth, and the life.
console.log("HitMeUp Reminder background loaded");

const accountNameCache = new Map();
let isProcessingDueReminders = false;
let scheduledReminderAlarmTime = 0;

function normalizeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };
}

async function getSettings() {
  const stored = await browser.storage.local.get("settings");
  return normalizeSettings(stored.settings);
}

async function ensureReminderTag() {
  if (!browser.messages) return false;

  try {
    if (browser.messages.tags && browser.messages.tags.list) {
      const tags = await browser.messages.tags.list();
      const existingTag = tags.find((tag) => tag.key === REMINDER_TAG_KEY);

      if (existingTag) {
        if (
          browser.messages.tags.update &&
          (existingTag.color !== REMINDER_TAG_COLOR || existingTag.tag !== REMINDER_TAG_NAME)
        ) {
          await browser.messages.tags.update(REMINDER_TAG_KEY, {
            tag: REMINDER_TAG_NAME,
            color: REMINDER_TAG_COLOR
          });
        }
        return true;
      }

      await browser.messages.tags.create(REMINDER_TAG_KEY, REMINDER_TAG_NAME, REMINDER_TAG_COLOR);
      return true;
    }
  } catch (error) {
    if (String(error && error.message).includes("already")) return true;
    console.error("Unable to ensure HitMeUp Reminder mail tag", error);
  }

  return false;
}

function isSameReminderMessage(left, right) {
  if (!left || !right) return false;
  if (left.headerMessageId && right.headerMessageId) {
    return left.headerMessageId === right.headerMessageId;
  }
  return left.messageId && right.messageId && String(left.messageId) === String(right.messageId);
}

function getMessageTagKeys(message) {
  if (!message || !Array.isArray(message.tags)) return [];

  return message.tags
    .map((tag) => typeof tag === "string" ? tag : tag && tag.key)
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function rememberResolvedMessage(reminder, message) {
  if (!reminder || !message) return;

  reminder.messageId = message.id || reminder.messageId;
  reminder.folderId = message.folder && message.folder.id;
  reminder.accountId = message.folder && message.folder.accountId;
  reminder.headerMessageId = reminder.headerMessageId || message.headerMessageId;
}

async function queryReminderMessages(reminder) {
  if (!reminder || !reminder.headerMessageId || !browser.messages.query) return [];

  try {
    const result = await browser.messages.query({
      headerMessageId: reminder.headerMessageId,
      messagesPerPage: 25
    });
    const messages = result && result.messages ? result.messages : [];

    return messages.filter((item) => {
      return !reminder.accountId || (item.folder && item.folder.accountId === reminder.accountId);
    });
  } catch (error) {
    console.error("Unable to query HitMeUp Reminder messages by header id", error);
    return [];
  }
}

async function resolveReminderMessage(reminder) {
  if (!reminder) return null;

  if (reminder.messageId) {
    try {
      const message = await browser.messages.get(reminder.messageId);
      rememberResolvedMessage(reminder, message);
      return message;
    } catch (error) {
      console.error("Unable to get HitMeUp Reminder message by session id", error);
    }
  }

  const messages = await queryReminderMessages(reminder);
  const message = messages[0] || null;

  if (message) {
    rememberResolvedMessage(reminder, message);
  }

  return message;
}

async function updateReminderTag(reminder, shouldTag) {
  if (!reminder) return;

  if (shouldTag) {
    const tagReady = await ensureReminderTag();
    if (!tagReady) return;
  }

  try {
    const candidates = [];

    if (reminder.messageId) {
      try {
        candidates.push(await browser.messages.get(reminder.messageId));
      } catch (error) {
        console.error("Unable to get HitMeUp Reminder message by session id", error);
      }
    }

    const queriedMessages = await queryReminderMessages(reminder);
    candidates.push(...queriedMessages);

    const uniqueMessages = candidates.filter((message, index, messages) => {
      return message && messages.findIndex((item) => item && String(item.id) === String(message.id)) === index;
    });

    const taggedMessage = uniqueMessages.find((message) => getMessageTagKeys(message).includes(REMINDER_TAG_KEY));
    const targetMessage = shouldTag
      ? (taggedMessage || queriedMessages[0] || uniqueMessages[0] || null)
      : (taggedMessage || uniqueMessages[0] || null);
    if (!targetMessage) return;

    rememberResolvedMessage(reminder, targetMessage);

    if (shouldTag) {
      const tags = getMessageTagKeys(targetMessage);
      const hasTag = tags.includes(REMINDER_TAG_KEY);

      if (!hasTag) {
        await browser.messages.update(targetMessage.id, {
          tags: [...tags, REMINDER_TAG_KEY]
        });
      }
      return;
    }

    for (const message of uniqueMessages) {
      const tags = getMessageTagKeys(message);
      if (!tags.includes(REMINDER_TAG_KEY)) continue;

      rememberResolvedMessage(reminder, message);
      await browser.messages.update(message.id, {
        tags: tags.filter((tag) => tag !== REMINDER_TAG_KEY)
      });
    }
  } catch (error) {
    console.error("Unable to update HitMeUp Reminder mail tag", error);
  }
}

async function getAccountName(accountId) {
  if (!accountId || !browser.accounts || !browser.accounts.get) return "";
  if (accountNameCache.has(accountId)) return accountNameCache.get(accountId);

  try {
    const account = await browser.accounts.get(accountId, false);
    const accountName = account && (account.name || account.identityName || account.id);
    accountNameCache.set(accountId, accountName || "");
    return accountName || "";
  } catch (error) {
    console.error("Unable to get HitMeUp Reminder account name", error);
    accountNameCache.set(accountId, "");
    return "";
  }
}

function formatMenuDuration(value, unit) {
  const label = value === 1 ? unit : `${unit}s`;
  return `${value} ${label}`;
}

function formatBadgeCount(count) {
  return count > 9 ? "9+" : String(count);
}

function getNextPendingReminder(reminders) {
  return reminders
    .filter((reminder) => {
      return reminder && !reminder.triggered && Number.isFinite(Number(reminder.remindAt));
    })
    .sort((a, b) => Number(a.remindAt) - Number(b.remindAt))[0] || null;
}

function isInboxReturnPending(reminder) {
  return Boolean(reminder && reminder.triggered && !reminder.returnedToInbox);
}

function shouldAttemptInboxReturn(reminder, now = Date.now()) {
  if (!isInboxReturnPending(reminder)) return false;

  const nextAttemptAt = Number(reminder.nextInboxReturnAttemptAt);
  return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= now;
}

function getNextInboxReturnAttemptTime(reminders) {
  const now = Date.now();
  const nextAttemptTimes = reminders
    .filter(isInboxReturnPending)
    .map((reminder) => {
      const nextAttemptAt = Number(reminder.nextInboxReturnAttemptAt);
      return Number.isFinite(nextAttemptAt) ? nextAttemptAt : now + 1000;
    })
    .sort((a, b) => a - b);

  return nextAttemptTimes[0] || 0;
}

function clearInboxReturnRetry(reminder) {
  if (!reminder) return;

  delete reminder.inboxReturnAttemptCount;
  delete reminder.lastInboxReturnAttemptAt;
  delete reminder.nextInboxReturnAttemptAt;
}

function scheduleInboxReturnRetry(reminder) {
  if (!reminder) return;

  const retryCount = Math.max(Number(reminder.inboxReturnAttemptCount) || 1, 1);
  const retryDelay = Math.min(INBOX_RETURN_RETRY_INTERVAL * retryCount, MAX_INBOX_RETURN_RETRY_INTERVAL);
  reminder.nextInboxReturnAttemptAt = Date.now() + retryDelay;
}

async function scheduleReminderAlarm(reminders) {
  if (!browser.alarms || !browser.alarms.create) return;

  try {
    const nextReminder = getNextPendingReminder(reminders);
    const nextInboxReturnAttemptTime = getNextInboxReturnAttemptTime(reminders);

    if (!nextReminder && !nextInboxReturnAttemptTime) {
      if (scheduledReminderAlarmTime && browser.alarms.clear) {
        await browser.alarms.clear(REMINDER_CHECK_ALARM_NAME);
      }
      scheduledReminderAlarmTime = 0;
      return;
    }

    const nextReminderTime = nextReminder ? Number(nextReminder.remindAt) : Number.POSITIVE_INFINITY;
    const nextAlarmTime = Math.max(
      Math.min(nextReminderTime, nextInboxReturnAttemptTime || Number.POSITIVE_INFINITY),
      Date.now() + 1000
    );

    if (scheduledReminderAlarmTime && Math.abs(scheduledReminderAlarmTime - nextAlarmTime) < 1000) {
      return;
    }

    if (browser.alarms.clear) {
      await browser.alarms.clear(REMINDER_CHECK_ALARM_NAME);
    }

    await browser.alarms.create(REMINDER_CHECK_ALARM_NAME, {
      when: nextAlarmTime
    });
    scheduledReminderAlarmTime = nextAlarmTime;
  } catch (error) {
    scheduledReminderAlarmTime = 0;
    console.error("Unable to schedule HitMeUp Reminder background alarm", error);
  }
}

async function syncReminderMenus() {
  if (!browser.menus || !browser.menus.update) return;

  const settings = await getSettings();

  try {
    await browser.menus.update("remind-10sec", {
      title: `In ${formatMenuDuration(settings.testDelaySeconds, "second")} (TEST)`
    });
    await browser.menus.update("remind-1hour", {
      title: `In ${formatMenuDuration(settings.defaultReminderHours, "hour")}`
    });
    await browser.menus.update("remind-1day", {
      title: `In ${formatMenuDuration(settings.defaultReminderDays, "day")}`
    });
  } catch (error) {
    console.error("Unable to update HitMeUp Reminder menu labels", error);
  }
}

async function updateToolbar(reminders) {
  if (!browser.browserAction) return;

  const reminderCount = reminders.length;
  const dueReminders = reminders.filter((reminder) => reminder.triggered);
  const dueCount = dueReminders.length;
  const badgeText = dueCount
    ? formatBadgeCount(dueCount)
    : reminderCount
      ? formatBadgeCount(reminderCount)
      : "";
  const title = reminderCount
    ? dueCount
      ? `${dueCount} due`
      : `${reminderCount} active`
    : "HitMeUp Reminder";

  try {
    await browser.browserAction.setBadgeText({ text: badgeText });
    await browser.browserAction.setTitle({ title });

    if (browser.browserAction.setBadgeBackgroundColor) {
      await browser.browserAction.setBadgeBackgroundColor({
        color: dueCount ? "#b00020" : "#2f80ed"
      });
    }
  } catch (error) {
    console.error("Unable to update reminder toolbar button", error);
  }
}

async function createMessageSnapshot(message) {
  let fullMessage = message;

  try {
    fullMessage = await browser.messages.get(message.id);
  } catch (error) {
    console.error("Unable to get full HitMeUp Reminder message details", error);
  }

  const accountId = fullMessage.folder && fullMessage.folder.accountId;

  return {
    messageId: fullMessage.id || message.id,
    headerMessageId: fullMessage.headerMessageId || message.headerMessageId,
    subject: fullMessage.subject || message.subject || "(No subject)",
    folderId: fullMessage.folder && fullMessage.folder.id,
    accountId,
    accountName: await getAccountName(accountId)
  };
}

function createReminderFromSnapshot(message, remindAt) {
  return {
    id: `${message.messageId}-${Date.now()}`,
    messageId: message.messageId,
    headerMessageId: message.headerMessageId,
    subject: message.subject || "(No subject)",
    folderId: message.folderId,
    accountId: message.accountId,
    accountName: message.accountName || "",
    remindAt,
    triggered: false,
    returnedToInbox: false
  };
}

async function createReminder(message, delayMs) {
  return createReminderFromSnapshot(await createMessageSnapshot(message), Date.now() + delayMs);
}

async function addReminder(reminder) {
  const reminders = await getReminders();

  const existingReminder = reminders.find((item) => isSameReminderMessage(item, reminder));
  let savedReminder = reminder;

  if (existingReminder) {
    savedReminder = existingReminder;
    Object.assign(existingReminder, {
      messageId: reminder.messageId || existingReminder.messageId,
      headerMessageId: reminder.headerMessageId || existingReminder.headerMessageId,
      subject: reminder.subject || existingReminder.subject,
      folderId: reminder.folderId || existingReminder.folderId,
      accountId: reminder.accountId || existingReminder.accountId,
      accountName: reminder.accountName || existingReminder.accountName,
      remindAt: reminder.remindAt,
      triggered: false,
      returnedToInbox: false
    });
    clearInboxReturnRetry(existingReminder);
  } else {
    reminders.push(reminder);
  }

  const dedupedReminders = reminders.filter((item) => {
    return item === savedReminder || !isSameReminderMessage(item, savedReminder);
  });

  await updateReminderTag(savedReminder, true);
  await saveReminders(dedupedReminders);
  await syncPopupReminders();
}

function getMessageFromMenuClick(info) {
  if (info.selectedMessages && info.selectedMessages.messages.length) {
    return info.selectedMessages.messages[0];
  }

  return null;
}

function getReminderMenuAction(menuItemId) {
  const id = String(menuItemId || "");

  if (id === "remind-10sec") return "10sec";
  if (id === "remind-1hour") return "1hour";
  if (id === "remind-1day") return "1day";
  if (id === "remind-custom") return "custom";

  return "";
}

async function getReminders() {
  const stored = await browser.storage.local.get("reminders");
  return stored.reminders || [];
}

async function saveReminders(reminders, options = {}) {
  const { scheduleAlarm = true } = options;

  await browser.storage.local.set({ reminders });
  await updateToolbar(reminders);

  if (scheduleAlarm) {
    await scheduleReminderAlarm(reminders);
  }
}

async function getPopupReminders() {
  const reminders = await getReminders();
  const enrichedReminders = await Promise.all(reminders.map(async (reminder) => ({
    ...reminder,
    accountName: reminder.accountName || (await getAccountName(reminder.accountId))
  })));

  return enrichedReminders
    .slice()
    .sort((a, b) => {
      if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
      return a.remindAt - b.remindAt;
    });
}

async function syncPopupReminders() {
  await browser.storage.local.set({
    popupReminders: await getPopupReminders()
  });
}

async function openReminderAlert() {
  const reminders = await getReminders();
  await updateToolbar(reminders);
}

async function showDueNotification(dueReminders, settings) {
  if (!browser.notifications || !dueReminders.length) return;
  if (!settings.notifyOnDue) return;

  const notificationTitle = dueReminders.length === 1
    ? "HitMeUp Reminder due"
    : `${dueReminders.length} HitMeUp reminders due`;
  const notificationMessage = dueReminders.length === 1
    ? dueReminders[0].subject || "(No subject)"
    : "Click the HitMeUp Reminder toolbar button to review them.";

  try {
    const notificationId = `${DUE_NOTIFICATION_ID}-${Date.now()}`;
    const notificationOptions = {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-96.png"),
      title: notificationTitle,
      message: notificationMessage,
      priority: 2,
      isClickable: true
    };

    try {
      await browser.notifications.create(notificationId, notificationOptions);
      return;
    } catch (error) {
      console.error("Unable to show rich HitMeUp Reminder notification", error);
    }

    await browser.notifications.create(notificationId, {
      type: "basic",
      title: notificationTitle,
      message: notificationMessage
    });
  } catch (error) {
    console.error("Unable to show HitMeUp Reminder notification", error);
  }
}

async function openReminderMessage(reminder) {
  const openAttempts = [];

  if (reminder.messageId) {
    openAttempts.push(
      { messageId: reminder.messageId, location: "tab", active: true },
      { messageId: reminder.messageId, location: "window" }
    );
  }

  if (reminder.headerMessageId) {
    openAttempts.push(
      { headerMessageId: reminder.headerMessageId, location: "tab", active: true },
      { headerMessageId: reminder.headerMessageId, location: "window" }
    );
  }

  for (const openProperties of openAttempts) {
    try {
      await browser.messageDisplay.open(openProperties);
      return true;
    } catch (error) {
      console.error("Unable to open HitMeUp Reminder message", error);
    }
  }

  return false;
}

async function findInboxFolder(accountId) {
  if (!accountId) return null;

  if (browser.folders && browser.folders.query) {
    try {
      const inboxFolders = await browser.folders.query({
        accountId,
        specialUse: ["inbox"]
      });
      if (inboxFolders && inboxFolders.length) return inboxFolders[0];
    } catch (error) {
      console.error("Unable to query Inbox folder directly", error);
    }
  }

  if (!browser.accounts || !browser.accounts.get) return null;

  const account = await browser.accounts.get(accountId, true);
  const stack = account && account.rootFolder ? [account.rootFolder] : [];

  while (stack.length) {
    const folder = stack.shift();
    if (folder.specialUse && folder.specialUse.includes("inbox")) return folder;
    if (folder.subFolders) stack.push(...folder.subFolders);
  }

  return null;
}

async function findMessageAfterMove(reminder, inboxFolder) {
  if (!reminder.headerMessageId || !browser.messages.query) return null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt) {
      await sleep(250);
    }

    if (inboxFolder && inboxFolder.id) {
      try {
        const result = await browser.messages.query({
          headerMessageId: reminder.headerMessageId,
          folderId: inboxFolder.id,
          messagesPerPage: 10
        });
        if (result && result.messages && result.messages.length) {
          return result.messages[0];
        }
      } catch (error) {
        console.error("Unable to find moved HitMeUp Reminder message in Inbox", error);
      }
    }

    try {
      const query = {
        headerMessageId: reminder.headerMessageId,
        messagesPerPage: 10
      };

      const result = await browser.messages.query(query);
      if (result && result.messages && result.messages.length) {
        const messages = result.messages.filter((item) => {
          return !reminder.accountId || (item.folder && item.folder.accountId === reminder.accountId);
        });
        const inboxMessage = inboxFolder && inboxFolder.id
          ? messages.find((item) => item.folder && item.folder.id === inboxFolder.id)
          : null;
        return inboxMessage || messages[0] || result.messages[0];
      }
    } catch (error) {
      console.error("Unable to find moved HitMeUp Reminder message", error);
    }
  }

  return null;
}

function copyReminderMessageState(target, source) {
  if (!target || !source) return;

  target.messageId = source.messageId || target.messageId;
  target.headerMessageId = source.headerMessageId || target.headerMessageId;
  target.subject = source.subject || target.subject;
  target.folderId = source.folderId || target.folderId;
  target.accountId = source.accountId || target.accountId;
  target.accountName = source.accountName || target.accountName;
}

async function returnReminderToInbox(reminder, settings) {
  if (!reminder || reminder.returnedToInbox) return true;

  reminder.inboxReturnAttemptCount = (Number(reminder.inboxReturnAttemptCount) || 0) + 1;
  reminder.lastInboxReturnAttemptAt = Date.now();
  delete reminder.nextInboxReturnAttemptAt;

  try {
    const message = await resolveReminderMessage(reminder);
    if (!message || !message.id) {
      throw new Error("Unable to resolve HitMeUp Reminder message for Inbox return");
    }

    if (settings.markUnreadOnDue) {
      try {
        await browser.messages.update(message.id, { read: false });
      } catch (error) {
        console.error("Unable to mark HitMeUp Reminder message unread", error);
      }
    }

    if (!settings.moveToInboxOnDue) {
      reminder.returnedToInbox = true;
      clearInboxReturnRetry(reminder);
      return true;
    }

    rememberResolvedMessage(reminder, message);
    reminder.subject = reminder.subject || message.subject || "(No subject)";

    const accountId = reminder.accountId || (message.folder && message.folder.accountId);
    reminder.accountName = reminder.accountName || (await getAccountName(accountId));
    const inboxFolder = await findInboxFolder(accountId);

    if (!inboxFolder) {
      reminder.returnedToInbox = true;
      clearInboxReturnRetry(reminder);
      return true;
    }

    const currentFolderId = message.folder && message.folder.id;
    const inboxFolderId = inboxFolder.id;
    const moveDestination = inboxFolderId || inboxFolder;

    if (!inboxFolderId || currentFolderId !== inboxFolderId) {
      await updateReminderTag(reminder, true);
      await browser.messages.move([reminder.messageId], moveDestination);
      const movedMessage = await findMessageAfterMove(reminder, inboxFolder);
      if (movedMessage) {
        reminder.messageId = movedMessage.id;
        reminder.folderId = movedMessage.folder && movedMessage.folder.id;
        reminder.accountId = movedMessage.folder && movedMessage.folder.accountId;
        reminder.accountName = await getAccountName(reminder.accountId);
        if (settings.markUnreadOnDue) {
          await browser.messages.update(movedMessage.id, { read: false });
        }
        await updateReminderTag(reminder, true);
      } else {
        reminder.folderId = inboxFolderId || reminder.folderId;
        reminder.accountId = accountId || reminder.accountId;
        reminder.accountName = reminder.accountName || (await getAccountName(reminder.accountId));
      }
    } else {
      await updateReminderTag(reminder, true);
    }

    reminder.returnedToInbox = true;
    clearInboxReturnRetry(reminder);
    return true;
  } catch (error) {
    scheduleInboxReturnRetry(reminder);
    console.error("Unable to move HitMeUp Reminder message to Inbox", error);
    return false;
  }
}

async function processInboxReturnReminders(reminders, settings, now) {
  const dueInboxReturnReminders = reminders.filter((reminder) => {
    return shouldAttemptInboxReturn(reminder, now);
  });

  for (const reminder of dueInboxReturnReminders) {
    await returnReminderToInbox(reminder, settings);
  }

  return dueInboxReturnReminders;
}

async function mergeProcessedInboxReturnReminders(latestReminders, processedReminders) {
  for (const processedReminder of processedReminders) {
    const currentReminder = latestReminders.find((item) => {
      return String(item.id) === String(processedReminder.id);
    });

    if (!currentReminder) {
      await updateReminderTag(processedReminder, false);
      continue;
    }

    copyReminderMessageState(currentReminder, processedReminder);

    if (currentReminder.triggered) {
      currentReminder.returnedToInbox = processedReminder.returnedToInbox;

      if (processedReminder.returnedToInbox) {
        clearInboxReturnRetry(currentReminder);
      } else {
        currentReminder.inboxReturnAttemptCount = processedReminder.inboxReturnAttemptCount;
        currentReminder.lastInboxReturnAttemptAt = processedReminder.lastInboxReturnAttemptAt;
        currentReminder.nextInboxReturnAttemptAt = processedReminder.nextInboxReturnAttemptAt;
      }
    }
  }
}

if (browser.notifications && browser.notifications.onClicked) {
  browser.notifications.onClicked.addListener(async (notificationId) => {
    if (!notificationId.startsWith(DUE_NOTIFICATION_ID)) return;

    if (browser.browserAction && browser.browserAction.openPopup) {
      try {
        await syncPopupReminders();
        await browser.browserAction.openPopup();
      } catch (error) {
        console.error("Unable to open HitMeUp Reminder dropdown", error);
      }
    }
  });
}

async function initializeReminderUi() {
  const settings = await getSettings();
  const reminders = await getReminders();
  await browser.storage.local.set({ settings });
  if (reminders.length) {
    await ensureReminderTag();
  }
  await updateToolbar(reminders);
  await syncPopupReminders();
  await scheduleReminderAlarm(reminders);
  await processDueReminders();
}

initializeReminderUi().catch((error) => {
  console.error("Unable to initialize reminder UI", error);
});

// ===== MENU =====
browser.menus.create({
  id: "reminder-root",
  title: "Set Reminder",
  contexts: ["message_list"]
});

browser.menus.create({
  id: "remind-10sec",
  parentId: "reminder-root",
  title: "In 10 seconds (TEST)",
  contexts: ["message_list"]
});

browser.menus.create({
  id: "remind-1hour",
  parentId: "reminder-root",
  title: "In 1 hour",
  contexts: ["message_list"]
});

browser.menus.create({
  id: "remind-1day",
  parentId: "reminder-root",
  title: "In 1 day",
  contexts: ["message_list"]
});

browser.menus.create({
  id: "remind-custom",
  parentId: "reminder-root",
  title: "Pick date and time...",
  contexts: ["message_list"]
});

syncReminderMenus().catch((error) => {
  console.error("Unable to sync HitMeUp Reminder menu labels", error);
});

// ===== CLICK =====
browser.menus.onClicked.addListener(async (info) => {
  const settings = await getSettings();
  const action = getReminderMenuAction(info.menuItemId);

  const delayMap = {
    "10sec": settings.testDelaySeconds * 1000,
    "1hour": settings.defaultReminderHours * 60 * 60 * 1000,
    "1day": settings.defaultReminderDays * 24 * 60 * 60 * 1000
  };

  if (!action) return;

  const msg = getMessageFromMenuClick(info);
  if (!msg) return;

  if (action === "custom") {
    const pendingCustomReminder = await createMessageSnapshot(msg);
    const reminders = await getReminders();
    const existingReminder = reminders.find((item) => isSameReminderMessage(item, pendingCustomReminder));

    if (existingReminder) {
      pendingCustomReminder.existingRemindAt = existingReminder.remindAt;
    }

    await browser.storage.local.set({ pendingCustomReminder });
    await browser.windows.create({
      url: CUSTOM_POPUP_URL,
      type: "popup",
      width: CUSTOM_POPUP_WIDTH,
      height: CUSTOM_POPUP_HEIGHT
    });
    return;
  }

  const delay = delayMap[action];
  if (!delay) return;

  await addReminder(await createReminder(msg, delay));
});

browser.runtime.onMessage.addListener(async (message) => {
  if (!message || !message.type) return;

  if (message.type === "open-options") {
    await browser.runtime.openOptionsPage();
    return;
  }

  if (message.type === "settings-updated") {
    await syncReminderMenus();
    await syncPopupReminders();
    return;
  }

  if (message.type === "dismiss-all-due") {
    const reminders = await getReminders();
    const activeReminders = reminders.filter((reminder) => !reminder.triggered);
    const dueReminders = reminders.filter((reminder) => reminder.triggered);

    for (const reminder of dueReminders) {
      await updateReminderTag(reminder, false);
    }

    await saveReminders(activeReminders);
    await syncPopupReminders();
    return;
  }

  if (message.type === "edit-reminder-time") {
    if (!message.reminderId) return;

    const reminders = await getReminders();
    const reminder = reminders.find((item) => String(item.id) === String(message.reminderId));
    if (!reminder) return;

    await browser.storage.local.set({
      pendingCustomReminder: {
        messageId: reminder.messageId,
        headerMessageId: reminder.headerMessageId,
        subject: reminder.subject,
        folderId: reminder.folderId,
        accountId: reminder.accountId,
        accountName: reminder.accountName,
        existingRemindAt: reminder.remindAt
      }
    });

    await browser.windows.create({
      url: CUSTOM_POPUP_URL,
      type: "popup",
      width: CUSTOM_POPUP_WIDTH,
      height: CUSTOM_POPUP_HEIGHT
    });
    return;
  }

  if (message.type === "create-custom-reminder") {
    const stored = await browser.storage.local.get("pendingCustomReminder");
    const pendingReminder = stored.pendingCustomReminder;
    const remindAt = Number(message.remindAt);

    if (!pendingReminder || !Number.isFinite(remindAt) || remindAt <= Date.now()) return;

    await addReminder(createReminderFromSnapshot(pendingReminder, remindAt));
    await browser.storage.local.remove("pendingCustomReminder");
    return;
  }

  if (!message.reminderId) return;

  const reminders = await getReminders();
  const reminder = reminders.find((item) => String(item.id) === String(message.reminderId));

  if (!reminder) {
    await syncPopupReminders();
    return;
  }

  if (message.type === "open-reminder-message") {
    await openReminderMessage(reminder);
  }

  if (message.type === "snooze-reminder") {
    const delayMs = Number(message.delayMs);
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      await syncPopupReminders();
      return;
    }

    reminder.remindAt = Date.now() + delayMs;
    reminder.triggered = false;
    reminder.returnedToInbox = false;
    clearInboxReturnRetry(reminder);
    await updateReminderTag(reminder, true);
  }

  if (message.type === "dismiss-reminder") {
    const reminderIndex = reminders.findIndex((item) => String(item.id) === String(message.reminderId));
    const removedReminders = reminders.splice(reminderIndex, 1);
    if (removedReminders.length) {
      await updateReminderTag(removedReminders[0], false);
    }
  }

  await saveReminders(reminders);
  await syncPopupReminders();
});

// ===== LOOP =====
async function processDueReminders() {
  if (isProcessingDueReminders) return;
  isProcessingDueReminders = true;

  try {
    const reminders = await getReminders();
    const settings = await getSettings();

    const now = Date.now();
    const newlyDueReminders = [];

    for (const reminder of reminders) {
      if (!reminder.triggered && reminder.remindAt <= now) {
        reminder.triggered = true;
        reminder.returnedToInbox = false;
        clearInboxReturnRetry(reminder);
        newlyDueReminders.push(reminder);
      }
    }

    if (newlyDueReminders.length) {
      await saveReminders(reminders, { scheduleAlarm: false });
      await syncPopupReminders();
      await openReminderAlert();
      await showDueNotification(newlyDueReminders, settings);
    }

    const processedInboxReturnReminders = await processInboxReturnReminders(reminders, settings, now);

    if (!newlyDueReminders.length && !processedInboxReturnReminders.length) {
      await scheduleReminderAlarm(reminders);
      return;
    }

    const latestReminders = await getReminders();
    await mergeProcessedInboxReturnReminders(latestReminders, processedInboxReturnReminders);

    await saveReminders(latestReminders);
    await syncPopupReminders();
    return;
  } finally {
    isProcessingDueReminders = false;
  }
}

if (browser.alarms && browser.alarms.onAlarm) {
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm && alarm.name !== REMINDER_CHECK_ALARM_NAME) return;

    scheduledReminderAlarmTime = 0;
    try {
      await processDueReminders();
    } catch (error) {
      console.error("Unable to process HitMeUp Reminder alarm", error);
    }
  });
}

setInterval(() => {
  processDueReminders().catch((error) => {
    console.error("Unable to process HitMeUp Reminder due loop", error);
  });
}, CHECK_INTERVAL);
