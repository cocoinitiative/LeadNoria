# LeadNoria: সহজ UI যাচাই

- রঙ: muted purple, muted black, muted white।
- সামনে Search, Leads, Saved lists; বাড়তি টুল More-এর মধ্যে।
- country, একাধিক keyword, searchable preset ও editable preset keywords।
- website: সব lead / website দেখা গেছে / website দেখা যায়নি। শেষেরটি ব্যবসার website নেই—এমন দাবি করে না।
- ফল সহজ টেবিলে; জটিল filter ও বিস্তারিত card বন্ধ রাখা যায়।
- প্রতিটি saved list খুলে ফল দেখা, নির্বাচিত ফল CSV download এবং Sheets copy।

## যাচাই হয়েছে

- TypeScript ও production build।
- focused Sheets test: ৯ কলাম, বাংলা, newline, formula escaping, restricted row বাদ দেওয়া।
- website preference ও আগের ২০ qualification test।
- আগের offline import / country / CTA / dedup flow।
- নিজস্ব in-app browser: preset খোঁজা ও keyword বদল, website preference review।
- তিনটি পরীক্ষার lead: website সহ ২টি, website অদেখা ১টি।
- Saved lists-এর একটি সমস্যা পাওয়া ও ঠিক করা হয়েছে: Chrome storage ছাড়া IndexedDB-এর তালিকা দেখাত না। ঠিক করার পর reload-এ পুরোনো চারটি তালিকা ফিরেছে।
- একটি তালিকা খুলে একটি lead নির্বাচন: clipboard-এ header ও এক row, প্রতিটিতে ৯টি column; download CSV-তেও এক lead।

## সীমা

এটি browser-hosted extension UI যাচাই। Chrome MV3 runtime এবং extension দিয়ে স্বয়ংক্রিয় live Meta সংগ্রহ পরীক্ষিত নয়। Live collection gate এখনও বন্ধ। Google Sheets account-এ paste করা হয়নি; tab-separated clipboard-এর row/column পরীক্ষা করা হয়েছে।

সর্বশেষ UI build রিপোর root extension.zip-এ আছে। review/ ফোল্ডারের আগের ZIP পুরোনো সংস্করণ।
