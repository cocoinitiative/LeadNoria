import type { CountryProfile } from '../types.ts';

export const US_PROFILE: CountryProfile = {
  countryCode: 'US',
  countryName: 'United States',
  aliases: ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'AMERICA'],
  phone: {
    internationalPrefixes: ['+1'],
    phoneRegex: /(?:\+1[\s\-]?[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4})/,
    domesticRegex: /\b[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}\b/,
    sharedPrefixes: ['+1'],
    tollFreeAreaCodes: ['800', '888', '877', '866', '855', '844', '833']
  },
  regions: {
    statesOrProvinces: [
      'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
      'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana',
      'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts',
      'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska',
      'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
      'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
      'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
      'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'
    ],
    stateCodes: [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ],
    postalCodeRegex: /\b\d{5}(?:-\d{4})?\b/
  },
  majorCities: [
    'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'austin', 'san jose', 'fort worth',
    'jacksonville', 'columbus', 'charlotte', 'indianapolis', 'san francisco',
    'seattle', 'denver', 'washington', 'boston', 'utica', 'miami', 'atlanta'
  ],
  addressKeywords: [
    'street', 'st.', 'st', 'avenue', 'ave.', 'ave', 'boulevard', 'blvd.', 'blvd',
    'road', 'rd.', 'rd', 'suite', 'ste.', 'ste', 'drive', 'dr.', 'dr',
    'court', 'ct.', 'ct', 'lane', 'ln.', 'ln', 'highway', 'hwy', 'parkway', 'pkwy'
  ],
  operationalPhrases: [
    'free shipping in us',
    'us nationwide delivery',
    'ships within us',
    'continental us',
    'lower 48',
    'made in usa',
    'us shipping',
    'nationwide delivery'
  ],
  domainSuffixes: ['.us', '.gov', '.mil'],
  knownCommercialDomains: [
    'raymourflanigan.com',
    'officedepot.com',
    'tahans.com',
    'ashleyfurniture.com',
    'target.com',
    'walmart.com',
    'homedepot.com'
  ],
  keywords: ['labor day', 'nationwide delivery', 'special financing', 'us shipping', 'usd', 'veterans day', 'memorial day']
};
