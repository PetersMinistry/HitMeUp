# Changelog

## [1.0.3] - 2026-05-16

Stabilization patch for due reminders that become due while Thunderbird is minimized or sitting in the tray.

### Fixed

- Added a retry path for already-due reminders whose Inbox return did not finish on the first attempt.
- Kept due notifications one-time while allowing unfinished Inbox moves to retry from the interval loop or background alarm.
- Preserved retry state until the Inbox return succeeds, then cleared retry metadata after completion.

### Validation Notes

- Manifest JSON parses successfully.
- Background script syntax check passes.
- Added a dependency-free due-reminder retry test covering minimized-style move failure and recovery.

## [1.0.2] - 2026-05-02

Stabilization patch for due-reminder reliability while Thunderbird is minimized or sitting in the tray.

### Fixed

- Added a Thunderbird background alarm for the next pending reminder so due actions can wake reliably when the normal interval loop is throttled.
- Kept the existing interval loop as a fast foreground fallback while preventing overlapping due-reminder processing.

### Validation Notes

- Manifest JSON parses successfully.
- Background script syntax check passes.

## [1.0.1] - 2026-04-30

Stabilization patch for the submitted Thunderbird review build.

### Fixed

- Made `HitMeUp Reminder` tag cleanup more resilient when a due reminder moves an email back to the Inbox before the user dismisses it.
- Prevented the due-reminder processing loop from overwriting a user dismiss/snooze action that happens while Inbox move and tag updates are still finishing.
- Added short retries when resolving a message after an Inbox move so Thunderbird has time to expose the moved message id.

### Validation Notes

- Manifest JSON parses successfully.
- Rebuilt `dist/HitMeUp-Reminder-1.0.1.xpi` and confirmed its packaged manifest contains version `1.0.1`.
- Confirmed the XPI uses forward-slash archive paths.
- Thunderbird smoke test passed for: set reminder, due move to Inbox, dismiss due reminder, confirm tag removal.

## [1.0.0] - 2026-04-25

Initial public release.

### Features

- Set reminders from the message list context menu.
- Quick presets for test, hour, day, and custom date/time reminders.
- Toolbar popup with separate Due and Active views.
- Active reminder search and account filtering.
- Snooze and dismiss actions.
- Dismiss all due reminders.
- Toolbar badge with active/due status.
- Email tagging with `HitMeUp Reminder`.
- Multi-account Inbox support.
- Duplicate reminder prevention per email.

### Options

- Toggle system notifications.
- Optional mark unread when due.
- Optional move to Inbox when due.
- Configurable quick reminder durations.

### Privacy

- All reminder data is stored locally.
- No external communication, tracking, or analytics.
