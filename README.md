# HitMeUp Reminder

HitMeUp Reminder is a Thunderbird extension for setting local follow-up reminders on email messages.

Use the message-list right-click menu to set a reminder, then manage due and active reminders from the toolbar popup. When a reminder becomes due, HitMeUp can notify you, tag the email, mark it unread, and move it back to the correct account's Inbox, depending on your settings.

## Features

- Set reminders from Thunderbird's message-list context menu.
- Use quick presets for testing, one hour, one day, or a custom date and time.
- View due and active reminders from the toolbar popup.
- Open, edit, cancel, snooze, or dismiss reminders.
- Search active reminders and filter them by account when multiple accounts are available.
- Show a compact toolbar badge with active and due reminder counts.
- Apply a `HitMeUp Reminder` mail tag while a reminder is active or due.
- Optionally show local desktop notifications when reminders become due.
- Optionally mark due messages unread and move them back to the correct Inbox.

## Screenshots

### Due Reminder Workflow

![Due Reminder](screenshots/01-due-reminder.png)

### Active Reminders View

![Active Reminders](screenshots/02-active-reminders.png)

### Options Panel

![Options](screenshots/03-options-page.png)

## Installation

### Temporary Install

1. Open Thunderbird.
2. Go to **Add-ons and Themes**.
3. Select **Extensions**.
4. Choose **Install Add-on From File**.
5. Select the packaged `.xpi` file.

### Current Package

```text
dist/HitMeUp-Reminder-1.0.2.xpi
```

## Current Version

**1.0.2** - Stabilization patch for due reminders while Thunderbird is minimized or sitting in the tray.

## Privacy

HitMeUp Reminder is local-first:

- No cloud sync
- No analytics
- No external tracking
- No data selling
- No remote service or backend

Reminder data and settings are stored locally in Thunderbird extension storage. See [PRIVACY.md](PRIVACY.md) for details.

## Repository Structure

```text
dist/          Packaged releases
icons/         Extension icons
screenshots/   Interface previews
```

## License

Code is licensed under the [MIT License](LICENSE.md).

The HitMeUp Reminder name, logo, icons, screenshots, and other branding assets are not covered by the MIT License. See [ASSET_LICENSE.md](ASSET_LICENSE.md).

## Author

Created by Peter Moreno.
