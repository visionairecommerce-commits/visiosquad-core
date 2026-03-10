import { db } from "../server/db";
import { users, clubs } from "../shared/schema";

async function runAudit() {
console.log("🚀 AI CEO Starting Permission & Visibility Audit...");

// 1. Check for "Ghost" Users (Users without a Club ID)
const orphanedUsers = await db.select().from(users).where({ clubId: null });
if (orphanedUsers.length > 0) {
console.warn("⚠️ Found " + orphanedUsers.length + " users with no Club ID. They likely see a blank screen.");
}

// 2. Verify Pricing Logic Accessibility
try {
const { TOTAL_PLATFORM_FEE } = await import("../app/fee.js");
console.log("✅ Pricing Config Link: SECURE ($" + TOTAL_PLATFORM_FEE + " found)");
} catch (e) {
console.error("❌ ROADBLOCK: Frontend cannot see pricing constants!");
}

console.log("🏁 Audit Complete.");
}

runAudit();
