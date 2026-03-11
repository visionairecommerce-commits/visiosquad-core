#!/usr/bin/env node
// Usage: node puppeteer_extract_leads.js ~/path/to/prospects.json output.json
// Requires: npm install puppeteer

const fs = require('fs');
const puppeteer = require('puppeteer');

const inputPath = process.argv[2] || './ledger/prospects.json';
const outPath = process.argv[3] || './ledger/prospects_verified.json';
const KEY_TITLES = ['director','owner','lead coach','head coach','club director','program director'];

function titleMatches(text){
  if(!text) return false;
  text = text.toLowerCase();
  return KEY_TITLES.some(k => text.includes(k));
}

(async ()=>{
  const prospects = JSON.parse(fs.readFileSync(inputPath));
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const results = [];

  for(let i=0;i<prospects.length;i++){
    const p = prospects[i];
    if(!p.website) continue;
    try{
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(30000);
      const paths = ['','/contact','/contact-us','/about','/about-us','/staff','/coaches','/team'];
      let found = [];
      for(const path of paths){
        const url = p.website.replace(/\/$/,'') + path;
        try{
          await page.goto(url, {waitUntil:'networkidle2'});
        }catch(e){ continue; }
        const html = await page.content();
        // find mailto and plain emails
        const mails = Array.from(new Set((html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/g) || [])));
        // also look for common staff blocks
        const people = await page.$$eval('body *', els => els.map(e=>({tag:e.tagName, text:e.innerText||''})).slice(0,2000));
        for(const m of mails){
          found.push({type:'email', value:m, source:url});
        }
        // simple heuristic to find lines that look like "Name — Title" or "Title: Name"
        const lines = html.split(/\n|<br|<p|<div>/).slice(0,1000);
        for(const ln of lines){
          const txt = ln.replace(/<[^>]+>/g,' ').trim();
          if(!txt) continue;
          for(const t of KEY_TITLES){
            if(txt.toLowerCase().includes(t)){
              // try to extract an email from nearby
              const nearby = txt.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/g) || [];
              found.push({type:'match', text:txt, nearbyEmails:nearby, source:url});
            }
          }
        }
        if(found.length) break;
      }
      results.push({prospect:p, found});
      await page.close();
    }catch(e){
      results.push({prospect:p, error:e.message});
    }
  }

  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('Done. Output written to', outPath);
  process.exit(0);
})();
