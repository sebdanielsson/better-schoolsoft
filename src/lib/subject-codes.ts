/** Skolverket's standard subject codes used across Swedish compulsory schools.
 *  Keys are case-insensitive (lowercased before lookup). Only includes codes
 *  whose mapping is unambiguous regardless of school — IES-specific overlays
 *  like "Sci", "PE", "Wd" intentionally omitted so we fall back to the raw
 *  short name rather than guess. */
const SUBJECT_CODES: Record<string, string> = {
  ma: "Mathematics",
  sv: "Swedish",
  sva: "Swedish as a Second Language",
  en: "English",
  mu: "Music",
  bl: "Art",
  bd: "Art",
  sl: "Crafts",
  re: "Religious Studies",
  hi: "History",
  ge: "Geography",
  bi: "Biology",
  fy: "Physics",
  ke: "Chemistry",
  tk: "Technology",
  hkk: "Home and Consumer Studies",
  idh: "Physical Education and Health",
  so: "Social Studies",
  no: "Science Studies",
  sh: "Civics",
};

/** Resolve a Skolverket subject code (e.g. "Ma", "SO") to its English long
 *  name. Returns the input unchanged when the code isn't a known standard
 *  abbreviation, so non-abbreviated names like "Mentor Time" pass through. */
export function expandSubjectCode(short: string): string {
  if (!short) return short;
  const key = short.trim().toLowerCase();
  return SUBJECT_CODES[key] ?? short;
}
