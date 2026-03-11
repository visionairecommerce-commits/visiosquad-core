// generate_google_queries.js
// Usage: node generate_google_queries.js input_whale.json output_queries.txt
// Produces Google search URLs to run locally for each club name found in the whale output

const fs = require('fs');
const inp = process.argv[2] || './ledger/prospects_whale.json';
const out = process.argv[3] || './ledger/google_queries.txt';

const data = JSON.parse(fs.readFileSync(inp,'utf8'));
const queries = [];
for(const item of data){
  const name = (item.prospect && item.prospect.name) || (item.prospect && item.prospect.club) || null;
  if(name){
    const q = encodeURIComponent(name + ' volleyball club official website contact email');
    queries.push('https://www.google.com/search?q='+q);
  }
}
fs.writeFileSync(out, queries.join('\n'));
console.log('Wrote', queries.length, 'queries to', out);
