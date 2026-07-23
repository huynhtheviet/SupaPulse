/**
 * Supabase Keep-Alive Script
 * Executes a Read, Write, and Cleanup operation on Supabase REST API
 * to prevent project deactivation.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY environment variable.");
  process.exit(1);
}

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function keepAlive() {
  console.log(`[${new Date().toISOString()}] 🚀 Starting Supabase Keep-Alive ping...`);

  try {
    // 1. READ Operation: Fetch latest 1 record
    console.log("📖 Reading latest ping log...");
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs?select=*&order=created_at.desc&limit=1`, {
      method: "GET",
      headers
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      console.warn("⚠️ Warning on READ operation:", readRes.status, errText);
    } else {
      const logs = await readRes.json();
      console.log(`✅ READ Success. Previous log count returned: ${logs.length}`);
    }

    // 2. WRITE Operation: Insert new ping record
    console.log("✍️ Writing new ping record...");
    const writePayload = {
      note: `Keep-alive pulse from GitHub Actions at ${new Date().toISOString()}`,
      status: "active"
    };

    const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(writePayload)
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`WRITE failed with status ${writeRes.status}: ${errText}`);
    }

    const inserted = await writeRes.json();
    console.log("✅ WRITE Success! Created record:", inserted[0]?.id || "OK");

    // 3. CLEANUP Operation: Delete records older than 7 days to conserve space
    console.log("🧹 Cleaning up old logs (> 7 days)...");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/keep_alive_logs?created_at=lt.${sevenDaysAgo}`, {
      method: "DELETE",
      headers
    });

    if (deleteRes.ok) {
      console.log("✅ CLEANUP Completed successfully.");
    }

    console.log("🎉 Supabase project is active and healthy!");
  } catch (error) {
    console.error("❌ Keep-Alive Error:", error.message);
    process.exit(1);
  }
}

keepAlive();
