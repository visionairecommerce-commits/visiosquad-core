#!/usr/bin/env node
const fs=require('fs');const puppeteer=require('puppeteer');const child=require('child_process');
const input=process.argv[2]||'ledger/whale_input_top10.json';
const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT=process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT='6683959510';
const output=process.argv[3]||'ledger/whale_click_live_out.json';
const KEY_TEXTS=['contact','about','staff','team','coaches','coaching'];
function findEmails(text){if(!text) return [];const m=text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}/g)||[];return Array.from(new Set(m));}
function supabasePatchProspect(id, email, string_id){try{const payload=JSON.stringify({email:email,verified:true}); let cmd; if(string_id){ cmd = `curl -s -X PATCH "${SUPABASE_URL}/rest/v1/prospects?string_id=eq.${string_id}" -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '${payload}'`; } else { cmd = `curl -s -X PATCH "${SUPABASE_URL}/rest/v1/prospects?id=eq.${id}" -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '${payload}'`; } const out=child.execSync(cmd,{timeout:20000}).toString(); return out;}catch(e){return null}}function sendTelegram(text){try{const cmd=`curl -s -X POST https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage -d chat_id=${TELEGRAM_CHAT} -d text="${text.replace(/\"/g,'\\\"')}"`; child.execSync(cmd,{timeout:20000});}catch(e){}}
(async ()=>{
  const prospects=JSON.parse(fs.readFileSync(input,'utf8'));
  const results=[];
  const browser=await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox'], executablePath:'/snap/bin/chromium'});
  let verifiedCount=0;
  for(const p of prospects){
    const page=await browser.newPage();page.setDefaultNavigationTimeout(30000);
    const found=[];
    try{
      await page.goto(p.website,{waitUntil:'networkidle2'});
      const html=await page.content();
      for(const e of findEmails(html)){ found.push({type:'email',value:e,source:p.website}); }
      if(!found.length){
        const anchors = await page.$$eval('a', els => els.map(a=>({text:(a.innerText||a.textContent||'').toLowerCase().trim(), href: a.href})).filter(a=>a.href));
        const targets = anchors.filter(a=> KEY_TEXTS.some(k=>a.text.includes(k)) ).slice(0,5);
        for(const t of targets){
          try{ await page.goto(t.href,{waitUntil:'networkidle2'}); const h=await page.content(); for(const e of findEmails(h)) found.push({type:'email',value:e,source:t.href}); if(found.length) break;}catch(e){ }
        }
      }
      // dedupe
      const uniq = Array.from(new Map(found.map(f=>[f.value,f])).values());
      for(const em of uniq){
        // patch supabase
        const out = supabasePatchProspect(p.id, em.value, p.string_id);
        if(out){ verifiedCount++; }
      }
      results.push({prospect:p,found:uniq});
    }catch(e){ results.push({prospect:p,found:[],error:String(e)}); }
    await page.close();
    if(verifiedCount>=5) break;
  }
  await browser.close();
  fs.writeFileSync(output,JSON.stringify(results,null,2));
  if(verifiedCount>=5){ sendTelegram(`Whale Hunter Success: ${verifiedCount} emails found. I am now drafting the first outreach batch for your review.`); }
  console.log('done, verifiedCount=',verifiedCount);
})();
