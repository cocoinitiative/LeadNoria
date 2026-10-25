import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readPublicPageSnapshot,interpretPublicPage} from '../src/extension/publicPageEvidence.ts';
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
try{
 const page=await browser.newPage();
 await page.setContent(`<main role="main"><h1>Dhaka Furniture</h1><h2>About</h2><a href="https://maps.google.com/?q=Dhaka">Dhaka, Bangladesh</a><a href="https://l.facebook.com/l.php?u=https%3A%2F%2Ffurniture.example%2FShop%3FColor%3DBlue">furniture.example</a><article role="article"><a href="https://unrelated.example">unrelated.example</a></article></main><script type="application/ld+json">[{"@type":"FurnitureStore","name":"Dhaka Furniture","address":{"streetAddress":"House 14","addressLocality":"Dhaka","addressCountry":"Bangladesh"}},{"@type":"Organization","name":"Facebook","address":{"addressCountry":"US"}}]</script>`);
 const snapshot=await page.evaluate(readPublicPageSnapshot);
 assert.equal(snapshot.heading,'Dhaka Furniture');
 assert.equal(snapshot.links.length,1);
 assert.deepEqual(snapshot.addressTexts,['Dhaka, Bangladesh']);
 const source='https://www.facebook.com/DhakaFurniture/about';
 const evidence=interpretPublicPage({...snapshot,url:source},source,'Dhaka Furniture');
 assert.deepEqual(evidence.addressCountryCodes,['BD']);
 assert.deepEqual(evidence.websiteUrls,['https://furniture.example/Shop?Color=Blue']);
 await page.setContent('<main role="main"><h1>Log into Facebook</h1><form><input type="password"></form></main>');
 assert.equal((await page.evaluate(readPublicPageSnapshot)).blocked,true);
 console.log('PASS isolated DOM extraction: visible About website, post-link exclusion, matching structured address, unrelated organization exclusion, login wall. Local HTML only.');
}finally{await browser.close();}
