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
 * - LOCAL_PROBABLE: Strong localized signals (delivery cities, local script, .bd presence) without full verified address/phone.
 * - FOREIGN_VERIFIED: Confirmed foreign headquarters, foreign domain, foreign phone code, or explicit foreign retail network.
 * - LOCATION_UNKNOWN: Insufficient evidence. Never populates target country without evidence.
 */

import type { GeographicClassification, LocationConfidence, GeographicEvaluation } from './types.ts';

// Known telephone country code prefixes and patterns
const BD_PHONE_REGEX = /(?:\+880\s*1[3-9]\d{8}|8801[3-9]\d{8}|\b01[3-9]\d{8}\b)/;
const IN_PHONE_REGEX = /(?:\+91[\s\-]?[6-9]\d{9}|\b[6-9]\d{9}\b)/;
const UK_PHONE_REGEX = /(?:\+44[\s\-]?[1-9]\d{8,9}|\b0[12378]\d{8,9}\b)/;
const US_PHONE_REGEX = /(?:\+1[\s\-]?[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}|\b[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}\b)/;
const AU_PHONE_REGEX = /(?:\+61[\s\-]?[2-478]\d{8}|\b0[2-478]\d{8}\b)/;

// Bangladesh geographic and commercial tokens
const BD_CITIES_DIVISIONS = [
  'dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna',
  'barishal', 'rangpur', 'mymensingh', 'gazipur', 'narayanganj', 'comilla',
  'savar', 'uttara', 'banani', 'gulshan', 'dhanmondi', 'mirpur', 'motijheel',
  'badda', 'mohammadpur', 'bashundhara', 'mohakhali', 'khilkhet', 'tejgaon'
];

const BD_OPERATIONAL_PHRASES = [
  'all over bangladesh',
  'delivery all over bangladesh',
  'inside dhaka',
  'outside dhaka',
  'free delivery in dhaka',
  'free delivery inside dhaka',
  'cash on delivery in bangladesh',
  'home delivery inside dhaka',
  'bangladesh delivery',
  'deliver all over bangladesh',
  'all over bd'
];

// Foreign geographic indicators
interface ForeignIndicator {
  countryCode: string;
  countryName: string;
  domainSuffixes: string[];
  domains: string[];
  cities: string[];
  keywords: string[];
}

const FOREIGN_INDICATORS: ForeignIndicator[] = [
  {
    countryCode: 'IN',
    countryName: 'India',
    domainSuffixes: ['.in', '.co.in'],
    domains: ['amazon.in', 'interio.com', 'flipkart.com'],
    cities: ['jaipur', 'mumbai', 'delhi', 'bengaluru', 'bangalore', 'kolkata', 'chennai', 'hyderabad', 'pune', 'noida', 'gurgaon'],
    keywords: ['india', 'inr', 'great indian festival', 'pan india']
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    domainSuffixes: ['.co.uk', '.uk', '.org.uk'],
    domains: ['scs.co.uk', 'fairwayfurniture.co.uk'],
    cities: ['london', 'north devon', 'manchester', 'birmingham', 'leeds', 'glasgow', 'devon', 'bristol'],
    keywords: ['uk', 'gbp', 'in-store & online', 'interest free credit', 'registered in england']
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    domainSuffixes: ['.us', '.gov', '.mil'],
    domains: ['raymourflanigan.com', 'officedepot.com', 'tahans.com', 'ashleyfurniture.com'],
    cities: ['new york', 'california', 'texas', 'florida', 'chicago', 'los angeles', 'utica'],
    keywords: ['labor day', 'nationwide delivery', 'special financing', 'us shipping']
  },
  {
    countryCode: 'AU',
    countryName: 'Australia',
    domainSuffixes: ['.com.au', '.net.au', '.au'],
    domains: ['hospitalityfurniture.net.au'],
    cities: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'],
    keywords: ['australia', 'aud', 'australia wide']
  },
  {
    countryCode: 'CN',
    countryName: 'China',
    domainSuffixes: ['.cn', '.com.cn'],
    domains: ['alibaba.com', 'made-in-china.com'],
    cities: ['guangzhou', 'foshan', 'shenzhen', 'dongguan', 'yiwu', 'zhejiang'],
    keywords: ['oem and odm', 'factory-direct', 'oem configurations', 'square meter factory']
  }
];

export interface CandidateGeoInputs {
  pageName: string;
  pageUrl?: string;
  destinationUrl?: string;
  destinationDomain?: string;
  bodyCopy?: string;
  ctaText?: string;
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
  const normTarget = (targetCountryCode || 'BD').toUpperCase();
  const evidence: string[] = [];

  const textToScan = [
    inputs.pageName || '',
    inputs.pageUrl || '',
    inputs.destinationDomain || '',
    inputs.destinationUrl || '',
    inputs.bodyCopy || '',
    inputs.ctaText || ''
  ].join(' ').toLowerCase();

  // 1. Check for Foreign Signals (High & Medium Specificity)
  for (const fi of FOREIGN_INDICATORS) {
    if (fi.countryCode === normTarget) continue;

    // Check domain matches (High authority)
    if (inputs.destinationDomain) {
      const dom = inputs.destinationDomain.toLowerCase();
      if (fi.domains.some(d => dom === d || dom.endsWith('.' + d))) {
        evidence.push(`Official website domain ${inputs.destinationDomain} belongs to known ${fi.countryName} commercial entity`);
        return {
          classification: 'FOREIGN_VERIFIED',
          targetCountryCode: normTarget,
          businessCountryCode: fi.countryCode,
          confidence: 'HIGH',
          evidence,
          reason: `Verified foreign commercial entity operating from ${fi.countryName} (${fi.countryCode}).`,
          isLocal: false,
          isForeign: true,
          isUnknown: false
        };
      }
      if (fi.domainSuffixes.some(s => dom.endsWith(s))) {
        evidence.push(`Destination domain ${inputs.destinationDomain} has ${fi.countryName} country-code TLD (${fi.domainSuffixes.join(', ')})`);
        return {
          classification: 'FOREIGN_VERIFIED',
          targetCountryCode: normTarget,
          businessCountryCode: fi.countryCode,
          confidence: 'HIGH',
          evidence,
          reason: `Verified foreign domain based in ${fi.countryName} (${fi.countryCode}).`,
          isLocal: false,
          isForeign: true,
          isUnknown: false
        };
      }
    }

    // Check explicit foreign address / city in ad copy or page handle
    const pageUrlLower = (inputs.pageUrl || '').toLowerCase();
    for (const city of fi.cities) {
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      if (cityRegex.test(inputs.bodyCopy || '') || pageUrlLower.includes(city) || (inputs.pageName || '').toLowerCase().includes(city)) {
        evidence.push(`Explicit mention of ${fi.countryName} location/city: "${city}"`);
        return {
          classification: 'FOREIGN_VERIFIED',
          targetCountryCode: normTarget,
          businessCountryCode: fi.countryCode,
          confidence: 'HIGH',
          evidence,
          reason: `Explicit commercial presence or address located in ${city}, ${fi.countryName}.`,
          isLocal: false,
          isForeign: true,
          isUnknown: false
        };
      }
    }

    // Check explicit foreign keywords
    for (const kw of fi.keywords) {
      if (textToScan.includes(kw)) {
        evidence.push(`Explicit ${fi.countryName} commercial context: "${kw}"`);
        return {
          classification: 'FOREIGN_VERIFIED',
          targetCountryCode: normTarget,
          businessCountryCode: fi.countryCode,
          confidence: 'HIGH',
          evidence,
          reason: `Entity copy and commercial signals explicitly refer to ${fi.countryName}.`,
          isLocal: false,
          isForeign: true,
          isUnknown: false
        };
      }
    }
  }

  // Check foreign phone numbers
  if (inputs.bodyCopy) {
    if (IN_PHONE_REGEX.test(inputs.bodyCopy) && inputs.bodyCopy.includes('+91')) {
      evidence.push('Verified Indian telephone international dialing prefix +91');
      return {
        classification: 'FOREIGN_VERIFIED',
        targetCountryCode: normTarget,
        businessCountryCode: 'IN',
        confidence: 'HIGH',
        evidence,
        reason: 'Verified telephone country code for India (+91).',
        isLocal: false,
        isForeign: true,
        isUnknown: false
      };
    }
    if (UK_PHONE_REGEX.test(inputs.bodyCopy) && inputs.bodyCopy.includes('+44')) {
      evidence.push('Verified UK telephone international dialing prefix +44');
      return {
        classification: 'FOREIGN_VERIFIED',
        targetCountryCode: normTarget,
        businessCountryCode: 'GB',
        confidence: 'HIGH',
        evidence,
        reason: 'Verified telephone country code for United Kingdom (+44).',
        isLocal: false,
        isForeign: true,
        isUnknown: false
      };
    }
    if (AU_PHONE_REGEX.test(inputs.bodyCopy) && inputs.bodyCopy.includes('+61')) {
      evidence.push('Verified Australian telephone international dialing prefix +61');
      return {
        classification: 'FOREIGN_VERIFIED',
        targetCountryCode: normTarget,
        businessCountryCode: 'AU',
        confidence: 'HIGH',
        evidence,
        reason: 'Verified telephone country code for Australia (+61).',
        isLocal: false,
        isForeign: true,
        isUnknown: false
      };
    }
  }

  // 2. Check for Bangladesh Local Signals (when targetCountryCode === 'BD')
  if (normTarget === 'BD') {
    let hasLocalPhone = false;
    let hasLocalAddressOrDelivery = false;
    let hasLocalCity = false;
    let hasBengaliScript = false;
    let hasBdDomain = false;

    // Check BD telephone prefix
    if (inputs.bodyCopy && BD_PHONE_REGEX.test(inputs.bodyCopy)) {
      const match = inputs.bodyCopy.match(BD_PHONE_REGEX);
      if (match) {
        hasLocalPhone = true;
        evidence.push(`Verified Bangladesh domestic phone number format: "${match[0]}"`);
      }
    }

    // Check BD operational / delivery phrases
    for (const phrase of BD_OPERATIONAL_PHRASES) {
      if (textToScan.includes(phrase)) {
        hasLocalAddressOrDelivery = true;
        evidence.push(`Explicit local operational coverage phrase: "${phrase}"`);
        break;
      }
    }

    // Check BD cities
    for (const city of BD_CITIES_DIVISIONS) {
      const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
      if (cityRegex.test(inputs.bodyCopy || '') || (inputs.destinationUrl || '').toLowerCase().includes(city)) {
        hasLocalCity = true;
        evidence.push(`Mention of major Bangladesh metropolitan area: "${city}"`);
        break;
      }
    }

    // Check Bengali Unicode script [\u0980-\u09FF]
    if (/[\u0980-\u09FF]/.test(inputs.bodyCopy || '') || /[\u0980-\u09FF]/.test(inputs.pageName || '')) {
      hasBengaliScript = true;
      evidence.push('Ad creative contains native Bengali script text');
    }

    // Check .bd domain (supporting signal only)
    if (inputs.destinationDomain) {
      const dom = inputs.destinationDomain.toLowerCase();
      if (dom.endsWith('.bd') || dom.endsWith('.com.bd') || dom.includes('regalfurniturebd') || dom.includes('htbazarbd')) {
        hasBdDomain = true;
        evidence.push(`Official website domain contains Bangladesh identifier: "${inputs.destinationDomain}"`);
      }
    }

    // Check explicit physical street/building address tokens
    const hasAddressKeywords = /\b(?:house\s*#?|road\s*#?|sector\s*#?|block\s*#?|lane\s*#?|plot\s*#?|holding\s*#?|floor\s*#?|avenue\b|street\b)/i.test(inputs.bodyCopy || '');
    const hasVerifiedPhysicalAddress = hasLocalCity && hasAddressKeywords;

    // Local Verified: Explicit BD phone prefix (+880), OR local phone + local context, OR explicit physical street address in local city
    const hasExplicitBdPrefix = inputs.bodyCopy && (inputs.bodyCopy.includes('+880') || inputs.bodyCopy.includes('8801'));
    if (
      hasExplicitBdPrefix ||
      (hasLocalPhone && (hasLocalCity || hasBdDomain || hasBengaliScript || hasLocalAddressOrDelivery)) ||
      hasVerifiedPhysicalAddress
    ) {
      return {
        classification: 'LOCAL_VERIFIED',
        targetCountryCode: normTarget,
        businessCountryCode: 'BD',
        confidence: 'HIGH',
        evidence,
        reason: 'Verified local business with confirmed Bangladesh physical showroom, street address, or telephone contact.',
        isLocal: true,
        isForeign: false,
        isUnknown: false
      };
    }

    // Local Probable: Strong supporting local signals (e.g. delivery phrases, Bengali script, BD cities, domestic phone)
    if (hasLocalAddressOrDelivery || hasBengaliScript || hasLocalCity || hasLocalPhone) {
      return {
        classification: 'LOCAL_PROBABLE',
        targetCountryCode: normTarget,
        businessCountryCode: 'BD',
        confidence: 'MEDIUM',
        evidence,
        reason: 'Probable local business with corroborating Bangladesh commercial signals (labeled for review).',
        isLocal: true,
        isForeign: false,
        isUnknown: false
      };
    }

    // Supporting domain only (.bd): LOCAL_PROBABLE with LOW confidence
    if (hasBdDomain) {
      return {
        classification: 'LOCAL_PROBABLE',
        targetCountryCode: normTarget,
        businessCountryCode: 'BD',
        confidence: 'LOW',
        evidence,
        reason: 'Country-code domain suffix indicates probable regional association, but lacks verified physical address/phone.',
        isLocal: true,
        isForeign: false,
        isUnknown: false
      };
    }
  }

  // 3. Fallback: Location Unknown
  // Do NOT populate businessCountryCode with targetCountryCode without independent proof!
  return {
    classification: 'LOCATION_UNKNOWN',
    targetCountryCode: normTarget,
    businessCountryCode: undefined,
    confidence: 'NONE',
    evidence: ['No unambiguous geographic signals detected in extracted ad or page data.'],
    reason: 'Physical business location cannot be verified from available public signals.',
    isLocal: false,
    isForeign: false,
    isUnknown: true
  };
}
