/** Lightweight brief counts shared by browser preflight and server admission. Deliberately small and explicit:
 * it reads counts and the pool decision; architectural interpretation remains the model's job. */
const numbers: Record<string, number> = {one: 1, a: 1, an: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10};
const NUM = String.raw`((?<![\d.])\d+(?![.\d])|one|two|three|four|five|six|seven|eight|nine|ten)`;
const ADJ = String.raw`(?:(?:spacious|large|small|generous|double|single|guest|master|main|primary|principal|en-?suite|private|comfortable|separate|full|additional|extra|secondary|children'?s|kids'?|family|upstairs|downstairs|ground-floor)[ -]+)*`;
const value = (s: string) => numbers[s.toLowerCase()] ?? Number(s);

export type PoolRequirement = 'required' | 'excluded' | 'optional';
export interface Requirements {bedrooms?: number; bathrooms?: number; storeys?: number; pool: PoolRequirement}

function counted(brief: string, noun: string, label: string): number | undefined {
  const text = brief.toLowerCase();
  const found = new Set<number>();
  // "three bedrooms", "3-bedroom", "four guest bedrooms", "3 beds"
  for (const m of text.matchAll(new RegExp(String.raw`\b${NUM}[ -]+${ADJ}${noun}\b`, 'g'))) found.add(value(m[1]));
  // "bedrooms: 4", "bedrooms = 4", "4 x bedrooms"
  for (const m of text.matchAll(new RegExp(String.raw`\b${noun}\s*[:=]\s*${NUM}\b`, 'g'))) found.add(value(m[1]));
  // Additive phrasing: "a master suite and two guest bedrooms" / "a main bedroom plus three children's bedrooms".
  if (label === 'bedroom') {
    const principal = /\b(?:a|one|the)\s+(?:master|main|primary|principal)\s+(?:bedroom|suite)\b/.test(text);
    const secondary = [...text.matchAll(new RegExp(String.raw`\b${NUM}[ -]+(?:more\s+|other\s+|further\s+)?(?:guest|additional|extra|secondary|children'?s|kids'?|other)[ -]+${ADJ}${noun}\b`, 'g'))].map(m => value(m[1]));
    const plain = [...text.matchAll(new RegExp(String.raw`\b${NUM}[ -]+${noun}\b`, 'g'))].map(m => value(m[1]));
    if (principal && secondary.length === 1 && !plain.length) return 1 + secondary[0];
  }
  // A half bath is a powder room; the full-bathroom count is what this generator constructs.
  if (label === 'bathroom') for (const m of text.matchAll(/\b(\d+)\.5[ -]+(?:bathrooms?|baths?)\b/g)) found.add(Number(m[1]));
  const values = [...found].filter(Number.isFinite);
  if (values.length > 1) throw Error(`Conflicting ${label} counts (${values.join(', ')}); clarify the description.`);
  return values[0];
}

/** "No pool", "without a swimming pool", "pool-free" exclude; any other pool mention requires one. */
export function poolRequirement(brief: string): PoolRequirement {
  const excluded = /\b(?:no|without(?:\s+a)?|exclude|excluding|omit|skip)\s+(?:a\s+|any\s+)?(?:swimming\s+)?pool\b|\bpool[ -]free\b/i;
  const remainder = brief.replace(new RegExp(excluded.source, 'gi'), ' ').replace(/\bpool\s+(?:table|house)\b/gi, ' ');
  const mentioned = /\b(?:swimming\s+)?pool\b|\bplunge\b|\blap\s+pool\b/i.test(remainder);
  if (excluded.test(brief) && mentioned) throw Error('Conflicting pool requirements: the description both asks for and excludes a pool.');
  return excluded.test(brief) ? 'excluded' : mentioned ? 'required' : 'optional';
}

export function promptRequirements(brief: string): Requirements {
  const bedrooms = counted(brief, String.raw`(?:bedrooms?|beds?|bedroom\s+suites?)`, 'bedroom') ?? counted(brief, String.raw`(?:br|bd)`, 'bedroom-abbreviation');
  const bathrooms = counted(brief, String.raw`(?:bathrooms?|baths?)`, 'bathroom');
  const t = brief.toLowerCase();
  const single = /\b(?:single|one)[ -](?:stor(?:e?y)|level|floor)\b|\bbungalow\b|\bground[ -]floor only\b/.test(t);
  const storeyCount = counted(brief, String.raw`(?:stor(?:ey|y|eys|ies)|floors|levels)`, 'storey') ?? (/\bdouble[ -]stor(?:e?y)\b/.test(t) ? 2 : undefined);
  if (single && storeyCount !== undefined && storeyCount !== 1) throw Error('Conflicting storey counts; clarify the description.');
  const storeys = single ? 1 : storeyCount;
  if (bedrooms !== undefined && (bedrooms < 1 || bedrooms > 10)) throw Error('Supported bedroom count is 1–10.');
  if (storeys !== undefined && (storeys < 1 || storeys > 2)) throw Error('Only one or two storeys are supported.');
  return {bedrooms, bathrooms, storeys, pool: poolRequirement(brief)};
}
