# Reviewer Notes

HitMeUp Reminder is a local-only reminder system for Thunderbird email messages. It does not perform background network requests, analytics, tracking, telemetry, advertising, or external sync.

All reminder data and settings are stored locally using Thunderbird extension storage.

## Basic Test Flow

1. Install the extension in Thunderbird.
2. Open a mail folder and right-click a message.
3. Choose `Set Reminder` and then `In 10 seconds (TEST)`.
4. Confirm the toolbar badge shows one active reminder.
5. Confirm the message receives the red `HitMeUp Reminder` tag.
6. Wait for the reminder to become due.
7. Confirm a notification appears if notifications are enabled.
8. Open the toolbar popup and confirm the due reminder appears.
9. Use `Open Email`, `Snooze`, and `Dismiss`.
10. Confirm dismissing the reminder removes the `HitMeUp Reminder` tag.

## Permission Notes

- `messagesRead`: Reads selected/displayed message metadata such as subject, folder, account, and identifiers needed to associate reminders with messages.
- `messagesMove`: Used only when the optional setting `Move email back to Inbox when due` is enabled by the user.
- `messagesUpdate`: Used only for user-facing actions such as marking messages unread and applying/removing reminder tags.
- `messagesTags`: Creates and manages the `HitMeUp Reminder` tag used to visually identify tracked messages.
- `notifications`: Displays reminder alerts when reminders become due.
- `accountsRead`: Locates the correct account and Inbox when the optional move-to-Inbox feature is enabled.
- `storage`: Stores reminders and user settings locally.
- `menus`: Adds reminder actions to Thunderbird context menus.

## Additional Notes

- No message content is transmitted externally.
- No remote code is loaded.
- No analytics or usage tracking are performed.
- All message-modifying behavior is user-controlled and can be disabled where applicable in the Options page.
- The add-on is designed solely to help users remember follow-ups on existing emails.
