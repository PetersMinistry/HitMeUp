# Reviewer Notes

HitMeUp Reminder is a local-only reminder system for Thunderbird email messages. It does not perform background network requests, analytics, tracking, or external sync.

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
