# HitMeUp Reminder

HitMeUp Reminder adds simple, reliable email reminders directly inside Thunderbird so follow-ups do not get lost.

## Features

- Set reminders from the message list right-click menu.
- Use quick presets or pick a custom date and time.
- View reminders from the toolbar dropdown.
- Keep Due and Active reminders separated.
- Search and filter active reminders.
- See exact date/time details on active reminders.
- Open, edit, or cancel active reminders from the active list.
- Snooze due reminders for 10, 30, or 60 minutes, or choose a custom time.
- Open the related email from a due reminder.
- Dismiss one due reminder or dismiss all due reminders.
- Tag tracked emails with `HitMeUp Reminder`.
- Prevent duplicate reminders on the same email by updating the existing reminder.
- Support multiple accounts when moving messages back to Inbox.

## Options

- Show a system notification when a reminder becomes due.
- Mark the email unread when a reminder becomes due.
- Move the email back to the Inbox for the same account when due.
- Configure the test reminder duration.
- Configure the quick hour reminder duration.
- Configure the quick day reminder duration.

## Permissions

- `accountsRead`: Finds the correct account and Inbox for reminders that move messages back to Inbox.
- `messagesRead`: Reads selected/displayed message metadata such as subject, folder, account, and Message-ID.
- `messagesMove`: Moves due messages back to their account Inbox when enabled.
- `messagesUpdate`: Marks messages unread and adds/removes reminder tags on messages.
- `messagesTags`: Creates and updates the `HitMeUp Reminder` mail tag.
- `notifications`: Shows a Thunderbird/system notification when reminders become due.
- `storage`: Stores reminders and settings locally.
- `menus`: Adds reminder actions to the message list context menu.

## Privacy

HitMeUp Reminder runs locally inside Thunderbird.

- No data is sent to external servers.
- No tracking or analytics are used.
- Reminder data is stored locally using Thunderbird extension storage.

## Notes

Some optional settings modify message state, including unread status, folder location, and message tags. These behaviors are controlled by the user in the Options page.
