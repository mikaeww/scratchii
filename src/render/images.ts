// Decoded pictures for the canvas, by data URL. A picture that is still decoding is skipped once and the
// caller is told to draw again when it is ready.
const decoded = new Map<string, HTMLImageElement>();

export function imageFor(src: string, onReady: () => void): HTMLImageElement | null {
  const known = decoded.get(src);
  if (known !== undefined) return known.complete && known.naturalWidth > 0 ? known : null;
  const image = new Image();
  image.addEventListener("load", onReady, { once: true });
  image.addEventListener("error", () => {
    console.error("A picture on this board could not be decoded");
  });
  image.src = src;
  decoded.set(src, image);
  return null;
}

// Resolves when every picture is decoded, so an export never misses one.
export async function decodeAll(sources: readonly string[]): Promise<void> {
  await Promise.all(
    sources.map(async (src) => {
      imageFor(src, () => undefined);
      await decoded.get(src)?.decode();
    }),
  );
}
