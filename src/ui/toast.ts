// Short messages at the bottom of the screen. Errors stay until closed; notes leave after a few seconds.
import { text } from "./text.ts";

const NOTE_MS = 4000;

function container(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(".toasts");
  if (existing !== null) return existing;
  const created = document.createElement("div");
  created.className = "toasts";
  document.body.append(created);
  return created;
}

export function showToast(message: string, kind: "note" | "error"): void {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  const label = document.createElement("span");
  label.textContent = message;
  toast.append(label);
  if (kind === "error") {
    const close = document.createElement("button");
    close.className = "button";
    close.textContent = text("toast.close");
    close.addEventListener("click", () => {
      toast.remove();
    });
    toast.append(close);
  } else {
    setTimeout(() => {
      toast.remove();
    }, NOTE_MS);
  }
  container().append(toast);
}
