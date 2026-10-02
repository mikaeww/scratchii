#!/bin/sh
# Builds the desktop app and installs it for the current user into ~/.local (no root).
#   ./install.sh              build and install
#   ./install.sh --uninstall  remove what install.sh put into ~/.local
set -eu
cd "$(dirname "$0")"

bin="$HOME/.local/bin/scratchii"
desktop="$HOME/.local/share/applications/scratchii.desktop"
icon="$HOME/.local/share/icons/hicolor/512x512/apps/scratchii.png"

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$bin" "$desktop" "$icon"
  echo "Removed Scratchii from ~/.local. Your boards stay in ~/.local/share/dev.mikaeww.scratchii."
  exit 0
fi

for tool in node npm cargo pkg-config; do
  command -v "$tool" >/dev/null || { echo "install.sh: $tool is missing" >&2; exit 1; }
done
pkg-config --exists webkit2gtk-4.1 || { echo "install.sh: webkit2gtk-4.1 is missing" >&2; exit 1; }

npm ci
# A third of the cores and the lowest priority, so the machine stays usable while Rust compiles.
jobs=$(( $(nproc) / 3 > 0 ? $(nproc) / 3 : 1 ))
CARGO_BUILD_JOBS=$jobs nice -n 19 npx tauri build --no-bundle

install -Dm755 src-tauri/target/release/scratchii "$bin"
install -Dm644 scratchii.desktop "$desktop"
install -Dm644 src-tauri/icons/icon.png "$icon"
# Optional: refreshes menu caches where the tool exists; menus pick the entry up on their own otherwise.
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
echo "Installed: $bin"
