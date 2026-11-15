/**
 * 256-Word English dictionary for human-readable optical recovery codes.
 * Every word is lowercase, 3 to 6 letters long, and has a unique 3-letter prefix.
 */

export const RECOVERY_WORDS: string[] = [
  "ace", "act", "add", "age", "aid", "aim", "air", "all", "and", "ant", "ape", "arm", "art", "ash", "ask", "bad",
  "bag", "ban", "bar", "bat", "bay", "bed", "bee", "beg", "bet", "bid", "big", "bin", "bit", "bob", "bog", "bow",
  "box", "boy", "bug", "bus", "but", "buy", "cab", "can", "cap", "car", "cat", "cow", "cry", "cup", "cut", "dad",
  "dam", "day", "den", "dew", "dig", "dim", "dip", "dog", "dot", "dry", "dub", "due", "dug", "ear", "eat", "egg",
  "ego", "elf", "elk", "elm", "end", "era", "eve", "eye", "fan", "far", "fat", "fed", "fee", "few", "fig", "fit",
  "fix", "fly", "fog", "for", "fox", "fry", "fun", "fur", "gas", "gem", "get", "gin", "god", "gum", "gun", "gut",
  "guy", "gym", "ham", "hat", "hay", "hem", "hen", "hid", "hip", "hit", "hop", "hot", "how", "hub", "hue", "hug",
  "hum", "hut", "ice", "ill", "ink", "inn", "ion", "ivy", "jam", "jar", "jaw", "jay", "jet", "job", "jog", "joy",
  "jug", "key", "kid", "kin", "kit", "lab", "lad", "lap", "law", "lay", "leg", "lid", "lie", "lip", "lit", "log",
  "lot", "low", "mad", "man", "map", "mat", "may", "men", "met", "mix", "mob", "mop", "mud", "mug", "nap", "net",
  "new", "nod", "nor", "not", "now", "nut", "oak", "oar", "oat", "odd", "off", "oil", "old", "one", "opt", "our",
  "out", "owl", "own", "pad", "pan", "pat", "paw", "pay", "pea", "pen", "pet", "pie", "pig", "pin", "pit", "pod",
  "pop", "pot", "pro", "pub", "pun", "pup", "rad", "rag", "ram", "ran", "rap", "raw", "ray", "red", "rib", "rid",
  "rig", "rim", "rip", "rob", "rod", "rot", "row", "rub", "rug", "run", "rut", "sad", "sag", "sap", "sat", "saw",
  "say", "sea", "see", "set", "sew", "shy", "sin", "sip", "sir", "sit", "six", "ski", "sky", "sly", "sob", "son",
  "spy", "sun", "tab", "tag", "tan", "tap", "tar", "tax", "tea", "tie", "tin", "tip", "toe", "ton", "top", "tow"
];

const PREFIX_MAP = new Map<string, number>();
for (let i = 0; i < RECOVERY_WORDS.length; i++) {
  PREFIX_MAP.set(RECOVERY_WORDS[i].slice(0, 3), i);
}

/**
 * Matches an input token by its first 3 lowercase letters to an index (0-255).
 * Returns -1 if token is shorter than 3 characters or unknown.
 */
export function wordToIndex(token: string): number {
  if (!token || typeof token !== "string" || token.length < 3) return -1;
  const prefix = token.toLowerCase().slice(0, 3);
  const idx = PREFIX_MAP.get(prefix);
  return idx !== undefined ? idx : -1;
}
