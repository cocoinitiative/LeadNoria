import type { CountryProfile } from '../types.ts';

export const IN_PROFILE: CountryProfile = {
  countryCode: 'IN',
  countryName: 'India',
  aliases: ['IN', 'INDIA', 'BHARAT'],
  phone: {
    internationalPrefixes: ['+91'],
    phoneRegex: /(?:\+91[\s\-]?[6-9]\d{9})/,
    domesticRegex: /\b[6-9]\d{9}\b/
  },
  majorCities: [
    'jaipur', 'mumbai', 'delhi', 'bengaluru', 'bangalore', 'kolkata',
    'chennai', 'hyderabad', 'pune', 'noida', 'gurgaon', 'ahmedabad', 'surat'
  ],
  addressKeywords: [
    'road', 'rd', 'street', 'st', 'nagar', 'colony', 'marg', 'sector', 'phase', 'plot'
  ],
  operationalPhrases: [
    'pan india',
    'all over india',
    'cash on delivery india',
    'great indian festival'
  ],
  domainSuffixes: ['.in', '.co.in', '.org.in', '.net.in'],
  knownCommercialDomains: [
    'amazon.in',
    'interio.com',
    'flipkart.com',
    'myntra.com'
  ],
  keywords: ['india', 'inr', 'pan india', 'great indian festival', 'gstin']
};
