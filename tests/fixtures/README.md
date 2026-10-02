# Test fixtures

| File | What | Recipe | SHA-256 |
|---|---|---|---|
| `pixel.jpg` | 8 × 6 yellow JPEG, 634 bytes, input for the PDF writer test | Pillow: `Image.new("RGB", (8, 6), (255, 210, 63)).save("pixel.jpg", quality=90)` | `c226466e498fb239069dbeafe0a9ddea12e7e101cbd30fcdeb631b046d3f0eaa` |
