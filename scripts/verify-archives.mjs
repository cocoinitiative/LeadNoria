import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const distDir = 'dist';
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.zip')).sort();

console.log('---------------------------------------------------------------------------------------------------');
console.log('Filename'.padEnd(25), 'Size'.padEnd(12), 'SHA-256');
console.log('---------------------------------------------------------------------------------------------------');
for (const file of files) {
  const buf = fs.readFileSync(path.join(distDir, file));
  const hash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  console.log(file.padEnd(25), `${buf.length} B`.padEnd(12), hash);
}

if (fs.existsSync('extension.zip')) {
  const extBuf = fs.readFileSync('extension.zip');
  const extHash = crypto.createHash('sha256').update(extBuf).digest('hex').toUpperCase();
  console.log('extension.zip'.padEnd(25), `${extBuf.length} B`.padEnd(12), extHash);
}
console.log('---------------------------------------------------------------------------------------------------');
