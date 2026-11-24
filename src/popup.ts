import { CHANGE_LABELS, type ChangeEvent } from "./settings.js";

const list = document.getElementById("log") as HTMLUListElement;
const empty = document.getElementById("empty") as HTMLParagraphElement;

function timeAgo(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return new Date(t).toLocaleTimeString();
}

function render(log: ChangeEvent[]): void {
  list.replaceChildren();
  empty.hidden = log.length > 0;
  for (const ev of log) {
    const li = document.createElement("li");
    li.className = `kind-${ev.kind}`;
    li.title = "Switch to this tab";

    const icon = document.createElement("img");
    icon.className = "favicon";
    icon.alt = "";
    if (ev.favIconUrl?.startsWith("http") || ev.favIconUrl?.startsWith("data:")) {
      icon.src = ev.favIconUrl;
    } else {
      icon.src = "icons/icon16.png";
    }

    const body = document.createElement("div");
    body.className = "body";
    const head = document.createElement("div");
    head.className = "head";
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = CHANGE_LABELS[ev.kind];
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = timeAgo(ev.time);
    head.append(kind, when);
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = ev.tabTitle;
    const detail = document.createElement("div");
    detail.className = "detail";
    detail.textContent = ev.detail;
    body.append(head, title, detail);

    li.append(icon, body);
    li.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "focus-tab", tabId: ev.tabId });
      window.close();
    });
    list.append(li);
  }
}

async function load(): Promise<void> {
  const { log = [] } = (await chrome.storage.session.get("log")) as { log?: ChangeEvent[] };
  render(log);
}

document.getElementById("clear")!.addEventListener("click", async () => {
  await chrome.storage.session.set({ log: [], unread: 0 });
  render([]);
});
document.getElementById("options")!.addEventListener("click", () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.log) render((changes.log.newValue as ChangeEvent[]) ?? []);
});

// Opening the popup marks everything as read.
await chrome.storage.session.set({ unread: 0 });
chrome.runtime.sendMessage({ type: "mark-read" });
await load();
