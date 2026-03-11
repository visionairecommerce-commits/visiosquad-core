#!/usr/bin/env node
// whale_hunter.js — Deep scrape /staff /coaches /contact pages for clubs in prospects.json
// Usage: node whale_hunter.js [input.json] [output.json]
// Requires: npm install puppeteer

const fs = require('fs');
const puppeteer = require('puppeteer');

const input = process.argv[2] || './ledger/prospects.json';
const output = process.argv[3] || './ledger/prospects_whale.json';

const KEY_TITLES = ['director','owner','lead coach','head coach','club director','program director','director of volleyball','event director'];
const PATHS = ['','/staff','/team','/coaches','/coaching','/about','/about-us','/contact','/contact-us'];
const HARDCODE_BLACKLIST = ['RPM Sand'];

function findEmails(text){
  if(!text) return [];
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/g) || [];
  return Array.from(new Set(m));
}

function textNormalize(s){
  return (s||'').replace(/\s+/g,' ').trim();
}

function looksLikePersonLine(line){
  // simple heuristics: contains comma, dash, or '—' and a title keyword
  const l = line.toLowerCase();
  return KEY_TITLES.some(t=>l.includes(t));
}

(async ()=>{
  const prospects = JSON.parse(fs.readFileSync(input, 'utf8'));
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const results = [];

  for(const p of prospects){
    if(!p.website){
      results.push({prospect:p, found:[]});
      continue;
    }
    // enforce blacklist (hard-coded + file)
    const blacklistFile = (fs.existsSync('./blacklist.json') ? JSON.parse(fs.readFileSync('./blacklist.json')) : []);
    const blacklist = blacklistFile.concat(HARDCODE_BLACKLIST);
    if(blacklist.map(b=>b.toLowerCase()).includes((p.name||'').toLowerCase())){
      results.push({prospect:p, skipped:true, reason:'blacklisted'});
      continue;
    }

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    const found = [];

    for(const path of PATHS){
      const url = p.website.replace(/\/$/,'') + path;
      try{
        await page.goto(url, {waitUntil:'networkidle2'});
      }catch(e){ continue; }

      const html = await page.content();
      const emails = findEmails(html);
      if(emails.length){
        for(const em of emails){
          found.push({type:'email',value:em,source:url});
        }
      }

      // extract visible text lines for person/title heuristics
      const lines = await page.$$eval('body *', els=>els.map(e=>e.innerText).filter(Boolean));
      for(const ln of lines){
        const txt = textNormalize(ln);
        if(looksLikePersonLine(txt)){
          // pull emails nearby in HTML
          const nearEmails = findEmails(txt);
          found.push({type:'match',text:txt,nearbyEmails:nearEmails,source:url});
        }
      }
      if(found.length) break;
    }

    await page.close();
    results.push({prospect:p, found});
  }

  await browser.close();
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
  console.log('Whale hunt complete — output written to', output);
})();
