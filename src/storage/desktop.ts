// Saving through the desktop shell's native dialog (Tauri). Loaded only inside the desktop app.
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// Resolves false when the user cancels the dialog.
export async function saveWithDialog(name: string, blob: Blob): Promise<boolean> {
  const extension = name.slice(name.lastIndexOf(".") + 1);
  const path = await save({
    defaultPath: name,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (path === null) return false;
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return true;
}
