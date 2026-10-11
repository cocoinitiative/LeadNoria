import type { CountryProfile } from '../types.ts';

export const GB_PROFILE: CountryProfile = {
  countryCode: 'GB',
  countryName: 'United Kingdom',
  aliases: [
    'GB', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN',
    'ENGLAND', 'SCOTLAND', 'WALES', 'NORTHERN IRELAND'
  ],
  phone: {
    internationalPrefixes: ['+44'],
    phoneRegex: /(?:\+44[\s\-]?[1-9](?:[\s\-]?\d){8,9})/,
    domesticRegex: /\b0[12378](?:[\s\-]?\d){8,9}\b/
  },
  regions: {
    statesOrProvinces: [
      'england', 'scotland', 'wales', 'northern ireland',
      'devon', 'north devon', 'cornwall', 'yorkshire', 'kent',
      'essex', 'surrey', 'lancashire', 'hampshire', 'somerset'
    ],
    postalCodeRegex: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i
  },
  majorCities: [
    'london', 'birmingham', 'manchester', 'leeds', 'glasgow',
    'liverpool', 'newcastle', 'sheffield', 'bristol', 'edinburgh',
    'belfast', 'cardiff', 'nottingham', 'southampton'
  ],
  addressKeywords: [
    'high street', 'street', 'st', 'road', 'rd', 'lane', 'ln',
    'avenue', 'ave', 'close', 'drive', 'way', 'walk', 'gardens',
    'square', 'sq', 'unit', 'building', 'mews'
  ],
  operationalPhrases: [
    'uk mainland delivery',
    'free uk delivery',
    'delivering across uk',
    'nationwide uk delivery',
    'uk delivery only',
    'in-store & online'
  ],
  domainSuffixes: ['.co.uk', '.uk', '.org.uk', '.gov.uk', '.ac.uk'],
  knownCommercialDomains: [
    'scs.co.uk',
    'fairwayfurniture.co.uk',
    'argos.co.uk',
    'currys.co.uk',
    'johnlewis.com',
    'marksandspencer.com'
  ],
  keywords: [
    'uk', 'gbp', 'interest free credit', 'registered in england',
    'vat registered', 'hmrc', 'companies house'
  ]
};
