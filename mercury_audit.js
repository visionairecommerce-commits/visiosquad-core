const fs = require('fs');
const path = require('path');

async function checkMercury() {
    console.log("\n--- 🏦 EMPIRE FUND FINANCIAL AUDIT ---");
    
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config/UNIFIED_CONFIG.json'), 'utf8'));
    const apiKey = env.match(/MERCURY_READ_KEY=(.*)/)?.[1]?.trim();
    const targetId = config.financial_guardrails.primary_account;
    
    try {
        const response = await fetch('https://api.mercury.com/api/v1/accounts', {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
        });
        const data = await response.json();
        const account = data.accounts.find(acc => acc.id === targetId);

        if (account) {
            const balance = account.availableBalance;
            const spendLimit = config.financial_guardrails.spend_limit_percentage;
            const spendable = balance * spendLimit;

            console.log(`✅ Identified Empire Fund: ${account.name}`);
            console.log(`💰 Current Balance: $${balance.toLocaleString()}`);
            console.log(`🛡️ Authorized Spending (${spendLimit * 100}%): $${spendable.toLocaleString()}`);

            if (balance > 0) {
                console.log("\n🚀 STATUS: REVENUE DETECTED. Budget Unlocked for Autonomous Operations.");
            } else {
                console.log("\n⚠️ STATUS: ZERO BALANCE. Waiting for revenue before execution.");
            }
        } else {
            console.log("❌ Error: Targeted Empire Fund ID not found in Mercury profile.");
        }
    } catch (e) {
        console.error("❌ Audit Failed:", e.message);
    }
    console.log("--------------------------------------\n");
}
checkMercury();
