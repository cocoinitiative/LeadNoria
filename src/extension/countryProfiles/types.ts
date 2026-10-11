/**
 * LeadNoria — Extensible Global Country Profiles
 * Types and Contracts for Evidence-Based Geographic Classification
 */

export interface CountryTelephoneRules {
  /** International dialing prefixes (e.g. ['+880', '880'] or ['+44', '44']) */
  internationalPrefixes: string[];
  /** Pattern matching valid international or domestic telephone formats */
  phoneRegex: RegExp;
  /** Domestic phone format without international dialing prefix */
  domesticRegex?: RegExp;
  /** Shared prefixes that span multiple countries (e.g. +1 between US and CA) */
  sharedPrefixes?: string[];
  /** Non-geographic / toll-free area codes (e.g. ['800', '888', '877']) */
  tollFreeAreaCodes?: string[];
}

export interface CountryRegionalRules {
  /** Full names of states, provinces, or major administrative divisions */
  statesOrProvinces?: string[];
  /** Standard 2-letter state or province abbreviations (e.g. ['CA', 'NY', 'TX']) */
  stateCodes?: string[];
  /** Pattern matching domestic postal codes or ZIP codes */
  postalCodeRegex?: RegExp;
}

export interface CountryProfile {
  /** ISO 3166-1 alpha-2 country code (uppercase, e.g. 'BD', 'US', 'GB') */
  countryCode: string;
  /** Canonical English country name */
  countryName: string;
  /** Recognized country aliases and common input variations */
  aliases: string[];
  /** Telephone numbering patterns and prefix definitions */
  phone: CountryTelephoneRules;
  /** Administrative regions, states, and postal code rules */
  regions?: CountryRegionalRules;
  /** Major metropolitan cities and commercial hubs */
  majorCities: string[];
  /** Address keywords indicating physical street, building, or showroom location */
  addressKeywords: string[];
  /** Operational phrases indicating local commercial distribution or delivery */
  operationalPhrases: string[];
  /** Country-specific domain suffixes (ccTLDs, e.g. ['.bd', '.com.bd']) */
  domainSuffixes: string[];
  /** High-authority commercial domains definitively anchored in this country */
  knownCommercialDomains?: string[];
  /** Native script regex if distinct (e.g. Bengali Unicode for BD) */
  nativeScriptRegex?: RegExp;
  /** Contextual commercial keywords (e.g. 'registered in england', 'gst', 'abn') */
  keywords?: string[];
}
