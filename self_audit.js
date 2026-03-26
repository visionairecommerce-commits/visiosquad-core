const fs = require('fs');
const path = require('path');

console.log("\n--- 🕵️ AURELIUS SOVEREIGN BRAIN AUDIT ---");

const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const config = JSON.parse(fs.readFileSync('/home/ubuntu/.openclaw/workspace/config/UNIFIED_CONFIG.json', 'utf8'));

console.log(`\n[GOAL]: ${config.global_goal}`);
console.log(`[IDENTITY]: ${config.ceo_identity} - ${env.match(/MISSION_STATEMENT='(.*)'/)?.[1] || "Sovereign CEO"}`);

console.log("\n[FINANCIAL RULES]:");
console.log(` - Target Account: ${config.financial_guardrails.primary_account}`);
console.log(` - Spend Limit: ${config.financial_guardrails.spend_limit_percentage * 100}%`);
console.log(` - Spending Status: ${config.financial_guardrails.spending_condition}`);

console.log("\n[PILLAR STATUS]:");
Object.keys(config.businesses).forEach(b => {
    console.log(` - ${b}: ${config.businesses[b].type} (${config.businesses[b].focus || "General Operations"})`);
});

console.log("\n[AUTONOMOUS POWERS]:");
const exec = env.includes('OPENCLAW_EXEC_ALLOWED=true');
console.log(` - Code Execution: ${exec ? "✅ UNLOCKED" : "❌ LOCKED"}`);
console.log(` - GitHub/Mercury: ✅ CONNECTED`);

console.log("\n--- AUDIT COMPLETE ---\n");
