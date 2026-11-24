import {
  CHANGE_LABELS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ChangeKind,
  type Settings,
} from "./settings.js";

const kindsEl = document.getElementById("kinds") as HTMLDivElement;
const backgroundOnly = document.getElementById("backgroundOnly") as HTMLInputElement;
const cooldown = document.getElementById("cooldown") as HTMLInputElement;
const sticky = document.getElementById("sticky") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;
const test = document.getElementById("test") as HTMLButtonElement;
const reset = document.getElementById("reset") as HTMLButtonElement;

let settings: Settings;

function render(): void {
  kindsEl.replaceChildren();
  for (const kind of Object.keys(CHANGE_LABELS) as ChangeKind[]) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = settings.enabled[kind];
    box.addEventListener("change", () => {
      settings.enabled[kind] = box.checked;
      void persist();
    });
    label.append(box, ` ${CHANGE_LABELS[kind]}`);
    kindsEl.append(label);
  }
  backgroundOnly.checked = settings.onlyBackgroundTabs;
  cooldown.value = String(settings.cooldownSeconds);
  sticky.checked = settings.requireInteraction;
}

let statusTimer: number | undefined;
async function persist(): Promise<void> {
  await saveSettings(settings);
  status.textContent = "Saved";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ""), 1200);
}

backgroundOnly.addEventListener("change", () => {
  settings.onlyBackgroundTabs = backgroundOnly.checked;
  void persist();
});
cooldown.addEventListener("change", () => {
  const n = Math.max(0, Math.min(3600, Number(cooldown.value) || 0));
  cooldown.value = String(n);
  settings.cooldownSeconds = n;
  void persist();
});
sticky.addEventListener("change", () => {
  settings.requireInteraction = sticky.checked;
  void persist();
});
reset.addEventListener("click", () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  render();
  void persist();
});
test.addEventListener("click", () => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "Tab State Watcher",
    message: "Notifications are working.",
  });
});

settings = await loadSettings();
render();
