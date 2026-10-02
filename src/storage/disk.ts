// Files the user picks or saves: a browser download, or the native save dialog inside the desktop app.

// Characters that are unsafe or awkward in file names on Linux, Windows or macOS; control characters too.
const UNSAFE = /[\\/:*?"<>|]+/g;

export function fileName(title: string, extension: string): string {
  const printable = title.replace(/./gsu, (c) => (c.charCodeAt(0) < 32 ? " " : c));
  const base = printable.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${base === "" ? "board" : base}${extension}`;
}

// The desktop shell (Tauri) injects this global; a browser never has it.
export function isDesktop(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function downloadFile(name: string, blob: Blob): Promise<void> {
  if (isDesktop()) {
    const { saveWithDialog } = await import("./desktop.ts");
    await saveWithDialog(name, blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // The click starts the download synchronously; the URL is only needed until then.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => {
      resolve(null);
    });
    input.click();
  });
}
