/**
 * LeadNoria — Geographic Classification Engine
 *
 * Implements strict separation between:
 * - targetCountryCode: The country targeted by the Meta ad search.
 * - businessCountryCode: The verified or inferred physical location of the business.
 * - businessLocationConfidence: Confidence level ('HIGH' | 'MEDIUM' | 'LOW' | 'NONE')
 *
 * Adheres to the strict evidence hierarchy:
 * 1. Explicit business physical address / showroom / headquarters.
 * 2. Verified local telephone country code.
 * 3. Official business website contact / domain location information.
 * 4. Reliable country-specific business & delivery operations.
 * 5. Supporting signals only (domain suffixes, localized ad copy) — never definitive proof alone.
 *
 * Outcomes:
 * - LOCAL_VERIFIED: Explicit physical presence or verified local telephone + commercial context.
 * - LOCAL_PROBABLE: Strong localized signals (delivery cities, local script, ccTLD presence) without full verified address/phone.
 * - FOREIGN_VERIFIED: Confirmed foreign headquarters, foreign domain, foreign phone code, or explicit foreign retail network.
 * - LOCATION_UNKNOWN: Insufficient evidence. Never populates target country without evidence.
 */

import type { GeographicEvaluation, BusinessPageEvidence } from './types.ts';
import { businessPageAboutUrl } from './publicPageEvidence.ts';
import {
  getCountryProfile,
  getForeignIndicatorProfiles,
  normalizeCountryCode,
  type CountryProfile
} from './countryProfiles/index.ts';

export interface CandidateGeoInputs {
  businessPageEvidence?: BusinessPageEvidence;
  pageName: string;
  pageUrl?: string;
  destinationUrl?: string;
  destinationDomain?: string;
  bodyCopy?: string;
  ctaText?: string;
}

interface DetectedCountrySignals {
  profile: CountryProfile;
  hasKnownDomain: boolean;
  hasCcTld: boolean;
  hasIntlPhone: boolean;
  hasDomesticPhone: boolean;
  matchedPhone?: string;
  hasPostalCode: boolean;
  hasCity: boolean;
  matchedCity?: string;
  hasStateOrProvince: boolean;
  matchedState?: string;
  hasAddressKeyword: boolean;
  hasOperationalPhrase: boolean;
  matchedOperationalPhrase?: string;
  hasNativeScript: boolean;
  hasCommercialKeyword: boolean;
  matchedCommercialKeyword?: string;
  hasExplicitPhysicalAddress: boolean;
}

function detectSignalsForProfile(
  profile: CountryProfile,
  inputs: CandidateGeoInputs,
  textToScan: string
): DetectedCountrySignals {
  const body = inputs.bodyCopy || '';
  const pageUrlLower = (inputs.pageUrl || '').toLowerCase();
  const pageNameLower = (inputs.pageName || '').toLowerCase();
  const destUrlLower = (inputs.destinationUrl || '').toLowerCase();
  const destDom = (inputs.destinationDomain || '').toLowerCase();

  // 1. Known Domain
  const hasKnownDomain = !!(
    destDom &&
    profile.knownCommercialDomains &&
    profile.knownCommercialDomains.some(d => destDom === d || destDom.endsWith('.' + d))
  );

  // 2. ccTLD Suffix
  const hasCcTld = !!(
    destDom &&
    profile.domainSuffixes.some(s => destDom.endsWith(s))
  );

  // 3. Telephone
  let hasIntlPhone = false;
  let hasDomesticPhone = false;
  let matchedPhone: string | undefined;

  if (body) {
    const phoneMatch = body.match(profile.phone.phoneRegex);
    if (phoneMatch) {
      matchedPhone = phoneMatch[0];
      const hasPrefix = profile.phone.internationalPrefixes.some(p =>
        body.includes(p) || (matchedPhone && matchedPhone.includes(p))
      );
      if (hasPrefix) {
        hasIntlPhone = true;
      } else {
        hasDomesticPhone = true;
      }
    } else if (profile.phone.domesticRegex) {
      const domMatch = body.match(profile.phone.domesticRegex);
      if (domMatch) {
        matchedPhone = domMatch[0];
        hasDomesticPhone = true;
      }
    }
  }

  // 4. Postal Code
  let hasPostalCode = false;
  if (body && profile.regions?.postalCodeRegex) {
    hasPostalCode = profile.regions.postalCodeRegex.test(body);
  }

  // 5. Major Cities
  let hasCity = false;
  let matchedCity: string | undefined;
  for (const city of profile.majorCities) {
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (
      cityRegex.test(body) ||
      pageUrlLower.includes(city) ||
      pageNameLower.includes(city) ||
      destUrlLower.includes(city)
    ) {
      hasCity = true;
      matchedCity = city;
      break;
    }
  }

  // 6. States or Provinces
  let hasStateOrProvince = false;
  let matchedState: string | undefined;
  if (profile.regions?.statesOrProvinces) {
    for (const state of profile.regions.statesOrProvinces) {
      const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
      if (stateRegex.test(body) || pageUrlLower.includes(state)) {
        hasStateOrProvince = true;
        matchedState = state;
        break;
      }
    }
  }
  if (!hasStateOrProvince && profile.regions?.stateCodes && body) {
    for (const code of profile.regions.stateCodes) {
      const codeRegex = new RegExp(`\\b${code}\\b`);
      if (codeRegex.test(body)) {
        hasStateOrProvince = true;
        matchedState = code;
        break;
      }
    }
  }

  // 7. Address Keywords
  let hasAddressKeyword = false;
  if (body && profile.addressKeywords.length > 0) {
    const addrPattern = new RegExp(`\\b(?:${profile.addressKeywords.map(k => k.replace('.', '\\.')).join('|')})\\b`, 'i');
    hasAddressKeyword = addrPattern.test(body);
  }

  // 8. Operational Delivery Phrases
  let hasOperationalPhrase = false;
  let matchedOperationalPhrase: string | undefined;
  for (const phrase of profile.operationalPhrases) {
    if (textToScan.includes(phrase)) {
      hasOperationalPhrase = true;
      matchedOperationalPhrase = phrase;
      break;
    }
  }

  // 9. Native Script
  let hasNativeScript = false;
  if (profile.nativeScriptRegex) {
    hasNativeScript = profile.nativeScriptRegex.test(body) || profile.nativeScriptRegex.test(inputs.pageName || '');
  }

  // 10. Commercial Keywords
  let hasCommercialKeyword = false;
  let matchedCommercialKeyword: string | undefined;
  if (profile.keywords) {
    for (const kw of profile.keywords) {
      if (textToScan.includes(kw)) {
        hasCommercialKeyword = true;
        matchedCommercialKeyword = kw;
        break;
      }
    }
  }

  // High Quality Physical Address:
  // Requires city or state AND address keyword, or postal code
  // Address words elsewhere in the ad must not turn a delivery destination
  // into the advertiser's address (e.g. Mumbai office + delivery to Dhaka).
  const addressClauses = body.split(/[\n;]|\.(?:\s|$)/);
  const hasExplicitPhysicalAddress = addressClauses.some(clause => {
    const cities = profile.majorCities.some(city => new RegExp(`\\b${city}\\b`, 'i').test(clause));
    const regions = profile.regions?.statesOrProvinces?.some(state => new RegExp(`\\b${state}\\b`, 'i').test(clause));
    const postal = Boolean(profile.regions?.postalCodeRegex?.test(clause));
    const address = profile.addressKeywords.some(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(clause));
    const deliveryOnly = /\b(?:deliver(?:y|ies|ing)?|ship(?:ping|ped)?|target(?:ing)?)\s+(?:to|across|throughout|in)\b/i.test(clause)
      && !/\b(?:office|headquarters|showroom|located|address|visit us|based in)\b/i.test(clause);
    return !deliveryOnly && Boolean((cities || regions || postal) && (address || postal));
  });

  return {
    profile,
    hasKnownDomain,
    hasCcTld,
    hasIntlPhone,
    hasDomesticPhone,
    matchedPhone,
    hasPostalCode,
    hasCity,
    matchedCity,
    hasStateOrProvince,
    matchedState,
    hasAddressKeyword,
    hasOperationalPhrase,
    matchedOperationalPhrase,
    hasNativeScript,
    hasCommercialKeyword,
    matchedCommercialKeyword,
    hasExplicitPhysicalAddress
  };
}

/**
 * Evaluates the geographic physical origin of a business candidate.
 * 
 * Strictly isolates target country code from business country code.
 */
export function evaluateGeographicOrigin(
  inputs: CandidateGeoInputs,
  targetCountryCode: string = 'BD'
): GeographicEvaluation {
  const rawTarget = targetCountryCode ? targetCountryCode.trim().toUpperCase() : 'BD';
  const normTarget = normalizeCountryCode(rawTarget) || rawTarget;
  const page = inputs.businessPageEvidence;
  if (page?.status === 'CHECKED' && page.addressText && businessPageAboutUrl(page.sourceUrl) && businessPageAboutUrl(page.sourceUrl) === businessPageAboutUrl(inputs.pageUrl)) {
    const countries = [...new Set(page.addressCountryCodes)];
    if (countries.length > 1) return { classification: 'LOCATION_UNKNOWN', targetCountryCode: normTarget, confidence: 'NONE', evidence: [page.sourceUrl, page.addressText], reason: 'The public Page lists addresses in multiple countries; business origin needs review.', reasonCode: 'MULTIPLE_PAGE_ADDRESS_COUNTRIES', isLocal: false, isForeign: false, isUnknown: true };
    if (countries.length === 1) {
      const local = countries[0] === normTarget;
      return {classification: local ? 'LOCAL_VERIFIED' : 'FOREIGN_VERIFIED', targetCountryCode: normTarget, businessCountryCode: countries[0], confidence: 'HIGH', evidence: [`Public Page address claim: ${page.addressText}`, page.sourceUrl, `Checked: ${page.checkedAt}`], reason: 'Country inferred from the matched public Page address, not ad targeting or manager location. The address is a public business claim.', reasonCode: 'PUBLIC_PAGE_ADDRESS_COUNTRY', isLocal: local, isForeign: !local, isUnknown: false};
    }
  }
  const targetProfile = getCountryProfile(normTarget);

  if (!targetProfile) {
    return {
      classification: 'LOCATION_UNKNOWN',
      targetCountryCode: normTarget,
      businessCountryCode: undefined,
      confidence: 'NONE',
      evidence: [`Target country code "${targetCountryCode}" is unsupported or unrecognized.`],
      reason: `Target country "${targetCountryCode}" lacks an active country classification profile.`,
      reasonCode: 'UNSUPPORTED_TARGET_COUNTRY',
      isLocal: false,
      isForeign: false,
      isUnknown: true
    };
  }

  const textToScan = [
    inputs.pageName || '',
    inputs.pageUrl || '',
    inputs.destinationDomain || '',
    inputs.destinationUrl || '',
    inputs.bodyCopy || '',
    inputs.ctaText || ''
  ].join(' ').toLowerCase();

  // Detect local signals for target country
  const localSignals = detectSignalsForProfile(targetProfile, inputs, textToScan);

  // Detect foreign signals across all foreign profiles
  const foreignProfiles = getForeignIndicatorProfiles(normTarget);
  const foreignObservations: DetectedCountrySignals[] = [];

  for (const fp of foreignProfiles) {
    const fs = detectSignalsForProfile(fp, inputs, textToScan);

    // If signal is only an international phone with a shared prefix (e.g. +1 between US and CA),
    // it cannot be attributed as a foreign signal without independent corroboration
    const isSharedPhoneOnly =
      fs.hasIntlPhone &&
      !fs.hasKnownDomain &&
      !fs.hasCcTld &&
      !fs.hasExplicitPhysicalAddress &&
      !fs.hasCity &&
      !fs.hasStateOrProvince &&
      !fs.hasPostalCode &&
      Boolean(targetProfile.phone.sharedPrefixes &&
        fp.phone.sharedPrefixes &&
        targetProfile.phone.sharedPrefixes.some(p => fp.phone.sharedPrefixes?.includes(p)));

    if (
      !isSharedPhoneOnly &&
      (fs.hasKnownDomain ||
       fs.hasCcTld ||
       fs.hasIntlPhone ||
       fs.hasExplicitPhysicalAddress ||
       fs.hasCommercialKeyword ||
       fs.hasCity)
    ) {
      foreignObservations.push(fs);
    }
  }

  // --- 1. CONFLICT RESOLUTION ---

  // Check if both local and foreign show explicit physical addresses
  const conflictingForeignAddress = foreignObservations.find(f => f.hasExplicitPhysicalAddress);
  if (localSignals.hasExplicitPhysicalAddress && conflictingForeignAddress) {
    return {
      classification: 'LOCATION_UNKNOWN',
      targetCountryCode: normTarget,
      businessCountryCode: undefined,
      confidence: 'NONE',
      evidence: [
        `Local physical address detected in ${localSignals.matchedCity || targetProfile.countryName}`,
        `Contradictory foreign physical address detected in ${conflictingForeignAddress.matchedCity || conflictingForeignAddress.profile.countryName}`
      ],
      reason: 'Conflicting high-quality physical address evidence detected across multiple countries; origin unresolved.',
      reasonCode: 'CONFLICTING_LOCATION_EVIDENCE',
      isLocal: false,
      isForeign: false,
      isUnknown: true
    };
  }

  // Check high-authority foreign signals (known domain, ccTLD, international phone, foreign headquarters)
  const strongForeign = foreignObservations.find(
    f => f.hasKnownDomain || f.hasCcTld || f.hasIntlPhone || f.hasExplicitPhysicalAddress || f.hasCommercialKeyword || f.hasCity
  );

  // If high-quality foreign evidence exists:
  // Foreign headquarters/phone/domain overrides weak local delivery phrases or mere targeting
  if (strongForeign) {
    // Check if foreign evidence is high-confidence (known domain, ccTLD, verified phone, explicit city/address)
    const isForeignVerified =
      strongForeign.hasKnownDomain ||
      strongForeign.hasCcTld ||
      strongForeign.hasIntlPhone ||
      strongForeign.hasExplicitPhysicalAddress ||
      strongForeign.hasCommercialKeyword ||
      strongForeign.hasCity;

    if (isForeignVerified && !localSignals.hasExplicitPhysicalAddress) {
      const foreignEvidence: string[] = [];
      let reasonCode = 'EXPLICIT_FOREIGN_ADDRESS';
      let reason = `Verified foreign commercial entity operating from ${strongForeign.profile.countryName} (${strongForeign.profile.countryCode}).`;

      if (strongForeign.hasKnownDomain) {
        foreignEvidence.push(`Official website domain ${inputs.destinationDomain} belongs to known ${strongForeign.profile.countryName} commercial entity`);
        reasonCode = 'EXPLICIT_FOREIGN_DOMAIN';
      } else if (strongForeign.hasCcTld) {
        foreignEvidence.push(`Destination domain ${inputs.destinationDomain} has ${strongForeign.profile.countryName} country-code TLD (${strongForeign.profile.domainSuffixes.join(', ')})`);
        reasonCode = 'EXPLICIT_FOREIGN_DOMAIN';
        reason = `Verified foreign domain based in ${strongForeign.profile.countryName} (${strongForeign.profile.countryCode}).`;
      } else if (strongForeign.hasIntlPhone) {
        foreignEvidence.push(`Verified telephone country code for ${strongForeign.profile.countryName} (${strongForeign.profile.phone.internationalPrefixes[0]})`);
        reasonCode = 'EXPLICIT_FOREIGN_PHONE';
        reason = `Verified telephone country code for ${strongForeign.profile.countryName} (${strongForeign.profile.phone.internationalPrefixes[0]}).`;
      } else if (strongForeign.hasCity) {
        foreignEvidence.push(`Explicit mention of ${strongForeign.profile.countryName} location/city: "${strongForeign.matchedCity}"`);
        reason = `Explicit commercial presence or address located in ${strongForeign.matchedCity}, ${strongForeign.profile.countryName}.`;
      } else if (strongForeign.hasCommercialKeyword) {
        foreignEvidence.push(`Explicit ${strongForeign.profile.countryName} commercial context: "${strongForeign.matchedCommercialKeyword}"`);
        reasonCode = 'EXPLICIT_FOREIGN_CONTEXT';
        reason = `Entity copy and commercial signals explicitly refer to ${strongForeign.profile.countryName}.`;
      }

      return {
        classification: 'FOREIGN_VERIFIED',
        targetCountryCode: normTarget,
        businessCountryCode: strongForeign.profile.countryCode,
        confidence: 'HIGH',
        evidence: foreignEvidence,
        reason,
        reasonCode,
        isLocal: false,
        isForeign: true,
        isUnknown: false
      };
    }
  }

  // --- 2. LOCAL VERIFIED EVALUATION ---
  // Signals that meet LOCAL_VERIFIED:
  // 1. Explicit verified physical address in target country
  // 2. Verified international telephone prefix for target country (if non-shared, or shared + regional context)
  // 3. Domestic phone + corroborating context (city, domain, script, or delivery)

  const isSharedNanp = (normTarget === 'US' || normTarget === 'CA') && localSignals.hasIntlPhone;
  const nanpCorroborated = isSharedNanp && (localSignals.hasCity || localSignals.hasStateOrProvince || localSignals.hasPostalCode || localSignals.hasCcTld);

  const hasStrongLocalPhone =
    (localSignals.hasIntlPhone && (!isSharedNanp || nanpCorroborated)) ||
    (localSignals.hasDomesticPhone && (localSignals.hasCity || localSignals.hasCcTld || localSignals.hasNativeScript || localSignals.hasOperationalPhrase));

  if (localSignals.hasExplicitPhysicalAddress || hasStrongLocalPhone) {
    const evidence: string[] = [];
    if (localSignals.hasIntlPhone) {
      evidence.push(`Verified ${targetProfile.countryName} telephone dialing prefix ${targetProfile.phone.internationalPrefixes[0]}`);
    } else if (localSignals.hasDomesticPhone && localSignals.matchedPhone) {
      evidence.push(`Verified ${targetProfile.countryName} domestic phone number format: "${localSignals.matchedPhone}"`);
    }

    if (localSignals.hasPostalCode) {
      evidence.push(`Verified domestic postal/ZIP code in ${targetProfile.countryName}`);
    }
    if (localSignals.hasCity && localSignals.matchedCity) {
      evidence.push(`Mention of major ${targetProfile.countryName} metropolitan area: "${localSignals.matchedCity}"`);
    }
    if (localSignals.hasStateOrProvince && localSignals.matchedState) {
      evidence.push(`Mention of administrative region/state: "${localSignals.matchedState}"`);
    }
    if (localSignals.hasOperationalPhrase && localSignals.matchedOperationalPhrase) {
      evidence.push(`Explicit local operational coverage phrase: "${localSignals.matchedOperationalPhrase}"`);
    }
    if (localSignals.hasNativeScript) {
      evidence.push(`Ad creative contains native ${targetProfile.countryCode === 'BD' ? 'Bengali ' : ''}script text`);
    }
    if (localSignals.hasCcTld && inputs.destinationDomain) {
      evidence.push(`Official website domain contains ${targetProfile.countryName} identifier: "${inputs.destinationDomain}"`);
    }

    return {
      classification: 'LOCAL_VERIFIED',
      targetCountryCode: normTarget,
      businessCountryCode: normTarget,
      confidence: 'HIGH',
      evidence,
      reason: `Verified local business with confirmed ${targetProfile.countryName} physical showroom, street address, or telephone contact.`,
      reasonCode: localSignals.hasExplicitPhysicalAddress ? 'EXPLICIT_LOCAL_ADDRESS' : 'EXPLICIT_LOCAL_PHONE',
      isLocal: true,
      isForeign: false,
      isUnknown: false
    };
  }

  // --- 3. LOCAL PROBABLE EVALUATION ---
  // Relevant local signals exist (delivery phrases, native script, cities, domestic phone, shared phone),
  // but without full physical address or unambiguous verified phone
  const hasProbableSignals =
    localSignals.hasOperationalPhrase ||
    localSignals.hasNativeScript ||
    localSignals.hasCity ||
    localSignals.hasDomesticPhone ||
    (isSharedNanp && !nanpCorroborated);

  if (hasProbableSignals) {
    const evidence: string[] = [];
    let reasonCode = 'WEAK_LOCAL_SIGNALS_ONLY';

    if (localSignals.hasOperationalPhrase && localSignals.matchedOperationalPhrase) {
      evidence.push(`Explicit local operational coverage phrase: "${localSignals.matchedOperationalPhrase}"`);
      reasonCode = 'PROBABLE_LOCAL_DELIVERY';
    }
    if (localSignals.hasCity && localSignals.matchedCity) {
      evidence.push(`Mention of major ${targetProfile.countryName} metropolitan area: "${localSignals.matchedCity}"`);
      if (reasonCode === 'WEAK_LOCAL_SIGNALS_ONLY') reasonCode = 'PROBABLE_LOCAL_CITY';
    }
    if (localSignals.hasNativeScript) {
      evidence.push(`Ad creative contains native ${targetProfile.countryCode === 'BD' ? 'Bengali ' : ''}script text`);
      if (reasonCode === 'WEAK_LOCAL_SIGNALS_ONLY') reasonCode = 'PROBABLE_LOCAL_SCRIPT';
    }
    if (localSignals.hasDomesticPhone && localSignals.matchedPhone) {
      evidence.push(`Observed unverified domestic telephone format: "${localSignals.matchedPhone}"`);
    }
    if (isSharedNanp && !nanpCorroborated) {
      evidence.push('Observed NANP (+1) telephone prefix without state, province, or city corroboration');
    }

    return {
      classification: 'LOCAL_PROBABLE',
      targetCountryCode: normTarget,
      businessCountryCode: normTarget,
      confidence: 'MEDIUM',
      evidence,
      reason: `Probable local business with corroborating ${targetProfile.countryName} commercial signals (labeled for review).`,
      reasonCode,
      isLocal: true,
      isForeign: false,
      isUnknown: false
    };
  }

  // Supporting domain ccTLD only: LOCAL_PROBABLE with LOW confidence
  if (localSignals.hasCcTld && inputs.destinationDomain) {
    return {
      classification: 'LOCAL_PROBABLE',
      targetCountryCode: normTarget,
      businessCountryCode: normTarget,
      confidence: 'LOW',
      evidence: [`Official website domain contains ${targetProfile.countryName} identifier: "${inputs.destinationDomain}"`],
      reason: 'Country-code domain suffix indicates probable regional association, but lacks verified physical address/phone.',
      reasonCode: 'DOMAIN_SUFFIX_ONLY',
      isLocal: true,
      isForeign: false,
      isUnknown: false
    };
  }

  // --- 4. FALLBACK: LOCATION UNKNOWN ---
  // Do NOT populate businessCountryCode with targetCountryCode without independent proof!
  return {
    classification: 'LOCATION_UNKNOWN',
    targetCountryCode: normTarget,
    businessCountryCode: undefined,
    confidence: 'NONE',
    evidence: ['No unambiguous geographic signals detected in extracted ad or page data.'],
    reason: 'Physical business location cannot be verified from available public signals.',
    reasonCode: 'COUNTRY_EVIDENCE_MISSING',
    isLocal: false,
    isForeign: false,
    isUnknown: true
  };
}
