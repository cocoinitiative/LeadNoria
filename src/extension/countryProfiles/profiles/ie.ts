import type { CountryProfile } from '../types.ts';

export const IE_PROFILE: CountryProfile = {
  countryCode: 'IE',
  countryName: 'Ireland',
  aliases: ['IE', 'IRELAND', 'EIRE', 'REPUBLIC OF IRELAND'],
  phone: {
    internationalPrefixes: ['+353'],
    phoneRegex: /(?:\+353[\s\-]?[1-9](?:[\s\-]?\d){6,8})/,
    domesticRegex: /\b0[1-9](?:[\s\-]?\d){6,8}\b/
  },
  regions: {
    statesOrProvinces: [
      'county dublin', 'county cork', 'county galway', 'county kildare',
      'county meath', 'county limerick', 'county waterford', 'county louth',
      'county wicklow', 'county kerry', 'county clare', 'county mayo',
      'county donegal', 'county tipperary', 'co. dublin', 'co. cork', 'co. galway'
    ],
    // Eircode routing keys (e.g. D02, T12, H91) followed by alphanumeric identifier
    postalCodeRegex: /\b[A-W]\d{2}\s*[0-9A-Z]{4}\b/i
  },
  majorCities: [
    'dublin', 'cork', 'galway', 'limerick', 'waterford',
    'drogheda', 'dundalk', 'swords', 'bray', 'navan', 'kilkenny'
  ],
  addressKeywords: [
    'street', 'st', 'road', 'rd', 'avenue', 'ave', 'lane', 'ln',
    'terrace', 'tce', 'quay', 'park', 'square', 'sq', 'unit', 'industrial estate'
  ],
  operationalPhrases: [
    'nationwide delivery ireland',
    'delivery across ireland',
    'irish owned',
    'all 32 counties',
    'republic of ireland delivery',
    'free delivery ireland',
    'ireland delivery'
  ],
  domainSuffixes: ['.ie'],
  knownCommercialDomains: [
    'harveynorman.ie',
    'woodies.ie',
    'did.ie',
    'currys.ie',
    'ezlivingfurniture.ie'
  ],
  keywords: ['ireland', 'eur', 'cro registered', 'eircode', 'an post']
};
