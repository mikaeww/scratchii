// Which palette commands fit what was typed, best first, and the argument after a command's name
// ("table 3x4"). Pure, so it is tested without a browser. Not here: the dialog (palette.ts).

export interface Command {
  readonly id: string;
  readonly label: string;
  // Search words in every language, so "tabelle" finds the table with the interface in English.
  readonly words: readonly string[];
  // Shown after the label when the command takes an argument, e.g. "3x4".
  readonly argument?: string;
  readonly run: (argument: string) => void;
}

export interface Match {
  readonly command: Command;
  readonly argument: string;
}

// Letters of the query in order, gaps allowed: "tbl" finds "table".
function subsequence(query: string, name: string): boolean {
  let at = 0;
  for (const char of name) if (char === query[at]) at++;
  return at === query.length;
}

function score(query: string, name: string): number {
  if (name === query) return 90;
  if (name.startsWith(query)) return 80;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 70;
  if (name.includes(query)) return 60;
  return subsequence(query, name) ? 10 : 0;
}

function bestMatch(command: Command, raw: string): Match & { readonly score: number } {
  const query = raw.toLowerCase();
  const names = [command.label, ...command.words].map((name) => name.toLowerCase());
  let best = { command, argument: "", score: 0 };
  for (const name of names) {
    if (command.argument !== undefined && query.startsWith(`${name} `)) {
      const candidate = { command, argument: raw.slice(name.length + 1).trim(), score: 100 + name.length };
      if (candidate.score > best.score) best = candidate;
    }
    const plain = score(query, name);
    if (plain > best.score) best = { command, argument: "", score: plain };
  }
  return best;
}

export function rankCommands(query: string, commands: readonly Command[]): Match[] {
  const raw = query.trim();
  if (raw === "") return commands.map((command) => ({ command, argument: "" }));
  return commands
    .map((command) => bestMatch(command, raw))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ command, argument }) => ({ command, argument }));
}
