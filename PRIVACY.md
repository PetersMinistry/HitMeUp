# Privacy Policy

HitMeUp Reminder does not collect, transmit, sell, or share personal data.

All reminder data is stored locally within Thunderbird using extension storage. No external server, tracking service, analytics service, or remote sync service is used.

The extension may store message metadata needed to make reminders work:

- message subject
- Thunderbird message id
- header Message-ID
- folder id
- account id and account name
- reminder time
- reminder status

The extension can optionally modify messages when a reminder becomes due:

- mark the message unread
- move the message back to the Inbox for the same account
- add or remove the `HitMeUp Reminder` mail tag

These actions happen locally inside Thunderbird and are used only for reminder functionality.

When enabled, due reminders can also trigger a local system notification that may display the email subject. Notification visibility is controlled by Thunderbird and operating system notification settings.

## Permissions and why they are needed

- `storage`: save reminders and settings locally on the device.
- `menus`: add reminder actions to the message list right-click menu.
- `messagesRead`: read message metadata needed to create, resolve, and open reminders.
- `messagesMove`: move due messages back to the Inbox when that option is enabled.
- `messagesUpdate`: mark messages unread and apply or remove reminder tags.
- `messagesTags`: create, update, and use the `HitMeUp Reminder` mail tag.
- `accountsRead`: resolve account names and locate the correct Inbox for multi-account moves.
- `notifications`: show local due reminder notifications.
