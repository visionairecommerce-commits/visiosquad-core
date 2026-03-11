#!/usr/bin/env node
// vbl_fetch_clubs.js — Fetch club names from VolleyballLife Events API or page
// Usage: node vbl_fetch_clubs.js [count] [output.json]
// Tries JSON API endpoints first; if unavailable, falls back to Puppeteer (requires local Chrome)

const fs = require('fs');
const https = require('https');
const count = parseInt(process.argv[2] || '20',10);
const out = process.argv[3] || './ledger/vbl_clubs.json';

function tryFetchJson(url){
  return new Promise((resolve,reject)=>{
    https.get(url, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>{
        try{ const j=JSON.parse(data); resolve(j); }catch(e){ reject(e); }
      });
    }).on('error',e=>reject(e));
  });
}

(async ()=>{
  const candidateUrls = [
    'https://volleyballlife.com/api/tournaments/upcoming',
    'https://volleyballlife.com/tournaments/upcoming?format=json',
    'https://volleyballlife.com/api/events/upcoming'
  ];
  let clubs=[];
  for(const u of candidateUrls){
    try{
      const data = await tryFetchJson(u);
      // heuristic: find club names in returned structure
      const flat = JSON.stringify(data);
      const matches = [...new Set((flat.match(/[A-Za-z0-9 \-&()]{3,60}/g) || []))];
      clubs = clubs.concat(matches);
      if(clubs.length>=count) break;
    }catch(e){ /* ignore */ }
  }

  if(clubs.length< Math.min(10,count)){
    // fallback: instruct user to run Puppeteer version locally
    console.log('No JSON API available or insufficient results. Please run the Puppeteer fallback locally: tools/whale_hunter.cjs or puppeteer_extract_leads.js');
    process.exit(1);
  }

  clubs = Array.from(new Set(clubs)).slice(0,count).map(c=>({name:c}));
  fs.writeFileSync(out, JSON.stringify(clubs, null, 2));
  console.log('Wrote', clubs.length, 'club candidates to', out);
})();
