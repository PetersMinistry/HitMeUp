const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createBrowserMock(options = {}) {
  const inboxFolder = { id: "inbox-folder", accountId: "account-1", specialUse: ["inbox"] };
  const archiveFolder = { id: "archive-folder", accountId: "account-1", specialUse: [] };
  const movedMessages = new Set();
  let storageData = {
    reminders: [],
    settings: {
      notifyOnDue: false,
      markUnreadOnDue: false,
      moveToInboxOnDue: true
    }
  };
  let moveCalls = 0;
  let moveFailuresRemaining = options.moveFailures || 0;

  const browser = {
    runtime: {
      getURL: (filePath) => filePath,
      onMessage: { addListener() {} },
      openOptionsPage: async () => {}
    },
    storage: {
      local: {
        get: async (key) => {
          if (!key) return { ...storageData };
          if (typeof key === "string") return { [key]: storageData[key] };
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((item) => [item, storageData[item]]));
          }
          return { ...key, ...storageData };
        },
        set: async (value) => {
          storageData = { ...storageData, ...value };
        },
        remove: async (key) => {
          delete storageData[key];
        }
      }
    },
    browserAction: {
      setBadgeText: async () => {},
      setTitle: async () => {},
      setBadgeBackgroundColor: async () => {},
      openPopup: async () => {}
    },
    alarms: {
      clear: async () => {},
      create: async () => {},
      onAlarm: { addListener() {} }
    },
    menus: {
      create: () => {},
      update: async () => {},
      onClicked: { addListener() {} }
    },
    notifications: {
      create: async () => {},
      onClicked: { addListener() {} }
    },
    windows: {
      create: async () => {}
    },
    folders: {
      query: async () => [inboxFolder]
    },
    accounts: {
      get: async () => ({
        id: "account-1",
        name: "Account 1",
        rootFolder: {
          id: "root",
          subFolders: [inboxFolder, archiveFolder]
        }
      })
    },
    messages: {
      listTags: async () => [{ key: "hitmeup-reminder", tag: "HitMeUp Reminder", color: "#CC0000" }],
      updateTag: async () => {},
      get: async (messageId) => ({
        id: messageId,
        headerMessageId: "header-1",
        subject: "Needs follow-up",
        folder: movedMessages.has(messageId) ? inboxFolder : archiveFolder,
        tags: []
      }),
      update: async () => {},
      move: async (messageIds) => {
        moveCalls += 1;
        if (moveFailuresRemaining > 0) {
          moveFailuresRemaining -= 1;
          throw new Error("simulated minimized move failure");
        }

        for (const messageId of messageIds) {
          movedMessages.add(messageId);
        }
      },
      query: async (query) => {
        if (query.headerMessageId !== "header-1") return { messages: [] };
        return {
          messages: [{
            id: "message-1",
            headerMessageId: "header-1",
            subject: "Needs follow-up",
            folder: movedMessages.has("message-1") ? inboxFolder : archiveFolder,
            tags: []
          }]
        };
      }
    }
  };

  return {
    browser,
    get moveCalls() {
      return moveCalls;
    },
    get reminders() {
      return storageData.reminders;
    },
    setReminders(reminders) {
      storageData.reminders = reminders;
    }
  };
}

async function loadBackground(mock) {
  const backgroundPath = path.join(__dirname, "..", "background.js");
  const source = fs.readFileSync(backgroundPath, "utf8");
  const context = {
    browser: mock.browser,
    console: {
      ...console,
      log: () => {},
      error: () => {}
    },
    setInterval: () => 0,
    setTimeout,
    clearTimeout
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: backgroundPath });
  await new Promise((resolve) => setImmediate(resolve));
  return context;
}

async function testTriggeredReminderRetriesInboxReturn() {
  const mock = createBrowserMock();
  const context = await loadBackground(mock);

  mock.setReminders([{
    id: "reminder-1",
    messageId: "message-1",
    headerMessageId: "header-1",
    subject: "Needs follow-up",
    folderId: "archive-folder",
    accountId: "account-1",
    accountName: "Account 1",
    remindAt: Date.now() - 60000,
    triggered: true,
    returnedToInbox: false
  }]);

  await context.processDueReminders();

  assert.equal(mock.moveCalls, 1, "already-triggered reminders that did not finish returning must retry the Inbox move");
  assert.equal(mock.reminders[0].returnedToInbox, true, "successful retry should persist returnedToInbox");
  assert.equal(mock.reminders[0].folderId, "inbox-folder", "successful retry should persist the moved Inbox folder");
}

async function testFailedInboxReturnSchedulesAndRetries() {
  const mock = createBrowserMock({ moveFailures: 1 });
  const context = await loadBackground(mock);

  mock.setReminders([{
    id: "reminder-1",
    messageId: "message-1",
    headerMessageId: "header-1",
    subject: "Needs follow-up",
    folderId: "archive-folder",
    accountId: "account-1",
    accountName: "Account 1",
    remindAt: Date.now() - 60000,
    triggered: true,
    returnedToInbox: false
  }]);

  await context.processDueReminders();

  assert.equal(mock.moveCalls, 1, "first Inbox return should be attempted");
  assert.equal(mock.reminders[0].returnedToInbox, false, "failed Inbox return should remain unfinished");
  assert.ok(
    mock.reminders[0].nextInboxReturnAttemptAt > Date.now(),
    "failed Inbox return should schedule a future retry"
  );

  mock.reminders[0].nextInboxReturnAttemptAt = Date.now() - 1;
  await context.processDueReminders();

  assert.equal(mock.moveCalls, 2, "retry should attempt the Inbox move again");
  assert.equal(mock.reminders[0].returnedToInbox, true, "successful retry should persist completion");
  assert.equal(
    Object.hasOwn(mock.reminders[0], "nextInboxReturnAttemptAt"),
    false,
    "successful retry should clear retry scheduling metadata"
  );
}

async function run() {
  await testTriggeredReminderRetriesInboxReturn();
  await testFailedInboxReturnSchedulesAndRetries();
  console.log("background due retry tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
