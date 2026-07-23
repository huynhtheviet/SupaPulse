/**
 * SupaPulse - Heartbeat Ping Script
 * Performs automated Read, Write, and Cleanup operations on Supabase REST API
 * to prevent project deactivation on the Free Tier.
 *
 * @repository https://github.com/your-username/supa-pulse
 * @license MIT
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ [SupaPulse] Fatal Error: Missing SUPABASE_URL or SUPABASE_KEY environment variable.");
  process.exit(1);
}

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function supaPulse() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ⚡ [SupaPulse] Initiating database heartbeat...`);

  try {
    // --------------------------------------------------------------------------
    // 1. READ Operation: Fetch the most recent heartbeat record
    // --------------------------------------------------------------------------
    console.log("📖 [SupaPulse] STEP 1/3: Reading recent heartbeat log...");
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs?select=*&order=created_at.desc&limit=1`, {
      method: "GET",
      headers
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      console.warn(`⚠️ [SupaPulse] Read warning (${readRes.status}):`, errText);
    } else {
      const logs = await readRes.json();
      console.log(`✅ [SupaPulse] Read successful. Logs retrieved: ${logs.length}`);
    }

    // --------------------------------------------------------------------------
    // 2. WRITE Operation: Insert new heartbeat record
    // --------------------------------------------------------------------------
    console.log("✍️ [SupaPulse] STEP 2/3: Writing new heartbeat log...");
    const writePayload = {
      note: `Heartbeat pulse generated via GitHub Actions at ${timestamp}`,
      status: "active"
    };

    const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(writePayload)
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`Write failed with HTTP status ${writeRes.status}: ${errText}`);
    }

    const inserted = await writeRes.json();
    console.log(`✅ [SupaPulse] Write successful. Record ID: ${inserted[0]?.id || "OK"}`);

    // --------------------------------------------------------------------------
    // 3. CLEANUP Operation: Delete logs older than 7 days to conserve space
    // --------------------------------------------------------------------------
    console.log("🧹 [SupaPulse] STEP 3/3: Cleaning up historical logs (> 7 days)...");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs?created_at=lt.${sevenDaysAgo}`, {
      method: "DELETE",
      headers
    });

    if (deleteRes.ok) {
      console.log("✅ [SupaPulse] Cleanup completed successfully.");
    } else {
      console.warn(`⚠️ [SupaPulse] Cleanup non-critical warning (${deleteRes.status}).`);
    }

    console.log("🎉 [SupaPulse] Heartbeat completed! Supabase project is active & healthy.");
  } catch (error) {
    console.error("❌ [SupaPulse] Execution Failed:", error.message);
    process.exit(1);
  }
}

supaPulse();
