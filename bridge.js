const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// 1. Robust .env Loader
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

// 2. Logic to satisfy the "SASL: password must be a string" error
if (process.env.DATABASE_URL) {
    try {
        const dbUrl = new URL(process.env.DATABASE_URL);
        process.env.PGPASSWORD = decodeURIComponent(dbUrl.password);
        process.env.DB_PASSWORD = decodeURIComponent(dbUrl.password);
        process.env.POSTGRES_PASSWORD = decodeURIComponent(dbUrl.password);
        console.log("Aurelius Bridge: Database credentials extracted and mapped.");
    } catch (e) {
        console.error("Aurelius Bridge: Could not parse DATABASE_URL for credentials.");
    }
}

// 3. Path Shim for the TypeError
const urlModule = require('url');
const original = urlModule.fileURLToPath;
urlModule.fileURLToPath = (arg) => arg ? original(arg) : __filename;

// 4. Globals
global.__filename = __filename;
global.__dirname = __dirname;

console.log("Aurelius Bridge: Launching dist/index.cjs...");
require('./dist/index.cjs');
