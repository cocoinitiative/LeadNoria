import type { CountryProfile } from '../types.ts';

export const CA_PROFILE: CountryProfile = {
  countryCode: 'CA',
  countryName: 'Canada',
  aliases: ['CA', 'CANADA', 'CAN'],
  phone: {
    internationalPrefixes: ['+1'],
    phoneRegex: /(?:\+1[\s\-]?[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4})/,
    domesticRegex: /\b[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}\b/,
    sharedPrefixes: ['+1'],
    tollFreeAreaCodes: ['800', '888', '877', '866', '855', '844', '833']
  },
  regions: {
    statesOrProvinces: [
      'ontario', 'quebec', 'british columbia', 'alberta', 'manitoba',
      'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland',
      'prince edward island', 'northwest territories', 'yukon', 'nunavut'
    ],
    stateCodes: [
      'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU'
    ],
    postalCodeRegex: /\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s*\d[A-CEGHJ-NPR-TV-Z]\d\b/i
  },
  majorCities: [
    'toronto', 'montreal', 'vancouver', 'calgary', 'edmonton', 'ottawa',
    'winnipeg', 'quebec city', 'hamilton', 'kitchener', 'halifax', 'victoria',
    'mississauga', 'brampton', 'surrey', 'laval', 'markham'
  ],
  addressKeywords: [
    'street', 'st', 'rue', 'avenue', 'ave', 'boulevard', 'blvd',
    'road', 'rd', 'chemin', 'suite', 'ste', 'drive', 'dr', 'court', 'ct'
  ],
  operationalPhrases: [
    'canada-wide delivery',
    'free shipping across canada',
    'shipping across canada',
    'canadian owned',
    'made in canada',
    'coast to coast delivery'
  ],
  domainSuffixes: ['.ca'],
  knownCommercialDomains: [
    'canadiantire.ca',
    'thebay.com',
    'bestbuy.ca',
    'leons.ca',
    'brick.com'
  ],
  keywords: ['cad', 'gst/hst', 'canadian', 'canada wide', 'cra registered']
};
