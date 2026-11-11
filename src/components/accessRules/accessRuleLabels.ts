import type { AccessRule } from '@/types/models';

/** Region codes that aren't countries, which the browser still names. */
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ']);

let regionNames: Intl.DisplayNames | null | undefined;
function names() {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    } catch {
      regionNames = null;
    }
  }
  return regionNames;
}

/** "Nigeria" for "NG"; the code itself when the browser has no name for it. */
export function countryName(code: string): string {
  return names()?.of(code.toUpperCase()) ?? code.toUpperCase();
}

let countries: { code: string; name: string }[] | undefined;

/** Every two-letter region the browser can name, A–Z by name. Built locally, no lookup service. */
export function countryOptions() {
  if (countries) return countries;
  const out: { code: string; name: string }[] = [];
  const A = 'A'.charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      const name = names()?.of(code);
      if (name && !NOT_COUNTRIES.has(code)) out.push({ code, name });
    }
  }
  countries = out.sort((a, b) => a.name.localeCompare(b.name));
  return countries;
}

/** "Allow 10.0.0.0/8" / "Block Nigeria (NG)". */
export function describeRule(rule: Pick<AccessRule, 'ruleType' | 'effect' | 'value'>) {
  const verb = rule.effect === 'allow' ? 'Allow' : 'Block';
  const what =
    rule.ruleType === 'country' ? `${countryName(rule.value)} (${rule.value})` : rule.value;
  return `${verb} ${what}`;
}
