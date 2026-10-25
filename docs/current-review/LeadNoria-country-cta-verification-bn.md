# দেশ ও CTA সংশোধন: যাচাই ফল

২৫ অক্টোবর ২০২৬। আগের audit-এর পর অনুমোদিত সংশোধন।

## বদলানো হয়েছে
- Meta search URL-এ নির্বাচিত country, all ad types ও keyword এক জায়গা থেকে তৈরি হয়। এই পরিবর্তন live collection gate চালু করে না।
- একটি দেশের office/address শব্দ দিয়ে অন্য দেশের delivery city-কে business address ধরে না।
- Strict import-এ probable-local default থেকে বাদ; unknown origin-এ target country বসায় না।
- CTA ও actual destination আলাদা থাকে। WhatsApp, Messenger, phone ও Facebook page-কে external website বলা হয় না।
- URL না থাকলে website status unknown থাকে; ad-এ URL দেখাকে live website verification বলা হয় না।
- Rejected/incomplete imported records-এও CTA ও destination থাকে।
- Stable lead ID দিয়ে table row/detail lookup; ভুল করে প্রথম lead দেখানোর fallback বাদ।

প্রধান ফাইল: src/extension/geographicClassifier.ts:199; destinationClassifier.ts:67; manualImport/importOrchestrator.ts:66; metaAdapter.ts:47; ui/viewModelMappers.ts:70; ui/App.tsx:442।

## নিজে চালানো পরীক্ষা
- নতুন tests/test-country-cta-user-flow.mjs পাস: query parameters → pasted card parsing → Indian/BD/unknown business classification → CTA ও website → qualification → storage roundtrip → UI IDs → qualified CSV export।
- ভারতীয় office + বাংলাদেশ delivery: business IN, target BD; স্থানীয় qualified export-এ বাদ।
- বাংলাদেশি showroom: BD; qualified export-এ থাকে।
- অজানা origin: country বানানো হয়নি; qualified export-এ বাদ।
- Shop Now কিন্তু URL নেই: unknown destination/website। Messaging/call/social URLs website নয়।
- পুরোনো ছয় suite-এর ১১০টি পরীক্ষা পাস: geography 16, country profiles 15, CTA/export 31, manual import 14, storage/recovery 14, qualification 20। আগের মৌখিক ১২৪ সংখ্যাটি গণনার ভুল; সঠিক পুরোনো-test সংখ্যা ১১০। নতুন flow test আলাদা।
- TypeScript, git diff --check ও পৃথক কপিতে পূর্ণ npm run build পাস।

## যা এখনো সম্পন্ন হয়নি
- বাস্তব Chrome extension install/click/scroll/Meta scraping end-to-end দেখা হয়নি। Connected browser inventory-তে extension-loadable Chrome/Edge ছিল না।
- Existing live-collection gate এখনও বন্ধ। কাজেই automatic Meta collection এখন ব্যবহারযোগ্য হয়েছে বলা যাবে না। Live permission ও বাস্তব browser acceptance unresolved।
- Cross-run dedup ও silent persistence failure আগের audit-এর পৃথক খোলা ত্রুটি; এই পরিবর্তনে সমাধান হয়নি।
- দেশ নির্ণয় public signals-এর heuristic; সব advertiser-এর প্রকৃত দেশ জানা যায় না। অনিশ্চয়তায় review দরকার।
- default npm test-এর missing historical ZIP blocker আগের মতো আছে। মূল unpacked extension ও historical ZIP-ও পুনর্লিখিত হয়নি; নতুন source build আলাদা work/audit-build-এ যাচাই হয়েছে।
