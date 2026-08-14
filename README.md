# YouTube Queue Manager

A Chrome extension experiment that enhances YouTube's native queue panel instead of creating a separate queue.

The goal is to keep YouTube as the source of truth: the extension reads the real queue rows from the page, adds small controls to that native queue UI, and reorders the native queue panel instead of keeping a separate list.

## Features

- Adds a **Queue tools** control strip inside YouTube's queue panel.
- Makes native queue rows draggable.
- Adds **Move to top**, **Move up**, **Move down**, and **Move to bottom** controls inside the row's native three-dot menu.
- Adds optional row numbering for easier manual reordering.
- Includes a **Reverse** command for the visible native queue.
- Does not store or manage a separate playback queue.

## Install locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `youtube-queue-manager` folder.
5. Open YouTube, add videos to YouTube's native queue, and open the queue panel.

## How it works

YouTube does not expose a stable public browser API for editing its native queue. This extension therefore works at the UI layer:

- It finds YouTube's native `ytd-playlist-panel-renderer` queue panel.
- It marks the native queue rows as draggable and reorders those rows on drop.
- It tries to update matching queue arrays attached to YouTube's page components.
- It injects move commands into the row's native three-dot menu after that menu opens.

Because this depends on YouTube's private page structure, selectors or drag behavior may need updates when YouTube changes its UI.

## Files

- `manifest.json` - Extension manifest.
- `content.js` - Native queue detection, row enhancement, and reorder commands.
- `panel.css` - Styles for injected controls inside YouTube's queue panel.
