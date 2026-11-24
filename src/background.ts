import {
  CHANGE_LABELS,
  LOG_LIMIT,
  loadSettings,
  type ChangeEvent,
  type ChangeKind,
  type Settings,
} from "./settings.js";

const NOTIFICATION_PREFIX = "tab-";

/** Last notification time per tab (in-memory; resets if the worker sleeps, which is fine). */
const lastNotified = new Map<number, number>();
/** Last known title per tab, so notifications can show "old → new". */
const lastTitle = new Map<number, string>();
/** onRemoved gives no Tab object, so keep a snapshot of each tab to describe it after it closes. */
const tabSnapshots = new Map<number, chrome.tabs.Tab>();

let settingsCache: Settings | null = null;
async function getSettings(): Promise<Settings> {
  settingsCache ??= await loadSettings();
  return settingsCache;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) settingsCache = null;
});

function tabLabel(tab: chrome.tabs.Tab): string {
  return tab.title || tab.pendingUrl || tab.url || `Tab ${tab.id}`;
}

function describe(
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
): Array<[ChangeKind, string]> {
  const out: Array<[ChangeKind, string]> = [];
  if (changeInfo.status === "loading") out.push(["loading", "Page started loading"]);
  if (changeInfo.status === "complete") out.push(["complete", "Page finished loading"]);
  if (changeInfo.title !== undefined) {
    const prev = lastTitle.get(tab.id!);
    if (prev !== changeInfo.title) {
      out.push(["title", prev ? `"${prev}" → "${changeInfo.title}"` : `Now "${changeInfo.title}"`]);
    }
  }
  if (changeInfo.url !== undefined) out.push(["url", changeInfo.url]);
  if (changeInfo.audible !== undefined) {
    out.push(["audible", changeInfo.audible ? "Started playing sound" : "Stopped playing sound"]);
  }
  if (changeInfo.mutedInfo !== undefined) {
    out.push(["muted", changeInfo.mutedInfo.muted ? "Muted" : "Unmuted"]);
  }
  if (changeInfo.discarded !== undefined) {
    out.push(["discarded", changeInfo.discarded ? "Discarded to save memory" : "Restored"]);
  }
  if (changeInfo.pinned !== undefined) out.push(["pinned", changeInfo.pinned ? "Pinned" : "Unpinned"]);
  return out;
}

async function isForegroundTab(tab: chrome.tabs.Tab): Promise<boolean> {
  if (!tab.active) return false;
  try {
    const win = await chrome.windows.get(tab.windowId);
    return win.focused;
  } catch {
    return false;
  }
}

async function setBadge(unread: number): Promise<void> {
  await chrome.action.setBadgeText({ text: unread === 0 ? "" : unread > 99 ? "99+" : String(unread) });
}

async function appendLog(event: ChangeEvent): Promise<void> {
  const { log = [], unread = 0 } = (await chrome.storage.session.get(["log", "unread"])) as {
    log?: ChangeEvent[];
    unread?: number;
  };
  log.unshift(event);
  log.length = Math.min(log.length, LOG_LIMIT);
  await chrome.storage.session.set({ log, unread: unread + 1 });
  await setBadge(unread + 1);
}

// Serialize work so rapid-fire events don't clobber each other's log writes.
let queue: Promise<void> = Promise.resolve();
function enqueue(fn: () => Promise<void>): void {
  queue = queue.then(fn).catch((err) => console.error("[tab-state-watcher]", err));
}

async function report(kind: ChangeKind, detail: string, tab: chrome.tabs.Tab): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled[kind] || tab.id === undefined) return;
  if (settings.onlyBackgroundTabs && kind !== "removed" && (await isForegroundTab(tab))) return;

  const now = Date.now();
  const event: ChangeEvent = {
    id: `${tab.id}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    tabId: tab.id,
    windowId: tab.windowId,
    kind,
    tabTitle: tabLabel(tab),
    detail,
    favIconUrl: tab.favIconUrl,
    time: now,
  };
  await appendLog(event);

  // Everything is logged, but notifications per tab are rate-limited.
  const last = lastNotified.get(tab.id) ?? 0;
  if (now - last < settings.cooldownSeconds * 1000) return;
  lastNotified.set(tab.id, now);

  chrome.notifications.create(`${NOTIFICATION_PREFIX}${tab.id}-${now}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: `${CHANGE_LABELS[kind]}: ${event.tabTitle}`.slice(0, 120),
    message: detail.slice(0, 300),
    contextMessage: kind === "removed" ? "Tab closed" : "Click to switch to this tab",
    requireInteraction: settings.requireInteraction,
    priority: 1,
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabSnapshots.set(tabId, tab);
  enqueue(async () => {
    for (const [kind, detail] of describe(changeInfo, tab)) await report(kind, detail, tab);
    if (changeInfo.title !== undefined) lastTitle.set(tabId, changeInfo.title);
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) {
    tabSnapshots.set(tab.id, tab);
    if (tab.title) lastTitle.set(tab.id, tab.title);
  }
  enqueue(() => report("created", tab.pendingUrl || tab.url || "New tab", tab));
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const snap =
    tabSnapshots.get(tabId) ?? ({ id: tabId, windowId: removeInfo.windowId } as chrome.tabs.Tab);
  tabSnapshots.delete(tabId);
  lastTitle.delete(tabId);
  lastNotified.delete(tabId);
  enqueue(() => report("removed", snap.url ? `Closed ${snap.url}` : "Tab was closed", snap));
});

async function focusTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab) await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // Tab no longer exists.
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
  const tabId = Number(notificationId.slice(NOTIFICATION_PREFIX.length).split("-")[0]);
  chrome.notifications.clear(notificationId);
  void focusTab(tabId);
});

chrome.runtime.onMessage.addListener((msg: { type: string; tabId?: number }) => {
  if (msg.type === "focus-tab" && msg.tabId !== undefined) void focusTab(msg.tabId);
  if (msg.type === "mark-read") void setBadge(0);
});

async function init(): Promise<void> {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id === undefined) continue;
    tabSnapshots.set(tab.id, tab);
    if (tab.title) lastTitle.set(tab.id, tab.title);
  }
  const { unread = 0 } = (await chrome.storage.session.get("unread")) as { unread?: number };
  await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  await setBadge(unread);
}
enqueue(init);
