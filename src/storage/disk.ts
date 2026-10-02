// Files the user picks or downloads, through the browser. The desktop shell swaps in native dialogs later.

// Characters that are unsafe or awkward in file names on Linux, Windows or macOS; control characters too.
const UNSAFE = /[\\/:*?"<>|]+/g;

export function fileName(title: string, extension: string): string {
  const printable = title.replace(/./gsu, (c) => (c.charCodeAt(0) < 32 ? " " : c));
  const base = printable.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${base === "" ? "board" : base}${extension}`;
}

export function downloadFile(name: string, blob: Blob): void {
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
