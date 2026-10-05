// The settings dialog: language and dot grid for this device, and the sync server.
import { PAPERS, type Paper } from "../../render/canvas.ts";
import { readPreferences, writePreferences, type Preferences } from "../../storage/preferences.ts";
import { SyncClient } from "../../sync/client.ts";
import { readSyncSettings, writeSyncSettings, type SyncSettings } from "../../sync/settings.ts";
import { text, type TextKey } from "../text.ts";
import { showToast } from "../toast.ts";

export interface SettingsHooks {
  readonly onSync: (settings: SyncSettings | null) => void;
  readonly onPaper: (paper: Paper) => void;
  // Called after the new language is stored; the caller saves the board and reloads.
  readonly onLanguage: () => void;
}

function label(key: TextKey): HTMLSpanElement {
  const caption = document.createElement("span");
  caption.className = "label";
  caption.textContent = text(key);
  return caption;
}

function field(key: TextKey, type: string): [HTMLLabelElement, HTMLInputElement] {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const input = document.createElement("input");
  input.className = "input";
  input.type = type;
  input.autocomplete = "off";
  input.spellcheck = false;
  wrapper.append(label(key), input);
  return [wrapper, input];
}

function button(key: TextKey, className = "button"): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text(key);
  return element;
}

function hint(key: TextKey | null): HTMLParagraphElement {
  const element = document.createElement("p");
  element.className = "dialog-hint";
  if (key !== null) element.textContent = text(key);
  return element;
}

const LANGUAGES: readonly [Preferences["language"], string][] = [
  ["system", ""],
  ["en", "English"],
  ["de", "Deutsch"],
];

function generalSection(hooks: SettingsHooks): { element: HTMLElement; load: () => void } {
  const element = document.createElement("div");
  element.className = "settings-section";
  const languageField = document.createElement("label");
  languageField.className = "field";
  const language = document.createElement("select");
  language.className = "input";
  for (const [value, name] of LANGUAGES)
    language.add(new Option(name === "" ? text("settings.languageSystem") : name, value));
  languageField.append(label("settings.language"), language);
  const paperField = document.createElement("label");
  paperField.className = "field";
  const paper = document.createElement("select");
  paper.className = "input";
  for (const value of PAPERS) paper.add(new Option(text(`paper.${value}`), value));
  paperField.append(label("settings.paper"), paper);
  element.append(label("settings.general"), languageField, hint("settings.languageHint"), paperField);
  language.addEventListener("change", () => {
    if (!writePreferences({ language: language.value as Preferences["language"] }))
      showToast(text("settings.unsaved"), "error");
    else hooks.onLanguage();
  });
  paper.addEventListener("change", () => {
    const chosen = PAPERS.find((p) => p === paper.value) ?? "plain";
    if (!writePreferences({ paper: chosen })) showToast(text("settings.unsaved"), "error");
    hooks.onPaper(chosen);
  });
  const load = (): void => {
    const preferences = readPreferences();
    language.value = preferences.language;
    paper.value = preferences.paper;
  };
  return { element, load };
}

function syncSection(hooks: SettingsHooks, done: () => void): { element: HTMLElement; load: () => void } {
  const element = document.createElement("div");
  element.className = "settings-section";
  const [urlField, url] = field("settings.url", "url");
  url.placeholder = "http://192.168.1.10:8787";
  const [tokenField, token] = field("settings.token", "password");
  const result = hint(null);
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
  element.append(label("settings.sync"), hint("settings.syncHint"), urlField, tokenField, result, actions);
  const current = (): SyncSettings => ({ url: url.value.trim(), token: token.value.trim() });
  const apply = (settings: SyncSettings | null): void => {
    if (!writeSyncSettings(settings)) showToast(text("settings.unsaved"), "error");
    hooks.onSync(settings);
    done();
  };
  test.addEventListener("click", () => {
    result.textContent = text("settings.testing");
    new SyncClient(current().url, current().token)
      .list()
      .then(
        (boards) =>
          (result.textContent = `${text("settings.ok")} ${boards.filter((entry) => !entry.deleted).length}`),
      )
      .catch(
        (error: unknown) =>
          (result.textContent = `${text("settings.failed")} ${error instanceof Error ? error.message : String(error)}`),
      );
  });
  save.addEventListener("click", () => {
    apply(current().url === "" ? null : current());
  });
  disconnect.addEventListener("click", () => {
    apply(null);
  });
  close.addEventListener("click", done);
  const load = (): void => {
    const saved = readSyncSettings();
    url.value = saved?.url ?? "";
    token.value = saved?.token ?? "";
    result.textContent = "";
  };
  return { element, load };
}

export function mountSettings(hooks: SettingsHooks): () => void {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog settings";
  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = text("settings.title");
  const general = generalSection(hooks);
  const sync = syncSection(hooks, () => {
    dialog.close();
  });
  dialog.append(title, general.element, sync.element);
  document.body.append(dialog);
  return () => {
    general.load();
    sync.load();
    dialog.showModal();
  };
}
