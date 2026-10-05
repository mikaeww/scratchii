# Verification: calculation

Covers `src/calc/expression.ts` (parse and evaluate), `src/calc/answer.ts` (a line ending in `=`) and
`src/calc/subnet.ts`.

## Claims

| # | Claim | Method | Oracle |
|---|---|---|---|
| C1 | For random expression trees over numbers, `x`, `+ - * / ^ %`, unary minus and the supported functions, printing the tree and parsing it back evaluates to the same number as evaluating the tree directly (both NaN, or equal within 1e-9 relative) | Differential property test, 5000 trees, depth ≤ 5 | Direct evaluation of the tree with `Math` |
| C2 | Precedence and associativity follow school maths: `^` binds tighter than unary minus and is right-associative, implicit multiplication (`2x`, `3(x+1)`, `2pi`) binds like `*` | Example table | Hand-computed values |
| C3 | Every malformed input (unknown name, missing operand or bracket, stray character) throws `ExpressionError` with the character offset; nothing is guessed | Example table plus property test: 2000 random strings over the token alphabet never throw anything else | Construction |
| C4 | `0x`, `0b`, `0o` literals and `in hex|bin|oct|dec` conversions round-trip every integer in [0, 65535] | Exhaustive | `Number.prototype.toString(radix)` |
| C5 | For every prefix 0 to 32 and 2000 random addresses, network, broadcast, mask and host count match an independent computation on 32-bit integers | Property test, exhaustive over prefixes | Bit arithmetic in the test with `>>> 0` |

## Corpus

Generated with fixed seeds (`tests/random.ts`); examples are listed in `tests/calc.test.ts`.

## Thresholds

All claims 100 %.

## Results

| Claim | Date | Result |
|---|---|---|
| C1 | 2026-10-05 | 5000 / 5000. First run failed on case 65: `ln(a)^b` was read as `ln(a^b)`; a function with brackets now binds before `^` |
| C2 | 2026-10-05 | 19 / 19 examples |
| C3 | 2026-10-05 | 6 / 6 examples with the right offset; 2000 random strings raised nothing but `ExpressionError` |
| C4 | 2026-10-05 | 65536 / 65536 integers in each base and as `in hex` answers |
| C5 | 2026-10-05 | 33 prefixes × 2000 addresses, all equal to the bit arithmetic |
| Real app | 2026-10-05 | headless (`node tools/render.ts OUT calc`): `Miete 450 + 120 =` became `= 570`, `3,5 * 2^3 =` `= 28`, `255 in hex =` `= 0xFF`, a /26 got network, mask, broadcast and hosts on four lines, a note `Gebühr 12,50 * 4 =` `= 50` |

## Known gaps

- Numbers are doubles: `0.1 + 0.2 =` shows `0.3` only because results are rounded to 12 significant digits.
- No units, no variables other than `x`, no symbolic algebra.
