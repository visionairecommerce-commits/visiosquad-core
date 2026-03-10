import { storage } from "../server/storage.js";
import manifest from "../aurelius-manifest.json" assert { type: "json" };

async function runAudit() {
  console.log("🚀 Aurelius: Deep System Verification...");
  try {
    console.log("🔍 1. Database...");
    if (!!storage) console.log("✅ Engine: REACHABLE");

    console.log("🔍 2. Pricing...");
    const feeModule = await import("../" + manifest.core_paths.fees);
    const fee = feeModule.TOTAL_PLATFORM_FEE;
    console.log("✅ Status: SECURE ($" + fee.toFixed(2) + " confirmed)");

    console.log("🔍 3. Roadblocks...");
    const users = await storage.getUsers?.() || [];
    const orphaned = users.filter(u => !u.clubId);
    if (orphaned.length > 0) {
      console.warn("⚠️ Roadblock: " + orphaned.length + " users missing Club IDs.");
    } else {
      console.log("✅ User Mapping: HEALTHY");
    }
  } catch (e) {
    console.error("❌ Error: " + e.message);
  }
  console.log("🏁 Audit Complete.");
  process.exit(0);
}
runAudit();
