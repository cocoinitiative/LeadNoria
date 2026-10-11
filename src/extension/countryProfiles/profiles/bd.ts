import type { CountryProfile } from '../types.ts';

export const BD_PROFILE: CountryProfile = {
  countryCode: 'BD',
  countryName: 'Bangladesh',
  aliases: ['BD', 'BANGLADESH', 'BENGAL'],
  phone: {
    internationalPrefixes: ['+880'],
    phoneRegex: /(?:\+880[\s\-]*1[3-9][\s\-]?\d{2}[\s\-]?\d{6}|880[\s\-]*1[3-9][\s\-]?\d{2}[\s\-]?\d{6}|\+880\s*1[3-9]\d{8}|8801[3-9]\d{8})/,
    domesticRegex: /(?:\b01[3-9][\s\-]?\d{2}[\s\-]?\d{6}\b|\b01[3-9]\d{8}\b)/
  },
  majorCities: [
    'dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna',
    'barishal', 'rangpur', 'mymensingh', 'gazipur', 'narayanganj', 'comilla',
    'savar', 'uttara', 'banani', 'gulshan', 'dhanmondi', 'mirpur', 'motijheel',
    'badda', 'mohammadpur', 'bashundhara', 'mohakhali', 'khilkhet', 'tejgaon'
  ],
  addressKeywords: [
    'house', 'road', 'sector', 'block', 'lane', 'plot', 'holding',
    'floor', 'avenue', 'street'
  ],
  operationalPhrases: [
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
  ],
  domainSuffixes: ['.bd', '.com.bd', '.org.bd', '.edu.bd', '.gov.bd'],
  knownCommercialDomains: [
    'regalfurniturebd.com',
    'htbazarbd.com',
    'daraz.com.bd',
    'othoba.com',
    'chaldal.com'
  ],
  nativeScriptRegex: /[\u0980-\u09FF]/,
  keywords: ['bangladesh', 'bdt', 'taka', 'cash on delivery']
};
