/** Kinds of tab state changes the extension can report. */
export type ChangeKind =
  | "loading"
  | "complete"
  | "title"
  | "url"
  | "audible"
  | "muted"
  | "discarded"
  | "pinned"
  | "created"
  | "removed";

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  loading: "Started loading",
  complete: "Finished loading",
  title: "Title changed",
  url: "URL changed",
  audible: "Sound started / stopped",
  muted: "Muted / unmuted",
  discarded: "Discarded / restored (memory saver)",
  pinned: "Pinned / unpinned",
  created: "Tab opened",
  removed: "Tab closed",
};

export interface Settings {
  enabled: Record<ChangeKind, boolean>;
  /** Skip notifications for the tab you're currently looking at. */
  onlyBackgroundTabs: boolean;
  /** Minimum seconds between notifications for the same tab. */
  cooldownSeconds: number;
  /** Keep notifications on screen until dismissed. */
  requireInteraction: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: {
    loading: false,
    complete: true,
    title: true,
    url: true,
    audible: true,
    muted: false,
    discarded: true,
    pinned: false,
    created: false,
    removed: false,
  },
  onlyBackgroundTabs: true,
  cooldownSeconds: 5,
  requireInteraction: false,
};

export async function loadSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get("settings");
  const stored = (settings ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    enabled: { ...DEFAULT_SETTINGS.enabled, ...(stored.enabled ?? {}) },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}

/** One entry in the recent-changes log shown in the popup. */
export interface ChangeEvent {
  id: string;
  tabId: number;
  windowId: number;
  kind: ChangeKind;
  tabTitle: string;
  detail: string;
  favIconUrl?: string;
  time: number;
}

export const LOG_LIMIT = 100;
