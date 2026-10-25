# LeadNoria: save, dedup ও CSV যাচাই

২৫ অক্টোবর ২০২৬। এটি স্থানীয় review build; production-ready বা live scraper verified release নয়।

## সংশোধন
- Manual import-এর run, ads, entities, checkpoint ও dedup index এখন একটি IndexedDB transaction-এ commit হয়। ব্যর্থতা browser-এ volatile memory fallback দিয়ে লুকানো হয় না।
- Chrome storage callback-এর runtime.lastError ধরা হয়। মূল database save হলে কিন্তু workspace snapshot fail করলে স্পষ্ট warning; database save fail হলে import error।
- popup/sidepanel import একই Web Lock নেয়; একই context-এও queue থাকে। একই country + normalized keywords + preset + strict/probable criteria-তে persisted ad IDs মিলিয়ে পুনরায় import বাদ যায়। আলাদা criteria-তে পুনর্মূল্যায়ন অনুমোদিত; নতুন ad একই advertiser-এর হলেও cross-run সব advertiser globally merge করার দাবি নয়।
- Chrome snapshot stale হলেও manual history IndexedDB থেকে load হয়। History clear করলে manual history আবার ফিরে আসে না।
- Results-এ সরাসরি Download CSV: filter করা দৃশ্যমান ফল; selection থাকলে শুধু সেই নির্বাচিত visible ফল। Qualification/status columns থাকে; শুধু qualified lead চাইলে existing Export dialog/filter ব্যবহার করা যায়।
- Bengali/Unicode CSV-তে UTF-8 BOM; download শুরু হওয়ার পরে object URL release হয়।
- Review/incomplete lead-এর ad copy, original CTA, destination ও evidence CSV-তে অক্ষত রাখা হয়েছে। Browser test-এ হারানো ad copy ধরা পড়ে; সংশোধনের পরে পুনরায় download করে পাস হয়েছে।
- অজানা website-এ “No website” বদলে “Website not observed”; review reason ও observed contact UI-তে রাখা হয়।

## চালানো পরীক্ষা
- TypeScript ও diff whitespace check পাস। পূর্ণ build এবং সর্বশেষ extension bundle/package পাস। Package-এর ১২টি runtime file unpacked directory-এর সঙ্গে মিলেছে।
- আগের ছয় suite-এর ১১০টি পরীক্ষা পাস: geography 16, country profiles 15, CTA/export 31, manual import 14, storage/recovery 14, qualification 20।
- নতুন repository test-country-cta-user-flow পাস: search parameters, BD/IN/unknown, CTA/website, save roundtrip, IDs, qualified CSV, repeated import, mixed old/new import, missing durable browser storage এবং review copy export।
- আলাদা fake-indexeddb পরীক্ষায় ৯টি case পাস: durable readback; repeated import; mixed import; Chrome quota/read error; transaction rollback; retry; concurrent duplicate import; changed criteria; absent browser IndexedDB। এটি simulation, বাস্তব Chrome quota test নয়। পরীক্ষার helper/library শুধু work/ এবং node_modules-এ; package/lockfile অপরিবর্তিত।

## নিজের browser UI-তে দেখা ফল
- Built sidepanel/app.js localhost-এ in-app browser-এ চালানো হয়েছে; API injection দিয়ে Chrome runtime সাজানো হয়নি।
- তিনটি sample import: ১ qualified BD, ১ foreign IN, ১ unknown।
- Reload-এর পরে একই sample import: ৩ duplicate, ০ নতুন record। অর্থাৎ real browser IndexedDB reload-এর পরেও duplicate IDs থাকে।
- Download CSV (3) চাপলে file নেমেছে; বাইরে থেকে ফাইল parse করে ৩ row মিলেছে।
- একটিমাত্র lead select করে Download CSV (1): ফাইলে ঠিক ১টি Dhaka Artisan Furniture row, BD/BD, SHOP_NOW, EXTERNAL_WEBSITE।
- বাস্তব Meta Ad Library-তে Bangladesh + All ads + Furniture query খুলেছে; public ad card ও CTA/destination দেখা গেছে। এই search-এর মধ্যে বিদেশি/অসংশ্লিষ্ট বিজ্ঞাপনও ছিল।
- সেখানকার RFL Furniture-এর একটি public ad-এর দৃশ্যমান তথ্য manual import করে আবার CSV download করা হয়েছে। বাংলা copy, original Order now CTA এবং external othoba.com destination সংরক্ষিত। প্রয়োজনীয় country proof না থাকায় LOCAL_PROBABLE/Needs Data থেকেছে; verified local বলে বানানো হয়নি। এটি live public input-এর assisted/manual processing, extension-এর স্বয়ংক্রিয় scraping নয়।

## যা এখনও যাচাই হয়নি
- Actual Chrome MV3 install/load, service-worker messaging, content-script injection, automatic scrolling/extraction এবং Chrome restart recovery।
- Windows Computer Use Chrome পেয়েছে; কিন্তু current browser URL policy check-এ নিশ্চিত করতে না পেরে control বন্ধ করেছে। ওই বাধা পাশ কাটানো হয়নি। In-app browser-এ extension load API নেই।
- collectionGate এখনও false; automatic Meta collection এখনো disabled। Public পেজ খোলা ও manual live-input পরীক্ষা থেকে automated extension workflow পাস বলা যাবে না।
- default npm test এখনও অনুপস্থিত historical release ZIP-এ থামে; পুরো default suite পাস বলা হচ্ছে না। পুরোনো README/release metadata-ও এই স্থানীয় build-কে production release করে না।

## গুরুত্বপূর্ণ ফাইল
Repository root-এর তুলনায়:
- src/extension/bulkStore.ts:511 — strict manual history read; :528 history clear; :552 atomic import commit।
- src/extension/manualImport/importOrchestrator.ts:59 — dedup scope; :67 storage error handling; :82 serialized import।
- src/extension/ui/components/ManualImportView.tsx — visible save error/warning।
- src/extension/ui/components/ResultsTableView.tsx:424 — direct CSV action; website-not-observed label।
- src/extension/ui/App.tsx — durable history recovery এবং selected/filtered CSV handling।
- tests/test-country-cta-user-flow.mjs — saved end-to-end offline acceptance test।

## পর্যালোচনার ফাইল
- LeadNoria-review-build.zip — বর্তমান local MV3 package, manifest 1.7.7।
- LeadNoria-review-extension/ — একই unpacked files; Chrome Load unpacked-এর জন্য।
- LeadNoria-public-ad-sample.csv — নিজে browser থেকে download করে যাচাই করা sample; ad-এর মূল উৎস Meta public page, import manual।
- LeadNoria-browser-dedup.jpg ও LeadNoria-browser-live-public-input.jpg — browser UI evidence।

কোনো push বা প্রকাশ করা হয়নি। আসল tracked historical ZIP ও extension/ পুনর্লিখিত হয়নি; পরিবর্তন source ও নতুন test-এ স্থানীয়ভাবে আছে।

## শেষ browser-access অবস্থা
পরের recovery-তে Chrome Extensions পেজ read করা গেছে এবং Load unpacked button দেখা গেছে। কিন্তু click-এর জন্য geometry পাওয়া যায়নি; screenshot capture-ও timeout হয়েছে। কোনো extension install/load সম্পন্ন হয়নি। ব্যবহারকারী ব্যক্তিগত Chrome ব্যবহার না করতে বলায় সেই browser-এ আর input দেওয়া হয়নি। Agent-এর in-app browser-এর capability inventory-তে শুধু visibility ও viewport আছে; MV3 extension install/load lifecycle নেই। ফলে agent-এর নিজস্ব browser-এ সম্পূর্ণ MV3 runtime test এই session-এর tools দিয়ে সম্পন্ন করা যায়নি। এটি test failure বা pass নয়—unverified access limitation।
