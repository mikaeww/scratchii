// Keyboard handling shared by every menu: arrows move between items, Escape closes.

export function moveFocus(menu: HTMLElement, step: number): void {
  const items = [...menu.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  items[(index + step + items.length) % items.length]?.focus();
}

export function attachMenuKeys(menu: HTMLElement, close: () => void): void {
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") moveFocus(menu, 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") moveFocus(menu, -1);
    else return;
    event.preventDefault();
  });
}
