// A minimal one-page PDF around a JPEG, which PDF embeds as is (DCTDecode). Enough for printing a board;
// not a vector PDF.

// PDF units are points: 72 per inch, against 96 CSS pixels per inch.
const POINTS_PER_PIXEL = 0.75;

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

// `image` is the JPEG's pixel size; `page` is the page size in CSS pixels, so a 2× image prints sharp at 1×.
export function pdfFromJpeg(jpeg: Uint8Array, image: Size, page: Size): Uint8Array<ArrayBuffer> {
  const width = (page.width * POINTS_PER_PIXEL).toFixed(2);
  const height = (page.height * POINTS_PER_PIXEL).toFixed(2);
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  const objects: (string | [string, Uint8Array, string])[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    [
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const parts: Uint8Array[] = [ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let offset = parts[0]?.length ?? 0;
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(offset);
    const pieces =
      typeof object === "string"
        ? [ascii(`${index + 1} 0 obj\n${object}\nendobj\n`)]
        : [ascii(`${index + 1} 0 obj\n${object[0]}`), object[1], ascii(`${object[2]}\nendobj\n`)];
    for (const piece of pieces) {
      parts.push(piece);
      offset += piece.length;
    }
  });
  const xref = offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  parts.push(
    ascii(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    ),
  );
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
