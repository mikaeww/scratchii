// The settings dialog. For now it holds the sync server; language and drawing defaults join in phase 9.
import { SyncClient } from "../../sync/client.ts";
import { readSyncSettings, writeSyncSettings, type SyncSettings } from "../../sync/settings.ts";
import { text, type TextKey } from "../text.ts";
import { showToast } from "../toast.ts";

function field(label: TextKey, type: string): [HTMLLabelElement, HTMLInputElement] {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const caption = document.createElement("span");
  caption.className = "label";
  caption.textContent = text(label);
  const input = document.createElement("input");
  input.className = "input";
  input.type = type;
  input.autocomplete = "off";
  input.spellcheck = false;
  wrapper.append(caption, input);
  return [wrapper, input];
}

function button(label: TextKey, className = "button"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text(label);
  return element;
}

async function testConnection(settings: SyncSettings, result: HTMLElement): Promise<void> {
  result.textContent = text("settings.testing");
  try {
    const boards = await new SyncClient(settings.url, settings.token).list();
    result.textContent = `${text("settings.ok")} ${boards.filter((entry) => !entry.deleted).length}`;
  } catch (error) {
    result.textContent = `${text("settings.failed")} ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function mountSettings(onSync: (settings: SyncSettings | null) => void): () => void {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog settings";
  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = text("settings.title");
  const heading = document.createElement("span");
  heading.className = "label";
  heading.textContent = text("settings.sync");
  const hint = document.createElement("p");
  hint.className = "dialog-hint";
  hint.textContent = text("settings.syncHint");
  const [urlField, url] = field("settings.url", "url");
  url.placeholder = "http://192.168.1.10:8787";
  const [tokenField, token] = field("settings.token", "password");
  const result = document.createElement("p");
  result.className = "dialog-hint";
  result.setAttribute("role", "status");
  const [test, disconnect, close, save] = [
    button("settings.test"),
    button("settings.disconnect"),
    button("settings.close"),
    button("settings.save", "button primary"),
  ];
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  actions.append(test, disconnect, close, save);
  dialog.append(title, heading, hint, urlField, tokenField, result, actions);
  document.body.append(dialog);
  const current = (): SyncSettings => ({ url: url.value.trim(), token: token.value.trim() });
  const apply = (settings: SyncSettings | null): void => {
    if (!writeSyncSettings(settings)) showToast(text("settings.unsaved"), "error");
    onSync(settings);
    dialog.close();
  };
  test.addEventListener("click", () => void testConnection(current(), result));
  save.addEventListener("click", () => {
    apply(current().url === "" ? null : current());
  });
  disconnect.addEventListener("click", () => {
    apply(null);
  });
  close.addEventListener("click", () => {
    dialog.close();
  });
  return () => {
    const saved = readSyncSettings();
    url.value = saved?.url ?? "";
    token.value = saved?.token ?? "";
    result.textContent = "";
    dialog.showModal();
  };
}
