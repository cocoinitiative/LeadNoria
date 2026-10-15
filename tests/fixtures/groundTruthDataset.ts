/**
 * LeadNoria — Ground-Truth Benchmark Dataset (V1.0)
 *
 * Meticulously labeled, multi-regional test dataset for automated precision/recall evaluation,
 * geographic accuracy validation, niche qualification benchmarking, contact quality assessment,
 * and fail-closed safety gate testing.
 *
 * Ground-Truth Regions Covered:
 * - Bangladesh (BD): Local services, clinics, manufacturing, retail, Bengali & English copy.
 * - International (US, GB, CA, AU): Local HVAC, legal, dental, trade services.
 * - Cross-Border / Negative Controls: Foreign businesses, dropshippers, and global SaaS targeting BD.
 * - Adversarial / Noise: Contact conflicts, spam/meme aggregators, missing geographic evidence.
 *
 * NOTE: This fixture resides in tests/fixtures/ and is strictly excluded from production extension bundles.
 */

export interface GroundTruthItem {
  id: string;
  name: string;
  regionCategory: 'BANGLADESH' | 'INTERNATIONAL_US' | 'INTERNATIONAL_UK' | 'INTERNATIONAL_CA' | 'INTERNATIONAL_AU' | 'CROSS_BORDER' | 'NOISE';
  targetCountryCode: string;
  expectedBusinessCountryCode: string | null;
  expectedClassification: 'LOCAL_VERIFIED' | 'LOCAL_PROBABLE' | 'FOREIGN_VERIFIED' | 'LOCATION_UNKNOWN';
  expectedIsLocal: boolean;
  expectedIsForeign: boolean;
  expectedIsUnknown: boolean;
  expectedNicheMatch: boolean;
  expectedPrioritizationTier: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  expectedHasContactConflict: boolean;
  labelingRationale: string;
  candidateInputs: {
    libraryId: string;
    pageName: string;
    facebookPageUrl?: string;
    destinationUrl?: string;
    destinationDomain?: string;
    bodyCopy: string;
    ctaText?: string;
    observedKeyword?: string;
  };
  additionalAds?: Array<{
    libraryId: string;
    bodyCopy: string;
    ctaText?: string;
  }>;
}

export const GROUND_TRUTH_DATASET_V1: GroundTruthItem[] = [
  // ============================================================================
  // 1. BANGLADESH (BD) LOCAL BENCHMARK
  // ============================================================================
  {
    id: 'GT-BD-001',
    name: 'Dhaka Modern Dental Care',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Explicit physical location (Gulshan-2, Dhaka) and verified BD phone number (+880 1711-234567).',
    candidateInputs: {
      libraryId: 'ad_bd_001_1',
      pageName: 'Dhaka Modern Dental Care',
      facebookPageUrl: 'https://facebook.com/dhakamoderndental',
      destinationUrl: 'https://dhakamoderndental.com',
      destinationDomain: 'dhakamoderndental.com',
      bodyCopy: 'Comprehensive dental implants and cosmetic teeth whitening at Gulshan-2, Dhaka. Book appointment: +880 1711-234567.',
      ctaText: 'Call Now',
      observedKeyword: 'dental'
    }
  },
  {
    id: 'GT-BD-002',
    name: 'Chittagong Teak & Steel Works',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Explicit physical address in Agrabad C/A, Chittagong with verified local phone (+880 1819-876543).',
    candidateInputs: {
      libraryId: 'ad_bd_002_1',
      pageName: 'Chittagong Teak & Steel Works',
      facebookPageUrl: 'https://facebook.com/ctgteaksteel',
      destinationUrl: 'https://ctgteaksteel.com',
      destinationDomain: 'ctgteaksteel.com',
      bodyCopy: 'Industrial grade structural steel fabrication and solid wood furniture. Factory: Agrabad C/A, Chittagong. Tel: +880 1819-876543.',
      ctaText: 'Contact Us',
      observedKeyword: 'furniture'
    }
  },
  {
    id: 'GT-BD-003',
    name: 'Sylhet Valley Organic Tea',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_PROBABLE',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'MEDIUM',
    expectedHasContactConflict: false,
    labelingRationale: 'Mentions local city delivery across Sylhet and Dhaka with .com.bd domain, but no explicit verified phone.',
    candidateInputs: {
      libraryId: 'ad_bd_003_1',
      pageName: 'Sylhet Valley Organic Tea',
      facebookPageUrl: 'https://facebook.com/sylhetvalleytea',
      destinationUrl: 'https://sylhetvalleytea.com.bd',
      destinationDomain: 'sylhetvalleytea.com.bd',
      bodyCopy: 'Freshly plucked organic tea gardens in Sreemangal. Home delivery available throughout Sylhet, Dhaka, and Chittagong.',
      ctaText: 'Shop Now',
      observedKeyword: 'organic'
    }
  },
  {
    id: 'GT-BD-004',
    name: 'ধানমন্ডি বুটিক ফ্যাশন (Dhanmondi Boutique)',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Bengali native script with physical showroom address in Dhanmondi, Dhaka and BD mobile number (+880 1912-334455).',
    candidateInputs: {
      libraryId: 'ad_bd_004_1',
      pageName: 'ধানমন্ডি বুটিক ফ্যাশন',
      facebookPageUrl: 'https://facebook.com/dhanmondiboutique',
      destinationUrl: 'https://dhanmondiboutique.com',
      destinationDomain: 'dhanmondiboutique.com',
      bodyCopy: 'ঈদ কালেকশন ২০২৬: ধানমন্ডি ৮/এ শোরুমে সরাসরি চলে আসুন। যেকোনো তথ্যের জন্য কল করুন +880 1912-334455 নম্বরে।',
      ctaText: 'Call Now',
      observedKeyword: 'boutique'
    }
  },
  {
    id: 'GT-BD-005',
    name: 'Dhaka Corporate Legal Associates',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Verified Supreme Court / Paltan physical law chamber and BD phone (+880 1611-998877).',
    candidateInputs: {
      libraryId: 'ad_bd_005_1',
      pageName: 'Dhaka Corporate Legal Associates',
      facebookPageUrl: 'https://facebook.com/dhakacorporatelaw',
      destinationUrl: 'https://dhakacorporatelaw.com',
      destinationDomain: 'dhakacorporatelaw.com',
      bodyCopy: 'Corporate registration, tax advisory, and commercial litigation. Chamber: Purana Paltan, Dhaka 1000. Mobile: +880 1611-998877.',
      ctaText: 'Book Now',
      observedKeyword: 'legal'
    }
  },
  {
    id: 'GT-BD-006',
    name: 'Rajshahi Silk Heritage',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_PROBABLE',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'MEDIUM',
    expectedHasContactConflict: false,
    labelingRationale: 'Rajshahi local region mention with .bd ccTLD domain, no explicit physical phone.',
    candidateInputs: {
      libraryId: 'ad_bd_006_1',
      pageName: 'Rajshahi Silk Heritage',
      facebookPageUrl: 'https://facebook.com/rajshahisilk',
      destinationUrl: 'https://rajshahisilk.com.bd',
      destinationDomain: 'rajshahisilk.com.bd',
      bodyCopy: 'Authentic Rajshahi pure silk sarees handwoven by master artisans. Express shipping across Bangladesh.',
      ctaText: 'Order Now',
      observedKeyword: 'silk'
    }
  },

  // ============================================================================
  // 2. CROSS-BORDER / FOREIGN BUSINESS TARGETING BANGLADESH (NEGATIVE CONTROLS)
  // ============================================================================
  {
    id: 'GT-XB-001',
    name: 'Jaipur Royal Wooden Crafts',
    regionCategory: 'CROSS_BORDER',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'IN',
    expectedClassification: 'FOREIGN_VERIFIED',
    expectedIsLocal: false,
    expectedIsForeign: true,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'LOW',
    expectedHasContactConflict: false,
    labelingRationale: 'Indian business (+91 phone, Jaipur location, .in domain) advertising to Bangladesh users.',
    candidateInputs: {
      libraryId: 'ad_xb_001_1',
      pageName: 'Jaipur Royal Wooden Crafts',
      facebookPageUrl: 'https://facebook.com/jaipurwoodencrafts',
      destinationUrl: 'https://jaipurwoodencrafts.in',
      destinationDomain: 'jaipurwoodencrafts.in',
      bodyCopy: 'Handcarved Sheesham dining sets and royal beds direct from our factory in Jaipur, Rajasthan, India. WhatsApp: +91 9829012345.',
      ctaText: 'Send Message',
      observedKeyword: 'furniture'
    }
  },
  {
    id: 'GT-XB-002',
    name: 'Shenzhen Microtech Wholesale',
    regionCategory: 'CROSS_BORDER',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'CN',
    expectedClassification: 'FOREIGN_VERIFIED',
    expectedIsLocal: false,
    expectedIsForeign: true,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'LOW',
    expectedHasContactConflict: false,
    labelingRationale: 'Chinese electronic manufacturer (+86 phone, Shenzhen mention, .cn domain) targeting BD importers.',
    candidateInputs: {
      libraryId: 'ad_xb_002_1',
      pageName: 'Shenzhen Microtech Wholesale',
      facebookPageUrl: 'https://facebook.com/szmicrotech',
      destinationUrl: 'https://szmicrotech.cn',
      destinationDomain: 'szmicrotech.cn',
      bodyCopy: 'Direct B2B wholesale electronics and PCB assembly. Factory: Futian District, Shenzhen, China. Tel: +86 755 8321 0099.',
      ctaText: 'Contact Us',
      observedKeyword: 'electronics'
    }
  },
  {
    id: 'GT-XB-003',
    name: 'CloudScale SaaS Platform',
    regionCategory: 'CROSS_BORDER',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'US',
    expectedClassification: 'FOREIGN_VERIFIED',
    expectedIsLocal: false,
    expectedIsForeign: true,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'LOW',
    expectedHasContactConflict: false,
    labelingRationale: 'San Francisco, US tech company with +1 phone and .com domain advertising cloud software in BD.',
    candidateInputs: {
      libraryId: 'ad_xb_003_1',
      pageName: 'CloudScale SaaS Platform',
      facebookPageUrl: 'https://facebook.com/cloudscaleplatform',
      destinationUrl: 'https://cloudscaleplatform.com',
      destinationDomain: 'cloudscaleplatform.com',
      bodyCopy: 'Deploy enterprise Kubernetes clusters in minutes. HQ: 450 Mission St, San Francisco, CA 94105, USA. Call: +1 415 555 0192.',
      ctaText: 'Sign Up',
      observedKeyword: 'cloud'
    }
  },
  {
    id: 'GT-XB-004',
    name: 'Dublin Enterprise Cloud Ltd',
    regionCategory: 'CROSS_BORDER',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'IE',
    expectedClassification: 'FOREIGN_VERIFIED',
    expectedIsLocal: false,
    expectedIsForeign: true,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'LOW',
    expectedHasContactConflict: false,
    labelingRationale: 'Irish software enterprise (+353 phone, Dublin Ireland, .ie domain) targeting Bangladeshi IT managers.',
    candidateInputs: {
      libraryId: 'ad_xb_004_1',
      pageName: 'Dublin Enterprise Cloud Ltd',
      facebookPageUrl: 'https://facebook.com/dublinenterprisecloud',
      destinationUrl: 'https://dublinenterprisecloud.ie',
      destinationDomain: 'dublinenterprisecloud.ie',
      bodyCopy: 'Offshore cloud data infrastructure and high-throughput microservices. HQ: Silicon Docks, Dublin, Ireland. Call: +353 1 496 0123.',
      ctaText: 'Learn More',
      observedKeyword: 'cloud'
    }
  },

  // ============================================================================
  // 3. LOCATION UNKNOWN / INSUFFICIENT EVIDENCE (FAIL-CLOSED BENCHMARK)
  // ============================================================================
  {
    id: 'GT-UNK-001',
    name: 'Digital Growth Hacks 247',
    regionCategory: 'NOISE',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: null,
    expectedClassification: 'LOCATION_UNKNOWN',
    expectedIsLocal: false,
    expectedIsForeign: false,
    expectedIsUnknown: true,
    expectedNicheMatch: false,
    expectedPrioritizationTier: 'MINIMAL',
    expectedHasContactConflict: false,
    labelingRationale: 'Zero physical location, zero phone number, generic international .com domain, no commercial address.',
    candidateInputs: {
      libraryId: 'ad_unk_001_1',
      pageName: 'Digital Growth Hacks 247',
      facebookPageUrl: 'https://facebook.com/digitalgrowth247',
      destinationUrl: 'https://digitalgrowth247.com',
      destinationDomain: 'digitalgrowth247.com',
      bodyCopy: 'Scale your online revenue with our automated traffic generator and digital marketing playbook.',
      ctaText: 'Get Offer',
      observedKeyword: 'marketing'
    }
  },
  {
    id: 'GT-UNK-002',
    name: 'Online Fitness Pro Secrets',
    regionCategory: 'NOISE',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: null,
    expectedClassification: 'LOCATION_UNKNOWN',
    expectedIsLocal: false,
    expectedIsForeign: false,
    expectedIsUnknown: true,
    expectedNicheMatch: false,
    expectedPrioritizationTier: 'MINIMAL',
    expectedHasContactConflict: false,
    labelingRationale: 'Virtual fitness PDF course, zero local or international phone prefix, virtual product only.',
    candidateInputs: {
      libraryId: 'ad_unk_002_1',
      pageName: 'Online Fitness Pro Secrets',
      facebookPageUrl: 'https://facebook.com/fitsecretsonline',
      destinationUrl: 'https://fitsecretsonline.clickfunnels.com',
      destinationDomain: 'fitsecretsonline.clickfunnels.com',
      bodyCopy: 'Download 30-day belly fat burning meal plan. Instant PDF download on signup.',
      ctaText: 'Download',
      observedKeyword: 'fitness'
    }
  },

  // ============================================================================
  // 4. INTERNATIONAL BENCHMARKS (US, UK, CA, AU)
  // ============================================================================
  {
    id: 'GT-US-001',
    name: 'Austin Precision Roofing & Gutter',
    regionCategory: 'INTERNATIONAL_US',
    targetCountryCode: 'US',
    expectedBusinessCountryCode: 'US',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Austin, Texas physical location, US domestic phone (+1 512 555-0147), roofing niche match.',
    candidateInputs: {
      libraryId: 'ad_us_001_1',
      pageName: 'Austin Precision Roofing & Gutter',
      facebookPageUrl: 'https://facebook.com/austinprecisionroofing',
      destinationUrl: 'https://austinprecisionroofing.com',
      destinationDomain: 'austinprecisionroofing.com',
      bodyCopy: 'Emergency storm hail damage repair and shingle roof replacement. Serving Austin, Round Rock & Cedar Park, TX. Call +1 512-555-0147.',
      ctaText: 'Call Now',
      observedKeyword: 'roofing'
    }
  },
  {
    id: 'GT-UK-001',
    name: 'Manchester Gas & Boiler Specialists Ltd',
    regionCategory: 'INTERNATIONAL_UK',
    targetCountryCode: 'GB',
    expectedBusinessCountryCode: 'GB',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Manchester UK address, Gas Safe registered, UK telephone (+44 161 496 0123), .co.uk domain.',
    candidateInputs: {
      libraryId: 'ad_uk_001_1',
      pageName: 'Manchester Gas & Boiler Specialists Ltd',
      facebookPageUrl: 'https://facebook.com/manchesterboilers',
      destinationUrl: 'https://manchesterboilers.co.uk',
      destinationDomain: 'manchesterboilers.co.uk',
      bodyCopy: 'Gas Safe registered emergency central heating repairs and boiler installation in Manchester M14. Phone: +44 161 496 0123.',
      ctaText: 'Call Now',
      observedKeyword: 'plumbing'
    }
  },
  {
    id: 'GT-CA-001',
    name: 'Toronto Licensed Master Electricians',
    regionCategory: 'INTERNATIONAL_CA',
    targetCountryCode: 'CA',
    expectedBusinessCountryCode: 'CA',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Toronto, Ontario address, Canadian phone (+1 416 555-0178), .ca domain, licensed electrical trade.',
    candidateInputs: {
      libraryId: 'ad_ca_001_1',
      pageName: 'Toronto Licensed Master Electricians',
      facebookPageUrl: 'https://facebook.com/torontomasterelectric',
      destinationUrl: 'https://torontomasterelectric.ca',
      destinationDomain: 'torontomasterelectric.ca',
      bodyCopy: 'Commercial panel upgrades and residential rewire. 24/7 service across Greater Toronto Area, Ontario. Call +1 416-555-0178.',
      ctaText: 'Call Now',
      observedKeyword: 'electrician'
    }
  },
  {
    id: 'GT-AU-001',
    name: 'Sydney Harbour Commercial Plumbing',
    regionCategory: 'INTERNATIONAL_AU',
    targetCountryCode: 'AU',
    expectedBusinessCountryCode: 'AU',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'HIGH',
    expectedHasContactConflict: false,
    labelingRationale: 'Sydney NSW address, Australian phone (+61 2 9123 4567), .com.au domain.',
    candidateInputs: {
      libraryId: 'ad_au_001_1',
      pageName: 'Sydney Harbour Commercial Plumbing',
      facebookPageUrl: 'https://facebook.com/sydneyharbourplumbing',
      destinationUrl: 'https://sydneyharbourplumbing.com.au',
      destinationDomain: 'sydneyharbourplumbing.com.au',
      bodyCopy: 'Blocked drains, pipe relining and commercial backflow prevention across Sydney CBD and North Shore, NSW. Tel: +61 2 9123 4567.',
      ctaText: 'Call Now',
      observedKeyword: 'plumbing'
    }
  },

  // ============================================================================
  // 5. CONTACT CONFLICT & ANOMALY BENCHMARK
  // ============================================================================
  {
    id: 'GT-CONF-001',
    name: 'Dhaka Swift Express Courier',
    regionCategory: 'BANGLADESH',
    targetCountryCode: 'BD',
    expectedBusinessCountryCode: 'BD',
    expectedClassification: 'LOCAL_VERIFIED',
    expectedIsLocal: true,
    expectedIsForeign: false,
    expectedIsUnknown: false,
    expectedNicheMatch: true,
    expectedPrioritizationTier: 'MEDIUM', // Penalized due to conflict
    expectedHasContactConflict: true,
    labelingRationale: 'Local BD entity with two conflicting telephone numbers across different active campaigns.',
    candidateInputs: {
      libraryId: 'ad_conf_001_1',
      pageName: 'Dhaka Swift Express Courier',
      facebookPageUrl: 'https://facebook.com/dhakaswiftexpress',
      destinationUrl: 'https://dhakaswiftexpress.com',
      destinationDomain: 'dhakaswiftexpress.com',
      bodyCopy: 'Same day parcel delivery in Dhaka. Call support helpline at +880 1711-000111.',
      ctaText: 'Call Now',
      observedKeyword: 'courier'
    },
    additionalAds: [
      {
        libraryId: 'ad_conf_001_2',
        bodyCopy: 'Ecommerce merchant delivery hotline: +880 1819-999222. Fast pickup in Motijheel.',
        ctaText: 'Contact Us'
      }
    ]
  }
];

/**
 * Metric Summary Calculation Contract
 */
export interface BinaryMetrics {
  total: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  specificity: number;
  falsePositiveRate: number;
}

export function calculateBinaryMetrics(tp: number, fp: number, tn: number, fn: number): BinaryMetrics {
  const total = tp + fp + tn + fn;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1.0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1.0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
  const accuracy = total > 0 ? (tp + tn) / total : 1.0;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 1.0;
  const falsePositiveRate = (fp + tn) > 0 ? fp / (fp + tn) : 0.0;

  return {
    total,
    tp,
    fp,
    tn,
    fn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    accuracy: Number(accuracy.toFixed(4)),
    specificity: Number(specificity.toFixed(4)),
    falsePositiveRate: Number(falsePositiveRate.toFixed(4))
  };
}
