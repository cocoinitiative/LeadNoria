import type { CountryProfile } from '../types.ts';

export const AU_PROFILE: CountryProfile = {
  countryCode: 'AU',
  countryName: 'Australia',
  aliases: ['AU', 'AUSTRALIA', 'AUS', 'OZ'],
  phone: {
    internationalPrefixes: ['+61'],
    phoneRegex: /(?:\+61[\s\-]?[2-478](?:[\s\-]?\d){7,8})/,
    domesticRegex: /\b0[2-478](?:[\s\-]?\d){7,8}\b/
  },
  regions: {
    statesOrProvinces: [
      'new south wales', 'victoria', 'queensland', 'western australia',
      'south australia', 'tasmania', 'australian capital territory', 'northern territory'
    ],
    stateCodes: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
    postalCodeRegex: /\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s*\d{4}\b/i
  },
  majorCities: [
    'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide',
    'gold coast', 'canberra', 'newcastle', 'wollongong', 'hobart',
    'geelong', 'darwin'
  ],
  addressKeywords: [
    'street', 'st', 'road', 'rd', 'parade', 'pde', 'highway', 'hwy',
    'avenue', 'ave', 'crescent', 'cres', 'court', 'ct', 'drive', 'dr', 'unit'
  ],
  operationalPhrases: [
    'australia wide',
    'australia-wide delivery',
    'delivery across australia',
    'aussie owned',
    'australian made',
    'free shipping australia wide'
  ],
  domainSuffixes: ['.com.au', '.net.au', '.au', '.org.au', '.gov.au'],
  knownCommercialDomains: [
    'hospitalityfurniture.net.au',
    'harveynorman.com.au',
    'bunnings.com.au',
    'thegoodguys.com.au',
    'freedom.com.au'
  ],
  keywords: ['australia', 'aud', 'australia wide', 'abn', 'acn', 'afterpay']
};
