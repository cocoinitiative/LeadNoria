import type { CountryProfile } from '../types.ts';

export const CN_PROFILE: CountryProfile = {
  countryCode: 'CN',
  countryName: 'China',
  aliases: ['CN', 'CHINA', 'PRC'],
  phone: {
    internationalPrefixes: ['+86', '86'],
    phoneRegex: /(?:\+86[\s\-]?[1-9]\d{9,10})/
  },
  majorCities: [
    'guangzhou', 'foshan', 'shenzhen', 'dongguan', 'yiwu',
    'zhejiang', 'shanghai', 'beijing', 'ningbo', 'hangzhou'
  ],
  addressKeywords: ['district', 'road', 'industrial park', 'building', 'street'],
  operationalPhrases: [
    'factory direct',
    'factory-direct',
    'oem and odm',
    'square meter factory',
    'china export'
  ],
  domainSuffixes: ['.cn', '.com.cn'],
  knownCommercialDomains: [
    'alibaba.com',
    'made-in-china.com',
    'aliexpress.com',
    '1688.com'
  ],
  keywords: [
    'oem and odm',
    'factory-direct',
    'oem configurations',
    'square meter factory',
    'china manufacturer'
  ]
};
