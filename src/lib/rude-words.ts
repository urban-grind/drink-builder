const WORDS = [
  "ass",
  "asshat",
  "asshole",
  "bastard",
  "bitch",
  "bitchy",
  "bullshit",
  "chink",
  "clusterfuck",
  "cock",
  "cunt",
  "dick",
  "dickhead",
  "dipshit",
  "dumbass",
  "fag",
  "faggot",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "goddamn",
  "jackass",
  "kike",
  "motherfucker",
  "nazi",
  "nigga",
  "nigger",
  "piss",
  "prick",
  "pussy",
  "rape",
  "rapist",
  "retard",
  "shit",
  "shithead",
  "shitty",
  "slut",
  "spic",
  "tits",
  "twat",
  "wank",
  "wetback",
  "whore",
] as const;

const ALIASES = ["fck", "fuk", "fuq", "sht", "biatch", "bich"] as const;

const BLOCKED = new Set<string>([...WORDS, ...ALIASES]);

function collapseRuns(token: string): string {
  return token.replace(/(.)\1+/g, "$1");
}

function tokenize(input: string): string[] {
  let text = input.toLowerCase();
  text = text
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[@4]/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");
  text = text.replace(/[*.'’`~\-_]+/g, "");
  const raw = text
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const tokens: string[] = [];
  let singles = "";
  for (const token of raw) {
    if (token.length === 1) {
      singles += token;
      continue;
    }
    if (singles) {
      tokens.push(singles);
      singles = "";
    }
    tokens.push(token);
  }
  if (singles) tokens.push(singles);
  return tokens;
}

function tokenBlocked(token: string): boolean {
  return BLOCKED.has(token) || BLOCKED.has(collapseRuns(token));
}

export function hasRudeLanguage(input: string): boolean {
  if (!input.trim()) return false;
  return tokenize(input).some(tokenBlocked);
}
