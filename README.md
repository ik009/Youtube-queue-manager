# YouTube Queue Manager

A Chrome extension that improves YouTube's native queue so you can reorder upcoming videos more easily.

YouTube already has a queue, but managing it can feel limited when you want to quickly change what plays next. This extension enhances the queue panel that is already on YouTube instead of creating a second queue or separate playlist.

## Benefits

- Reorder YouTube's native queue without building a separate queue somewhere else.
- Drag and drop queue rows to change the visible play order.
- Move videos to the top, up, down, or bottom from the row's three-dot menu.
- Keep the YouTube queue panel as the source of truth.
- Make long music queues easier to manage while listening.
- Add optional row numbers so the queue is easier to scan.
- Use a reverse action when you want to flip the visible queue order.
- Keep playback aligned with the reordered queue when YouTube tries to continue in the old order.

## Features

- Adds a small **Queue tools** section inside YouTube's native queue panel.
- Makes native queue rows draggable.
- Adds queue move actions inside each row's native three-dot menu.
- Syncs video-end and player **Next** transitions to the reordered visible queue.
- Does not collect data, send analytics, or store a separate queue.

## Install Locally

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `youtube-queue-manager` folder.
6. Open YouTube, add videos to YouTube's native queue, and open the queue panel.

## How To Use

1. Open YouTube in Chrome.
2. Start playing any video.
3. Add more videos to YouTube's native queue:
   - From a recommendation, search result, or playlist item, open the three-dot menu.
   - Click **Add to queue**.
4. Open YouTube's queue panel. It usually appears near the lower-right area of the player/page after you add videos to the queue.
5. Use the **Queue tools** section added by this extension:
   - **Refresh** updates the detected queue rows.
   - **Reverse** flips the visible queue order.
   - **Number** toggles row numbers so the order is easier to scan.
6. Drag a queue row and drop it above or below another row to change the visible order.
7. Use a row's native three-dot menu for precise actions:
   - **Move to top**
   - **Move up**
   - **Move down**
   - **Move to bottom**
8. Let the current video finish, or press YouTube's **Next** button. The extension will try to keep playback aligned with the reordered visible queue.

## Quick Test

1. Add three videos to YouTube's queue.
2. Drag the third video to the top of the queue.
3. Press YouTube's **Next** button.
4. The video now at the top of the visible queue should play next.

## How It Works

YouTube does not provide a stable public browser API for editing its native queue. This extension works at the UI layer:

- It finds YouTube's native queue panel.
- It enhances the existing queue rows.
- It reorders the visible native queue rows on drag and drop.
- It injects move actions into YouTube's existing row menu.
- If YouTube's player advances using its old internal order, it corrects playback by selecting the next row from the visible reordered queue.

## Limitations

- This depends on YouTube's page structure, which can change.
- If YouTube changes its queue markup or playback internals, the extension may need selector updates.
- This is intended for YouTube's web queue in Chrome-style browsers.

## Privacy

This extension does not collect, transmit, or sell user data. It runs locally in your browser and only interacts with YouTube's queue UI on YouTube pages.

## Project Files

- `manifest.json` - Chrome extension manifest.
- `content.js` - Native queue detection, drag/drop behavior, menu actions, and playback sync.
- `panel.css` - Styles for controls injected into YouTube's queue panel.

## License

MIT
