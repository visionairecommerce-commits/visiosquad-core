import fs from 'fs';
import path from 'path';

export async function updateManifest(key: string, value: any) {
const manifestPath = path.resolve(process.cwd(), 'aurelius-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const keys = key.split('.');
let current = manifest;
for (let i = 0; i < keys.length - 1; i++) {
current = current[keys[i]];
}
current[keys[keys.length - 1]] = value;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log("Aurelius Memory updated for: " + key);
}

if (process.argv[2] && process.argv[3]) {
updateManifest(process.argv[2], JSON.parse(process.argv[3]));
}
