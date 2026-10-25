(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/data/presetCatalogue.ts
  var RESEARCH_PRESETS;
  var init_presetCatalogue = __esm({
    "src/data/presetCatalogue.ts"() {
      RESEARCH_PRESETS = [
        {
          preset_id: "retail_furniture_home",
          name: "Furniture & Home Decor",
          industry: "Home & Living",
          sub_industry: "Furniture",
          description: "Furniture shops, makers, and home decor businesses.",
          primary_keywords: ["furniture", "sofa", "home decor", "\u09AB\u09BE\u09B0\u09CD\u09A8\u09BF\u099A\u09BE\u09B0"],
          secondary_keywords: ["dining table", "bedroom furniture", "custom furniture"],
          default_location_behavior: { defaultLocationCode: "BD", allowsGlobal: true },
          website_required: false,
          default_result_limit: 200,
          version: "v2.2.0",
          status: "ACTIVE",
          aliases: ["Furniture", "Home Decor", "\u09AB\u09BE\u09B0\u09CD\u09A8\u09BF\u099A\u09BE\u09B0"]
        },
        // ==========================================
        // 1. TECHNOLOGY & SOFTWARE
        // ==========================================
        {
          preset_id: "tech_saas_b2b",
          name: "B2B SaaS Platforms",
          industry: "Technology & Software",
          sub_industry: "Cloud Software",
          description: "B2B cloud software providers advertising subscription business tools.",
          primary_keywords: ["saas", "cloud software", "business software"],
          secondary_keywords: ["crm", "erp", "workflow automation", "enterprise software"],
          optional_exclusions: ["free software", "pirate", "torrent"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["SaaS", "B2B Software", "Cloud Platforms", "Enterprise SaaS"]
        },
        {
          preset_id: "tech_crm_platforms",
          name: "CRM & Pipeline Software",
          industry: "Technology & Software",
          sub_industry: "Sales Technology",
          description: "Customer relationship management and sales automation software vendors.",
          primary_keywords: ["crm software", "sales pipeline software", "lead management software"],
          secondary_keywords: ["pipeline crm", "contact manager", "deal tracking"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["CRM", "Sales CRM", "Pipeline Tool"]
        },
        {
          preset_id: "tech_devops_cloud",
          name: "DevOps & Cloud Infrastructure",
          industry: "Technology & Software",
          sub_industry: "Developer Tools",
          description: "Continuous delivery, Kubernetes, cloud hosting, and infrastructure monitoring.",
          primary_keywords: ["devops platform", "kubernetes management", "cloud infrastructure"],
          secondary_keywords: ["ci/cd pipeline", "container orchestration", "cloud monitoring"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["DevOps", "Cloud Infra", "Kubernetes"]
        },
        {
          preset_id: "tech_cybersecurity_b2b",
          name: "Cybersecurity & Compliance",
          industry: "Technology & Software",
          sub_industry: "Security & Privacy",
          description: "Enterprise endpoint protection, SOC 2 compliance automation, and threat defense.",
          primary_keywords: ["cybersecurity solution", "soc 2 compliance", "endpoint security"],
          secondary_keywords: ["vulnerability management", "data security platform", "zero trust"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Cybersecurity", "SOC 2", "InfoSec", "Penetration Testing"]
        },
        {
          preset_id: "tech_fintech_software",
          name: "FinTech & Billing Software",
          industry: "Technology & Software",
          sub_industry: "Financial Technology",
          description: "Corporate spend management, payroll automation, and recurring billing systems.",
          primary_keywords: ["spend management software", "payroll software", "subscription billing"],
          secondary_keywords: ["corporate card", "invoicing software", "expense automation"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["FinTech", "Payroll SaaS", "Billing Engine"]
        },
        {
          preset_id: "tech_hr_recruitment_saas",
          name: "HR & ATS Talent Software",
          industry: "Technology & Software",
          sub_industry: "Human Resources",
          description: "Applicant tracking systems, employee onboarding, and HR information systems.",
          primary_keywords: ["applicant tracking system", "hr software", "employee onboarding platform"],
          secondary_keywords: ["ats software", "hris", "recruitment software"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["HR Tech", "ATS", "HRIS", "Staffing Software"]
        },
        // ==========================================
        // 2. HEALTHCARE & MEDICAL
        // ==========================================
        {
          preset_id: "health_dental_clinics",
          name: "Dental & Orthodontic Clinics",
          industry: "Healthcare & Medical",
          sub_industry: "Dental Services",
          description: "Private dental practices advertising cosmetic dentistry, implants, and clear aligners.",
          primary_keywords: ["dental implants", "cosmetic dentist", "clear aligners"],
          secondary_keywords: ["emergency dentist", "teeth whitening clinic", "invisalign dentist"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Dentist", "Orthodontist", "Dental Implants"]
        },
        {
          preset_id: "health_med_spa_aesthetic",
          name: "Medical Spas & Aesthetics",
          industry: "Healthcare & Medical",
          sub_industry: "Aesthetic Medicine",
          description: "Clinics offering Botox, dermal fillers, laser skin resurfacing, and body contouring.",
          primary_keywords: ["med spa", "botox clinic", "laser hair removal"],
          secondary_keywords: ["dermal fillers", "body contouring", "skin rejuvenation clinic"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["MedSpa", "Aesthetic Clinic", "Cosmetic Dermatology"]
        },
        {
          preset_id: "health_mental_telehealth",
          name: "Mental Health & Teletherapy",
          industry: "Healthcare & Medical",
          sub_industry: "Mental Health",
          description: "Private therapy practices, online counseling, and licensed mental health clinics.",
          primary_keywords: ["online therapy", "licensed counselor", "adhd assessment clinic"],
          secondary_keywords: ["couples therapy", "telehealth psychiatry", "anxiety counseling"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Therapy", "Telehealth", "Counseling", "Psychiatry"]
        },
        {
          preset_id: "health_veterinary_clinics",
          name: "Veterinary Hospitals & Clinics",
          industry: "Healthcare & Medical",
          sub_industry: "Veterinary Medicine",
          description: "Animal hospitals, urgent pet care, and companion animal veterinary clinics.",
          primary_keywords: ["veterinary hospital", "animal clinic", "emergency vet"],
          secondary_keywords: ["pet wellness exam", "vet surgery clinic", "canine care center"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Vet", "Animal Hospital", "Veterinarian"]
        },
        {
          preset_id: "health_optometry_eyecare",
          name: "Optometry & Eye Care Centers",
          industry: "Healthcare & Medical",
          sub_industry: "Vision Care",
          description: "Independent optometrists, LASIK eye surgery clinics, and designer optical boutiques.",
          primary_keywords: ["lasik eye surgery", "optometrist eye exam", "designer eyewear clinic"],
          secondary_keywords: ["cataract surgery center", "vision correction", "prescription glasses clinic"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Eye Clinic", "LASIK", "Optometrist"]
        },
        // ==========================================
        // 3. HOME SERVICES & TRADES
        // ==========================================
        {
          preset_id: "home_hvac_heating_cooling",
          name: "HVAC Installation & Repair",
          industry: "Home Services & Trades",
          sub_industry: "Climate Control",
          description: "Air conditioning, heat pump replacement, and furnace repair contractors.",
          primary_keywords: ["ac installation", "furnace replacement", "hvac repair contractor"],
          secondary_keywords: ["heat pump installation", "air conditioning service", "emergency hvac"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["HVAC", "Air Conditioning", "Heating", "Heat Pump"]
        },
        {
          preset_id: "home_roofing_contractors",
          name: "Roofing & Siding Contractors",
          industry: "Home Services & Trades",
          sub_industry: "Exterior Remodeling",
          description: "Commercial and residential roof replacement, hail damage repair, and gutter systems.",
          primary_keywords: ["roof replacement contractor", "roof repair company", "metal roofing"],
          secondary_keywords: ["storm damage roof inspection", "residential siding", "seamless gutters"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Roofing", "Roofers", "Siding Contractor"]
        },
        {
          preset_id: "home_solar_energy",
          name: "Solar Panel Installation & Batteries",
          industry: "Home Services & Trades",
          sub_industry: "Renewable Energy",
          description: "Residential solar power systems, battery backup storage, and commercial solar EPC.",
          primary_keywords: ["solar panel installation", "home battery backup", "commercial solar"],
          secondary_keywords: ["residential solar financing", "solar roof quote", "clean energy savings"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Solar", "Renewable Energy", "Solar Financing", "Solar Panels"]
        },
        {
          preset_id: "home_plumbing_water",
          name: "Plumbing & Water Filtration",
          industry: "Home Services & Trades",
          sub_industry: "Plumbing Systems",
          description: "Plumbing repairs, tankless water heater installation, and whole-house filtration.",
          primary_keywords: ["emergency plumber", "water heater replacement", "whole house water filter"],
          secondary_keywords: ["drain cleaning service", "tankless water heater", "sewer line repair"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Plumber", "Plumbing", "Water Heaters"]
        },
        {
          preset_id: "home_pest_control",
          name: "Pest & Termite Control",
          industry: "Home Services & Trades",
          sub_industry: "Pest Management",
          description: "Exterminator services, termite inspections, bed bug treatments, and rodent exclusion.",
          primary_keywords: ["pest control service", "termite inspection company", "bed bug treatment"],
          secondary_keywords: ["commercial exterminator", "rodent control", "mosquito defense program"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Pest Control", "Exterminator", "Termite Control"]
        },
        // ==========================================
        // 4. FINANCIAL SERVICES
        // ==========================================
        {
          preset_id: "fin_commercial_lending",
          name: "Commercial & Business Lending",
          industry: "Financial Services",
          sub_industry: "Commercial Financing",
          description: "Equipment financing, working capital lines of credit, and SBA commercial loans.",
          primary_keywords: ["business loan", "equipment financing", "working capital line of credit"],
          secondary_keywords: ["sba loan broker", "commercial mortgage financing", "invoice factoring"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Business Loans", "Commercial Lending", "Equipment Lease"]
        },
        {
          preset_id: "fin_wealth_management",
          name: "Wealth Advisory & Financial Planning",
          industry: "Financial Services",
          sub_industry: "Wealth Advisory",
          description: "Fiduciary financial advisors, retirement planners, and high-net-worth wealth managers.",
          primary_keywords: ["wealth management firm", "fiduciary financial advisor", "retirement planning"],
          secondary_keywords: ["estate planning advisory", "high net worth wealth planner", "portfolio management"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Wealth Advisor", "Financial Planner", "RIA"]
        },
        {
          preset_id: "fin_tax_accounting_cpa",
          name: "Tax Advisory & CPA Firms",
          industry: "Financial Services",
          sub_industry: "Tax & Accounting",
          description: "Certified public accountants, corporate tax prep, audit, and outsourced bookkeeping.",
          primary_keywords: ["cpa firm", "corporate tax advisory", "outsourced bookkeeping services"],
          secondary_keywords: ["tax resolution specialist", "fractional cfo services", "business tax preparation"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["CPA", "Tax Prep", "Bookkeeping", "Accounting Firm"]
        },
        {
          preset_id: "fin_business_insurance",
          name: "Commercial & Business Insurance",
          industry: "Financial Services",
          sub_industry: "Commercial Insurance",
          description: "General liability, cyber insurance, commercial auto, and workers compensation.",
          primary_keywords: ["commercial insurance broker", "general liability insurance", "workers comp insurance"],
          secondary_keywords: ["cyber liability insurance", "errors and omissions policy", "business owners policy"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Commercial Insurance", "Business Insurance", "BOP"]
        },
        // ==========================================
        // 5. REAL ESTATE & PROPERTY
        // ==========================================
        {
          preset_id: "real_commercial_brokerage",
          name: "Commercial Real Estate Brokerages",
          industry: "Real Estate & Property",
          sub_industry: "Commercial Properties",
          description: "Office, retail, and industrial leasing brokers, triple-net investment advisors.",
          primary_keywords: ["commercial real estate broker", "industrial warehouse lease", "office space leasing"],
          secondary_keywords: ["retail space commercial lease", "nnn investment properties", "commercial property sales"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["CRE", "Commercial Real Estate", "Warehouse Lease"]
        },
        {
          preset_id: "real_property_management",
          name: "Property Management Companies",
          industry: "Real Estate & Property",
          sub_industry: "Asset Management",
          description: "Multifamily residential management, HOA management, and commercial property care.",
          primary_keywords: ["property management company", "hoa management services", "multifamily property manager"],
          secondary_keywords: ["rental property management", "commercial asset management", "tenant placement agency"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Property Manager", "HOA Management", "Rental Management"]
        },
        {
          preset_id: "real_luxury_brokerages",
          name: "Luxury Residential Real Estate",
          industry: "Real Estate & Property",
          sub_industry: "Residential Brokerage",
          description: "High-end home brokerages, luxury estate specialists, and waterfront property realtors.",
          primary_keywords: ["luxury real estate agent", "waterfront homes for sale", "luxury estate brokerage"],
          secondary_keywords: ["custom home realtor", "high end listing agent", "gated community homes"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Luxury Realtor", "Real Estate Agent", "Residential Brokerage"]
        },
        // ==========================================
        // 6. PROFESSIONAL & BUSINESS SERVICES
        // ==========================================
        {
          preset_id: "prof_growth_marketing_agencies",
          name: "B2B Digital Marketing Agencies",
          industry: "Professional Services",
          sub_industry: "Digital Marketing",
          description: "Performance advertising, SEO agencies, conversion rate optimization, and brand studios.",
          primary_keywords: ["b2b marketing agency", "performance marketing firm", "seo agency services"],
          secondary_keywords: ["paid social advertising agency", "lead generation agency", "b2b content studio"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Marketing Agency", "Growth Agency", "SEO Agency", "Lead Gen Agency"]
        },
        {
          preset_id: "prof_it_managed_services",
          name: "Managed IT Services (MSP)",
          industry: "Professional Services",
          sub_industry: "IT Consulting",
          description: "Outsourced IT helpdesk, network administration, cloud migrations, and MSP support.",
          primary_keywords: ["managed it services", "msp it provider", "it support company"],
          secondary_keywords: ["outsourced it helpdesk", "business network security", "cloud migration consultant"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["MSP", "Managed IT", "IT Helpdesk", "IT Support"]
        },
        {
          preset_id: "prof_legal_corporate_law",
          name: "Corporate & Business Law Firms",
          industry: "Professional Services",
          sub_industry: "Legal Services",
          description: "M&A legal counsel, intellectual property attorneys, and corporate formation lawyers.",
          primary_keywords: ["corporate law firm", "business litigation attorney", "intellectual property lawyer"],
          secondary_keywords: ["m&a legal advisory", "trademark attorney", "employment law firm"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Law Firm", "Corporate Attorney", "Business Lawyer"]
        },
        {
          preset_id: "prof_executive_search_staffing",
          name: "Executive Search & Staffing Agencies",
          industry: "Professional Services",
          sub_industry: "Staffing & Recruiting",
          description: "Retained executive search, technical recruitment, and healthcare staffing agencies.",
          primary_keywords: ["executive search firm", "technical staffing agency", "recruiting agency"],
          secondary_keywords: ["retained executive recruiter", "locum tenens healthcare staffing", "it recruitment firm"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Recruiter", "Staffing Agency", "Headhunter", "Executive Search"]
        },
        // ==========================================
        // 7. MANUFACTURING & INDUSTRIAL
        // ==========================================
        {
          preset_id: "mfg_contract_cnc_machining",
          name: "Precision CNC Machining & Fabrication",
          industry: "Manufacturing & Industrial",
          sub_industry: "Metal Fabrication",
          description: "Custom CNC milling, precision sheet metal fabrication, and contract manufacturing.",
          primary_keywords: ["cnc machining services", "precision sheet metal fabrication", "custom contract manufacturing"],
          secondary_keywords: ["5-axis cnc milling", "rapid prototyping parts", "laser cutting services"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["CNC Machining", "Fabrication", "Metal Stamping"]
        },
        {
          preset_id: "mfg_industrial_automation",
          name: "Industrial Automation & Robotics",
          industry: "Manufacturing & Industrial",
          sub_industry: "Factory Automation",
          description: "PLC programming, robotic arm integration, machine vision, and SCADA systems.",
          primary_keywords: ["industrial automation integrator", "robotics system integrator", "plc programming services"],
          secondary_keywords: ["machine vision inspection", "automated conveyor systems", "scada engineering"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Industrial Automation", "Robotics Integrator", "PLC"]
        },
        {
          preset_id: "mfg_packaging_corrugated",
          name: "Custom Packaging & Box Manufacturers",
          industry: "Manufacturing & Industrial",
          sub_industry: "Packaging Solutions",
          description: "Corrugated mailer boxes, folding cartons, luxury rigid boxes, and sustainable packaging.",
          primary_keywords: ["custom corrugated boxes", "folding carton manufacturer", "custom printed packaging"],
          secondary_keywords: ["rigid gift box supplier", "sustainable packaging company", "protective foam inserts"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Packaging", "Custom Boxes", "Corrugated"]
        },
        // ==========================================
        // 8. LOGISTICS & TRANSPORTATION
        // ==========================================
        {
          preset_id: "logistics_3pl_freight",
          name: "Third-Party Logistics (3PL) & Freight",
          industry: "Transportation & Logistics",
          sub_industry: "Freight & Fulfillment",
          description: "E-commerce fulfillment centers, freight forwarding, cold storage, and intermodal transport.",
          primary_keywords: ["3pl fulfillment warehouse", "freight brokerage company", "intermodal transportation"],
          secondary_keywords: ["cold chain storage warehouse", "ecommerce pick and pack", "ltl freight shipping"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["3PL", "Freight Broker", "Warehousing", "Fulfillment"]
        },
        {
          preset_id: "logistics_fleet_telematics",
          name: "Fleet Telematics & GPS Tracking",
          industry: "Transportation & Logistics",
          sub_industry: "Fleet Technology",
          description: "Commercial fleet management software, ELD compliance, and dashcam safety systems.",
          primary_keywords: ["fleet telematics software", "eld compliance system", "fleet dash cam safety"],
          secondary_keywords: ["gps fleet tracking", "driver safety monitoring", "fuel management system"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Fleet Management", "Telematics", "GPS Tracking"]
        },
        // ==========================================
        // 9. EDUCATION & TRAINING
        // ==========================================
        {
          preset_id: "edu_corporate_compliance_training",
          name: "Corporate Training & Leadership Development",
          industry: "Education & Training",
          sub_industry: "Corporate Education",
          description: "Executive coaching programs, enterprise compliance e-learning, and sales bootcamps.",
          primary_keywords: ["executive leadership coaching", "corporate compliance training", "sales training program"],
          secondary_keywords: ["enterprise lms content", "management training workshop", "workplace diversity training"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Corporate Training", "Executive Coaching", "Leadership Training"]
        },
        {
          preset_id: "edu_certifications_bootcamps",
          name: "Professional Certifications & Bootcamps",
          industry: "Education & Training",
          sub_industry: "Professional Skills",
          description: "Coding bootcamps, cybersecurity certification courses, and PMP credential prep.",
          primary_keywords: ["coding bootcamp", "cybersecurity certification training", "pmp exam prep course"],
          secondary_keywords: ["data analytics bootcamp", "cloud engineer certification", "tech career training"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Bootcamp", "Certification Prep", "Coding School"]
        },
        // ==========================================
        // 10. RETAIL & E-COMMERCE
        // ==========================================
        {
          preset_id: "retail_dtc_apparel_fashion",
          name: "Direct-to-Consumer (DTC) Fashion Brands",
          industry: "Retail & E-commerce",
          sub_industry: "Apparel & Accessories",
          description: "Independent apparel brands, sustainable activewear, and designer accessories.",
          primary_keywords: ["sustainable activewear", "custom leather goods", "luxury streetwear brand"],
          secondary_keywords: ["dtc apparel brand", "bamboo clothing", "minimalist watches brand"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["DTC Apparel", "Fashion Brand", "Activewear"]
        },
        {
          preset_id: "retail_subscription_box",
          name: "Subscription Commerce & Box Services",
          industry: "Retail & E-commerce",
          sub_industry: "Subscription Goods",
          description: "Curated monthly subscription boxes for coffee, grooming, pet supplies, and snacks.",
          primary_keywords: ["monthly subscription box", "curated coffee subscription", "pet supply subscription"],
          secondary_keywords: ["grooming subscription box", "artisan snack box", "membership club delivery"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Subscription Box", "SubBox", "Subscription Club"]
        },
        // ==========================================
        // 11. AUTOMOTIVE
        // ==========================================
        {
          preset_id: "auto_fleet_commercial_leasing",
          name: "Commercial Fleet Leasing & Vans",
          industry: "Automotive",
          sub_industry: "Commercial Fleet",
          description: "Work truck upfitting, commercial cargo van leasing, and enterprise fleet acquisition.",
          primary_keywords: ["commercial van leasing", "work truck upfitting", "commercial vehicle fleet sales"],
          secondary_keywords: ["cargo van fleet financing", "box truck lease", "utility truck body builder"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Fleet Leasing", "Commercial Vans", "Work Trucks"]
        },
        {
          preset_id: "auto_collision_repair_centers",
          name: "Auto Collision & Body Repair Centers",
          industry: "Automotive",
          sub_industry: "Vehicle Repair",
          description: "Certified collision repair shops, paintless dent repair, and auto body restoration.",
          primary_keywords: ["collision repair center", "auto body shop repair", "paintless dent removal"],
          secondary_keywords: ["certified collision center", "car paint restoration", "bumper repair service"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Auto Body", "Collision Repair", "Dent Repair"]
        },
        // ==========================================
        // 12. CLEANING & FACILITIES MANAGEMENT
        // ==========================================
        {
          preset_id: "clean_commercial_janitorial",
          name: "Commercial Janitorial & Office Cleaning",
          industry: "Cleaning & Facilities",
          sub_industry: "Janitorial Services",
          description: "Nightly office cleaning, commercial floor waxing, medical facility disinfection.",
          primary_keywords: ["commercial janitorial service", "office cleaning company", "medical facility cleaning"],
          secondary_keywords: ["commercial floor strip and wax", "post construction cleaning", "industrial cleaning contractor"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Janitorial", "Office Cleaning", "Commercial Cleaning"]
        },
        {
          preset_id: "clean_disaster_restoration",
          name: "Water & Fire Disaster Restoration",
          industry: "Cleaning & Facilities",
          sub_industry: "Disaster Restoration",
          description: "Emergency water extraction, smoke and fire cleanup, and certified mold remediation.",
          primary_keywords: ["water damage restoration company", "fire damage cleanup", "mold remediation contractor"],
          secondary_keywords: ["emergency water extraction", "sewage backup cleanup", "structural drying service"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Restoration", "Water Damage", "Mold Remediation"]
        },
        // ==========================================
        // 13. SECURITY SERVICES
        // ==========================================
        {
          preset_id: "sec_commercial_surveillance_alarms",
          name: "Commercial Surveillance & Access Control",
          industry: "Security Services",
          sub_industry: "Physical Security",
          description: "Security camera installation, keycard access control systems, and commercial burglar alarms.",
          primary_keywords: ["commercial security camera installation", "access control systems", "commercial burglar alarm"],
          secondary_keywords: ["cctv surveillance installer", "cloud video surveillance", "keycard door lock installation"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Security Cameras", "Access Control", "Commercial Alarm"]
        },
        // ==========================================
        // 14. FITNESS & WELLNESS
        // ==========================================
        {
          preset_id: "fit_boutique_studios",
          name: "Boutique Fitness & Pilates Studios",
          industry: "Fitness & Wellness",
          sub_industry: "Fitness Centers",
          description: "Reformer Pilates studios, HIIT training clubs, and boutique fitness franchises.",
          primary_keywords: ["reformer pilates studio", "boutique fitness club", "hiit group fitness"],
          secondary_keywords: ["hot yoga studio", "strength training gym membership", "spin cycling studio"],
          default_location_behavior: { defaultLocationCode: "US", allowsGlobal: true },
          website_required: true,
          default_result_limit: 50,
          version: "v2.1.0",
          status: "ACTIVE",
          aliases: ["Pilates", "Gym", "Fitness Studio", "HIIT"]
        }
      ];
    }
  });

  // src/extension/evidenceWaterfall.ts
  var evidenceWaterfall_exports = {};
  __export(evidenceWaterfall_exports, {
    RELEVANCE_ENGINE_VERSION_V3: () => RELEVANCE_ENGINE_VERSION_V3,
    RELEVANCE_STRATEGY_VERSION_V3: () => RELEVANCE_STRATEGY_VERSION_V3,
    buildUncertainRecord: () => buildUncertainRecord,
    calculateEvidenceCoverage: () => calculateEvidenceCoverage,
    collectEvidenceWaterfall: () => collectEvidenceWaterfall,
    createEntityEvidenceProfile: () => createEntityEvidenceProfile,
    createEvidenceSignature: () => createEvidenceSignature,
    evaluateStrictRelevanceV3: () => evaluateStrictRelevanceV3,
    integrateWebsiteVerificationEvidence: () => integrateWebsiteVerificationEvidence,
    recordCandidateEvidenceInProfile: () => recordCandidateEvidenceInProfile
  });
  function createEvidenceSignature(type, source, strength, value) {
    const normVal = (value || "").toLowerCase().trim().replace(/\s+/g, " ");
    return `${type}::${source}::${strength}::${normVal}`;
  }
  function createEntityEvidenceProfile(entityKey, advertiserName = "", canonicalName) {
    const safeName = advertiserName || "";
    return {
      entityKey,
      advertiserName: safeName,
      canonicalName: canonicalName || safeName,
      uniqueEvidenceMap: /* @__PURE__ */ new Map(),
      observedEvidenceOccurrences: 0,
      distinctAdCopyHashes: /* @__PURE__ */ new Set(),
      distinctAdCount: 0,
      matchedQueries: /* @__PURE__ */ new Set(),
      observedDomains: /* @__PURE__ */ new Set(),
      observedPages: /* @__PURE__ */ new Set(),
      observedDestinationUrls: /* @__PURE__ */ new Set(),
      conflicts: [],
      negativeSignals: []
    };
  }
  function collectEvidenceWaterfall(evidence, intent) {
    const evidenceList = [];
    const conflicts = [];
    const negativeSignals = [];
    const normalized = normalizeEvidence(evidence);
    const allQueryPhrases = [];
    if (evidence.query) allQueryPhrases.push(evidence.query.toLowerCase().trim());
    if (evidence.matchedKeyword) allQueryPhrases.push(evidence.matchedKeyword.toLowerCase().trim());
    if (intent.primaryKeywords) {
      for (const kw of intent.primaryKeywords) {
        const l = kw.toLowerCase().trim();
        if (!allQueryPhrases.includes(l)) allQueryPhrases.push(l);
      }
    }
    const activeTaxonomies = [];
    for (const [key, tax] of Object.entries(BOUNDED_TAXONOMY)) {
      if (allQueryPhrases.some(
        (phrase) => phrase.includes(key) || key.includes(phrase) || tax.rootTerms.some((rt) => phrase.includes(rt) || rt.includes(phrase)) || tax.productServiceTerms.some((pt) => phrase === pt || phrase.includes(pt) || pt.includes(phrase)) || tax.industryDescriptors.some((id) => phrase.includes(id) || id.includes(phrase))
      )) {
        activeTaxonomies.push(tax);
      }
    }
    if (activeTaxonomies.length === 0 && allQueryPhrases.length > 0) {
      const dynamicRoots = [];
      const dynamicStems = [];
      for (const phrase of allQueryPhrases) {
        dynamicRoots.push(phrase);
        for (const tok of tokenizeText(phrase)) {
          dynamicStems.push(tok);
        }
      }
      activeTaxonomies.push({
        category: allQueryPhrases[0],
        rootTerms: Array.from(new Set(dynamicRoots)),
        productServiceTerms: Array.from(new Set(dynamicStems)),
        industryDescriptors: allQueryPhrases,
        conflictingCategories: ["sports", "healthcare", "politics", "gaming", "casino"]
      });
    }
    const coreQueryTokens = /* @__PURE__ */ new Set();
    for (const phrase of allQueryPhrases) {
      for (const t of tokenizeText(phrase)) {
        coreQueryTokens.add(t);
      }
    }
    for (const tax of activeTaxonomies) {
      for (const rt of tax.rootTerms) {
        for (const t of tokenizeText(rt)) {
          coreQueryTokens.add(t);
        }
      }
    }
    const productTerms = /* @__PURE__ */ new Set();
    for (const tax of activeTaxonomies) {
      for (const t of tax.productServiceTerms) {
        productTerms.add(stemToken(t));
      }
    }
    if (intent.exclusions && intent.exclusions.length > 0) {
      for (const excl of intent.exclusions) {
        const exclLower = excl.toLowerCase();
        if (normalized.advertiserText.includes(exclLower) || normalized.adCopyText.includes(exclLower) || normalized.normalizedDomain.includes(exclLower)) {
          const reason = `Matched preset exclusion rule: "${excl}"`;
          negativeSignals.push(reason);
          conflicts.push({
            type: "CONTRADICTION",
            strength: "STRONG",
            source: "advertiser_name",
            reason,
            matchedSignal: excl,
            reasonCode: "REJECT_PRESET_EXCLUSION",
            value: excl,
            explanation: `Candidate matches explicit preset exclusion rule: ${excl}`,
            signature: createEvidenceSignature("CONTRADICTION", "advertiser_name", "STRONG", excl)
          });
          break;
        }
      }
    }
    for (const negCat of NEGATIVE_CATEGORIES) {
      const isQueryRelatedToNegCat = allQueryPhrases.some(
        (q) => negCat.terms.some((t) => q.includes(t)) || q.includes(negCat.category) || negCat.category === "sports" && (q.includes("football") || q.includes("cricket") || q.includes("sports"))
      );
      if (isQueryRelatedToNegCat) continue;
      let entityContradictionTerm;
      for (const term of negCat.terms) {
        if (normalized.advertiserText.includes(term) || normalized.normalizedDomain.includes(term.replace(/\s+/g, ""))) {
          entityContradictionTerm = term;
          break;
        }
      }
      if (entityContradictionTerm) {
        const reason = `Advertiser entity identity belongs to unrelated category (${negCat.category}): "${entityContradictionTerm}"`;
        negativeSignals.push(reason);
        conflicts.push({
          type: "CONTRADICTION",
          strength: "STRONG",
          source: "advertiser_name",
          reason,
          matchedSignal: entityContradictionTerm,
          reasonCode: "REJECT_CONTRADICTION_IDENTITY",
          value: entityContradictionTerm,
          explanation: `Advertiser belongs to conflicting ${negCat.category} vertical`,
          signature: createEvidenceSignature("CONTRADICTION", "advertiser_name", "STRONG", entityContradictionTerm)
        });
        continue;
      }
      for (const term of negCat.terms) {
        if (normalized.adCopyText.includes(term) || normalized.normalizedDomain.includes(term.replace(/\s+/g, ""))) {
          const reason = `Unrelated ${negCat.category} signal detected in candidate ad context: "${term}"`;
          negativeSignals.push(reason);
          conflicts.push({
            type: "NEGATIVE_CATEGORY",
            strength: "STRONG",
            source: "ad_text",
            reason,
            matchedSignal: term,
            reasonCode: "REJECT_CONFLICT",
            value: term,
            explanation: `Context contains conflicting ${negCat.category} terms`,
            signature: createEvidenceSignature("NEGATIVE_CATEGORY", "ad_text", "STRONG", term)
          });
          break;
        }
      }
    }
    let strongNameFound = false;
    const hasCoreVerticalInName = activeTaxonomies.some(
      (tax) => tax.rootTerms.some((rt) => normalized.advertiserText.includes(rt)) || tax.industryDescriptors.some((id) => normalized.advertiserText.includes(id))
    );
    for (const phrase of allQueryPhrases) {
      if (normalized.advertiserText.includes(phrase)) {
        strongNameFound = true;
        if (hasCoreVerticalInName) {
          evidenceList.push({
            type: "ENTITY_IDENTITY",
            strength: "STRONG",
            source: "advertiser_name",
            reason: `Advertiser name explicitly contains target category query "${phrase}"`,
            matchedSignal: phrase,
            reasonCode: "SIGNAL_ENTITY_NAME_EXACT",
            value: phrase,
            explanation: `Business name explicitly specifies target category: ${phrase}`,
            signature: createEvidenceSignature("ENTITY_IDENTITY", "advertiser_name", "STRONG", phrase)
          });
        } else {
          evidenceList.push({
            type: "ENTITY_IDENTITY",
            strength: "MODERATE",
            source: "advertiser_name",
            reason: `Advertiser name mentions target product term "${phrase}"`,
            matchedSignal: phrase,
            reasonCode: "SIGNAL_ENTITY_NAME_PRODUCT",
            value: phrase,
            explanation: `Business name mentions product term without core vertical descriptor: ${phrase}`,
            signature: createEvidenceSignature("ENTITY_IDENTITY", "advertiser_name", "MODERATE", phrase)
          });
        }
        break;
      }
    }
    if (!strongNameFound) {
      const matchedTokensInName = normalized.normalizedAdvertiserTokens.filter((t) => coreQueryTokens.has(t));
      if (matchedTokensInName.length > 0) {
        strongNameFound = true;
        const val = matchedTokensInName.join(", ");
        evidenceList.push({
          type: "ENTITY_IDENTITY",
          strength: "STRONG",
          source: "advertiser_name",
          reason: `Advertiser name contains core target keyword stem(s): ${val}`,
          matchedSignal: val,
          reasonCode: "SIGNAL_ENTITY_NAME_CORE",
          value: val,
          explanation: `Business name contains core keyword stem(s): ${val}`,
          signature: createEvidenceSignature("ENTITY_IDENTITY", "advertiser_name", "STRONG", val)
        });
      } else {
        const productTokensInName = normalized.normalizedAdvertiserTokens.filter((t) => productTerms.has(t));
        const matchedSubstringProduct = Array.from(productTerms).filter(
          (pt) => pt.length >= 4 && normalized.advertiserText.includes(pt)
        );
        const combined = Array.from(/* @__PURE__ */ new Set([...productTokensInName, ...matchedSubstringProduct]));
        if (combined.length > 0) {
          const val = combined.join(", ");
          evidenceList.push({
            type: "ENTITY_IDENTITY",
            strength: "MODERATE",
            source: "advertiser_name",
            reason: `Advertiser name contains target product term(s): ${val}`,
            matchedSignal: val,
            reasonCode: "SIGNAL_ENTITY_NAME_PRODUCT",
            value: val,
            explanation: `Business name contains relevant product or service terms: ${val}`,
            signature: createEvidenceSignature("ENTITY_IDENTITY", "advertiser_name", "MODERATE", val)
          });
        }
      }
    }
    if (normalized.normalizedDomain) {
      const domainHasQuery = allQueryPhrases.some(
        (p) => normalized.normalizedDomain.includes(p.replace(/\s+/g, ""))
      );
      const domainHasProduct = Array.from(productTerms).some(
        (t) => t.length >= 4 && normalized.normalizedDomain.includes(t)
      );
      if (domainHasQuery) {
        evidenceList.push({
          type: "DESTINATION_MATCH",
          strength: "STRONG",
          source: "destination_domain",
          reason: `Destination domain "${normalized.normalizedDomain}" explicitly contains target query`,
          matchedSignal: normalized.normalizedDomain,
          reasonCode: "SIGNAL_DOMAIN_QUERY_EXACT",
          value: normalized.normalizedDomain,
          explanation: `Destination website domain matches target query`,
          signature: createEvidenceSignature("DESTINATION_MATCH", "destination_domain", "STRONG", normalized.normalizedDomain)
        });
      } else if (domainHasProduct) {
        evidenceList.push({
          type: "DOMAIN_SIGNAL",
          strength: "MODERATE",
          source: "destination_domain",
          reason: `Destination domain "${normalized.normalizedDomain}" contains category product term`,
          matchedSignal: normalized.normalizedDomain,
          reasonCode: "SIGNAL_DOMAIN_PRODUCT",
          value: normalized.normalizedDomain,
          explanation: `Destination website domain includes category product term`,
          signature: createEvidenceSignature("DOMAIN_SIGNAL", "destination_domain", "MODERATE", normalized.normalizedDomain)
        });
      }
    }
    if (evidence.facebookPageUrl) {
      const pageUrlLower = evidence.facebookPageUrl.toLowerCase();
      const pageHasQuery = allQueryPhrases.some((p) => pageUrlLower.includes(p.replace(/\s+/g, "")));
      if (pageHasQuery) {
        evidenceList.push({
          type: "FACEBOOK_PAGE_SIGNAL",
          strength: "MODERATE",
          source: "facebook_page",
          reason: `Facebook Page handle/URL reinforces target category identity`,
          matchedSignal: evidence.facebookPageUrl,
          reasonCode: "SIGNAL_PAGE_HANDLE",
          value: evidence.facebookPageUrl,
          explanation: `Facebook page handle reinforces category identity`,
          signature: createEvidenceSignature("FACEBOOK_PAGE_SIGNAL", "facebook_page", "MODERATE", evidence.facebookPageUrl)
        });
      }
    }
    let adCopyMatchedPhrase = false;
    for (const phrase of allQueryPhrases) {
      if (normalized.adCopyText.includes(phrase)) {
        adCopyMatchedPhrase = true;
        evidenceList.push({
          type: "CATEGORY_MATCH",
          strength: "MODERATE",
          source: "ad_text",
          reason: `Ad copy directly mentions target query "${phrase}"`,
          matchedSignal: phrase,
          reasonCode: "SIGNAL_COPY_PHRASE",
          value: phrase,
          explanation: `Ad copy explicitly mentions target query phrase`,
          signature: createEvidenceSignature("CATEGORY_MATCH", "ad_text", "MODERATE", phrase)
        });
        break;
      }
    }
    const foundProductTermsInCopy = Array.from(productTerms).filter(
      (t) => normalized.normalizedAdTextTokens.includes(t) || t.length >= 4 && normalized.adCopyText.includes(t)
    );
    if (foundProductTermsInCopy.length > 0) {
      const sampleTerms = foundProductTermsInCopy.slice(0, 5);
      const val = sampleTerms.join(", ");
      if (foundProductTermsInCopy.length >= 2) {
        evidenceList.push({
          type: "PRODUCT_OR_SERVICE_SIGNAL",
          strength: "STRONG",
          source: "ad_text",
          reason: `Ad copy contains specific category product catalog: ${val}`,
          matchedSignal: val,
          reasonCode: "SIGNAL_COPY_PRODUCT_CATALOG",
          value: val,
          explanation: `Ad offers multiple distinct category products: ${val}`,
          signature: createEvidenceSignature("PRODUCT_OR_SERVICE_SIGNAL", "ad_text", "STRONG", val)
        });
      } else {
        evidenceList.push({
          type: "PRODUCT_OR_SERVICE_SIGNAL",
          strength: "WEAK",
          source: "ad_text",
          reason: `Ad copy mentions category product term: ${sampleTerms[0]}`,
          matchedSignal: sampleTerms[0],
          reasonCode: "SIGNAL_COPY_SINGLE_PRODUCT",
          value: sampleTerms[0],
          explanation: `Ad mentions category product: ${sampleTerms[0]}`,
          signature: createEvidenceSignature("PRODUCT_OR_SERVICE_SIGNAL", "ad_text", "WEAK", sampleTerms[0])
        });
      }
    } else if (!adCopyMatchedPhrase) {
      const matchedTokensInCopy = normalized.normalizedAdTextTokens.filter((t) => coreQueryTokens.has(t));
      if (matchedTokensInCopy.length > 0) {
        const val = matchedTokensInCopy.join(", ");
        evidenceList.push({
          type: "CATEGORY_MATCH",
          strength: "WEAK",
          source: "ad_text",
          reason: `Ad copy mentions keyword stem(s): ${val}`,
          matchedSignal: val,
          reasonCode: "SIGNAL_COPY_STEM_ONLY",
          value: val,
          explanation: `Ad copy only contains isolated keyword stem`,
          signature: createEvidenceSignature("CATEGORY_MATCH", "ad_text", "WEAK", val)
        });
      }
    }
    if (normalized.normalizedUrlSlug) {
      const slugHasProduct = Array.from(productTerms).some(
        (t) => t.length >= 4 && normalized.normalizedUrlSlug.includes(t)
      );
      const slugHasQuery = Array.from(coreQueryTokens).some(
        (t) => normalized.normalizedUrlSlug.includes(t)
      );
      if (slugHasProduct || slugHasQuery) {
        evidenceList.push({
          type: "DESTINATION_MATCH",
          strength: "MODERATE",
          source: "destination_url",
          reason: `Destination URL path contains target product category context`,
          matchedSignal: normalized.normalizedUrlSlug.substring(0, 50),
          reasonCode: "SIGNAL_URL_SLUG_MATCH",
          value: normalized.normalizedUrlSlug.substring(0, 50),
          explanation: `Destination URL path contains target category terms`,
          signature: createEvidenceSignature("DESTINATION_MATCH", "destination_url", "MODERATE", normalized.normalizedUrlSlug.substring(0, 30))
        });
      }
    }
    const ctaLower = (evidence.ctaText || "").toLowerCase().trim();
    if (COMMERCIAL_CTA_PHRASES.has(ctaLower)) {
      evidenceList.push({
        type: "COMMERCIAL_INTENT",
        strength: "MODERATE",
        source: "cta_text",
        reason: `Commercial action call-to-action ("${evidence.ctaText}")`,
        matchedSignal: evidence.ctaText,
        reasonCode: "SIGNAL_COMMERCIAL_INTENT_CTA",
        value: evidence.ctaText,
        explanation: `Commercial call-to-action detected: ${evidence.ctaText}`,
        signature: createEvidenceSignature("COMMERCIAL_INTENT", "cta_text", "MODERATE", ctaLower)
      });
    }
    if (COMMERCIAL_COPY_REGEX.test(normalized.adCopyText)) {
      evidenceList.push({
        type: "COMMERCIAL_INTENT",
        strength: "MODERATE",
        source: "ad_text",
        reason: `Commercial pricing, transaction, or sale language observed in ad copy`,
        reasonCode: "SIGNAL_COMMERCIAL_INTENT_PRICE",
        value: "pricing_or_offer_terms",
        explanation: `Commercial pricing, discount, or offer terms found in ad copy`,
        signature: createEvidenceSignature("COMMERCIAL_INTENT", "ad_text", "MODERATE", "pricing_or_offer_terms")
      });
    }
    if (evidence.matchedKeyword || evidence.query) {
      const q = (evidence.matchedKeyword || evidence.query || "").trim();
      evidenceList.push({
        type: "QUERY_CONTEXT",
        strength: "WEAK",
        source: "matched_query",
        reason: `Discovered under query "${q}"`,
        matchedSignal: q,
        reasonCode: "SIGNAL_QUERY_PROVENANCE",
        value: q,
        explanation: `Candidate surfaced by query: ${q}`,
        signature: createEvidenceSignature("QUERY_CONTEXT", "matched_query", "WEAK", q.toLowerCase())
      });
    }
    return { evidenceList, conflicts, negativeSignals };
  }
  function calculateEvidenceCoverage(evidenceItems) {
    const APPLICABLE_CATEGORIES = [
      "ENTITY_IDENTITY",
      "CATEGORY_MATCH",
      "COMMERCIAL_INTENT",
      "PRODUCT_OR_SERVICE_SIGNAL",
      "DESTINATION_MATCH",
      "FACEBOOK_PAGE_SIGNAL",
      "DOMAIN_SIGNAL"
    ];
    const presentCategories = Array.from(
      new Set(evidenceItems.map((e) => e.type).filter((t) => APPLICABLE_CATEGORIES.includes(t)))
    );
    const missingCategories = APPLICABLE_CATEGORIES.filter((c) => !presentCategories.includes(c));
    const applicableCategoriesPresent = presentCategories.length;
    const applicableCategoriesTotal = APPLICABLE_CATEGORIES.length;
    const coverageRatio = Math.round(applicableCategoriesPresent / applicableCategoriesTotal * 100) / 100;
    let coverageLevel = "LOW";
    if (applicableCategoriesPresent >= 4) {
      coverageLevel = "HIGH";
    } else if (applicableCategoriesPresent >= 2) {
      coverageLevel = "MEDIUM";
    }
    return {
      applicableCategoriesPresent,
      applicableCategoriesTotal,
      coverageRatio,
      coverageLevel,
      presentCategories,
      missingCategories
    };
  }
  function recordCandidateEvidenceInProfile(profile, evidence, intent) {
    const { evidenceList, conflicts, negativeSignals } = collectEvidenceWaterfall(evidence, intent);
    for (const c of conflicts) {
      if (!profile.conflicts.some((ex) => ex.signature === c.signature)) {
        profile.conflicts.push(c);
      }
    }
    for (const sig of negativeSignals) {
      if (!profile.negativeSignals.includes(sig)) {
        profile.negativeSignals.push(sig);
      }
    }
    const copyNormalized = (evidence.adText || "").toLowerCase().trim().replace(/\s+/g, " ").substring(0, 120);
    if (copyNormalized) {
      profile.distinctAdCopyHashes.add(copyNormalized);
    }
    profile.distinctAdCount++;
    if (evidence.matchedKeyword) profile.matchedQueries.add(evidence.matchedKeyword);
    if (evidence.query) profile.matchedQueries.add(evidence.query);
    if (evidence.destinationDomain) profile.observedDomains.add(evidence.destinationDomain);
    if (evidence.destinationUrl) profile.observedDestinationUrls.add(evidence.destinationUrl);
    if (evidence.facebookPageUrl) profile.observedPages.add(evidence.facebookPageUrl);
    for (const item of evidenceList) {
      profile.observedEvidenceOccurrences++;
      const sig = item.signature || createEvidenceSignature(item.type, item.source, item.strength, item.value || item.reason);
      const existing = profile.uniqueEvidenceMap.get(sig);
      if (existing) {
        existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      } else {
        profile.uniqueEvidenceMap.set(sig, {
          ...item,
          signature: sig,
          occurrenceCount: 1
        });
      }
    }
  }
  function evaluateStrictRelevanceV3(candidateOrProfile, intent) {
    let profile;
    if ("uniqueEvidenceMap" in candidateOrProfile) {
      profile = candidateOrProfile;
    } else {
      profile = createEntityEvidenceProfile("cand", candidateOrProfile.advertiserName || "");
      recordCandidateEvidenceInProfile(profile, candidateOrProfile, intent);
    }
    const candEvidence = {
      advertiserName: profile.advertiserName,
      adText: Array.from(profile.distinctAdCopyHashes).join(" "),
      destinationDomain: Array.from(profile.observedDomains)[0],
      destinationUrl: Array.from(profile.observedDestinationUrls)[0],
      facebookPageUrl: Array.from(profile.observedPages)[0],
      matchedKeyword: Array.from(profile.matchedQueries)[0]
    };
    const v2Eval = LeadRelevanceEngine.evaluateCandidate(candEvidence, intent);
    const evidenceItems = Array.from(profile.uniqueEvidenceMap.values());
    const coverage = calculateEvidenceCoverage(evidenceItems);
    const hasHardContradiction = profile.conflicts.some(
      (c) => (c.type === "CONTRADICTION" || c.type === "NEGATIVE_CATEGORY") && c.strength === "STRONG"
    ) || v2Eval.conflicts.some((c) => c.type === "CONTRADICTION" && c.strength === "STRONG");
    const strongEntity = evidenceItems.some(
      (e) => e.type === "ENTITY_IDENTITY" && e.strength === "STRONG"
    );
    const moderateEntity = evidenceItems.some(
      (e) => e.type === "ENTITY_IDENTITY" && e.strength === "MODERATE"
    );
    const strongCategory = evidenceItems.some(
      (e) => (e.type === "CATEGORY_MATCH" || e.type === "PRODUCT_OR_SERVICE_SIGNAL") && e.strength === "STRONG"
    );
    const moderateCategory = evidenceItems.some(
      (e) => (e.type === "CATEGORY_MATCH" || e.type === "PRODUCT_OR_SERVICE_SIGNAL") && e.strength === "MODERATE"
    );
    const weakCategory = evidenceItems.some(
      (e) => e.type === "CATEGORY_MATCH" && e.strength === "WEAK"
    );
    const commercialIntent = evidenceItems.some(
      (e) => e.type === "COMMERCIAL_INTENT"
    );
    const strongDestination = evidenceItems.some(
      (e) => e.type === "DESTINATION_MATCH" && e.strength === "STRONG"
    );
    const moderateDestination = evidenceItems.some(
      (e) => (e.type === "DESTINATION_MATCH" || e.type === "DOMAIN_SIGNAL") && e.strength === "MODERATE"
    );
    let decision = "UNCERTAIN";
    let confidence = "LOW";
    let reasonCode = "UNCERTAIN_AMBIGUOUS_ENTITY";
    let explanation = "";
    const reasons = [];
    if (hasHardContradiction) {
      decision = "NOT_RELEVANT";
      confidence = "HIGH";
      reasonCode = profile.conflicts[0]?.reasonCode || v2Eval.reasonCode || "REJECT_CONTRADICTION_IDENTITY";
      const conflictDesc = profile.negativeSignals[0] || v2Eval.negativeSignals[0] || "Entity conflicts with requested category";
      reasons.push(`Disqualified by Hard Contradiction Gate: ${conflictDesc}`);
      explanation = `Advertiser entity conflicts with target category: ${conflictDesc}`;
      return {
        decision,
        confidence,
        score: 0.05,
        reasons,
        matchedKeywords: v2Eval.matchedKeywords,
        matchedTerms: v2Eval.matchedTerms,
        negativeSignals: profile.negativeSignals.length > 0 ? profile.negativeSignals : v2Eval.negativeSignals,
        evidence: evidenceItems,
        conflicts: profile.conflicts.length > 0 ? profile.conflicts : v2Eval.conflicts,
        evidenceCoverage: coverage,
        uniqueEvidenceSignals: evidenceItems.length,
        observedEvidenceOccurrences: profile.observedEvidenceOccurrences,
        explanation,
        reasonCode,
        strategyVersion: RELEVANCE_STRATEGY_VERSION_V3,
        engineVersion: RELEVANCE_ENGINE_VERSION_V3,
        presetVersion: intent.presetVersion
      };
    }
    const hasRootVerticalEntity = evidenceItems.some(
      (e) => e.type === "ENTITY_IDENTITY" && (e.reasonCode === "SIGNAL_ENTITY_NAME_EXACT" || e.reasonCode === "SIGNAL_ENTITY_NAME_CORE")
    );
    const isAccessoryOnly = ACCESSORY_ONLY_INDICATORS.some(
      (ind) => (profile.advertiserName || "").toLowerCase().includes(ind) || Array.from(profile.distinctAdCopyHashes).some((copy) => (copy || "").toLowerCase().includes(ind))
    ) && !hasRootVerticalEntity;
    if (isAccessoryOnly) {
      decision = "UNCERTAIN";
      confidence = "MEDIUM";
      reasonCode = "UNCERTAIN_ACCESSORY_ONLY";
      reasons.push("Candidate appears to offer furniture accessories/textiles rather than core furniture manufacturing or retail.");
      explanation = "Advertiser provides furniture accessories or slipcovers rather than primary furniture manufacturing or retail.";
      return {
        decision,
        confidence,
        score: 0.28,
        reasons,
        matchedKeywords: v2Eval.matchedKeywords,
        matchedTerms: v2Eval.matchedTerms,
        negativeSignals: profile.negativeSignals,
        evidence: evidenceItems,
        conflicts: profile.conflicts,
        evidenceCoverage: coverage,
        uniqueEvidenceSignals: evidenceItems.length,
        observedEvidenceOccurrences: profile.observedEvidenceOccurrences,
        explanation,
        reasonCode,
        strategyVersion: RELEVANCE_STRATEGY_VERSION_V3,
        engineVersion: RELEVANCE_ENGINE_VERSION_V3,
        presetVersion: intent.presetVersion
      };
    }
    const hasCategoryCorroboration = moderateCategory || strongCategory || strongDestination || moderateDestination;
    if (strongEntity && (hasCategoryCorroboration || hasRootVerticalEntity && commercialIntent)) {
      decision = "RELEVANT";
      confidence = strongCategory || coverage.coverageLevel === "HIGH" ? "HIGH" : "MEDIUM";
      reasonCode = "ACCEPT_STRONG_ENTITY_MATCH";
      reasons.push("Advertiser is confirmed as target business entity with supporting product/commercial evidence.");
      explanation = `Advertiser is identified as a ${intent.primaryKeywords?.[0] || "target"} business with supporting category evidence.`;
    } else if (strongCategory && (commercialIntent || strongDestination || moderateDestination || moderateEntity)) {
      decision = "RELEVANT";
      confidence = commercialIntent || strongDestination || moderateDestination ? "HIGH" : "MEDIUM";
      reasonCode = "ACCEPT_MULTI_SIGNAL_MATCH";
      reasons.push("Verified product/service catalog with corroborating commercial intent.");
      explanation = `Explicit product catalog and commercial intent confirm active business in target vertical.`;
    } else if (moderateEntity && (moderateCategory || strongCategory || hasRootVerticalEntity && strongDestination)) {
      decision = "RELEVANT";
      confidence = "MEDIUM";
      reasonCode = "ACCEPT_MULTI_SIGNAL_MATCH";
      reasons.push("Entity product terms corroborated by category evidence.");
      explanation = `Entity product branding corroborated by category match.`;
    } else if (!strongEntity && !moderateEntity && !strongDestination && !moderateDestination && !strongCategory) {
      if (weakCategory || moderateCategory) {
        if (v2Eval.score < 0.18) {
          decision = "NOT_RELEVANT";
          confidence = "HIGH";
          reasonCode = "REJECT_INSUFFICIENT_EVIDENCE";
          reasons.push("Keyword appears in passing but entity has zero commercial or vertical corroboration.");
          explanation = `Keyword appears in ad context, but advertiser lacks verified vertical identity.`;
        } else {
          decision = "UNCERTAIN";
          confidence = "LOW";
          reasonCode = "UNCERTAIN_KEYWORD_ONLY";
          reasons.push("Candidate mentions keyword but lacks independent business or product catalog evidence.");
          explanation = `Keyword mention detected, but advertiser business vertical is unverified.`;
        }
      } else {
        decision = "NOT_RELEVANT";
        confidence = "HIGH";
        reasonCode = "REJECT_CATEGORY_MISMATCH";
        reasons.push("Zero target category or commercial signals found.");
        explanation = `No entity identity, category, or commercial evidence observed for requested vertical.`;
      }
    } else {
      decision = "UNCERTAIN";
      confidence = "LOW";
      reasonCode = "UNCERTAIN_AMBIGUOUS_ENTITY";
      reasons.push("Candidate has partial signals but missing critical category or entity verification.");
      explanation = `Commercial advertiser detected, but vertical identity evidence is incomplete.`;
    }
    if (v2Eval.decision === "NOT_RELEVANT" && decision === "RELEVANT") {
      decision = "NOT_RELEVANT";
      confidence = v2Eval.confidence;
      reasonCode = v2Eval.reasonCode;
      reasons.unshift(`Strict-v2 safety lock: ${v2Eval.reasons[0] || "Score insufficient"}`);
    }
    const finalScore = Math.max(v2Eval.score, decision === "RELEVANT" ? 0.65 : decision === "UNCERTAIN" ? 0.35 : 0.1);
    return {
      decision,
      confidence,
      score: Math.round(finalScore * 100) / 100,
      reasons: [...reasons, ...v2Eval.reasons],
      matchedKeywords: v2Eval.matchedKeywords,
      matchedTerms: v2Eval.matchedTerms,
      negativeSignals: v2Eval.negativeSignals,
      evidence: evidenceItems,
      conflicts: profile.conflicts,
      evidenceCoverage: coverage,
      uniqueEvidenceSignals: evidenceItems.length,
      observedEvidenceOccurrences: profile.observedEvidenceOccurrences,
      explanation,
      reasonCode,
      strategyVersion: RELEVANCE_STRATEGY_VERSION_V3,
      engineVersion: RELEVANCE_ENGINE_VERSION_V3,
      presetVersion: intent.presetVersion
    };
  }
  function buildUncertainRecord(entityKey, profile, v3Decision) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return {
      entityId: `uncertain_${entityKey}`,
      entityKey,
      canonicalName: profile.canonicalName,
      observedNames: [profile.advertiserName, profile.canonicalName],
      advertiserName: profile.advertiserName,
      matchedQueries: Array.from(profile.matchedQueries),
      identityConfidence: "WEAK",
      evidenceItems: v3Decision.evidence,
      evidence: v3Decision.evidence,
      missingEvidence: v3Decision.evidenceCoverage.missingCategories.map((c) => `MISSING_${c}`),
      reasonCodes: [v3Decision.reasonCode],
      primaryReasonCode: v3Decision.reasonCode,
      reasonCode: v3Decision.reasonCode,
      uncertainReasonCodes: [v3Decision.reasonCode],
      reasons: v3Decision.reasons,
      observedAdIds: Array.from(profile.distinctAdCopyHashes),
      observedDomains: Array.from(profile.observedDomains),
      timestamps: {
        firstDiscovered: now,
        lastEvaluated: now
      },
      queryProvenance: Array.from(profile.matchedQueries),
      evidenceCoverage: v3Decision.evidenceCoverage,
      recordedAt: now,
      decision: "UNCERTAIN",
      confidence: v3Decision.confidence,
      lastEvaluationState: {
        score: v3Decision.score,
        decision: "UNCERTAIN",
        confidence: v3Decision.confidence,
        explanation: v3Decision.explanation
      }
    };
  }
  function integrateWebsiteVerificationEvidence(profile, websiteRecord) {
    for (const ev of websiteRecord.evidence) {
      if (ev.strength === "CONTRADICTORY") {
        profile.conflicts.push(ev);
        profile.negativeSignals.push(ev.reason);
      } else {
        const sig = ev.signature || createEvidenceSignature(ev.type, ev.source, ev.strength, ev.value || ev.reason);
        if (!profile.uniqueEvidenceMap.has(sig)) {
          profile.uniqueEvidenceMap.set(sig, { ...ev, signature: sig });
          profile.observedEvidenceOccurrences++;
        }
      }
    }
    if (websiteRecord.hostname) {
      profile.observedDomains.add(websiteRecord.hostname);
    }
  }
  var RELEVANCE_ENGINE_VERSION_V3, RELEVANCE_STRATEGY_VERSION_V3, COMMERCIAL_CTA_PHRASES, COMMERCIAL_COPY_REGEX;
  var init_evidenceWaterfall = __esm({
    "src/extension/evidenceWaterfall.ts"() {
      init_relevanceEngine();
      RELEVANCE_ENGINE_VERSION_V3 = "strict-v3";
      RELEVANCE_STRATEGY_VERSION_V3 = 3;
      COMMERCIAL_CTA_PHRASES = /* @__PURE__ */ new Set([
        "shop now",
        "buy now",
        "order now",
        "get quote",
        "contact us",
        "order",
        "book now",
        "sign up",
        "apply now",
        "request quote",
        "call now",
        "schedule now",
        "get offer",
        "claim offer"
      ]);
      COMMERCIAL_COPY_REGEX = /(price|discount|sale|off|taka|bdt|usd|\$|€|£|warranty|deal|buy|shop|order|quote|booking|free consultation|special offer|flat \d+%|starts at|affordable)/i;
    }
  });

  // src/extension/relevanceEngine.ts
  function stemToken(token) {
    const t = token.toLowerCase().trim();
    if (t.length <= 3) return t;
    if (t.endsWith("ies") && t.length > 4) {
      return t.substring(0, t.length - 3) + "y";
    }
    if (t.endsWith("ses") || t.endsWith("xes") || t.endsWith("zes") || t.endsWith("ches") || t.endsWith("shes")) {
      return t.substring(0, t.length - 2);
    }
    if (t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) {
      return t.substring(0, t.length - 1);
    }
    return t;
  }
  function tokenizeText(text) {
    if (!text) return [];
    return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ").split(/[\s-]+/).map((w) => w.trim()).filter((w) => w.length >= 2 && !STOP_WORDS.has(w)).map(stemToken);
  }
  function extractUrlTokens(urlStr) {
    if (!urlStr) return [];
    try {
      const url = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
      const pathAndQuery = `${url.pathname} ${url.search}`.replace(/[/?&=_.-]/g, " ");
      return tokenizeText(pathAndQuery);
    } catch {
      return tokenizeText(urlStr.replace(/[/?&=_.-]/g, " "));
    }
  }
  function normalizeEvidence(evidence) {
    const rawAdvertiser = (evidence.advertiserName || "").trim();
    const rawAdCopy = (evidence.adText || "").trim();
    const rawPageName = (evidence.facebookPageName || "").trim();
    const rawCta = (evidence.ctaText || "").trim();
    let rawDomain = (evidence.destinationDomain || "").toLowerCase().trim();
    if (!rawDomain && evidence.destinationUrl) {
      try {
        const u = new URL(evidence.destinationUrl.startsWith("http") ? evidence.destinationUrl : `https://${evidence.destinationUrl}`);
        rawDomain = u.hostname.replace(/^(www\.|m\.|l\.)/, "");
      } catch {
        rawDomain = "";
      }
    }
    return {
      normalizedAdvertiserTokens: tokenizeText(rawAdvertiser),
      normalizedAdTextTokens: tokenizeText(rawAdCopy),
      normalizedDomain: rawDomain,
      normalizedUrlSlug: evidence.destinationUrl ? extractUrlTokens(evidence.destinationUrl).join(" ") : "",
      normalizedPageNameTokens: tokenizeText(rawPageName),
      normalizedCta: rawCta.normalize("NFC").toLowerCase(),
      advertiserText: rawAdvertiser.normalize("NFC").toLowerCase(),
      adCopyText: rawAdCopy.normalize("NFC").toLowerCase()
    };
  }
  function compileResearchIntent(modeOrConfig, keywords = [], presetId, locationCode = "US", options) {
    let mode = "CUSTOM";
    let cleanKeywords = [];
    let pId = presetId;
    let loc = locationCode;
    let opts = options;
    if (typeof modeOrConfig === "string") {
      mode = modeOrConfig;
      cleanKeywords = (keywords || []).map((k) => k.trim()).filter(Boolean);
    } else if (modeOrConfig && typeof modeOrConfig === "object") {
      mode = modeOrConfig.mode || "CUSTOM";
      cleanKeywords = (modeOrConfig.keywords || modeOrConfig.targetNiches || []).map((k) => k.trim()).filter(Boolean);
      pId = modeOrConfig.presetId;
      loc = modeOrConfig.locationCode || modeOrConfig.targetCountryCode || "US";
      opts = {
        strictLocalMode: modeOrConfig.strictLocalMode,
        allowProbableLocal: modeOrConfig.allowProbableLocal,
        requiredCtaTypes: modeOrConfig.requiredCtaTypes,
        requiredDestinationTypes: modeOrConfig.requiredDestinationTypes,
        requireWebsiteFound: modeOrConfig.requireWebsiteFound,
        websiteRequirement: modeOrConfig.websiteRequirement,
        ...options
      };
    }
    if (mode === "PRESET" && pId) {
      const preset = RESEARCH_PRESETS.find((p) => p.preset_id === pId);
      if (preset) {
        return {
          mode: "PRESET",
          keywords: preset.primary_keywords,
          presetId: preset.preset_id,
          presetName: preset.name,
          presetVersion: preset.version,
          targetIndustry: preset.industry,
          targetSubIndustry: preset.sub_industry,
          primaryKeywords: preset.primary_keywords,
          secondaryKeywords: preset.secondary_keywords,
          exclusions: preset.optional_exclusions || [],
          locationCode: loc,
          strictLocalMode: opts?.strictLocalMode,
          allowProbableLocal: opts?.allowProbableLocal,
          requiredCtaTypes: opts?.requiredCtaTypes,
          requiredDestinationTypes: opts?.requiredDestinationTypes,
          requireWebsiteFound: opts?.requireWebsiteFound,
          websiteRequirement: opts?.websiteRequirement
        };
      }
    }
    return {
      mode: "CUSTOM",
      keywords: cleanKeywords,
      primaryKeywords: cleanKeywords,
      secondaryKeywords: [],
      exclusions: [],
      locationCode: loc,
      strictLocalMode: opts?.strictLocalMode,
      allowProbableLocal: opts?.allowProbableLocal,
      requiredCtaTypes: opts?.requiredCtaTypes,
      requiredDestinationTypes: opts?.requiredDestinationTypes,
      requireWebsiteFound: opts?.requireWebsiteFound,
      websiteRequirement: opts?.websiteRequirement
    };
  }
  var RELEVANCE_STRATEGY_VERSION, RELEVANCE_ENGINE_VERSION, BOUNDED_TAXONOMY, NEGATIVE_CATEGORIES, ACCESSORY_ONLY_INDICATORS, STOP_WORDS, LeadRelevanceEngine;
  var init_relevanceEngine = __esm({
    "src/extension/relevanceEngine.ts"() {
      init_presetCatalogue();
      RELEVANCE_STRATEGY_VERSION = 2;
      RELEVANCE_ENGINE_VERSION = "strict-v2";
      BOUNDED_TAXONOMY = {
        furniture: {
          category: "furniture",
          rootTerms: ["furniture", "furnishing", "furnishings", "furnish", "\u09AB\u09BE\u09B0\u09CD\u09A8\u09BF\u099A\u09BE\u09B0", "\u0986\u09B8\u09AC\u09BE\u09AC\u09AA\u09A4\u09CD\u09B0"],
          productServiceTerms: [
            "chair",
            "table",
            "desk",
            "sofa",
            "couch",
            "bed",
            "mattress",
            "cabinet",
            "wardrobe",
            "dining",
            "bench",
            "drawer",
            "drawers",
            "stool",
            "bookshelf",
            "shelf",
            "shelves",
            "almirah",
            "cupboard",
            "recliner",
            "credenza",
            "workstation",
            "seating",
            "lounge",
            "headboard",
            "nightstand",
            "dresser",
            "vanity",
            "sideboard",
            "armchair",
            "futon",
            "loveseat",
            "ottoman",
            "sectional",
            "ergonomic chair",
            "standing desk",
            "bedroom set",
            "\u099A\u09C7\u09DF\u09BE\u09B0",
            "\u09A1\u09BE\u0987\u09A8\u09BF\u0982",
            "\u0996\u09BE\u099F",
            "\u09B8\u09CB\u09AB\u09BE",
            "\u099F\u09C7\u09AC\u09BF\u09B2",
            "\u0986\u09B2\u09AE\u09BE\u09B0\u09BF"
          ],
          industryDescriptors: [
            "furniture store",
            "furniture retailer",
            "furniture manufacturer",
            "furniture studio",
            "home furniture",
            "office furniture",
            "wood furniture",
            "custom furniture",
            "living room",
            "bedroom set",
            "dining room"
          ],
          conflictingCategories: ["sports", "healthcare", "politics", "gaming", "casino", "education", "news_media"]
        },
        restaurant: {
          category: "restaurant",
          rootTerms: ["restaurant", "dining", "eatery", "bistro", "cafe", "food", "grill", "bar & grill", "smokehouse"],
          productServiceTerms: [
            "menu",
            "cuisine",
            "chef",
            "catering",
            "takeaway",
            "takeout",
            "delivery",
            "breakfast",
            "lunch",
            "dinner",
            "brunch",
            "burger",
            "pizza",
            "pasta",
            "steak",
            "seafood",
            "dessert",
            "cocktails",
            "wine",
            "appetizers",
            "buffet",
            "bar",
            "grill",
            "bbq",
            "ribs",
            "brisket",
            "beers",
            "reservation",
            "reservations"
          ],
          industryDescriptors: [
            "fine dining",
            "casual dining",
            "restaurant & bar",
            "cafe & bakery",
            "culinary"
          ],
          conflictingCategories: ["sports", "politics", "gaming", "casino"]
        },
        dental: {
          category: "dental",
          rootTerms: ["dentist", "dental", "orthodontist", "orthodontics"],
          productServiceTerms: [
            "teeth",
            "tooth",
            "invisalign",
            "braces",
            "whitening",
            "implants",
            "cleaning",
            "denture",
            "crown",
            "veneer",
            "extraction",
            "cavity",
            "oral surgery"
          ],
          industryDescriptors: ["dental clinic", "dental practice", "family dentistry"],
          conflictingCategories: ["sports", "politics", "gaming", "furniture"]
        },
        roofing: {
          category: "roofing",
          rootTerms: ["roof", "roofing", "roofer"],
          productServiceTerms: [
            "shingles",
            "gutters",
            "siding",
            "leak repair",
            "metal roof",
            "tile roof",
            "flat roof",
            "roof inspection",
            "roof replacement",
            "flashing",
            "soffit"
          ],
          industryDescriptors: ["roofing contractor", "roofing company", "roofing specialists"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        real_estate: {
          category: "real_estate",
          rootTerms: ["real estate", "realty", "realtor", "property", "properties"],
          productServiceTerms: [
            "apartment",
            "condo",
            "townhouse",
            "villa",
            "homes for sale",
            "open house",
            "mortgage",
            "brokerage",
            "leasing",
            "tenant",
            "landlord",
            "commercial space"
          ],
          industryDescriptors: ["real estate agency", "property group", "real estate broker"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        marketing_agency: {
          category: "marketing_agency",
          rootTerms: ["marketing agency", "digital marketing", "advertising agency", "media agency"],
          productServiceTerms: [
            "seo",
            "ppc",
            "lead generation",
            "social media marketing",
            "branding",
            "content marketing",
            "web design",
            "growth marketing",
            "performance marketing"
          ],
          industryDescriptors: ["creative agency", "marketing partner", "growth agency"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        clothing: {
          category: "clothing",
          rootTerms: ["clothing", "apparel", "fashion", "wear", "garments"],
          productServiceTerms: [
            "dress",
            "shirt",
            "pants",
            "t-shirt",
            "jacket",
            "hoodie",
            "shoes",
            "footwear",
            "denim",
            "jeans",
            "boutique",
            "suits",
            "outfit",
            "swimwear"
          ],
          industryDescriptors: ["clothing brand", "fashion boutique", "apparel store"],
          conflictingCategories: ["sports_team", "politics", "gaming"]
        },
        fitness: {
          category: "fitness",
          rootTerms: ["fitness", "gym", "workout", "training"],
          productServiceTerms: [
            "personal trainer",
            "crossfit",
            "bodybuilding",
            "weightlifting",
            "cardio",
            "yoga",
            "pilates",
            "membership",
            "strength training",
            "coaching"
          ],
          industryDescriptors: ["fitness center", "health club", "gym & fitness"],
          conflictingCategories: ["politics", "gaming", "casino"]
        },
        saas: {
          category: "saas",
          rootTerms: ["saas", "cloud software", "business software", "software platform"],
          productServiceTerms: [
            "crm",
            "erp",
            "pipeline",
            "workflow automation",
            "subscription",
            "enterprise software",
            "dashboard",
            "analytics tool",
            "b2b platform"
          ],
          industryDescriptors: ["b2b saas", "software provider", "cloud solution"],
          conflictingCategories: ["sports", "politics", "casino"]
        },
        construction: {
          category: "construction",
          rootTerms: ["construction", "contractor", "builder", "remodeling"],
          productServiceTerms: [
            "renovation",
            "drywall",
            "masonry",
            "excavation",
            "framing",
            "general contractor",
            "commercial building",
            "home addition",
            "deck building",
            "demolition"
          ],
          industryDescriptors: ["construction company", "building contractors"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        photography: {
          category: "photography",
          rootTerms: ["photography", "photographer", "photoshoot"],
          productServiceTerms: [
            "portrait",
            "wedding photography",
            "headshots",
            "studio portrait",
            "videography",
            "photo session",
            "commercial photography",
            "event photography"
          ],
          industryDescriptors: ["photo studio", "photography services"],
          conflictingCategories: ["sports_team", "politics", "gaming"]
        },
        hvac: {
          category: "hvac",
          rootTerms: ["hvac", "air conditioning", "heating", "cooling", "ventilation"],
          productServiceTerms: [
            "furnace",
            "heat pump",
            "duct",
            "ductwork",
            "ac repair",
            "thermostat",
            "compressor",
            "refrigerant",
            "boiler",
            "air filter"
          ],
          industryDescriptors: ["hvac contractor", "heating repair", "ac installation"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        home_services: {
          category: "home_services",
          rootTerms: ["home services", "plumbing", "electrician", "handyman", "pest control", "appliance repair"],
          productServiceTerms: [
            "pipe leak",
            "drain cleaning",
            "water heater",
            "wiring",
            "electrical panel",
            "lighting installation",
            "termite control",
            "drywall repair",
            "carpentry",
            "home maintenance"
          ],
          industryDescriptors: ["home service contractor", "emergency plumbing", "residential electrician"],
          conflictingCategories: ["sports", "politics", "gaming"]
        },
        ecommerce: {
          category: "ecommerce",
          rootTerms: ["ecommerce", "online store", "online shop", "retail store", "direct to consumer", "d2c"],
          productServiceTerms: [
            "add to cart",
            "checkout",
            "free shipping",
            "order tracking",
            "fast delivery",
            "storefront",
            "catalog",
            "shopping cart",
            "apparel",
            "accessories",
            "retail"
          ],
          industryDescriptors: ["online store", "ecommerce brand", "direct-to-consumer store"],
          conflictingCategories: ["politics", "casino"]
        },
        professional_services: {
          category: "professional_services",
          rootTerms: ["professional services", "accounting", "legal", "law firm", "consulting", "tax advisory"],
          productServiceTerms: [
            "cpa",
            "tax filing",
            "audit",
            "bookkeeping",
            "litigation",
            "attorney",
            "lawyer",
            "business advisory",
            "corporate legal",
            "compliance advisory"
          ],
          industryDescriptors: ["certified public accountant", "law practice", "management consulting"],
          conflictingCategories: ["sports", "casino", "gaming"]
        }
      };
      NEGATIVE_CATEGORIES = [
        {
          category: "sports",
          terms: [
            "manchester united",
            "premier league",
            "football club",
            "soccer team",
            "cricket board",
            "champions league",
            "matchday",
            "fifa",
            "uefa",
            "nba",
            "nfl",
            "sports club",
            "women team",
            "head coach",
            "stadium"
          ],
          entityTokens: ["fc", "united", "stadium", "club", "league", "team", "cricket", "football", "fifa", "uefa"],
          penalty: -0.65
        },
        {
          category: "healthcare",
          terms: [
            "health support community",
            "saved my husband",
            "seventy-nine",
            "cancer treatment",
            "diabetes remedy",
            "chronic illness",
            "prescription drug",
            "patient clinical",
            "health injustice",
            "clinical trial",
            "disease cure",
            "medical hospital",
            "dental care clinic"
          ],
          entityTokens: ["hospital", "clinic", "medical", "pharma", "health", "doctor", "patient"],
          penalty: -0.65
        },
        {
          category: "politics",
          terms: [
            "political campaign",
            "election rally",
            "vote for",
            "parliament member",
            "political party",
            "candidate for senate",
            "citizens for governance",
            "ballot initiative",
            "party congress"
          ],
          entityTokens: ["party", "senate", "parliament", "campaign", "governance", "election", "voters"],
          penalty: -0.65
        },
        {
          category: "gaming_casino",
          terms: [
            "online casino",
            "slot machine",
            "jackpot betting",
            "poker chips",
            "crypto casino",
            "betting odds",
            "spin to win",
            "roulette online"
          ],
          entityTokens: ["casino", "betting", "poker", "slots", "jackpot"],
          penalty: -0.65
        },
        {
          category: "news_media",
          terms: [
            "breaking news",
            "daily news",
            "news network",
            "news channel",
            "broadcasting station",
            "journalism report",
            "magazine online"
          ],
          entityTokens: ["news", "media", "journal", "broadcasting", "times", "chronicle", "gazette"],
          penalty: -0.55
        },
        {
          category: "education",
          terms: [
            "university admissions",
            "undergraduate degree",
            "campus tuition",
            "public school district",
            "college alumni",
            "academic curriculum"
          ],
          entityTokens: ["university", "college", "school", "academy", "campus", "alumni"],
          penalty: -0.55
        },
        {
          category: "charity_ngo",
          terms: [
            "charity relief",
            "humanitarian aid",
            "donation campaign",
            "non-profit organization",
            "relief fund",
            "donate now to support"
          ],
          entityTokens: ["charity", "foundation", "relief", "humanitarian", "donation", "ngo"],
          penalty: -0.55
        },
        {
          category: "astrology_psychic_spiritual",
          terms: [
            "psychic",
            "psychics",
            "top uk psychics",
            "psychic reading",
            "psychic readings",
            "tarot",
            "tarot card",
            "tarot reading",
            "astrology",
            "astrologer",
            "horoscope",
            "horoscopes",
            "clairvoyant",
            "spiritual guidance",
            "fortune teller",
            "fortune telling",
            "palmistry",
            "numerology",
            "mediumship",
            "trusted readings"
          ],
          entityTokens: ["psychic", "psychics", "tarot", "astrology", "astrologer", "horoscope", "clairvoyant", "spiritual", "medium"],
          penalty: -0.65
        },
        {
          category: "digital_entertainment_media",
          terms: [
            "podcast",
            "podcast episode",
            "listen on spotify",
            "music band",
            "mobile app wallet",
            "app wallet",
            "free minutes in our app",
            "download our app for free"
          ],
          entityTokens: ["podcast", "streamer", "band"],
          penalty: -0.55
        }
      ];
      ACCESSORY_ONLY_INDICATORS = [
        "sofa cover",
        "sofa covers",
        "couch cover",
        "couch covers",
        "slipcover",
        "slipcovers",
        "cushion cover",
        "cushion covers",
        "pillow cover",
        "pillow covers",
        "elastic cover",
        "furniture protector",
        "sofa protector",
        "chair cover",
        "chair covers"
      ];
      STOP_WORDS = /* @__PURE__ */ new Set([
        "a",
        "about",
        "above",
        "after",
        "again",
        "against",
        "all",
        "am",
        "an",
        "and",
        "any",
        "are",
        "aren",
        "as",
        "at",
        "be",
        "because",
        "been",
        "before",
        "being",
        "below",
        "between",
        "both",
        "but",
        "by",
        "can",
        "cannot",
        "could",
        "did",
        "do",
        "does",
        "doing",
        "down",
        "during",
        "each",
        "few",
        "for",
        "from",
        "further",
        "had",
        "has",
        "have",
        "having",
        "he",
        "her",
        "here",
        "hers",
        "herself",
        "him",
        "himself",
        "his",
        "how",
        "i",
        "if",
        "in",
        "into",
        "is",
        "it",
        "its",
        "itself",
        "just",
        "me",
        "more",
        "most",
        "my",
        "myself",
        "no",
        "nor",
        "not",
        "now",
        "of",
        "off",
        "on",
        "once",
        "only",
        "or",
        "other",
        "ought",
        "our",
        "ours",
        "ourselves",
        "out",
        "over",
        "own",
        "same",
        "she",
        "should",
        "so",
        "some",
        "such",
        "than",
        "that",
        "the",
        "their",
        "theirs",
        "them",
        "themselves",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "through",
        "to",
        "too",
        "under",
        "until",
        "up",
        "very",
        "was",
        "we",
        "were",
        "what",
        "when",
        "where",
        "which",
        "while",
        "who",
        "whom",
        "why",
        "with",
        "would",
        "you",
        "your",
        "yours",
        "yourself",
        "yourselves"
      ]);
      LeadRelevanceEngine = class _LeadRelevanceEngine {
        static {
          this.VERSION = RELEVANCE_STRATEGY_VERSION;
        }
        static {
          this.ENGINE_VERSION = RELEVANCE_ENGINE_VERSION;
        }
        static {
          this.compileResearchIntent = compileResearchIntent;
        }
        /**
         * Evaluates a single candidate ad against the research intent using the Multi-Stage Pipeline.
         */
        static evaluateCandidate(candidate, intent) {
          const evidence = {
            advertiserName: candidate.pageName || candidate.advertiserName || "",
            adText: candidate.bodyCopy || candidate.adText || "",
            destinationUrl: candidate.destinationUrl,
            destinationDomain: candidate.destinationDomain,
            facebookPageName: candidate.facebookPageName || candidate.pageName,
            facebookPageUrl: candidate.facebookPageUrl,
            ctaText: candidate.ctaText,
            matchedKeyword: candidate.observedKeyword || candidate.matchedKeyword
          };
          return this.evaluateEvidence(evidence, intent);
        }
        /**
         * Evaluates structured candidate evidence against research intent.
         * Deterministic, explainable, and bounded.
         */
        static evaluateEvidence(evidence, intent) {
          const normalized = normalizeEvidence(evidence);
          const structuredEvidence = [];
          const conflicts = [];
          const reasons = [];
          const matchedKeywords = [];
          const matchedTerms = [];
          const negativeSignals = [];
          const allQueryPhrases = [
            ...intent.primaryKeywords || intent.keywords || [],
            ...intent.secondaryKeywords || []
          ].map((k) => k.toLowerCase().trim()).filter(Boolean);
          const activeTaxonomies = [];
          for (const [key, tax] of Object.entries(BOUNDED_TAXONOMY)) {
            if (allQueryPhrases.some(
              (phrase) => phrase.includes(key) || key.includes(phrase) || tax.rootTerms.some((rt) => phrase.includes(rt) || rt.includes(phrase)) || tax.productServiceTerms.some((pt) => phrase === pt || phrase.includes(pt) || pt.includes(phrase)) || tax.industryDescriptors.some((id) => phrase.includes(id) || id.includes(phrase))
            )) {
              activeTaxonomies.push(tax);
            }
          }
          if (activeTaxonomies.length === 0 && allQueryPhrases.length > 0) {
            const dynamicRoots = [];
            const dynamicStems = [];
            for (const phrase of allQueryPhrases) {
              dynamicRoots.push(phrase);
              for (const tok of tokenizeText(phrase)) {
                dynamicStems.push(tok);
              }
            }
            activeTaxonomies.push({
              category: allQueryPhrases[0],
              rootTerms: Array.from(new Set(dynamicRoots)),
              productServiceTerms: Array.from(new Set(dynamicStems)),
              industryDescriptors: allQueryPhrases,
              conflictingCategories: ["sports", "healthcare", "politics", "gaming", "casino"]
            });
          }
          const coreQueryTokens = /* @__PURE__ */ new Set();
          for (const phrase of allQueryPhrases) {
            for (const t of tokenizeText(phrase)) {
              coreQueryTokens.add(t);
            }
          }
          for (const tax of activeTaxonomies) {
            for (const rt of tax.rootTerms) {
              for (const t of tokenizeText(rt)) {
                coreQueryTokens.add(t);
              }
            }
          }
          const productTerms = /* @__PURE__ */ new Set();
          for (const tax of activeTaxonomies) {
            for (const t of tax.productServiceTerms) {
              productTerms.add(stemToken(t));
            }
          }
          let negativePenalty = 0;
          if (intent.exclusions && intent.exclusions.length > 0) {
            for (const excl of intent.exclusions) {
              const exclLower = excl.toLowerCase();
              if (normalized.advertiserText.includes(exclLower) || normalized.adCopyText.includes(exclLower) || normalized.normalizedDomain.includes(exclLower)) {
                const reason = `Matched preset exclusion rule: "${excl}"`;
                negativeSignals.push(reason);
                conflicts.push({
                  type: "CONTRADICTION",
                  strength: "STRONG",
                  source: "advertiser_name",
                  reason,
                  matchedSignal: excl,
                  reasonCode: "REJECT_PRESET_EXCLUSION"
                });
                negativePenalty -= 0.55;
                break;
              }
            }
          }
          for (const negCat of NEGATIVE_CATEGORIES) {
            const isQueryRelatedToNegCat = allQueryPhrases.some(
              (q) => negCat.terms.some((t) => q.includes(t)) || q.includes(negCat.category) || negCat.category === "sports" && (q.includes("football") || q.includes("cricket") || q.includes("sports"))
            );
            if (isQueryRelatedToNegCat) continue;
            let entityContradictionTerm;
            for (const term of negCat.terms) {
              if (normalized.advertiserText.includes(term) || normalized.normalizedDomain.includes(term.replace(/\s+/g, ""))) {
                entityContradictionTerm = term;
                break;
              }
            }
            if (entityContradictionTerm) {
              const reason = `Advertiser entity identity belongs to unrelated category (${negCat.category}): "${entityContradictionTerm}"`;
              negativeSignals.push(reason);
              conflicts.push({
                type: "CONTRADICTION",
                strength: "STRONG",
                source: "advertiser_name",
                reason,
                matchedSignal: entityContradictionTerm,
                reasonCode: "REJECT_CONTRADICTION_IDENTITY"
              });
              negativePenalty += negCat.penalty;
              continue;
            }
            for (const term of negCat.terms) {
              if (normalized.adCopyText.includes(term) || normalized.normalizedDomain.includes(term.replace(/\s+/g, ""))) {
                const reason = `Unrelated ${negCat.category} signal detected in candidate ad context: "${term}"`;
                negativeSignals.push(reason);
                conflicts.push({
                  type: "NEGATIVE_CATEGORY",
                  strength: "STRONG",
                  source: "ad_text",
                  reason,
                  matchedSignal: term,
                  reasonCode: "REJECT_CONFLICT"
                });
                negativePenalty += negCat.penalty;
                break;
              }
            }
          }
          negativePenalty = Math.max(-0.8, negativePenalty);
          let advertiserNameScore = 0;
          let hasStrongEntityMatch = false;
          let hasModerateEntityMatch = false;
          const hasCoreVerticalInName = activeTaxonomies.some(
            (tax) => tax.rootTerms.some((rt) => normalized.advertiserText.includes(rt)) || tax.industryDescriptors.some((id) => normalized.advertiserText.includes(id))
          );
          for (const phrase of allQueryPhrases) {
            if (normalized.advertiserText.includes(phrase)) {
              if (hasCoreVerticalInName) {
                advertiserNameScore = 0.4;
                hasStrongEntityMatch = true;
                matchedKeywords.push(phrase);
                matchedTerms.push(phrase);
                const reason = `Advertiser name explicitly contains target category query "${phrase}"`;
                reasons.push(reason);
                structuredEvidence.push({
                  type: "ENTITY_IDENTITY",
                  strength: "STRONG",
                  source: "advertiser_name",
                  reason,
                  matchedSignal: phrase,
                  reasonCode: "SIGNAL_ENTITY_NAME_EXACT"
                });
              } else {
                advertiserNameScore = 0.25;
                hasModerateEntityMatch = true;
                matchedKeywords.push(phrase);
                matchedTerms.push(phrase);
                const reason = `Advertiser name mentions target product term "${phrase}"`;
                reasons.push(reason);
                structuredEvidence.push({
                  type: "ENTITY_IDENTITY",
                  strength: "MODERATE",
                  source: "advertiser_name",
                  reason,
                  matchedSignal: phrase,
                  reasonCode: "SIGNAL_ENTITY_NAME_PRODUCT"
                });
              }
              break;
            }
          }
          if (!hasStrongEntityMatch) {
            const matchedTokensInName = normalized.normalizedAdvertiserTokens.filter((t) => coreQueryTokens.has(t));
            if (matchedTokensInName.length > 0) {
              advertiserNameScore = 0.3;
              hasStrongEntityMatch = true;
              matchedTerms.push(...matchedTokensInName);
              const reason = `Advertiser name contains core target keyword stem(s): ${matchedTokensInName.join(", ")}`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "ENTITY_IDENTITY",
                strength: "STRONG",
                source: "advertiser_name",
                reason,
                matchedSignal: matchedTokensInName.join(", "),
                reasonCode: "SIGNAL_ENTITY_NAME_CORE"
              });
            } else {
              const productTokensInName = normalized.normalizedAdvertiserTokens.filter((t) => productTerms.has(t));
              const matchedSubstringProduct = Array.from(productTerms).filter(
                (pt) => pt.length >= 4 && normalized.advertiserText.includes(pt)
              );
              const combinedProductMatches = Array.from(/* @__PURE__ */ new Set([...productTokensInName, ...matchedSubstringProduct]));
              if (combinedProductMatches.length > 0) {
                advertiserNameScore = 0.25;
                hasModerateEntityMatch = true;
                matchedTerms.push(...combinedProductMatches);
                const reason = `Advertiser name contains target product term(s): ${combinedProductMatches.join(", ")}`;
                reasons.push(reason);
                structuredEvidence.push({
                  type: "ENTITY_IDENTITY",
                  strength: "MODERATE",
                  source: "advertiser_name",
                  reason,
                  matchedSignal: combinedProductMatches.join(", "),
                  reasonCode: "SIGNAL_ENTITY_NAME_PRODUCT"
                });
              }
            }
          }
          let destinationScore = 0;
          let hasDomainCategoryMatch = false;
          if (normalized.normalizedDomain) {
            const domainHasQuery = allQueryPhrases.some(
              (p) => normalized.normalizedDomain.includes(p.replace(/\s+/g, ""))
            );
            const domainHasProduct = Array.from(productTerms).some(
              (t) => t.length >= 4 && normalized.normalizedDomain.includes(t)
            );
            if (domainHasQuery) {
              destinationScore = 0.2;
              hasDomainCategoryMatch = true;
              const reason = `Destination domain "${normalized.normalizedDomain}" explicitly contains target query`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "ENTITY_IDENTITY",
                strength: "STRONG",
                source: "destination_domain",
                reason,
                matchedSignal: normalized.normalizedDomain,
                reasonCode: "SIGNAL_DOMAIN_QUERY_EXACT"
              });
            } else if (domainHasProduct) {
              destinationScore = 0.15;
              hasDomainCategoryMatch = true;
              const reason = `Destination domain "${normalized.normalizedDomain}" contains category product term`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "ENTITY_IDENTITY",
                strength: "MODERATE",
                source: "destination_domain",
                reason,
                matchedSignal: normalized.normalizedDomain,
                reasonCode: "SIGNAL_DOMAIN_PRODUCT"
              });
            }
          }
          let facebookPageScore = 0;
          if (evidence.facebookPageUrl) {
            const pageUrlLower = evidence.facebookPageUrl.toLowerCase();
            const pageHasQuery = allQueryPhrases.some((p) => pageUrlLower.includes(p.replace(/\s+/g, "")));
            if (pageHasQuery) {
              facebookPageScore = hasStrongEntityMatch ? 0.05 : 0.12;
              const reason = `Facebook Page handle/URL reinforces target category identity`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "ENTITY_IDENTITY",
                strength: "MODERATE",
                source: "facebook_page",
                reason,
                matchedSignal: evidence.facebookPageUrl,
                reasonCode: "SIGNAL_PAGE_HANDLE"
              });
            }
          }
          let adCopyScore = 0;
          let adCopyHasPhraseMatch = false;
          for (const phrase of allQueryPhrases) {
            if (normalized.adCopyText.includes(phrase)) {
              adCopyScore += 0.2;
              adCopyHasPhraseMatch = true;
              if (!matchedKeywords.includes(phrase)) matchedKeywords.push(phrase);
              if (!matchedTerms.includes(phrase)) matchedTerms.push(phrase);
              const reason = `Ad copy directly mentions target query "${phrase}"`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "CATEGORY_MATCH",
                strength: "MODERATE",
                source: "ad_text",
                reason,
                matchedSignal: phrase,
                reasonCode: "SIGNAL_COPY_PHRASE"
              });
              break;
            }
          }
          const foundProductTermsInCopy = Array.from(productTerms).filter(
            (t) => normalized.normalizedAdTextTokens.includes(t) || t.length >= 4 && normalized.adCopyText.includes(t)
          );
          let hasProductCatalogEvidence = false;
          if (foundProductTermsInCopy.length > 0) {
            const sampleTerms = foundProductTermsInCopy.slice(0, 5);
            matchedTerms.push(...sampleTerms);
            if (foundProductTermsInCopy.length >= 2) {
              hasProductCatalogEvidence = true;
              const copyAdd = Math.min(0.35, 0.15 + (foundProductTermsInCopy.length - 1) * 0.06);
              adCopyScore += copyAdd;
              const reason = `Ad copy contains specific category product catalog: ${sampleTerms.join(", ")}`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "CATEGORY_MATCH",
                strength: "STRONG",
                source: "ad_text",
                reason,
                matchedSignal: sampleTerms.join(", "),
                reasonCode: "SIGNAL_COPY_PRODUCT_CATALOG"
              });
            } else {
              adCopyScore += 0.12;
              const reason = `Ad copy mentions category product term: ${sampleTerms[0]}`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "CATEGORY_MATCH",
                strength: "WEAK",
                source: "ad_text",
                reason,
                matchedSignal: sampleTerms[0],
                reasonCode: "SIGNAL_COPY_SINGLE_PRODUCT"
              });
            }
          } else if (!adCopyHasPhraseMatch) {
            const matchedTokensInCopy = normalized.normalizedAdTextTokens.filter((t) => coreQueryTokens.has(t));
            if (matchedTokensInCopy.length > 0) {
              adCopyScore += 0.1;
              matchedTerms.push(...matchedTokensInCopy);
              const reason = `Ad copy mentions keyword stem(s): ${matchedTokensInCopy.join(", ")}`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "CATEGORY_MATCH",
                strength: "WEAK",
                source: "ad_text",
                reason,
                matchedSignal: matchedTokensInCopy.join(", "),
                reasonCode: "SIGNAL_COPY_STEM_ONLY"
              });
            }
          }
          adCopyScore = Math.min(0.4, adCopyScore);
          let hasUrlSlugProduct = false;
          if (normalized.normalizedUrlSlug) {
            const slugHasProduct = Array.from(productTerms).some(
              (t) => t.length >= 4 && normalized.normalizedUrlSlug.includes(t)
            );
            const slugHasQuery = Array.from(coreQueryTokens).some(
              (t) => normalized.normalizedUrlSlug.includes(t)
            );
            if (slugHasProduct || slugHasQuery) {
              hasUrlSlugProduct = true;
              destinationScore = Math.max(destinationScore, 0.12);
              const reason = `Destination URL path contains target product category context`;
              reasons.push(reason);
              structuredEvidence.push({
                type: "CATEGORY_MATCH",
                strength: "MODERATE",
                source: "destination_url",
                reason,
                matchedSignal: normalized.normalizedUrlSlug.substring(0, 50),
                reasonCode: "SIGNAL_URL_SLUG_MATCH"
              });
            }
          }
          let commercialScore = 0;
          const commercialCtas = ["shop now", "buy now", "order now", "get quote", "contact us", "order"];
          const hasCommercialCta = commercialCtas.includes(normalized.normalizedCta);
          if (hasCommercialCta) {
            commercialScore += 0.05;
            structuredEvidence.push({
              type: "COMMERCIAL_INTENT",
              strength: "MODERATE",
              source: "cta_text",
              reason: `Commercial action call-to-action ("${evidence.ctaText}")`,
              matchedSignal: evidence.ctaText,
              reasonCode: "SIGNAL_COMMERCIAL_INTENT_CTA"
            });
          }
          const hasPricingInCopy = /(price|discount|sale|off|taka|bdt|usd|\$|€|£|warranty|deal|buy|shop)/i.test(normalized.adCopyText);
          if (hasPricingInCopy) {
            commercialScore = Math.min(0.1, commercialScore + 0.05);
            structuredEvidence.push({
              type: "COMMERCIAL_INTENT",
              strength: "MODERATE",
              source: "ad_text",
              reason: `Commercial pricing, transaction, or sale language observed in ad copy`,
              reasonCode: "SIGNAL_COMMERCIAL_INTENT_PRICE"
            });
          }
          const rawPositiveScore = advertiserNameScore + adCopyScore + destinationScore + facebookPageScore + commercialScore;
          const totalScore = Math.max(0, Math.min(1, rawPositiveScore + negativePenalty));
          let decision = "UNCERTAIN";
          let confidence = "LOW";
          let reasonCode = "UNCERTAIN_AMBIGUOUS_ENTITY";
          const hasStrongConflict = conflicts.some((c) => c.type === "CONTRADICTION" && c.strength === "STRONG") || negativePenalty <= -0.3;
          if (hasStrongConflict) {
            decision = "NOT_RELEVANT";
            confidence = "HIGH";
            reasonCode = conflicts[0]?.reasonCode || "REJECT_CONFLICT";
            reasons.unshift(`Disqualified by Hard Contradiction Gate: ${negativeSignals.join("; ")}`);
          } else {
            const hasOnlyWeakKeywordInCopy = !hasStrongEntityMatch && !hasModerateEntityMatch && !hasDomainCategoryMatch && !hasProductCatalogEvidence;
            if (hasOnlyWeakKeywordInCopy) {
              if (totalScore < 0.18) {
                decision = "NOT_RELEVANT";
                confidence = "HIGH";
                reasonCode = "REJECT_INSUFFICIENT_EVIDENCE";
                reasons.push(`Classified as NOT_RELEVANT: No entity or category evidence found.`);
              } else {
                decision = "UNCERTAIN";
                confidence = "LOW";
                reasonCode = "UNCERTAIN_KEYWORD_ONLY";
                reasons.push(`Classified as UNCERTAIN: Mentioned keyword but lacks independent entity or product evidence.`);
              }
            } else {
              const isAccessoryOnly = ACCESSORY_ONLY_INDICATORS.some(
                (ind) => normalized.advertiserText.includes(ind) || normalized.adCopyText.includes(ind)
              ) && !hasCoreVerticalInName;
              const hasCategoryCorroboration = adCopyScore >= 0.1 || destinationScore >= 0.12 || hasProductCatalogEvidence || hasDomainCategoryMatch;
              const hasSupportingSignal = hasCategoryCorroboration || commercialScore >= 0.05 || facebookPageScore >= 0.05;
              const passesCriterion1 = hasCoreVerticalInName && hasSupportingSignal || hasStrongEntityMatch && hasCategoryCorroboration;
              const passesCriterion2 = hasModerateEntityMatch && (adCopyScore >= 0.15 || destinationScore >= 0.12 || hasProductCatalogEvidence);
              const passesCriterion3 = hasProductCatalogEvidence && (destinationScore >= 0.12 || hasUrlSlugProduct || hasDomainCategoryMatch || adCopyScore >= 0.25 && commercialScore >= 0.05);
              if (isAccessoryOnly) {
                decision = "UNCERTAIN";
                confidence = "MEDIUM";
                reasonCode = "UNCERTAIN_ACCESSORY_ONLY";
                reasons.push("Classified as UNCERTAIN: Candidate appears to offer accessories or covers rather than core furniture manufacturing or retail.");
              } else if ((passesCriterion1 || passesCriterion2 || passesCriterion3) && totalScore >= 0.35) {
                decision = "RELEVANT";
                const hasMultiDimensionalCorroboration = hasStrongEntityMatch && hasSupportingSignal || hasProductCatalogEvidence && destinationScore >= 0.12 && commercialScore >= 0.05;
                confidence = totalScore >= 0.6 || hasMultiDimensionalCorroboration ? "HIGH" : "MEDIUM";
                reasonCode = passesCriterion1 ? "ACCEPT_STRONG_ENTITY_MATCH" : "ACCEPT_MULTI_SIGNAL_MATCH";
                reasons.push(
                  `Qualified as RELEVANT: ${passesCriterion1 ? "Strong entity identity confirmed with supporting product/commercial evidence" : passesCriterion3 ? "Category product catalog verified with commercial corroboration" : "Entity and category evidence meet sufficiency standards"} (Confidence: ${confidence})`
                );
              } else if (totalScore < 0.22) {
                decision = "NOT_RELEVANT";
                confidence = totalScore < 0.12 ? "HIGH" : "MEDIUM";
                reasonCode = "REJECT_CATEGORY_MISMATCH";
                reasons.push(`Classified as NOT_RELEVANT: Insufficient category evidence (Score: ${(totalScore * 100).toFixed(0)}%)`);
              } else {
                decision = "UNCERTAIN";
                confidence = "LOW";
                reasonCode = "UNCERTAIN_AMBIGUOUS_ENTITY";
                reasons.push(`Classified as UNCERTAIN: Evidence is ambiguous or insufficient to confirm business vertical.`);
              }
            }
          }
          if (evidence.matchedKeyword && !matchedKeywords.includes(evidence.matchedKeyword)) {
            if (decision === "RELEVANT") {
              matchedKeywords.push(evidence.matchedKeyword);
            }
          }
          return {
            decision,
            confidence,
            score: Math.round(totalScore * 100) / 100,
            reasons,
            matchedKeywords,
            matchedTerms: Array.from(new Set(matchedTerms)),
            negativeSignals,
            evidence: structuredEvidence,
            conflicts,
            evidenceBreakdown: {
              advertiserNameScore,
              adCopyScore,
              destinationScore,
              facebookPageScore,
              commercialScore,
              negativePenalty
            },
            strategyVersion: RELEVANCE_STRATEGY_VERSION,
            engineVersion: RELEVANCE_ENGINE_VERSION,
            presetVersion: intent.presetVersion,
            reasonCode
          };
        }
        /**
         * Entity-Level Evaluation: Evaluates multiple ad cards for an advertiser entity
         * to produce the consolidated entity relevance decision without duplicate inflation.
         */
        static evaluateEntity(advertiserName, candidates, intent) {
          if (candidates.length === 0) {
            return this.evaluateEvidence({ advertiserName }, intent);
          }
          const evaluations = candidates.map((c) => this.evaluateCandidate(c, intent));
          const allConflicts = evaluations.flatMap((e) => e.conflicts);
          const hasEntityContradiction = allConflicts.some(
            (c) => c.type === "CONTRADICTION" && c.strength === "STRONG"
          );
          const allNegativeSignals = Array.from(new Set(evaluations.flatMap((e) => e.negativeSignals)));
          const maxNegativePenalty = Math.min(...evaluations.map((e) => e.evidenceBreakdown.negativePenalty));
          if (hasEntityContradiction || maxNegativePenalty <= -0.3) {
            const worstEval = evaluations.find((e) => e.evidenceBreakdown.negativePenalty <= -0.3) || evaluations[0];
            return {
              ...worstEval,
              decision: "NOT_RELEVANT",
              confidence: "HIGH",
              negativeSignals: allNegativeSignals,
              conflicts: allConflicts,
              reasons: [
                `Entity disqualified across ${candidates.length} ad(s) due to hard contradiction: ${allNegativeSignals.join("; ")}`
              ],
              reasonCode: "REJECT_CONTRADICTION_IDENTITY",
              engineVersion: RELEVANCE_ENGINE_VERSION,
              strategyVersion: RELEVANCE_STRATEGY_VERSION
            };
          }
          const seenCopyHashes = /* @__PURE__ */ new Set();
          const distinctAds = [];
          for (const c of candidates) {
            const copyNormalized = (c.bodyCopy || "").toLowerCase().trim().replace(/\s+/g, " ").substring(0, 100);
            if (!seenCopyHashes.has(copyNormalized)) {
              seenCopyHashes.add(copyNormalized);
              distinctAds.push(c);
            }
          }
          evaluations.sort((a, b) => b.score - a.score);
          const bestEval = evaluations[0];
          const combinedKeywords = Array.from(new Set(evaluations.flatMap((e) => e.matchedKeywords)));
          const combinedTerms = Array.from(new Set(evaluations.flatMap((e) => e.matchedTerms)));
          const allEvidence = Array.from(
            new Map(evaluations.flatMap((e) => e.evidence).map((ev) => [`${ev.type}:${ev.source}:${ev.reasonCode}`, ev])).values()
          );
          let consolidatedScore = bestEval.score;
          let decision = bestEval.decision;
          let confidence = bestEval.confidence;
          let reasonCode = bestEval.reasonCode;
          const distinctSupportingAds = distinctAds.filter((ad) => {
            const ev = _LeadRelevanceEngine.evaluateCandidate(ad, intent);
            return ev.decision === "RELEVANT" || ev.evidence.some((e) => e.type === "CATEGORY_MATCH");
          });
          if (allNegativeSignals.length === 0 && distinctSupportingAds.length > 1) {
            const multiCardBoost = Math.min(0.12, (distinctSupportingAds.length - 1) * 0.04);
            consolidatedScore = Math.min(1, consolidatedScore + multiCardBoost);
            if (decision === "UNCERTAIN" && consolidatedScore >= 0.4 && (bestEval.evidenceBreakdown.advertiserNameScore > 0 || bestEval.evidenceBreakdown.adCopyScore >= 0.25)) {
              decision = "RELEVANT";
              reasonCode = "ACCEPT_MULTI_SIGNAL_MATCH";
            }
            if (consolidatedScore >= 0.6) {
              confidence = "HIGH";
            }
            allEvidence.push({
              type: "ENTITY_IDENTITY",
              strength: "STRONG",
              source: "entity_aggregation",
              reason: `Entity confirmed across ${distinctSupportingAds.length} distinct category ads`,
              matchedSignal: `${distinctSupportingAds.length} distinct ads`,
              reasonCode: "SIGNAL_MULTI_AD_CORROBORATION"
            });
          }
          return {
            ...bestEval,
            decision,
            confidence,
            score: Math.round(consolidatedScore * 100) / 100,
            matchedKeywords: combinedKeywords.length > 0 ? combinedKeywords : bestEval.matchedKeywords,
            matchedTerms: combinedTerms,
            evidence: allEvidence,
            conflicts: allConflicts,
            reasons: [
              `Entity evaluated across ${candidates.length} ad card(s) (${distinctAds.length} distinct): status ${decision} (${(consolidatedScore * 100).toFixed(0)}%)`,
              ...bestEval.reasons
            ],
            reasonCode,
            strategyVersion: RELEVANCE_STRATEGY_VERSION,
            engineVersion: RELEVANCE_ENGINE_VERSION
          };
        }
        /**
         * Evidence Waterfall + Strict Relevance v3 Evaluator
         * Executes deterministic evidence collection, anti-inflation aggregation,
         * and strict multi-tier decision hierarchy.
         */
        static evaluateCandidateV3(candidate, intent) {
          const { evaluateStrictRelevanceV3: evaluateStrictRelevanceV32 } = (init_evidenceWaterfall(), __toCommonJS(evidenceWaterfall_exports));
          const candEvidence = {
            advertiserName: candidate.pageName || candidate.advertiserName || "",
            adText: candidate.bodyCopy || candidate.adText || "",
            destinationUrl: candidate.destinationUrl,
            destinationDomain: candidate.destinationDomain,
            facebookPageUrl: candidate.facebookPageUrl,
            ctaText: candidate.ctaText,
            matchedKeyword: candidate.observedKeyword || candidate.matchedKeyword
          };
          return evaluateStrictRelevanceV32(candEvidence, intent);
        }
      };
    }
  });

  // src/extension/metaAdapter.ts
  init_relevanceEngine();

  // src/extension/countryProfiles/profiles/bd.ts
  var BD_PROFILE = {
    countryCode: "BD",
    countryName: "Bangladesh",
    aliases: ["BD", "BANGLADESH", "BENGAL"],
    phone: {
      internationalPrefixes: ["+880"],
      phoneRegex: /(?:\+880[\s\-]*1[3-9][\s\-]?\d{2}[\s\-]?\d{6}|880[\s\-]*1[3-9][\s\-]?\d{2}[\s\-]?\d{6}|\+880\s*1[3-9]\d{8}|8801[3-9]\d{8})/,
      domesticRegex: /(?:\b01[3-9][\s\-]?\d{2}[\s\-]?\d{6}\b|\b01[3-9]\d{8}\b)/
    },
    majorCities: [
      "dhaka",
      "chittagong",
      "chattogram",
      "sylhet",
      "rajshahi",
      "khulna",
      "barishal",
      "rangpur",
      "mymensingh",
      "gazipur",
      "narayanganj",
      "comilla",
      "savar",
      "uttara",
      "banani",
      "gulshan",
      "dhanmondi",
      "mirpur",
      "motijheel",
      "badda",
      "mohammadpur",
      "bashundhara",
      "mohakhali",
      "khilkhet",
      "tejgaon"
    ],
    addressKeywords: [
      "house",
      "road",
      "sector",
      "block",
      "lane",
      "plot",
      "holding",
      "floor",
      "avenue",
      "street"
    ],
    operationalPhrases: [
      "all over bangladesh",
      "delivery all over bangladesh",
      "inside dhaka",
      "outside dhaka",
      "free delivery in dhaka",
      "free delivery inside dhaka",
      "cash on delivery in bangladesh",
      "home delivery inside dhaka",
      "bangladesh delivery",
      "deliver all over bangladesh",
      "all over bd"
    ],
    domainSuffixes: [".bd", ".com.bd", ".org.bd", ".edu.bd", ".gov.bd"],
    knownCommercialDomains: [
      "regalfurniturebd.com",
      "htbazarbd.com",
      "daraz.com.bd",
      "othoba.com",
      "chaldal.com"
    ],
    nativeScriptRegex: /[\u0980-\u09FF]/,
    keywords: ["bangladesh", "bdt", "taka", "cash on delivery"]
  };

  // src/extension/countryProfiles/profiles/us.ts
  var US_PROFILE = {
    countryCode: "US",
    countryName: "United States",
    aliases: ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA", "AMERICA"],
    phone: {
      internationalPrefixes: ["+1"],
      phoneRegex: /(?:\+1[\s\-]?[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4})/,
      domesticRegex: /\b[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}\b/,
      sharedPrefixes: ["+1"],
      tollFreeAreaCodes: ["800", "888", "877", "866", "855", "844", "833"]
    },
    regions: {
      statesOrProvinces: [
        "alabama",
        "alaska",
        "arizona",
        "arkansas",
        "california",
        "colorado",
        "connecticut",
        "delaware",
        "florida",
        "georgia",
        "hawaii",
        "idaho",
        "illinois",
        "indiana",
        "iowa",
        "kansas",
        "kentucky",
        "louisiana",
        "maine",
        "maryland",
        "massachusetts",
        "michigan",
        "minnesota",
        "mississippi",
        "missouri",
        "montana",
        "nebraska",
        "nevada",
        "new hampshire",
        "new jersey",
        "new mexico",
        "new york",
        "north carolina",
        "north dakota",
        "ohio",
        "oklahoma",
        "oregon",
        "pennsylvania",
        "rhode island",
        "south carolina",
        "south dakota",
        "tennessee",
        "texas",
        "utah",
        "vermont",
        "virginia",
        "washington",
        "west virginia",
        "wisconsin",
        "wyoming"
      ],
      stateCodes: [
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
        "DC"
      ],
      postalCodeRegex: /\b\d{5}(?:-\d{4})?\b/
    },
    majorCities: [
      "new york",
      "los angeles",
      "chicago",
      "houston",
      "phoenix",
      "philadelphia",
      "san antonio",
      "san diego",
      "dallas",
      "austin",
      "san jose",
      "fort worth",
      "jacksonville",
      "columbus",
      "charlotte",
      "indianapolis",
      "san francisco",
      "seattle",
      "denver",
      "washington",
      "boston",
      "utica",
      "miami",
      "atlanta"
    ],
    addressKeywords: [
      "street",
      "st.",
      "st",
      "avenue",
      "ave.",
      "ave",
      "boulevard",
      "blvd.",
      "blvd",
      "road",
      "rd.",
      "rd",
      "suite",
      "ste.",
      "ste",
      "drive",
      "dr.",
      "dr",
      "court",
      "ct.",
      "ct",
      "lane",
      "ln.",
      "ln",
      "highway",
      "hwy",
      "parkway",
      "pkwy"
    ],
    operationalPhrases: [
      "free shipping in us",
      "us nationwide delivery",
      "ships within us",
      "continental us",
      "lower 48",
      "made in usa",
      "us shipping",
      "nationwide delivery"
    ],
    domainSuffixes: [".us", ".gov", ".mil"],
    knownCommercialDomains: [
      "raymourflanigan.com",
      "officedepot.com",
      "tahans.com",
      "ashleyfurniture.com",
      "target.com",
      "walmart.com",
      "homedepot.com"
    ],
    keywords: ["labor day", "nationwide delivery", "special financing", "us shipping", "usd", "veterans day", "memorial day"]
  };

  // src/extension/countryProfiles/profiles/gb.ts
  var GB_PROFILE = {
    countryCode: "GB",
    countryName: "United Kingdom",
    aliases: [
      "GB",
      "UK",
      "UNITED KINGDOM",
      "GREAT BRITAIN",
      "ENGLAND",
      "SCOTLAND",
      "WALES",
      "NORTHERN IRELAND"
    ],
    phone: {
      internationalPrefixes: ["+44"],
      phoneRegex: /(?:\+44[\s\-]?[1-9](?:[\s\-]?\d){8,9})/,
      domesticRegex: /\b0[12378](?:[\s\-]?\d){8,9}\b/
    },
    regions: {
      statesOrProvinces: [
        "england",
        "scotland",
        "wales",
        "northern ireland",
        "devon",
        "north devon",
        "cornwall",
        "yorkshire",
        "kent",
        "essex",
        "surrey",
        "lancashire",
        "hampshire",
        "somerset"
      ],
      postalCodeRegex: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i
    },
    majorCities: [
      "london",
      "birmingham",
      "manchester",
      "leeds",
      "glasgow",
      "liverpool",
      "newcastle",
      "sheffield",
      "bristol",
      "edinburgh",
      "belfast",
      "cardiff",
      "nottingham",
      "southampton"
    ],
    addressKeywords: [
      "high street",
      "street",
      "st",
      "road",
      "rd",
      "lane",
      "ln",
      "avenue",
      "ave",
      "close",
      "drive",
      "way",
      "walk",
      "gardens",
      "square",
      "sq",
      "unit",
      "building",
      "mews"
    ],
    operationalPhrases: [
      "uk mainland delivery",
      "free uk delivery",
      "delivering across uk",
      "nationwide uk delivery",
      "uk delivery only",
      "in-store & online"
    ],
    domainSuffixes: [".co.uk", ".uk", ".org.uk", ".gov.uk", ".ac.uk"],
    knownCommercialDomains: [
      "scs.co.uk",
      "fairwayfurniture.co.uk",
      "argos.co.uk",
      "currys.co.uk",
      "johnlewis.com",
      "marksandspencer.com"
    ],
    keywords: [
      "uk",
      "gbp",
      "interest free credit",
      "registered in england",
      "vat registered",
      "hmrc",
      "companies house"
    ]
  };

  // src/extension/countryProfiles/profiles/ca.ts
  var CA_PROFILE = {
    countryCode: "CA",
    countryName: "Canada",
    aliases: ["CA", "CANADA", "CAN"],
    phone: {
      internationalPrefixes: ["+1"],
      phoneRegex: /(?:\+1[\s\-]?[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4})/,
      domesticRegex: /\b[2-9]\d{2}[\s\-]?[2-9]\d{2}[\s\-]?\d{4}\b/,
      sharedPrefixes: ["+1"],
      tollFreeAreaCodes: ["800", "888", "877", "866", "855", "844", "833"]
    },
    regions: {
      statesOrProvinces: [
        "ontario",
        "quebec",
        "british columbia",
        "alberta",
        "manitoba",
        "saskatchewan",
        "nova scotia",
        "new brunswick",
        "newfoundland",
        "prince edward island",
        "northwest territories",
        "yukon",
        "nunavut"
      ],
      stateCodes: [
        "ON",
        "QC",
        "BC",
        "AB",
        "MB",
        "SK",
        "NS",
        "NB",
        "NL",
        "PE",
        "NT",
        "YT",
        "NU"
      ],
      postalCodeRegex: /\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s*\d[A-CEGHJ-NPR-TV-Z]\d\b/i
    },
    majorCities: [
      "toronto",
      "montreal",
      "vancouver",
      "calgary",
      "edmonton",
      "ottawa",
      "winnipeg",
      "quebec city",
      "hamilton",
      "kitchener",
      "halifax",
      "victoria",
      "mississauga",
      "brampton",
      "surrey",
      "laval",
      "markham"
    ],
    addressKeywords: [
      "street",
      "st",
      "rue",
      "avenue",
      "ave",
      "boulevard",
      "blvd",
      "road",
      "rd",
      "chemin",
      "suite",
      "ste",
      "drive",
      "dr",
      "court",
      "ct"
    ],
    operationalPhrases: [
      "canada-wide delivery",
      "free shipping across canada",
      "shipping across canada",
      "canadian owned",
      "made in canada",
      "coast to coast delivery"
    ],
    domainSuffixes: [".ca"],
    knownCommercialDomains: [
      "canadiantire.ca",
      "thebay.com",
      "bestbuy.ca",
      "leons.ca",
      "brick.com"
    ],
    keywords: ["cad", "gst/hst", "canadian", "canada wide", "cra registered"]
  };

  // src/extension/countryProfiles/profiles/au.ts
  var AU_PROFILE = {
    countryCode: "AU",
    countryName: "Australia",
    aliases: ["AU", "AUSTRALIA", "AUS", "OZ"],
    phone: {
      internationalPrefixes: ["+61"],
      phoneRegex: /(?:\+61[\s\-]?[2-478](?:[\s\-]?\d){7,8})/,
      domesticRegex: /\b0[2-478](?:[\s\-]?\d){7,8}\b/
    },
    regions: {
      statesOrProvinces: [
        "new south wales",
        "victoria",
        "queensland",
        "western australia",
        "south australia",
        "tasmania",
        "australian capital territory",
        "northern territory"
      ],
      stateCodes: ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"],
      postalCodeRegex: /\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s*\d{4}\b/i
    },
    majorCities: [
      "sydney",
      "melbourne",
      "brisbane",
      "perth",
      "adelaide",
      "gold coast",
      "canberra",
      "newcastle",
      "wollongong",
      "hobart",
      "geelong",
      "darwin"
    ],
    addressKeywords: [
      "street",
      "st",
      "road",
      "rd",
      "parade",
      "pde",
      "highway",
      "hwy",
      "avenue",
      "ave",
      "crescent",
      "cres",
      "court",
      "ct",
      "drive",
      "dr",
      "unit"
    ],
    operationalPhrases: [
      "australia wide",
      "australia-wide delivery",
      "delivery across australia",
      "aussie owned",
      "australian made",
      "free shipping australia wide"
    ],
    domainSuffixes: [".com.au", ".net.au", ".au", ".org.au", ".gov.au"],
    knownCommercialDomains: [
      "hospitalityfurniture.net.au",
      "harveynorman.com.au",
      "bunnings.com.au",
      "thegoodguys.com.au",
      "freedom.com.au"
    ],
    keywords: ["australia", "aud", "australia wide", "abn", "acn", "afterpay"]
  };

  // src/extension/countryProfiles/profiles/ie.ts
  var IE_PROFILE = {
    countryCode: "IE",
    countryName: "Ireland",
    aliases: ["IE", "IRELAND", "EIRE", "REPUBLIC OF IRELAND"],
    phone: {
      internationalPrefixes: ["+353"],
      phoneRegex: /(?:\+353[\s\-]?[1-9](?:[\s\-]?\d){6,8})/,
      domesticRegex: /\b0[1-9](?:[\s\-]?\d){6,8}\b/
    },
    regions: {
      statesOrProvinces: [
        "county dublin",
        "county cork",
        "county galway",
        "county kildare",
        "county meath",
        "county limerick",
        "county waterford",
        "county louth",
        "county wicklow",
        "county kerry",
        "county clare",
        "county mayo",
        "county donegal",
        "county tipperary",
        "co. dublin",
        "co. cork",
        "co. galway"
      ],
      // Eircode routing keys (e.g. D02, T12, H91) followed by alphanumeric identifier
      postalCodeRegex: /\b[A-W]\d{2}\s*[0-9A-Z]{4}\b/i
    },
    majorCities: [
      "dublin",
      "cork",
      "galway",
      "limerick",
      "waterford",
      "drogheda",
      "dundalk",
      "swords",
      "bray",
      "navan",
      "kilkenny"
    ],
    addressKeywords: [
      "street",
      "st",
      "road",
      "rd",
      "avenue",
      "ave",
      "lane",
      "ln",
      "terrace",
      "tce",
      "quay",
      "park",
      "square",
      "sq",
      "unit",
      "industrial estate"
    ],
    operationalPhrases: [
      "nationwide delivery ireland",
      "delivery across ireland",
      "irish owned",
      "all 32 counties",
      "republic of ireland delivery",
      "free delivery ireland",
      "ireland delivery"
    ],
    domainSuffixes: [".ie"],
    knownCommercialDomains: [
      "harveynorman.ie",
      "woodies.ie",
      "did.ie",
      "currys.ie",
      "ezlivingfurniture.ie"
    ],
    keywords: ["ireland", "eur", "cro registered", "eircode", "an post"]
  };

  // src/extension/countryProfiles/profiles/in.ts
  var IN_PROFILE = {
    countryCode: "IN",
    countryName: "India",
    aliases: ["IN", "INDIA", "BHARAT"],
    phone: {
      internationalPrefixes: ["+91"],
      phoneRegex: /(?:\+91[\s\-]?[6-9]\d{9})/,
      domesticRegex: /\b[6-9]\d{9}\b/
    },
    majorCities: [
      "jaipur",
      "mumbai",
      "delhi",
      "bengaluru",
      "bangalore",
      "kolkata",
      "chennai",
      "hyderabad",
      "pune",
      "noida",
      "gurgaon",
      "ahmedabad",
      "surat"
    ],
    addressKeywords: [
      "road",
      "rd",
      "street",
      "st",
      "nagar",
      "colony",
      "marg",
      "sector",
      "phase",
      "plot"
    ],
    operationalPhrases: [
      "pan india",
      "all over india",
      "cash on delivery india",
      "great indian festival"
    ],
    domainSuffixes: [".in", ".co.in", ".org.in", ".net.in"],
    knownCommercialDomains: [
      "amazon.in",
      "interio.com",
      "flipkart.com",
      "myntra.com"
    ],
    keywords: ["india", "inr", "pan india", "great indian festival", "gstin"]
  };

  // src/extension/countryProfiles/profiles/cn.ts
  var CN_PROFILE = {
    countryCode: "CN",
    countryName: "China",
    aliases: ["CN", "CHINA", "PRC"],
    phone: {
      internationalPrefixes: ["+86", "86"],
      phoneRegex: /(?:\+86[\s\-]?[1-9]\d{9,10})/
    },
    majorCities: [
      "guangzhou",
      "foshan",
      "shenzhen",
      "dongguan",
      "yiwu",
      "zhejiang",
      "shanghai",
      "beijing",
      "ningbo",
      "hangzhou"
    ],
    addressKeywords: ["district", "road", "industrial park", "building", "street"],
    operationalPhrases: [
      "factory direct",
      "factory-direct",
      "oem and odm",
      "square meter factory",
      "china export"
    ],
    domainSuffixes: [".cn", ".com.cn"],
    knownCommercialDomains: [
      "alibaba.com",
      "made-in-china.com",
      "aliexpress.com",
      "1688.com"
    ],
    keywords: [
      "oem and odm",
      "factory-direct",
      "oem configurations",
      "square meter factory",
      "china manufacturer"
    ]
  };

  // src/extension/countryProfiles/registry.ts
  var PROFILES = [
    BD_PROFILE,
    US_PROFILE,
    GB_PROFILE,
    CA_PROFILE,
    AU_PROFILE,
    IE_PROFILE,
    IN_PROFILE,
    CN_PROFILE
  ];
  var CODE_MAP = /* @__PURE__ */ new Map();
  var ALIAS_MAP = /* @__PURE__ */ new Map();
  for (const profile of PROFILES) {
    const code = profile.countryCode.toUpperCase();
    CODE_MAP.set(code, profile);
    ALIAS_MAP.set(code, code);
    for (const alias of profile.aliases) {
      ALIAS_MAP.set(alias.toUpperCase(), code);
    }
  }

  // src/extension/extraction/normalizer.ts
  var COMMON_COUNTRY_CODES = {
    US: { code: "US", dial: "1", nationalDigits: [10] },
    CA: { code: "CA", dial: "1", nationalDigits: [10] },
    GB: { code: "GB", dial: "44", nationalDigits: [10, 11] },
    UK: { code: "GB", dial: "44", nationalDigits: [10, 11] },
    BD: { code: "BD", dial: "880", nationalDigits: [10, 11] },
    DE: { code: "DE", dial: "49", nationalDigits: [9, 10, 11, 12] },
    FR: { code: "FR", dial: "33", nationalDigits: [9, 10] },
    ES: { code: "ES", dial: "34", nationalDigits: [9] },
    AU: { code: "AU", dial: "61", nationalDigits: [9, 10] },
    AE: { code: "AE", dial: "971", nationalDigits: [9] },
    IN: { code: "IN", dial: "91", nationalDigits: [10] },
    SG: { code: "SG", dial: "65", nationalDigits: [8] },
    NZ: { code: "NZ", dial: "64", nationalDigits: [8, 9] },
    IE: { code: "IE", dial: "353", nationalDigits: [9] },
    NL: { code: "NL", dial: "31", nationalDigits: [9] },
    IT: { code: "IT", dial: "39", nationalDigits: [9, 10] },
    BR: { code: "BR", dial: "55", nationalDigits: [10, 11] },
    JP: { code: "JP", dial: "81", nationalDigits: [10] }
  };
  function sanitizeText(raw, maxLength = 2e3) {
    if (raw === null || raw === void 0) return "";
    let text = String(raw);
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");
    text = text.replace(/<[^>]*>/g, " ");
    text = text.normalize("NFC");
    text = text.replace(/[ \t\r\f\v]+/g, " ").trim();
    if (text.length > maxLength) {
      text = text.substring(0, maxLength).trim();
    }
    return text;
  }
  function normalizePhone(rawPhone, countryHint) {
    const original = sanitizeText(rawPhone, 100);
    if (!original) {
      return {
        rawPhone: "",
        phoneState: "PHONE_INVALID",
        countryInference: "COUNTRY_UNKNOWN",
        isValid: false,
        error: "EMPTY_PHONE"
      };
    }
    let extension;
    let cleanInput = original;
    const extMatch = original.match(/(?:ext|ext\.|x|#)\s*([0-9]{1,6})/i);
    if (extMatch) {
      extension = extMatch[1];
      cleanInput = original.substring(0, extMatch.index).trim();
    }
    const hasPlus = cleanInput.trim().startsWith("+");
    const digits = cleanInput.replace(/[^0-9]/g, "");
    if (digits.length < 5 || digits.length > 15) {
      return {
        rawPhone: original,
        phoneState: "PHONE_INVALID",
        countryInference: "COUNTRY_UNKNOWN",
        isValid: false,
        error: "INVALID_DIGIT_LENGTH"
      };
    }
    let countryMeta = countryHint ? COMMON_COUNTRY_CODES[countryHint.toUpperCase()] : void 0;
    let countryInference = countryHint ? "COUNTRY_EXPLICIT" : "COUNTRY_UNKNOWN";
    let e164;
    let dialCode;
    let nationalNumber = digits;
    if (hasPlus) {
      for (const meta of Object.values(COMMON_COUNTRY_CODES)) {
        if (digits.startsWith(meta.dial)) {
          dialCode = meta.dial;
          nationalNumber = digits.substring(meta.dial.length);
          e164 = `+${digits}`;
          if (!countryMeta) {
            countryMeta = meta;
            countryInference = "COUNTRY_INFERRED";
          }
          break;
        }
      }
      if (!e164) {
        e164 = `+${digits}`;
        countryInference = "COUNTRY_INFERRED";
      }
    } else if (countryMeta) {
      if (countryMeta.nationalDigits.includes(digits.length)) {
        e164 = `+${countryMeta.dial}${digits}`;
        dialCode = countryMeta.dial;
        nationalNumber = digits;
      } else if (digits.startsWith(countryMeta.dial)) {
        e164 = `+${digits}`;
        dialCode = countryMeta.dial;
        nationalNumber = digits.substring(countryMeta.dial.length);
      } else {
        return {
          rawPhone: original,
          phoneState: "PHONE_AMBIGUOUS",
          countryInference: "COUNTRY_EXPLICIT",
          countryCode: countryMeta.code,
          isValid: false,
          error: "AMBIGUOUS_NATIONAL_NUMBER_FOR_COUNTRY"
        };
      }
    } else {
      return {
        rawPhone: original,
        phoneState: "PHONE_AMBIGUOUS",
        countryInference: "COUNTRY_UNKNOWN",
        isValid: false,
        error: "AMBIGUOUS_WITHOUT_COUNTRY_CODE"
      };
    }
    return {
      rawPhone: original,
      e164Format: e164,
      internationalFormat: e164,
      nationalFormat: nationalNumber,
      countryCode: countryMeta?.code,
      countryInference,
      dialCode,
      extension,
      phoneState: "PHONE_NORMALIZED",
      isValid: true
    };
  }
  function normalizeEmail(rawEmail) {
    if (!rawEmail) {
      return {
        rawEmail: "",
        normalizedEmail: "",
        localPart: "",
        domainPart: "",
        isValid: false,
        error: "EMPTY_EMAIL"
      };
    }
    const stripped = String(rawEmail).trim().replace(/^[<(\["']+|[>)\]"']+$/g, "").trim();
    const original = sanitizeText(stripped, 254);
    if (!original) {
      return {
        rawEmail: String(rawEmail),
        normalizedEmail: "",
        localPart: "",
        domainPart: "",
        isValid: false,
        error: "EMPTY_EMAIL"
      };
    }
    const emailRegex = /^([a-zA-Z0-9_\.\-\+]+)@([a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+)$/;
    const match = original.match(emailRegex);
    if (!match) {
      return {
        rawEmail: String(rawEmail),
        normalizedEmail: "",
        localPart: "",
        domainPart: "",
        isValid: false,
        error: "INVALID_EMAIL_SYNTAX"
      };
    }
    const localPart = match[1];
    const domainPart = match[2].toLowerCase();
    const normalizedEmail = `${localPart}@${domainPart}`;
    return {
      rawEmail: String(rawEmail),
      normalizedEmail,
      localPart,
      domainPart,
      isValid: true
    };
  }

  // src/extension/contactQuality.ts
  var PLACEHOLDER_EMAIL_DOMAINS = /* @__PURE__ */ new Set([
    "example.com",
    "example.org",
    "example.net",
    "domain.com",
    "email.com",
    "sentry.io",
    "wixpress.com",
    "wordpress.org",
    "shopify.com",
    "myshopify.com",
    "gravatar.com",
    "schema.org",
    "facebook.com",
    "fb.com",
    "meta.com",
    "instagram.com"
  ]);
  function normalizeContactPhone(rawPhone, countryHint) {
    if (!rawPhone || !rawPhone.trim()) {
      return {
        syntaxState: "NOT_OBSERVED",
        reason: "No phone number observed in ad creative or links."
      };
    }
    const cleaned = sanitizeText(rawPhone, 100);
    const digitsOnly = cleaned.replace(/[^0-9]/g, "");
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return {
        syntaxState: "SYNTAX_INVALID",
        reason: `Phone digits count (${digitsOnly.length}) is outside standard E.164 boundary (7-15 digits).`
      };
    }
    const norm = normalizePhone(cleaned, countryHint);
    if (!norm.isValid) {
      if (norm.error === "AMBIGUOUS_WITHOUT_COUNTRY_CODE" || norm.phoneState === "PHONE_AMBIGUOUS") {
        return {
          normalized: digitsOnly,
          e164: void 0,
          syntaxState: "AMBIGUOUS",
          reason: "Local phone number lacks explicit international country dial code.",
          nationalFormat: digitsOnly
        };
      }
      return {
        syntaxState: "SYNTAX_INVALID",
        reason: norm.error || "Failed standard phone validation."
      };
    }
    return {
      normalized: norm.e164Format || norm.nationalFormat || digitsOnly,
      e164: norm.e164Format,
      syntaxState: "SYNTAX_VALID",
      reason: `Format validated via E.164/national standard (inferred: ${norm.countryInference}).`,
      extension: norm.extension,
      nationalFormat: norm.nationalFormat
    };
  }
  function normalizeContactEmail(rawEmail) {
    if (!rawEmail || !rawEmail.trim()) {
      return {
        syntaxState: "NOT_OBSERVED",
        reason: "No email address observed in ad creative or links."
      };
    }
    const stripped = String(rawEmail).trim().replace(/^[<(\["']+|[>)\]"']+$/g, "").trim();
    const cleaned = sanitizeText(stripped, 254);
    const norm = normalizeEmail(cleaned);
    if (!norm.isValid) {
      return {
        syntaxState: "SYNTAX_INVALID",
        reason: norm.error || "Invalid RFC 5322 email syntax."
      };
    }
    const domain = norm.domainPart.toLowerCase();
    if (PLACEHOLDER_EMAIL_DOMAINS.has(domain)) {
      return {
        normalized: norm.normalizedEmail,
        syntaxState: "SYNTAX_INVALID",
        reason: `Email domain "${domain}" is a known placeholder/vendor domain, not a private business contact.`,
        localPart: norm.localPart,
        domainPart: domain
      };
    }
    if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
      return {
        syntaxState: "SYNTAX_INVALID",
        reason: "Email domain lacks valid top-level domain."
      };
    }
    return {
      normalized: norm.normalizedEmail,
      syntaxState: "SYNTAX_VALID",
      reason: "RFC 5322 compliant syntax validated.",
      localPart: norm.localPart,
      domainPart: domain
    };
  }
  function extractContactsFromText(text, sourceSurface = "AD_BODY_TEXT", libraryId, countryHint) {
    const phones = [];
    const emails = [];
    if (!text || typeof text !== "string") return { phones, emails };
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let emailMatch;
    const seenEmails = /* @__PURE__ */ new Set();
    while ((emailMatch = emailRegex.exec(text)) !== null) {
      const raw = emailMatch[0];
      const lower = raw.toLowerCase();
      if (seenEmails.has(lower)) continue;
      seenEmails.add(lower);
      const normRes = normalizeContactEmail(raw);
      const startIdx = Math.max(0, emailMatch.index - 25);
      const endIdx = Math.min(text.length, emailMatch.index + raw.length + 25);
      const contextSnippet = text.substring(startIdx, endIdx).replace(/\s+/g, " ").trim();
      emails.push({
        id: `email_${libraryId || "anon"}_${emails.length + 1}`,
        type: "EMAIL",
        rawValue: raw,
        normalizedValue: normRes.normalized,
        sourceSurface,
        syntaxState: normRes.syntaxState,
        verificationStatus: normRes.syntaxState === "SYNTAX_VALID" ? "UNPROBED_PUBLIC_CLAIM" : "NOT_OBSERVED",
        confidence: normRes.syntaxState === "SYNTAX_VALID" ? "HIGH" : "LOW",
        contextSnippet,
        adLibraryId: libraryId,
        observedAt: (/* @__PURE__ */ new Date()).toISOString(),
        evidenceReason: normRes.reason
      });
    }
    const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,5}\b/g;
    let phoneMatch;
    const seenPhones = /* @__PURE__ */ new Set();
    while ((phoneMatch = phoneRegex.exec(text)) !== null) {
      const raw = phoneMatch[0].trim();
      const digitsOnly = raw.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) continue;
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) continue;
      if (seenPhones.has(digitsOnly)) continue;
      seenPhones.add(digitsOnly);
      const normRes = normalizeContactPhone(raw, countryHint);
      const startIdx = Math.max(0, phoneMatch.index - 25);
      const endIdx = Math.min(text.length, phoneMatch.index + raw.length + 25);
      const contextSnippet = text.substring(startIdx, endIdx).replace(/\s+/g, " ").trim();
      phones.push({
        id: `phone_${libraryId || "anon"}_${phones.length + 1}`,
        type: "PHONE",
        rawValue: raw,
        normalizedValue: normRes.normalized,
        sourceSurface,
        syntaxState: normRes.syntaxState,
        verificationStatus: normRes.syntaxState === "SYNTAX_VALID" || normRes.syntaxState === "AMBIGUOUS" ? "UNPROBED_PUBLIC_CLAIM" : "NOT_OBSERVED",
        confidence: normRes.syntaxState === "SYNTAX_VALID" ? "HIGH" : normRes.syntaxState === "AMBIGUOUS" ? "MEDIUM" : "LOW",
        contextSnippet,
        adLibraryId: libraryId,
        observedAt: (/* @__PURE__ */ new Date()).toISOString(),
        evidenceReason: normRes.reason,
        countryHint,
        e164Format: normRes.e164,
        nationalFormat: normRes.nationalFormat,
        extension: normRes.extension
      });
    }
    return { phones, emails };
  }
  function extractContactsFromAdCard(cardRoot, libraryId, countryHint) {
    const allPhones = [];
    const allEmails = [];
    const seenPhoneDigits = /* @__PURE__ */ new Set();
    const seenEmailNorms = /* @__PURE__ */ new Set();
    const links = Array.from(cardRoot.querySelectorAll("a"));
    for (const link of links) {
      const href = link.href || link.getAttribute("href") || "";
      const linkText = (link.innerText || link.textContent || "").trim();
      if (href.startsWith("tel:")) {
        const raw = href.replace(/^tel:\s*/i, "").trim();
        const normRes = normalizeContactPhone(raw, countryHint);
        const digits = raw.replace(/[^0-9]/g, "");
        if (digits && !seenPhoneDigits.has(digits)) {
          seenPhoneDigits.add(digits);
          allPhones.push({
            id: `tel_link_${libraryId || "anon"}_${allPhones.length + 1}`,
            type: "PHONE",
            rawValue: raw,
            normalizedValue: normRes.normalized,
            sourceSurface: "TEL_LINK",
            syntaxState: normRes.syntaxState,
            verificationStatus: normRes.syntaxState === "SYNTAX_VALID" || normRes.syntaxState === "AMBIGUOUS" ? "UNPROBED_PUBLIC_CLAIM" : "NOT_OBSERVED",
            confidence: "HIGH",
            contextSnippet: `Link text: "${linkText}"`,
            adLibraryId: libraryId,
            observedAt: (/* @__PURE__ */ new Date()).toISOString(),
            evidenceReason: `Explicit tel: anchor observed in DOM: ${normRes.reason}`,
            countryHint,
            e164Format: normRes.e164,
            nationalFormat: normRes.nationalFormat
          });
        }
      }
      if (href.startsWith("mailto:")) {
        const raw = href.replace(/^mailto:\s*/i, "").split("?")[0].trim();
        const normRes = normalizeContactEmail(raw);
        const lower = raw.toLowerCase();
        if (lower && !seenEmailNorms.has(lower)) {
          seenEmailNorms.add(lower);
          allEmails.push({
            id: `mailto_link_${libraryId || "anon"}_${allEmails.length + 1}`,
            type: "EMAIL",
            rawValue: raw,
            normalizedValue: normRes.normalized,
            sourceSurface: "MAILTO_LINK",
            syntaxState: normRes.syntaxState,
            verificationStatus: normRes.syntaxState === "SYNTAX_VALID" ? "UNPROBED_PUBLIC_CLAIM" : "NOT_OBSERVED",
            confidence: "HIGH",
            contextSnippet: `Link text: "${linkText}"`,
            adLibraryId: libraryId,
            observedAt: (/* @__PURE__ */ new Date()).toISOString(),
            evidenceReason: `Explicit mailto: anchor observed in DOM: ${normRes.reason}`
          });
        }
      }
      if (href.includes("wa.me/") || href.includes("api.whatsapp.com/send")) {
        let rawPhone = "";
        if (href.includes("wa.me/")) {
          const match = href.match(/wa\.me\/([0-9+]+)/i);
          if (match) rawPhone = match[1];
        } else {
          try {
            const u = new URL(href);
            rawPhone = u.searchParams.get("phone") || "";
          } catch {
          }
        }
        if (rawPhone) {
          const intlPhone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
          const normRes = normalizeContactPhone(intlPhone, countryHint);
          const digits = rawPhone.replace(/[^0-9]/g, "");
          if (digits && !seenPhoneDigits.has(digits)) {
            seenPhoneDigits.add(digits);
            allPhones.push({
              id: `wa_link_${libraryId || "anon"}_${allPhones.length + 1}`,
              type: "PHONE",
              rawValue: rawPhone,
              normalizedValue: normRes.normalized,
              sourceSurface: "WHATSAPP_LINK",
              syntaxState: normRes.syntaxState,
              verificationStatus: normRes.syntaxState === "SYNTAX_VALID" || normRes.syntaxState === "AMBIGUOUS" ? "UNPROBED_PUBLIC_CLAIM" : "NOT_OBSERVED",
              confidence: "HIGH",
              contextSnippet: `WhatsApp link destination: ${href.substring(0, 60)}`,
              adLibraryId: libraryId,
              observedAt: (/* @__PURE__ */ new Date()).toISOString(),
              evidenceReason: `WhatsApp direct link observed in ad card: ${normRes.reason}`,
              countryHint,
              e164Format: normRes.e164,
              nationalFormat: normRes.nationalFormat
            });
          }
        }
      }
    }
    const fullText = cardRoot.innerText || cardRoot.textContent || "";
    const textContacts = extractContactsFromText(fullText, "AD_BODY_TEXT", libraryId, countryHint);
    for (const p of textContacts.phones) {
      const digits = p.rawValue.replace(/[^0-9]/g, "");
      if (!seenPhoneDigits.has(digits)) {
        seenPhoneDigits.add(digits);
        allPhones.push(p);
      }
    }
    for (const e of textContacts.emails) {
      const lower = e.rawValue.toLowerCase();
      if (!seenEmailNorms.has(lower)) {
        seenEmailNorms.add(lower);
        allEmails.push(e);
      }
    }
    return { phones: allPhones, emails: allEmails };
  }

  // src/extension/metaAdapter.ts
  function checkForBotChallenge(doc) {
    const hasAdCards = Array.from(doc.querySelectorAll("span, div")).some(
      (el) => {
        const txt = el.textContent || "";
        return /(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*[0-9]+/i.test(txt);
      }
    );
    if (hasAdCards) {
      return { isBlocked: false };
    }
    const text = doc.body ? doc.body.innerText || doc.body.textContent || "" : "";
    if (/(?:Security\s+Check|Enter\s+the\s+characters|verify\s+you\s+are\s+human|checkpoint|captcha)/i.test(text)) {
      return { isBlocked: true, reason: "Meta Security Check / CAPTCHA challenge presented.", code: "CHALLENGED" };
    }
    if (/(?:You(?:’|'|\s+are)\s+temporarily\s+blocked|Rate\s+limit\s+exceeded|Too\s+Many\s+Requests|Please\s+slow\s+down)/i.test(text)) {
      return { isBlocked: true, reason: "Meta access temporarily rate-limited.", code: "RATE_LIMITED" };
    }
    if (text.includes("Log In to Facebook") && doc.querySelectorAll('input[type="password"]').length > 0) {
      return { isBlocked: true, reason: "Meta mandatory login dialog restricting public ad library access.", code: "CHALLENGED" };
    }
    return { isBlocked: false };
  }
  function extractUrlFromShim(rawHref) {
    if (!rawHref || typeof rawHref !== "string") return {};
    let targetUrl = rawHref.trim();
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.toLowerCase();
      if (host.includes("facebook.com") && (parsed.pathname === "/l.php" || parsed.pathname.includes("/l.php"))) {
        const uParam = parsed.searchParams.get("u");
        if (uParam) {
          targetUrl = decodeURIComponent(uParam);
        }
      }
      const finalParsed = new URL(targetUrl);
      const finalHost = finalParsed.hostname.toLowerCase();
      const fbInternalDomains = [
        "facebook.com",
        "fb.com",
        "fb.me",
        "meta.com",
        "messenger.com",
        "instagram.com",
        "threads.net",
        "whatsapp.com"
      ];
      const isInternal = fbInternalDomains.some(
        (domain) => finalHost === domain || finalHost.endsWith("." + domain)
      );
      if (isInternal) {
        if (finalHost.includes("instagram.com")) {
          return {
            destinationUrl: targetUrl,
            domain: "instagram.com"
          };
        }
        return {};
      }
      const cleanDomain = finalHost.replace(/^www\./, "");
      return {
        destinationUrl: targetUrl,
        domain: cleanDomain
      };
    } catch {
      return {};
    }
  }
  function extractFacebookPageInfo(href, linkText) {
    if (!href) return {};
    try {
      const parsed = new URL(href);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes("facebook.com") && !host.includes("fb.com")) return {};
      const path = parsed.pathname;
      if (path === "/" || path.startsWith("/ads/") || path.startsWith("/policy") || path.startsWith("/help") || path.startsWith("/settings") || path.startsWith("/legal") || path.includes("terms")) {
        return {};
      }
      const cleanUrl = `https://www.facebook.com${path}`;
      return {
        pageUrl: cleanUrl,
        pageName: linkText?.trim() || void 0
      };
    } catch {
      return {};
    }
  }
  function normalizeAdLibraryText(text) {
    if (!text) return "";
    return text.replace(/[\uFF1A\uFE55\u05C3\u2236]/g, ":").replace(/[\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  }
  function extractAdIdentifier(text, context) {
    if (!text) return null;
    const clean = normalizeAdLibraryText(text);
    const explicitPatterns = [
      // English
      { regex: /(?:Library\s+ID|Ad\s+Library\s+ID)\s*:\s*([0-9]{5,25})/i, label: "Library ID" },
      // Spanish
      { regex: /(?:ID\s+de\s+la\s+biblioteca|ID\s+de\s+biblioteca)\s*:\s*([0-9]{5,25})/i, label: "ID de la biblioteca" },
      // French
      { regex: /(?:Identifiant\s+de\s+la\s+biblioth[eè]que|ID\s+de\s+la\s+biblioth[eè]que)\s*:\s*([0-9]{5,25})/i, label: "Identifiant de la biblioth\xE8que" },
      // German
      { regex: /(?:Bibliotheks-?ID|Bibliothek-?ID)\s*:\s*([0-9]{5,25})/i, label: "Bibliotheks-ID" },
      // Italian
      { regex: /(?:ID\s+della\s+libreria|ID\s+libreria)\s*:\s*([0-9]{5,25})/i, label: "ID della libreria" },
      // Portuguese
      { regex: /(?:ID\s+da\s+biblioteca)\s*:\s*([0-9]{5,25})/i, label: "ID da biblioteca" },
      // Dutch
      { regex: /(?:Bibliotheek-?ID|ID\s+van\s+de\s+bibliotheek)\s*:\s*([0-9]{5,25})/i, label: "Bibliotheek-ID" },
      // Polish
      { regex: /(?:Identyfikator\s+(?:w\s+)?Bibliotece|ID\s+biblioteki)\s*:\s*([0-9]{5,25})/i, label: "Identyfikator w Bibliotece" },
      // Nordic (Danish, Swedish, Norwegian)
      { regex: /(?:Biblioteks-?ID)\s*:\s*([0-9]{5,25})/i, label: "Biblioteks-ID" }
    ];
    const multiLocaleMonthRegex = /^\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic|Janv|F[eé]vr|Mars|Avr|Mai|Juin|Juil|Ao[uû]t|Sept|M[aä]r|Okt|Dez|Fev|Set|Out|Gen|Mag|Giu|Lug|Ott)\b/i;
    for (const { regex, label } of explicitPatterns) {
      const match = clean.match(regex);
      if (match && match[1]) {
        let extractedId = match[1];
        const afterMatch = clean.slice((match.index ?? 0) + match[0].length);
        const monthMatch = afterMatch.match(multiLocaleMonthRegex);
        if (monthMatch && extractedId.length >= 13) {
          const lastTwo = extractedId.slice(-2);
          const lastOne = extractedId.slice(-1);
          const numTwo = parseInt(lastTwo, 10);
          const numOne = parseInt(lastOne, 10);
          if (numTwo >= 1 && numTwo <= 31 && extractedId.length - 2 >= 12) {
            extractedId = extractedId.slice(0, -2);
          } else if (numOne >= 1 && numOne <= 9 && extractedId.length - 1 >= 12) {
            extractedId = extractedId.slice(0, -1);
          }
        } else if (/^[A-Za-z]/.test(afterMatch)) {
          return {
            id: extractedId,
            rawLabel: label,
            confidence: "LOW",
            isAmbiguous: true,
            ambiguityReason: `Ambiguous boundary: digits directly fused into non-digit token "${afterMatch.slice(0, 15)}"`,
            rawExtracted: match[0]
          };
        }
        return {
          id: extractedId,
          rawLabel: label,
          confidence: "HIGH"
        };
      }
    }
    const contextualMatch = clean.match(/\bID\s*:\s*([0-9]{5,25})/i);
    if (contextualMatch && contextualMatch[1]) {
      const ctx = normalizeAdLibraryText(context?.surroundingText || clean);
      const hasAdSignal = /(?:Library|Biblioteca|Biblioth|Libreria|Active|Inactive|Activo|Inactivo|Actif|Inactif|Aktiv|Inaktiv|Attivo|Inattivo|Ativo|Inativo|Started\s+running|Sponsored|Publicidad|Sponsoris|Gesponsert)/i.test(ctx);
      if (hasAdSignal) {
        let extractedId = contextualMatch[1];
        const afterMatch = clean.slice((contextualMatch.index ?? 0) + contextualMatch[0].length);
        const monthMatch = afterMatch.match(multiLocaleMonthRegex);
        if (monthMatch && extractedId.length >= 13) {
          const lastTwo = extractedId.slice(-2);
          const lastOne = extractedId.slice(-1);
          const numTwo = parseInt(lastTwo, 10);
          const numOne = parseInt(lastOne, 10);
          if (numTwo >= 1 && numTwo <= 31 && extractedId.length - 2 >= 12) {
            extractedId = extractedId.slice(0, -2);
          } else if (numOne >= 1 && numOne <= 9 && extractedId.length - 1 >= 12) {
            extractedId = extractedId.slice(0, -1);
          }
        } else if (/^[A-Za-z]/.test(afterMatch)) {
          return {
            id: extractedId,
            rawLabel: "ID (Contextual)",
            confidence: "LOW",
            isAmbiguous: true,
            ambiguityReason: `Ambiguous boundary: digits directly fused into non-digit token "${afterMatch.slice(0, 15)}"`,
            rawExtracted: contextualMatch[0]
          };
        }
        return {
          id: extractedId,
          rawLabel: "ID (Contextual)",
          confidence: "LOW"
        };
      }
    }
    return null;
  }
  function findCandidateCardRoot(idEl, doc) {
    const MAX_TRAVERSAL_DEPTH = 20;
    let current = idEl;
    let bestCardRoot = null;
    let depth = 0;
    while (current && current.parentElement && depth < MAX_TRAVERSAL_DEPTH) {
      const parent = current.parentElement;
      depth++;
      if (parent === doc.body || parent === doc.documentElement) {
        break;
      }
      const parentTag = (parent.tagName || "").toUpperCase();
      if (parentTag === "NAV" || parentTag === "HEADER" || parentTag === "FORM") {
        break;
      }
      if (parent.querySelector('input[type="search"], form[role="search"], nav')) {
        break;
      }
      const parentText = parent.textContent || "";
      const idMatches = parentText.match(/(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*[0-9]+/gi);
      if (idMatches && idMatches.length > 1) {
        if (!bestCardRoot) {
          bestCardRoot = current;
        }
        break;
      }
      const hasLinks = current.querySelectorAll("a").length > 0;
      const hasRoleArticle = current.getAttribute("role") === "article";
      const hasCardClass = typeof current.className === "string" && /(?:card|ad-card|result-card)/i.test(current.className);
      const hasAdvertiserSignal = /(?:Sponsored|Publicidad|Sponsoris|Gesponsert|Started\s+running|En\s+circulaci[oó]n)/i.test(current.textContent || "");
      if (hasRoleArticle || hasLinks && hasAdvertiserSignal || hasCardClass) {
        bestCardRoot = current;
      }
      current = parent;
    }
    const finalRoot = bestCardRoot || current || idEl;
    if (!finalRoot) {
      return { cardRoot: null, outcome: "INVALID_CONTAINER", reason: "No card container found" };
    }
    return { cardRoot: finalRoot, outcome: "VALID_CANDIDATE" };
  }
  function validateAdCardCandidate(cardRoot, libraryId, seenIds) {
    if (!libraryId || !/^[0-9]{5,25}$/.test(libraryId)) {
      return { isValid: false, outcome: "MISSING_IDENTIFIER", reason: "Invalid or missing library ID" };
    }
    if (seenIds.has(libraryId)) {
      return { isValid: false, outcome: "DUPLICATE_CANDIDATE", reason: `Duplicate library ID: ${libraryId}` };
    }
    if (!cardRoot) {
      return { isValid: false, outcome: "INVALID_CONTAINER", reason: "Card container element is null" };
    }
    const text = cardRoot.textContent || "";
    const idMatches = text.match(/(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*([0-9]+)/gi);
    if (idMatches && idMatches.length > 1) {
      const uniqueIds = new Set(idMatches.map((m) => m.replace(/[^0-9]/g, "")));
      if (uniqueIds.size > 1) {
        return { isValid: false, outcome: "INVALID_CONTAINER", reason: "Container encapsulates multiple ad cards" };
      }
    }
    return { isValid: true, outcome: "VALID_CANDIDATE" };
  }
  function extractFieldsFromCard(cardRoot, libraryId, observedKeyword) {
    const adDetailLink = cardRoot.querySelector('a[href*="/ads/library/?id="], a[href*="/ads/library/"]');
    if (adDetailLink) {
      const href = adDetailLink.href || "";
      const match = href.match(/[?&]id=([0-9]{5,25})/i);
      if (match && match[1]) {
        libraryId = match[1];
      }
    }
    const cardFullText = cardRoot.innerText || cardRoot.textContent || "";
    const inactiveRegex = /(?:Inactive|Inactivo|Inactif|Inaktiv|Inattivo|Inativo)/i;
    const activeRegex = /(?:Active|Activo|Actif|Aktiv|Attivo|Ativo)/i;
    const isActive = !inactiveRegex.test(cardFullText) && (activeRegex.test(cardFullText) || true);
    let startedRunning = "";
    const datePatterns = [
      /Started running on ([^\n~·]+)/i,
      /En circulaci[oó]n desde el ([^\n~·]+)/i,
      /En circulation depuis le ([^\n~·]+)/i,
      /Seit ([^\n~·]+) aktiv/i,
      /Inizio pubblicazione:?\s*([^\n~·]+)/i,
      /Veicula[çc][aã]o iniciada em ([^\n~·]+)/i,
      /([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4}\s*-\s*[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})/i
    ];
    for (const pattern of datePatterns) {
      const match = cardFullText.match(pattern);
      if (match) {
        startedRunning = match[1].trim();
        break;
      }
    }
    const hasMultipleVersions = /(?:multiple versions|plusieurs versions|m[uú]ltiples versiones|mehrere Versionen|pi[uù] versioni|v[aá]rias vers[oõ]es)/i.test(cardFullText);
    let pageName = "Unknown Advertiser";
    let facebookPageUrl;
    let facebookPageId;
    const links = Array.from(cardRoot.querySelectorAll("a"));
    for (const link of links) {
      const href = link.href || "";
      const linkText = link.innerText || link.textContent || "";
      const fbInfo = extractFacebookPageInfo(href, linkText);
      if (fbInfo.pageUrl) {
        facebookPageUrl = fbInfo.pageUrl;
        if (linkText && linkText.trim() && (!pageName || pageName === "Unknown Advertiser")) {
          pageName = linkText.trim();
        }
        const idMatch = fbInfo.pageUrl.match(/facebook\.com\/([0-9]{5,})/);
        if (idMatch) facebookPageId = idMatch[1];
        break;
      }
    }
    if (pageName === "Unknown Advertiser") {
      const sponsoredRegex = /(?:Sponsored|Publicidad|Sponsoris[eé]|Gesponsert|Sponsorizzato|Patrocinado)/i;
      const match = cardFullText.match(sponsoredRegex);
      if (match && typeof match.index === "number" && match.index > 0) {
        const textBefore = cardFullText.substring(0, match.index).trim();
        const lines = textBefore.split("\n").map((l) => l.trim()).filter(Boolean);
        const lastLine = lines.pop();
        if (lastLine && lastLine.length > 1 && !lastLine.includes("Library ID") && !lastLine.includes("Active")) {
          pageName = lastLine;
        }
      }
    }
    let destinationUrl;
    let destinationDomain;
    let ctaText;
    for (const link of links) {
      const href = link.href || "";
      const dest = extractUrlFromShim(href);
      if (dest.destinationUrl) {
        destinationUrl = dest.destinationUrl;
        destinationDomain = dest.domain;
        const text = (link.innerText || link.textContent || "").trim();
        if (text && text.length < 50) {
          ctaText = text.split("\n").pop()?.trim();
        }
        break;
      }
    }
    if (!ctaText) {
      const ctaPatterns = [
        "Learn more",
        "Shop Now",
        "Sign Up",
        "Contact Us",
        "Apply Now",
        "Book Now",
        "Get Quote",
        "Download",
        "M[a\xE1]s informaci[o\xF3]n",
        "En savoir plus",
        "Mehr dazu",
        "Scopri di pi[u\xF9]",
        "Saiba mais"
      ];
      for (const pattern of ctaPatterns) {
        if (cardFullText.includes(pattern)) {
          ctaText = pattern;
          break;
        }
      }
    }
    let bodyCopy = "";
    const bodyMatch = cardFullText.match(/(?:Sponsored|Publicidad|Sponsoris[eé]|Gesponsert|Sponsorizzato|Patrocinado)\s*\n([\s\S]{10,350})/i);
    if (bodyMatch) {
      bodyCopy = bodyMatch[1].trim().replace(/\n+/g, " ");
    } else {
      bodyCopy = cardFullText.substring(0, 200).replace(/\n+/g, " ");
    }
    const contactData = extractContactsFromAdCard(cardRoot, libraryId);
    const observedPhones = contactData.phones;
    const observedEmails = contactData.emails;
    const contactObservations = [...observedPhones, ...observedEmails];
    return {
      libraryId,
      pageName,
      facebookPageUrl,
      facebookPageId,
      destinationUrl,
      destinationDomain,
      isActive,
      startedRunning,
      hasMultipleVersions,
      bodyCopy: bodyCopy.substring(0, 300),
      ctaText,
      observedKeyword,
      rawText: cardFullText.substring(0, 200),
      observedPhones,
      observedEmails,
      contactObservations
    };
  }
  function extractAdCardsWithDiagnostics(doc, observedKeyword, options) {
    const startTime = Date.now();
    const candidates = [];
    const seenLibraryIds = options?.seenLibraryIds ? new Set(options.seenLibraryIds) : /* @__PURE__ */ new Set();
    const diagnosticDetails = [];
    let cardsExamined = 0;
    let identifierCandidatesFound = 0;
    let cardsRejectedMissingId = 0;
    let duplicateCardsIgnored = 0;
    try {
      const challenge = checkForBotChallenge(doc);
      if (challenge.isBlocked) {
        return {
          candidates: [],
          diagnostics: {
            cardsExamined: 0,
            identifierCandidatesFound: 0,
            validCardsAccepted: 0,
            cardsRejectedMissingId: 0,
            duplicateCardsIgnored: 0,
            extractionDurationMs: Date.now() - startTime,
            scrollIteration: options?.scrollIteration,
            relevantMutationsObserved: options?.relevantMutationsObserved
          },
          status: challenge.code || "CHALLENGED"
        };
      }
      const idCandidates = [];
      const detailLinks = Array.from(doc.querySelectorAll('a[href*="/ads/library/"]'));
      for (const link of detailLinks) {
        const href = link.href || "";
        const urlMatch = href.match(/[?&]id=([0-9]{5,25})/i);
        if (urlMatch && urlMatch[1]) {
          const id = urlMatch[1];
          if (!idCandidates.some((c) => c.idEl === link)) {
            idCandidates.push({
              idEl: link,
              idInfo: { id, rawLabel: "Ad Detail Link ID", confidence: "HIGH" }
            });
          }
        }
      }
      const allElements = Array.from(doc.querySelectorAll("div, span, p, a, strong, b"));
      for (const el of allElements) {
        const htmlEl = el;
        const text = htmlEl.textContent;
        if (!text || text.length > 250) continue;
        if (!/(?:ID|Identifiant|Bibliothek|Identyfikator|Biblioteka|Libreria)/i.test(text)) continue;
        const hasMatchingChild = (node) => {
          if (!node.children || node.children.length === 0) return false;
          for (const child of Array.from(node.children)) {
            const childText = child.textContent || "";
            if (/(?:ID|Identifiant|Bibliothek|Identyfikator|Biblioteka|Libreria)/i.test(childText) && extractAdIdentifier(childText, { surroundingText: child.parentElement?.textContent || "" }) !== null) {
              return true;
            }
            if (hasMatchingChild(child)) return true;
          }
          return false;
        };
        if (hasMatchingChild(htmlEl)) continue;
        const parentText = htmlEl.parentElement ? htmlEl.parentElement.textContent || "" : "";
        const idInfo = extractAdIdentifier(text, { surroundingText: parentText });
        if (idInfo) {
          const isRedundantInternal = idCandidates.some((c) => {
            if (c.idEl === htmlEl) return true;
            if (c.idInfo.id === idInfo.id) {
              return Boolean(c.idEl.contains?.(htmlEl) || htmlEl.contains?.(c.idEl));
            }
            return false;
          });
          if (!isRedundantInternal) {
            idCandidates.push({ idEl: htmlEl, idInfo });
          }
        } else {
          const malformedMatch = text.match(/(?:Library\s+ID|Ad\s+Library\s+ID|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca|ID\s+de\s+la\s+biblioteca|Bibliotheek-?ID|Identyfikator\s+(?:w\s+)?Bibliotece)\s*:\s*(\S*)/i);
          if (malformedMatch) {
            const extractedVal = malformedMatch[1]?.trim() || "";
            idCandidates.push({
              idEl: htmlEl,
              idInfo: {
                id: extractedVal,
                rawLabel: malformedMatch[0],
                confidence: "LOW",
                isAmbiguous: true,
                ambiguityReason: `Malformed or missing identifier digits: "${extractedVal}"`
              }
            });
          }
        }
      }
      const structuralCards = Array.from(doc.querySelectorAll('article, [role="article"], div[class*="ad-card"], div[class*="result-card"]'));
      for (const cardEl of structuralCards) {
        const htmlCard = cardEl;
        const alreadyHasCandidate = idCandidates.some((c) => htmlCard.contains?.(c.idEl) || htmlCard === c.idEl);
        if (!alreadyHasCandidate) {
          const hasAdSignal = /(?:Sponsored|Publicidad|Sponsoris|Gesponsert|Started\s+running)/i.test(htmlCard.textContent || "");
          if (hasAdSignal) {
            idCandidates.push({
              idEl: htmlCard,
              idInfo: {
                id: "",
                rawLabel: "Unidentified Card Container",
                confidence: "LOW",
                isAmbiguous: true,
                ambiguityReason: "Ad card container has no identifiable Library ID"
              }
            });
          }
        }
      }
      identifierCandidatesFound = idCandidates.length;
      const seenCardRoots = /* @__PURE__ */ new Set();
      for (const { idEl, idInfo } of idCandidates) {
        cardsExamined++;
        const { id: libraryId } = idInfo;
        if (!libraryId || idInfo.isAmbiguous) {
          cardsRejectedMissingId++;
          diagnosticDetails.push({
            libraryId: libraryId || "UNKNOWN",
            outcome: !libraryId ? "MISSING_IDENTIFIER" : "AMBIGUOUS_CANDIDATE",
            reason: idInfo.ambiguityReason || "Ambiguous identifier boundary without corroborating source"
          });
          continue;
        }
        if (seenLibraryIds.has(libraryId)) {
          duplicateCardsIgnored++;
          diagnosticDetails.push({ libraryId, outcome: "DUPLICATE_CANDIDATE", reason: "Identifier already seen in run" });
          continue;
        }
        const containerResult = findCandidateCardRoot(idEl, doc);
        if (!containerResult.cardRoot) {
          cardsRejectedMissingId++;
          diagnosticDetails.push({ libraryId, outcome: containerResult.outcome, reason: containerResult.reason });
          continue;
        }
        if (seenCardRoots.has(containerResult.cardRoot)) {
          duplicateCardsIgnored++;
          diagnosticDetails.push({ libraryId, outcome: "DUPLICATE_CANDIDATE", reason: "Physical card root already extracted in current scan pass" });
          continue;
        }
        const valResult = validateAdCardCandidate(containerResult.cardRoot, libraryId, seenLibraryIds);
        if (!valResult.isValid) {
          diagnosticDetails.push({ libraryId, outcome: valResult.outcome, reason: valResult.reason });
          if (valResult.outcome === "DUPLICATE_CANDIDATE") duplicateCardsIgnored++;
          else cardsRejectedMissingId++;
          continue;
        }
        seenCardRoots.add(containerResult.cardRoot);
        try {
          const candidate = extractFieldsFromCard(containerResult.cardRoot, libraryId, observedKeyword);
          candidates.push(candidate);
          seenLibraryIds.add(candidate.libraryId);
          diagnosticDetails.push({ libraryId: candidate.libraryId, outcome: "VALID_CANDIDATE" });
        } catch (cardErr) {
          cardsRejectedMissingId++;
          diagnosticDetails.push({
            libraryId,
            outcome: "PARSING_FAILED",
            reason: cardErr?.message || "Field extraction failed"
          });
        }
      }
      const duration = Date.now() - startTime;
      let status = "NO_NEW_RESULTS_OBSERVED";
      if (candidates.length > 0) {
        status = "RESULTS_FOUND";
      } else if (cardsRejectedMissingId > 0 && duplicateCardsIgnored === 0) {
        status = "EXTRACTION_ERROR";
      }
      return {
        candidates,
        diagnostics: {
          cardsExamined,
          identifierCandidatesFound,
          validCardsAccepted: candidates.length,
          cardsRejectedMissingId,
          duplicateCardsIgnored,
          extractionDurationMs: duration,
          scrollIteration: options?.scrollIteration,
          relevantMutationsObserved: options?.relevantMutationsObserved,
          details: diagnosticDetails
        },
        status
      };
    } catch (err) {
      return {
        candidates,
        diagnostics: {
          cardsExamined,
          identifierCandidatesFound,
          validCardsAccepted: candidates.length,
          cardsRejectedMissingId,
          duplicateCardsIgnored,
          extractionDurationMs: Date.now() - startTime,
          scrollIteration: options?.scrollIteration,
          relevantMutationsObserved: options?.relevantMutationsObserved,
          details: [
            ...diagnosticDetails,
            { outcome: "INVALID_CONTAINER", reason: err?.message || "Extraction exception" }
          ]
        },
        status: candidates.length > 0 ? "RESULTS_FOUND" : "EXTRACTION_ERROR"
      };
    }
  }

  // src/extension/content-script.ts
  console.log("[Meta Ad Library Scraper] Content script active on:", typeof window !== "undefined" ? window.location?.href : "unknown");
  var activeWaitCancellation = null;
  function isAtBottomOfPage(doc = document, win = window) {
    try {
      const scrollHeight = Math.max(
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0,
        doc.body?.offsetHeight || 0
      );
      const clientHeight = win.innerHeight || doc.documentElement?.clientHeight || 0;
      const currentScroll = win.scrollY || win.pageYOffset || 0;
      if (scrollHeight <= 0 || clientHeight <= 0) return false;
      return currentScroll + clientHeight >= scrollHeight - 250;
    } catch {
      return false;
    }
  }
  function waitForDynamicAdCards(doc = document, win = window, options) {
    const {
      keyword,
      scroll = true,
      quietPeriodMs = 400,
      maxWaitMs = 3500,
      scrollIteration = 1,
      seenLibraryIds = /* @__PURE__ */ new Set()
    } = options;
    return new Promise((resolve) => {
      let finished = false;
      let quietTimer = null;
      let maxWaitTimer = null;
      let observer = null;
      let relevantMutationsCount = 0;
      let scrolled = false;
      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (quietTimer) {
          clearTimeout(quietTimer);
          quietTimer = null;
        }
        if (maxWaitTimer) {
          clearTimeout(maxWaitTimer);
          maxWaitTimer = null;
        }
        if (activeWaitCancellation === cancelWait) {
          activeWaitCancellation = null;
        }
      };
      const finish = (statusOverride) => {
        if (finished) return;
        finished = true;
        cleanup();
        const extraction = extractAdCardsWithDiagnostics(doc, keyword, {
          seenLibraryIds,
          scrollIteration,
          relevantMutationsObserved: relevantMutationsCount
        });
        const atBottom = isAtBottomOfPage(doc, win);
        let finalStatus = statusOverride || extraction.status;
        if (finalStatus === "NO_NEW_RESULTS_OBSERVED" && atBottom) {
          finalStatus = "END_OF_RESULTS";
        }
        resolve({
          ...extraction,
          status: finalStatus,
          scrolled,
          atBottom
        });
      };
      const cancelWait = () => {
        finish("CANCELLED");
      };
      activeWaitCancellation = cancelWait;
      try {
        const initialChallenge = checkForBotChallenge(doc);
        if (initialChallenge.isBlocked) {
          finish(initialChallenge.code || "CHALLENGED");
          return;
        }
        if (scroll) {
          try {
            const prevScrollY = win.scrollY || win.pageYOffset || 0;
            if (typeof win.scrollBy === "function") {
              win.scrollBy(0, 1200);
            }
            scrolled = (win.scrollY || win.pageYOffset || 0) > prevScrollY || true;
          } catch {
            scrolled = false;
          }
        }
        const initialScan = extractAdCardsWithDiagnostics(doc, keyword, { seenLibraryIds });
        if (initialScan.candidates.length > 0) {
          quietTimer = setTimeout(() => {
            finish("RESULTS_FOUND");
          }, quietPeriodMs);
        }
        const MutationObserverClass = win.MutationObserver || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
        const targetNode = doc.body || doc.documentElement;
        if (MutationObserverClass && targetNode) {
          observer = new MutationObserverClass((mutations) => {
            try {
              if (finished) return;
              let hasRelevantElements = false;
              for (const m of mutations) {
                if (m.type === "childList" && m.addedNodes.length > 0) {
                  for (let i = 0; i < m.addedNodes.length; i++) {
                    if (m.addedNodes[i].nodeType === 1) {
                      hasRelevantElements = true;
                      break;
                    }
                  }
                }
                if (hasRelevantElements) break;
              }
              if (hasRelevantElements) {
                relevantMutationsCount++;
                const liveChallenge = checkForBotChallenge(doc);
                if (liveChallenge.isBlocked) {
                  finish(liveChallenge.code || "CHALLENGED");
                  return;
                }
                const currentScan = extractAdCardsWithDiagnostics(doc, keyword, { seenLibraryIds });
                if (currentScan.candidates.length > 0) {
                  if (quietTimer) clearTimeout(quietTimer);
                  quietTimer = setTimeout(() => {
                    finish("RESULTS_FOUND");
                  }, quietPeriodMs);
                } else {
                  if (quietTimer) clearTimeout(quietTimer);
                  quietTimer = setTimeout(() => {
                    finish();
                  }, quietPeriodMs);
                }
              }
            } catch {
              finish("EXTRACTION_ERROR");
            }
          });
          try {
            observer.observe(targetNode, { childList: true, subtree: true });
          } catch {
          }
        }
        maxWaitTimer = setTimeout(() => {
          finish();
        }, maxWaitMs);
      } catch {
        finish("EXTRACTION_ERROR");
      }
    });
  }
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "CONTENT_SCRIPT_READY",
        payload: { url: window.location.href, timestamp: Date.now() }
      }).catch(() => {
      });
    }
  } catch {
  }
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SCAN_AND_EXTRACT") {
        const keyword = message.payload?.keyword || "";
        const shouldScroll = message.payload?.scroll ?? true;
        const quietPeriodMs = message.payload?.quietPeriodMs;
        const maxWaitMs = message.payload?.maxWaitMs;
        const scrollIteration = message.payload?.scrollIteration;
        const seenIdsArray = message.payload?.seenLibraryIds || [];
        const seenLibraryIds = new Set(seenIdsArray);
        const challenge = checkForBotChallenge(document);
        if (challenge.isBlocked) {
          sendResponse({
            type: "CHALLENGE_DETECTED",
            reason: challenge.reason,
            code: challenge.code || "CHALLENGED",
            payload: {
              candidates: [],
              count: 0,
              status: challenge.code || "CHALLENGED",
              scrolled: false,
              atBottom: false
            }
          });
          return true;
        }
        waitForDynamicAdCards(document, window, {
          keyword,
          scroll: shouldScroll,
          quietPeriodMs,
          maxWaitMs,
          scrollIteration,
          seenLibraryIds
        }).then((result) => {
          sendResponse({
            type: "CANDIDATES_COLLECTED",
            payload: {
              candidates: result.candidates,
              count: result.candidates.length,
              status: result.status,
              diagnostics: result.diagnostics,
              scrolled: result.scrolled,
              atBottom: result.atBottom
            }
          });
        }).catch((err) => {
          sendResponse({
            type: "CANDIDATES_COLLECTED",
            payload: {
              candidates: [],
              count: 0,
              status: "EXTRACTION_ERROR",
              diagnostics: {
                cardsExamined: 0,
                identifierCandidatesFound: 0,
                validCardsAccepted: 0,
                cardsRejectedMissingId: 0,
                duplicateCardsIgnored: 0,
                extractionDurationMs: 0
              },
              scrolled: shouldScroll,
              atBottom: false,
              error: err?.message || "Unknown extraction error"
            }
          });
        });
        return true;
      }
      if (message.type === "CANCEL_RESEARCH" || message.type === "STOP_RESEARCH") {
        if (activeWaitCancellation) {
          activeWaitCancellation();
        }
        sendResponse({ status: "CANCELLED" });
        return false;
      }
      return false;
    });
  }
})();
