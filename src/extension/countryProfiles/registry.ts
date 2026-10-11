import type { CountryProfile } from './types.ts';
import { BD_PROFILE } from './profiles/bd.ts';
import { US_PROFILE } from './profiles/us.ts';
import { GB_PROFILE } from './profiles/gb.ts';
import { CA_PROFILE } from './profiles/ca.ts';
import { AU_PROFILE } from './profiles/au.ts';
import { IE_PROFILE } from './profiles/ie.ts';
import { IN_PROFILE } from './profiles/in.ts';
import { CN_PROFILE } from './profiles/cn.ts';

const PROFILES: CountryProfile[] = [
  BD_PROFILE,
  US_PROFILE,
  GB_PROFILE,
  CA_PROFILE,
  AU_PROFILE,
  IE_PROFILE,
  IN_PROFILE,
  CN_PROFILE
];

const CODE_MAP = new Map<string, CountryProfile>();
const ALIAS_MAP = new Map<string, string>();

for (const profile of PROFILES) {
  const code = profile.countryCode.toUpperCase();
  CODE_MAP.set(code, profile);
  ALIAS_MAP.set(code, code);

  for (const alias of profile.aliases) {
    ALIAS_MAP.set(alias.toUpperCase(), code);
  }
}

/**
 * Normalizes any country code, name, or alias to ISO 3166-1 alpha-2 format.
 * (e.g. 'UK' -> 'GB', 'USA' -> 'US', 'Eire' -> 'IE')
 */
export function normalizeCountryCode(codeOrAlias?: string): string | undefined {
  if (!codeOrAlias) return undefined;
  const clean = codeOrAlias.trim().toUpperCase();
  return ALIAS_MAP.get(clean) || (clean.length === 2 ? clean : undefined);
}

/**
 * Retrieves the registered CountryProfile for a given ISO code or alias.
 */
export function getCountryProfile(codeOrAlias?: string): CountryProfile | undefined {
  const normCode = normalizeCountryCode(codeOrAlias);
  if (!normCode) return undefined;
  return CODE_MAP.get(normCode);
}

/**
 * Returns all registered country profiles.
 */
export function getAllCountryProfiles(): CountryProfile[] {
  return [...PROFILES];
}

/**
 * Returns all country profiles that act as foreign indicators relative to the target country.
 */
export function getForeignIndicatorProfiles(targetCountryCode: string): CountryProfile[] {
  const normTarget = normalizeCountryCode(targetCountryCode);
  return PROFILES.filter(p => p.countryCode !== normTarget);
}
