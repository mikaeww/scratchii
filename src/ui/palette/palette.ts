// The command palette (Ctrl+K): a filter field over every command, arrow keys to choose, Enter to run. Not here:
// which commands exist (commands.ts) or how they are ranked (rank.ts).
import { text } from "../text.ts";
import { rankCommands, type Command, type Match } from "./rank.ts";

// More would only push the best matches out of sight; typing narrows the list anyway.
const SHOWN = 12;

function option(match: Match, index: number, active: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "menu-item palette-option";
  row.id = `palette-option-${index}`;
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", String(active));
  const label = document.createElement("span");
  label.textContent = match.command.label;
  row.append(label);
  const hint = match.argument || match.command.argument;
  if (hint !== undefined && hint !== "") {
    const extra = document.createElement("span");
    extra.className = "palette-argument";
    extra.textContent = hint;
    row.append(extra);
  }
  return row;
}

export function mountPalette(commands: () => readonly Command[]): () => void {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog palette";
  dialog.setAttribute("aria-label", text("palette.title"));
  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = text("palette.placeholder");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-controls", "palette-list");
  input.spellcheck = false;
  const list = document.createElement("div");
  list.id = "palette-list";
  list.className = "palette-list";
  list.setAttribute("role", "listbox");
  dialog.append(input, list);
  document.body.append(dialog);
  let matches: Match[] = [];
  let active = 0;

  const show = (): void => {
    matches = rankCommands(input.value, commands()).slice(0, SHOWN);
    active = Math.min(active, Math.max(0, matches.length - 1));
    list.replaceChildren(...matches.map((match, index) => option(match, index, index === active)));
    if (matches.length === 0)
      list.append(
        Object.assign(document.createElement("p"), {
          className: "dialog-hint",
          textContent: text("palette.none"),
        }),
      );
    input.setAttribute("aria-activedescendant", matches.length === 0 ? "" : `palette-option-${active}`);
  };
  const run = (match: Match | undefined): void => {
    if (match === undefined) return;
    dialog.close();
    match.command.run(match.argument);
  };

  input.addEventListener("input", () => {
    active = 0;
    show();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = (active + step + matches.length) % Math.max(1, matches.length);
      show();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(matches[active]);
    }
  });
  list.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[role=option]");
    if (row !== null) run(matches[Number(row.id.replace("palette-option-", ""))]);
  });
  const open = (): void => {
    if (dialog.open) return;
    input.value = "";
    active = 0;
    show();
    dialog.showModal();
    input.focus();
  };
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    }
  });
  return open;
}
