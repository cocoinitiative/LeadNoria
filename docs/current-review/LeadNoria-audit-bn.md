# LeadNoria: স্বাধীন কোড ও যাচাই রিপোর্ট

তারিখ: ২৫ অক্টোবর ২০২৬। ব্রাঞ্চ: main। Commit: bcc31fa। সোর্স সংস্করণ: 1.7.7।

## রায়
বর্তমানে এটি কার্যকর অফলাইন lead-processing ভিত্তি; বিক্রির উপযোগী, যাচাইকৃত Meta scraping product নয়। স্ক্র্যাপিংয়ের পুরোনো বাস্তব কোড আছে, কিন্তু বর্তমান execution gate সেটি বন্ধ করে। বড় rewrite শুরুর আগে release, record identity, persistence ও evidence semantics ঠিক করাই বেশি মূল্যবান। লাভ বা বাজারসেরা হওয়ার প্রমাণ এই repo দেয় না।

## কী যাচাই হয়েছে
- lockfile না বদলে npm ci --ignore-scripts সফল। TypeScript check সফল।
- work/audit-build-এ পৃথক কপিতে পূর্ণ npm run build সফল: web UI, server ও MV3 extension তৈরি হয়েছে। Web bundle 3.25 MB; build warning আছে, blocker নয়।
- সাতটি সরাসরি offline suite: মোট ১৩৪ assertion পাস, ২ ব্যর্থ।
  - Manual import 14/14; entity resolution 21/21; qualification 20/20; storage/recovery 14/14; discovery/extraction 20/20।
  - Contact quality 27 pass/1 fail; export integrity 18 pass/1 fail। দুই failure-ই অনুপস্থিত dist/leadnoria-v1.7.5.zip সম্পর্কিত।
- মূল npm test শুরুতেই অনুপস্থিত historical ZIP-এ থামে; পুরো default suite চলেছে বলা যাবে না।
- মূল repository clean আছে। সোর্স ও lockfile বদলানো হয়নি।
- আলাদা probe-এ UI ID collision, পুনরায় import-এ cross-run duplicate, silent Chrome storage error পুনরুৎপাদন হয়েছে।

## যা করতে পারে
- ব্যবহারকারীর pasted ad text, CSV ও Meta URL reference স্থানীয়ভাবে parse করা। URL reference খুলে তথ্য আনে না।
- supplied name, ID, copy, CTA, destination ও দৃশ্যমান phone/email থেকে candidate তৈরি।
- একই run-এর মধ্যে ad/entity deduplication, geography/relevance classification, qualification ও scoring।
- IndexedDB/chrome.storage-ভিত্তিক history ও checkpoint কোড আছে। Offline storage tests মূলত fallback/mocked আচরণ যাচাই করে।
- CSV/JSON serializer, escaping ও qualification filters আছে। বর্তমান মূল UI-র export action CSV চালায়; serializer থাকা মানেই সব UI path JSON দেয় না।
- পুরোনো extraction path-এ DOM card discovery, MutationObserver, scrolling, challenge detection ও diagnostics আছে। লাইভ Meta-তে নির্ভুলতা বা coverage যাচাই হয়নি।

## প্রধান সমস্যা ও প্রমাণ
ফাইলগুলো LeadNoria repository root থেকে দেখানো হয়েছে।

1. **P1: মূল লক্ষ্য বর্তমানে বন্ধ।** src/config/collectionGate.ts:31 এবং :50 দুই permission function সবসময় false দেয়। src/extension/service-worker.ts:958-968 START_RESEARCH-এ BLOCKED ফেরায়। websiteVerifier.ts:834-835 বাস্তব external fetch আটকায়; customFetch দিয়ে fixture পরীক্ষা সম্ভব। Manifest-এ advertiser website host permission-ও নেই। Gate একা উল্টালেই কাজের product তৈরি হবে না।

2. **P1: বিতরণে তিন আলাদা সংস্করণ/আচরণ।** package.json ও extension/manifest.json = 1.7.7; README.md:42 এবং LEADNORIA-RELEASE-METADATA.json:5 = 1.6.0; root extension.zip-এর manifest সরাসরি খুলে 1.7.5 পাওয়া গেছে। ZIP-এ বর্তমান COLLECTION_NOT_AUTHORIZED ও MANUAL_META_IMPORT markers নেই; বর্তমান unpacked worker-এ gate আছে। ZIP runtime পরীক্ষা হয়নি—marker absence থেকে পূর্ণ live কার্যকারিতা দাবি করা হচ্ছে না। scripts/verify-offline.mjs:28-31 যে 1.7.5/1.7.6 archive চায়, clone-এ সেগুলো নেই।

3. **P1: row identity ভাঙা; ভুল lead খোলার ঝুঁকি।** ExtensionLead-এর required field id (types.ts:434), কিন্তু ui/viewModelMappers.ts:69-70 সেটি বাদ দিয়ে leadId/entityId অথবা Date.now ব্যবহার করে। দুই imported lead-এ fixed same millisecond দিয়ে একই rec_123456 পুনরুৎপাদন হয়েছে। ui/App.tsx:442-446 lookup-এও id বাদ, শেষে প্রথম lead নেয়। ফল: selection collision, ভুল detail, ভুল selected export হতে পারে। Browser click-path পর্যবেক্ষণ হয়নি; function-level defect নিশ্চিত।

4. **P1: save ব্যর্থ হলেও success।** manualImport/importOrchestrator.ts:291-340 persistence errors শুধু console-এ; chrome.storage.local.set callback runtime.lastError দেখে না; শেষে warnings: []। QUOTA error mock দিয়েও success summary পাওয়া গেছে। bulkStore.ts:553 IndexedDB write fail-এ volatile memory fallback দেয়। Browser restart-এর পরে data-loss risk আছে; quota exhaustion live browser-এ ঘটানো হয়নি।

5. **P1: confidence labels প্রকৃত যাচাই ছাড়াই উন্নীত হয়।** metaAdapter.ts:487-এ activeRegex || true থাকায় পরিচিত inactive শব্দ না থাকলেই active। manualImport/importParsers.ts:344 URL-only reference-ও isActive:true। ui/viewModelMappers.ts:133 websiteState=found হলেই websiteVerified true, :137 freshness সবসময় CURRENT। URL দেখা HTTP verification বা fresh ad observation নয়। ui/App.tsx:499 legacy fallback-এ score 85 hardcoded; এটি সব সাধারণ record-এর default নয়, unsupported fallback branch।

6. **P2: dedup scope সীমিত।** manualImport/importOrchestrator.ts:84-86 প্রতি import-এ নতুন map/set। একই দুই-row CSV দুই run-এ আমদানি: প্রতিবার দুই lead, দ্বিতীয়বার duplicateCount=0। Run-local dedup কাজ করলেও workspace-wide idempotence নেই। test-phase34-manual-import.mjs header-এ repeated-import claim থাকলেও সরাসরি ওই case পরীক্ষা নেই।

7. **P2: input validation দুর্বল।** importParsers.ts:302 hostname substring মেলায়—facebook.com.example.org-ও গৃহীত হতে পারে; Ads Library path বাধ্যতামূলক নয়। :33-38 formula পরীক্ষা trim-এর আগে; '  =1+1' ফেরে '=1+1'। বর্তমান metaAdapter CSV exporter আবার sanitize করে, তাই এই probe থেকে final CSV exploit প্রমাণিত নয়; parser-এর নিজস্ব নিরাপত্তা দাবি অসম্পূর্ণ।

8. **P2: architecture label ও implementation আলাদা।** pipeline/sourceAdapter.ts:63 Meta implementationState LIVE বলে; executeLive :96-99 খালি array ফেরায়। Website ও user adapters-ও executeLive-এ খালি array। Legacy service-worker scraper আলাদা path। 'Unified live multi-source engine' দাবি এই adapter দেখে গ্রহণযোগ্য নয়।

9. **P2: standalone extension build reproducible নয়।** scripts/build-extension.mjs:254-265 dist/assets-এর প্রথম CSS নেয়; না থাকলে utility CSS ছাড়াই সফল হয়। Clean clone-এ dist/assets নেই। পূর্ণ npm run build সফল হয়েছে; শুধু build:extension-এর fresh output styling নিশ্চয়তা নেই।

## পণ্য ও আয়
Extension runtime-এ কার্যকর checkout, subscription entitlement, license server বা payment webhook পাওয়া যায়নি। Documentation/data fixture-এ billing শব্দ থাকাকে implemented billing ধরা হয়নি। LICENSE হলো MIT; commercial use/sale অনুমোদিত ভাষা আছে, copyright/license notice রাখতে হবে। Software license Meta data সংগ্রহ বা পুনর্বিক্রির অধিকার দেয় না।

আমার সুপারিশ, ক্রমানুসারে:
1. একটি authoritative release বানান: এক version, এক verified package, fresh-clone build ও চালানো যায় এমন tests।
2. Stable lead ID, সঠিক details/selection, visible save failure ও durable storage ঠিক করুন।
3. observed/unknown/verified এবং freshness আলাদা করুন; hardcoded certainty সরান; workspace dedup দিন।
4. অনুমোদিত data-access পদ্ধতি স্থির করে ছোট real-browser acceptance workflow চালান: extraction → dedup → qualification → restart → exact export। Precision, unique advertiser coverage ও contact yield মাপুন।
5. তারপর pricing/billing যোগ করুন। এখন বেশি dashboard, analytics layer বা speculative AI feature যোগ করলে মূল নির্ভরযোগ্যতা বাড়বে না।

## লাইভ পরীক্ষা ও নিয়মের সীমা
এই সেশনে connected browser inventory-তে শুধু in-app browser ও MCP Apps ছিল; extension-loadable Chrome/Edge session পাওয়া যায়নি। MV3 install, popup/sidepanel, real IndexedDB restart, live Meta extraction ও website fetch end-to-end পর্যবেক্ষণ হয়নি। পুরোনো Playwright ফল বা repo-র production reports-কে বর্তমান যাচাই ধরা হয়নি। CAPTCHA বা block bypass করা হয়নি।

Meta-র official explanation বলছে permission ছাড়া Facebook automation তাদের terms ভঙ্গ করে; public visibility বা browser automation নিজে অনুমোদনের প্রমাণ নয়। বর্তমান automated collection terms URL login/block-এ গেছে; সম্পূর্ণ বর্তমান terms এখানে পড়ে যাচাই করা যায়নি। এটি আইনি রায় নয়; নির্দিষ্ট ব্যবহারের permission/terms যাচাই প্রয়োজন।
সূত্র: https://about.fb.com/news/2021/04/how-we-combat-scraping/

Chrome policy অনুযায়ী প্রয়োজনের সর্বনিম্ন permissions, সঠিক feature description, user-data disclosure/consent ও নিরাপদ handling প্রয়োজন। Paid extension সম্ভব, কিন্তু pricing/basic paid functionality ও terms স্পষ্ট করতে হবে। Store approval বা Meta permission এখানে নিশ্চিত হয়নি।
সূত্র: https://developer.chrome.com/docs/webstore/program-policies/policies

