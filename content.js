const ROW_SELECTOR = "ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer";
const TOOLBAR_CLASS = "ytqm-native-toolbar";
const ROW_CLASS = "ytqm-native-row";
const DRAGGING_CLASS = "ytqm-row-dragging";
const DROP_TARGET_CLASS = "ytqm-row-drop-target";
const MENU_CLASS = "ytqm-menu-actions";
const STATUS_TIMEOUT_MS = 2500;
const PENDING_NEXT_TIMEOUT_MS = 15000;

let activePanel = null;
let attachedVideo = null;
let draggedRow = null;
let menuRow = null;
let pendingNext = null;
let lastVideoId = getCurrentVideoId();
let refreshTimer = null;
let statusTimer = null;
let urlCheckTimer = null;

init();

function init() {
  refreshEnhancements();
  attachPlaybackSync();

  document.addEventListener("click", rememberMenuRow, true);
  document.addEventListener("click", handleInjectedMenuClick, true);
  document.addEventListener("click", handlePlaybackControlClick, true);
  window.addEventListener("yt-navigate-start", scheduleVideoChangeCheck, true);
  window.addEventListener("yt-navigate-finish", scheduleVideoChangeCheck, true);
  window.addEventListener("yt-page-data-updated", scheduleVideoChangeCheck, true);
  window.addEventListener("popstate", scheduleVideoChangeCheck, true);

  const observer = new MutationObserver(() => {
    scheduleRefresh();
    injectMenuActions();
    attachPlaybackSync();
    scheduleVideoChangeCheck();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshEnhancements, 120);
}

function refreshEnhancements() {
  const panel = findNativeQueuePanel();

  if (!panel) {
    activePanel = null;
    return;
  }

  activePanel = panel;
  ensureToolbar(panel);
  enhanceRows(panel);
  updateToolbarCount(panel);
}

function attachPlaybackSync() {
  const video = document.querySelector("video");

  if (!video || video === attachedVideo) {
    return;
  }

  if (attachedVideo) {
    attachedVideo.removeEventListener("ended", handleVideoEnded, true);
  }

  attachedVideo = video;
  attachedVideo.addEventListener("ended", handleVideoEnded, true);
}

function findNativeQueuePanel() {
  const panels = [...document.querySelectorAll("ytd-playlist-panel-renderer")];

  return (
    panels.find((panel) => isVisible(panel) && isQueuePanel(panel)) ||
    panels.find((panel) => isVisible(panel) && getQueueRows(panel).length > 0) ||
    null
  );
}

function isQueuePanel(panel) {
  const headerText = [
    panel.querySelector("#title")?.textContent,
    panel.querySelector("#header")?.textContent,
    panel.querySelector("yt-formatted-string")?.textContent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return headerText.includes("queue");
}

function ensureToolbar(panel) {
  if (panel.querySelector(`.${TOOLBAR_CLASS}`)) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = TOOLBAR_CLASS;
  toolbar.append(
    createToolbarTitle(),
    createToolbarActions(),
    createStatusElement()
  );

  toolbar.addEventListener("click", handleToolbarClick);

  const insertionPoint =
    panel.querySelector("#header") ||
    panel.querySelector("ytd-playlist-panel-header-renderer") ||
    panel.firstElementChild;

  if (insertionPoint?.parentElement) {
    insertionPoint.insertAdjacentElement("afterend", toolbar);
  } else {
    panel.prepend(toolbar);
  }
}

function handleToolbarClick(event) {
  const button = event.target.closest("button");

  if (!button || !activePanel) {
    return;
  }

  if (button.dataset.action === "refresh") {
    refreshEnhancements();
    setStatus("Queue rows refreshed.");
  }

  if (button.dataset.action === "number") {
    activePanel.classList.toggle("ytqm-show-numbers");
    refreshEnhancements();
  }

  if (button.dataset.action === "reverse") {
    reverseQueue(activePanel);
  }
}

function enhanceRows(panel) {
  getQueueRows(panel).forEach((row, index) => {
    row.classList.add(ROW_CLASS);
    row.dataset.ytqmIndex = String(index + 1);
    row.setAttribute("draggable", "true");
    row.title = "Drag this row to reorder YouTube's queue";

    row.querySelectorAll(".ytqm-row-actions").forEach((actions) => actions.remove());

    if (row.dataset.ytqmDragReady === "true") {
      return;
    }

    row.dataset.ytqmDragReady = "true";
    row.addEventListener("dragstart", handleDragStart, true);
    row.addEventListener("dragover", handleDragOver, true);
    row.addEventListener("dragleave", handleDragLeave, true);
    row.addEventListener("drop", handleDrop, true);
    row.addEventListener("dragend", handleDragEnd, true);
  });
}

function handleDragStart(event) {
  const row = event.currentTarget;

  draggedRow = row;
  row.classList.add(DRAGGING_CLASS);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", getRowId(row));
  }
}

function handleDragOver(event) {
  if (!draggedRow || event.currentTarget === draggedRow) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  event.currentTarget.classList.add(DROP_TARGET_CLASS);
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove(DROP_TARGET_CLASS);
}

function handleDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove(DROP_TARGET_CLASS);

  if (!activePanel || !draggedRow || draggedRow === event.currentTarget) {
    return;
  }

  const rows = getQueueRows(activePanel);
  const fromIndex = rows.indexOf(draggedRow);
  const toIndex = rows.indexOf(event.currentTarget);

  if (fromIndex === -1 || toIndex === -1) {
    return;
  }

  moveQueueItem(activePanel, fromIndex, toIndex);
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove(DRAGGING_CLASS);
  getQueueRows(activePanel || document).forEach((row) => row.classList.remove(DROP_TARGET_CLASS));
  draggedRow = null;
}

function handleVideoEnded() {
  armExpectedNextFromVisibleQueue("Video ended");

  if (pendingNext) {
    playPendingNextFromNativeQueue();
  }
}

function handlePlaybackControlClick(event) {
  if (!event.target.closest(".ytp-next-button")) {
    return;
  }

  armExpectedNextFromVisibleQueue("Next");

  if (pendingNext) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.setTimeout(playPendingNextFromNativeQueue, 0);
  }
}

function scheduleVideoChangeCheck() {
  window.clearTimeout(urlCheckTimer);
  urlCheckTimer = window.setTimeout(checkForVideoChange, 80);
}

function checkForVideoChange() {
  const currentVideoId = getCurrentVideoId();

  if (!currentVideoId || currentVideoId === lastVideoId) {
    return;
  }

  lastVideoId = currentVideoId;

  if (!pendingNext) {
    return;
  }

  if (Date.now() > pendingNext.expiresAt) {
    pendingNext = null;
    return;
  }

  if (currentVideoId === pendingNext.videoId) {
    pendingNext = null;
    return;
  }

  if (pendingNext.attempts >= 2) {
    setStatus("YouTube ignored the reordered queue playback correction.");
    pendingNext = null;
    return;
  }

  pendingNext.attempts += 1;
  playPendingNextFromNativeQueue();
}

function armExpectedNextFromVisibleQueue(reason) {
  const nextItem = getExpectedNextQueueItem();

  if (!nextItem) {
    pendingNext = null;
    return;
  }

  pendingNext = {
    ...nextItem,
    attempts: 0,
    expiresAt: Date.now() + PENDING_NEXT_TIMEOUT_MS
  };

  setStatus(`${reason}: next is ${nextItem.title || nextItem.videoId}.`);
}

function playPendingNextFromNativeQueue() {
  if (!pendingNext) {
    return;
  }

  const row = findQueueRowByVideoId(pendingNext.videoId);
  const link = row?.querySelector("a[href*='/watch']");

  if (link) {
    link.click();
    return;
  }

  window.location.assign(pendingNext.url);
}

function getExpectedNextQueueItem() {
  if (!activePanel) {
    refreshEnhancements();
  }

  const items = getVisibleQueueItems(activePanel);
  const currentVideoId = getCurrentVideoId();

  if (!items.length || !currentVideoId) {
    return null;
  }

  const currentIndex = items.findIndex((item) => item.videoId === currentVideoId);
  const nextItem = currentIndex >= 0 ? items[currentIndex + 1] : items[0];

  if (!nextItem || nextItem.videoId === currentVideoId) {
    return null;
  }

  return nextItem;
}

function rememberMenuRow(event) {
  const row = event.target.closest(ROW_SELECTOR);

  if (!row || !activePanel || !activePanel.contains(row)) {
    return;
  }

  const menuTrigger = event.target.closest(
    "ytd-menu-renderer, yt-icon-button, button, #button, [aria-label*='Action' i], [aria-label*='More' i]"
  );

  if (menuTrigger) {
    menuRow = row;
    window.setTimeout(injectMenuActions, 50);
  }
}

function injectMenuActions() {
  if (!menuRow || !activePanel?.contains(menuRow)) {
    return;
  }

  const popup = findOpenMenuPopup();

  if (!popup || popup.querySelector(`.${MENU_CLASS}`)) {
    return;
  }

  const actions = document.createElement("div");
  actions.className = MENU_CLASS;
  actions.append(
    createMenuButton("top", "Move to top"),
    createMenuButton("up", "Move up"),
    createMenuButton("down", "Move down"),
    createMenuButton("bottom", "Move to bottom")
  );

  const list = popup.querySelector("tp-yt-paper-listbox, ytd-menu-popup-renderer, #items") || popup;
  list.append(actions);
}

function createToolbarTitle() {
  const title = document.createElement("div");
  const label = document.createElement("span");
  const count = document.createElement("span");

  title.className = "ytqm-native-title";
  label.textContent = "Queue tools";
  count.dataset.role = "count";
  title.append(label, count);

  return title;
}

function createToolbarActions() {
  const actions = document.createElement("div");

  actions.className = "ytqm-native-actions";
  actions.append(
    createToolbarButton("refresh", "Refresh"),
    createToolbarButton("reverse", "Reverse"),
    createToolbarButton("number", "Number")
  );

  return actions;
}

function createToolbarButton(action, label) {
  const button = document.createElement("button");

  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;

  return button;
}

function createStatusElement() {
  const status = document.createElement("div");

  status.className = "ytqm-native-status";
  status.dataset.role = "status";

  return status;
}

function createMenuButton(action, label) {
  const button = document.createElement("button");

  button.type = "button";
  button.dataset.ytqmMove = action;
  button.role = "menuitem";
  button.textContent = label;

  return button;
}

function handleInjectedMenuClick(event) {
  const button = event.target.closest("[data-ytqm-move]");

  if (!button || !menuRow || !activePanel) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const rows = getQueueRows(activePanel);
  const fromIndex = rows.indexOf(menuRow);
  const toIndex = getTargetIndex(button.dataset.ytqmMove, fromIndex, rows.length);

  moveQueueItem(activePanel, fromIndex, toIndex);
  closeOpenMenu();
}

function reverseQueue(panel) {
  const rows = getQueueRows(panel);

  if (rows.length < 2) {
    setStatus("Queue needs at least two items.");
    return;
  }

  const beforeOrder = getRowOrder(panel);
  const reversedRows = [...rows].reverse();
  const container = getRowsContainer(rows);

  reversedRows.forEach((row) => container.append(row));
  updateMatchingComponentArrays(panel, beforeOrder, [...beforeOrder].reverse());
  emitQueueChanged(panel);
  refreshEnhancements();
  setStatus("Visible native queue reversed.");
}

function moveQueueItem(panel, fromIndex, toIndex) {
  const rows = getQueueRows(panel);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return;
  }

  const source = rows[fromIndex];
  const target = rows[toIndex];
  const container = getRowsContainer(rows);
  const beforeOrder = getRowOrder(panel);
  const nextOrder = moveArrayItem(beforeOrder, fromIndex, toIndex);

  if (toIndex > fromIndex) {
    target.after(source);
  } else {
    container.insertBefore(source, target);
  }

  updateMatchingComponentArrays(panel, beforeOrder, nextOrder);
  emitQueueChanged(panel);
  refreshEnhancements();
  setStatus("Visible native queue order changed.");
}

function updateMatchingComponentArrays(panel, beforeOrder, nextOrder) {
  const candidates = findMatchingArrays(panel, beforeOrder);

  candidates.forEach((candidate) => {
    const reordered = reorderArrayByIds(candidate.array, beforeOrder, nextOrder);

    candidate.parent[candidate.key] = reordered;

    if (typeof candidate.owner?.notifyPath === "function") {
      candidate.owner.notifyPath(candidate.path, reordered);
    }

    if (typeof candidate.owner?.set === "function") {
      candidate.owner.set(candidate.path, reordered);
    }
  });
}

function findMatchingArrays(root, order) {
  const matches = [];
  const visited = new WeakSet();
  const maxDepth = 5;
  const searchRoots = [
    { value: root, owner: root, path: "" },
    { value: root.data, owner: root, path: "data" },
    { value: root.playlistData, owner: root, path: "playlistData" },
    { value: root.__data, owner: root, path: "__data" },
    { value: root.__data?.data, owner: root, path: "__data.data" }
  ];

  searchRoots.forEach((searchRoot) => {
    walk(searchRoot.value, searchRoot.owner, searchRoot.path, 0);
  });
  return matches;

  function walk(value, owner, path, depth) {
    if (!value || typeof value !== "object" || visited.has(value) || depth > maxDepth) {
      return;
    }

    visited.add(value);

    if (Array.isArray(value) && value.length === order.length && arrayMatchesOrder(value, order)) {
      const parentPath = path.split(".");
      const key = parentPath.pop();
      const parent = parentPath.reduce((object, pathPart) => object?.[pathPart], root);

      if (parent && key) {
        matches.push({ array: value, owner, parent, key, path });
      }
      return;
    }

    Object.keys(value).forEach((key) => {
      if (key.startsWith("__") || key === "parentNode" || key === "children") {
        return;
      }

      try {
        walk(value[key], owner, path ? `${path}.${key}` : key, depth + 1);
      } catch {
        // YouTube components expose some throwing accessors.
      }
    });
  }
}

function arrayMatchesOrder(items, order) {
  return items.every((item, index) => getVideoIdFromData(item) === order[index]);
}

function reorderArrayByIds(items, beforeOrder, nextOrder) {
  const itemByVideoId = new Map();

  items.forEach((item, index) => {
    itemByVideoId.set(beforeOrder[index], item);
  });

  return nextOrder.map((videoId) => itemByVideoId.get(videoId));
}

function emitQueueChanged(panel) {
  ["change", "yt-update-playlist", "yt-playlist-data-updated"].forEach((eventName) => {
    panel.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true }));
  });
}

function getTargetIndex(action, currentIndex, rowCount) {
  const lastIndex = rowCount - 1;
  const targetIndexByAction = {
    top: 0,
    up: Math.max(0, currentIndex - 1),
    down: Math.min(lastIndex, currentIndex + 1),
    bottom: lastIndex
  };

  return targetIndexByAction[action] ?? currentIndex;
}

function getQueueRows(panel) {
  return [...panel.querySelectorAll(ROW_SELECTOR)].filter(isVisible);
}

function getVisibleQueueItems(panel) {
  if (!panel) {
    return [];
  }

  return getQueueRows(panel)
    .map((row) => ({
      row,
      videoId: getPlayableRowVideoId(row),
      title: getRowTitle(row),
      url: getRowUrl(row)
    }))
    .filter((item) => item.videoId && item.url);
}

function findQueueRowByVideoId(videoId) {
  return getQueueRows(activePanel || document).find((row) => getPlayableRowVideoId(row) === videoId) || null;
}

function getRowsContainer(rows) {
  return rows[0]?.parentElement || activePanel;
}

function getRowOrder(panel) {
  return getQueueRows(panel).map(getRowId);
}

function getRowId(row) {
  const link = row.querySelector("a[href*='/watch']");
  const videoId = getVideoIdFromUrl(link?.href || "");

  return videoId || row.getAttribute("video-id") || row.textContent.trim();
}

function getRowUrl(row) {
  const link = row.querySelector("a[href*='/watch']");

  return link?.href || "";
}

function getPlayableRowVideoId(row) {
  const link = row.querySelector("a[href*='/watch']");

  return getVideoIdFromUrl(link?.href || "");
}

function getRowTitle(row) {
  return (
    row.querySelector("#video-title")?.textContent?.trim() ||
    row.querySelector("yt-formatted-string")?.textContent?.trim() ||
    row.textContent.trim()
  );
}

function getCurrentVideoId() {
  return getVideoIdFromUrl(location.href);
}

function getVideoIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}

function getVideoIdFromData(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value.videoId === "string") {
    return value.videoId;
  }

  if (typeof value.video_id === "string") {
    return value.video_id;
  }

  if (value.playlistPanelVideoRenderer) {
    return getVideoIdFromData(value.playlistPanelVideoRenderer);
  }

  if (value.videoRenderer) {
    return getVideoIdFromData(value.videoRenderer);
  }

  if (value.watchEndpoint) {
    return getVideoIdFromData(value.watchEndpoint);
  }

  if (value.navigationEndpoint) {
    return getVideoIdFromData(value.navigationEndpoint);
  }

  return null;
}

function moveArrayItem(items, fromIndex, toIndex) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function findOpenMenuPopup() {
  return [...document.querySelectorAll("ytd-menu-popup-renderer, tp-yt-paper-listbox")]
    .filter(isVisible)
    .at(-1);
}

function closeOpenMenu() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Escape",
      code: "Escape"
    })
  );
}

function updateToolbarCount(panel) {
  const count = panel.querySelector(`.${TOOLBAR_CLASS} [data-role='count']`);

  if (count) {
    count.textContent = `${getQueueRows(panel).length} items`;
  }
}

function setStatus(message) {
  const status = activePanel?.querySelector(`.${TOOLBAR_CLASS} [data-role='status']`);

  if (!status) {
    return;
  }

  window.clearTimeout(statusTimer);
  status.textContent = message;
  statusTimer = window.setTimeout(() => {
    status.textContent = "";
  }, STATUS_TIMEOUT_MS);
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
