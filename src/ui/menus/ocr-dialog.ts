// Shows what Tesseract read from the chosen strokes and replaces them only after the user confirmed or
// corrected the text.
import { strokesToText } from "../../editor/commands.ts";
import type { Editor } from "../../editor/editor.ts";
import type { StrokeItem } from "../../model/item.ts";
import { measureBlock } from "../../render/measure.ts";
import { readHandwriting, strokesImage } from "../../recognize/handwriting.ts";
import { text } from "../text.ts";

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

export function mountOcr(editor: Editor): (strokes: readonly StrokeItem[]) => void {
  const dialog = element("dialog", "dialog settings");
  const status = element("p", "dialog-hint");
  status.setAttribute("role", "status");
  const result = element("textarea", "input ocr-text");
  result.setAttribute("aria-label", text("ocr.title"));
  result.rows = 3;
  const convert = element("button", "button primary", text("ocr.convert"));
  const cancel = element("button", "button", text("ocr.cancel"));
  const actions = element("div", "dialog-actions");
  actions.append(cancel, convert);
  dialog.append(element("h2", "dialog-title", text("ocr.title")), status, result, actions);
  document.body.append(dialog);
  let chosen: readonly StrokeItem[] = [];

  cancel.addEventListener("click", () => {
    dialog.close();
  });
  convert.addEventListener("click", () => {
    strokesToText(editor, chosen, result.value.trim(), measureBlock);
    dialog.close();
  });

  return (strokes) => {
    chosen = strokes;
    result.value = "";
    result.hidden = true;
    convert.disabled = true;
    status.textContent = text("ocr.reading");
    dialog.showModal();
    const image = strokesImage(strokes);
    if (image === null) {
      status.textContent = text("ocr.empty");
      return;
    }
    readHandwriting(image)
      .then((reading) => {
        if (reading.text === "") {
          status.textContent = text("ocr.empty");
          return;
        }
        status.textContent = `${text("ocr.hint")} ${Math.round(reading.confidence)} %`;
        result.value = reading.text;
        result.hidden = false;
        convert.disabled = false;
        result.focus();
      })
      .catch((error: unknown) => {
        console.error(error);
        status.textContent = `${text("ocr.failed")} ${error instanceof Error ? error.message : String(error)}`;
      });
  };
}
