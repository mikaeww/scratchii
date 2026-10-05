// A dialog with one text field for things edited as plain text: a graph's functions, a chart's values, a
// diagram's description. It stays open and names the problem until the text reads.
import { text, type TextKey } from "../text.ts";

export interface TextRequest {
  readonly title: TextKey;
  readonly hint: TextKey;
  readonly value: string;
  // Returns null when the text was used, or the problem to show.
  readonly apply: (value: string) => string | null;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

export function mountTextDialog(): (request: TextRequest) => void {
  const dialog = element("dialog", "dialog settings text-dialog");
  const title = element("h2", "dialog-title");
  const hint = element("p", "dialog-hint");
  const field = element("textarea", "input text-dialog-field");
  field.rows = 8;
  field.spellcheck = false;
  const problem = element("p", "dialog-hint text-dialog-problem");
  problem.setAttribute("role", "alert");
  const apply = element("button", "button primary", text("dialog.apply"));
  const cancel = element("button", "button", text("dialog.cancel"));
  const actions = element("div", "dialog-actions");
  actions.append(cancel, apply);
  dialog.append(title, hint, field, problem, actions);
  document.body.append(dialog);
  let current: TextRequest | null = null;
  // Opened from the palette, the dialog has no earlier focus to return to and would keep it in its hidden
  // field, where every shortcut typed afterwards would land. Escape closes natively, hence the listener too.
  const close = (): void => {
    field.blur();
    dialog.close();
  };
  dialog.addEventListener("close", () => {
    if (!dialog.open && dialog.contains(document.activeElement)) field.blur();
  });

  const submit = (): void => {
    if (current === null) return;
    const error = current.apply(field.value);
    problem.textContent = error ?? "";
    if (error === null) close();
  };
  apply.addEventListener("click", submit);
  cancel.addEventListener("click", close);
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  });
  return (request) => {
    current = request;
    title.textContent = text(request.title);
    hint.textContent = text(request.hint);
    field.setAttribute("aria-label", text(request.title));
    field.value = request.value;
    problem.textContent = "";
    dialog.showModal();
    field.focus();
  };
}
