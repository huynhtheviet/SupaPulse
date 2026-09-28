/**
 * SupaPulse - Heartbeat Ping Script
 * Performs automated Read, Write, and Cleanup operations on Supabase REST API
 * to prevent project deactivation on the Free Tier.
 * Supports pinging multiple Supabase projects in a single run.
 *
 * @repository https://github.com/huynhtheviet/SupaPulse
 * @license MIT
 */

// ----------------------------------------------------------------------------
// Configuration loading
// ----------------------------------------------------------------------------
// Projects can be configured in three (combinable) ways:
//   1. SUPABASE_PROJECTS  - JSON array: [{"name":"app","url":"https://...","key":"..."}]
//   2. SUPABASE_URL_<N> / SUPABASE_KEY_<N> (+ optional SUPABASE_NAME_<N>) - numbered pairs
//   3. SUPABASE_URL / SUPABASE_KEY - legacy single project
// On GitHub Actions, SUPAPULSE_SECRETS (= toJSON(secrets)) exposes numbered
// secrets without having to list each of them in the workflow file.

function loadEnv() {
  const env = { ...process.env };
  if (env.SUPAPULSE_SECRETS) {
    try {
      const secrets = JSON.parse(env.SUPAPULSE_SECRETS);
      for (const [k, v] of Object.entries(secrets)) {
        if (k.startsWith("SUPABASE_") && !env[k]) env[k] = v;
      }
    } catch {
      console.warn("⚠️ [SupaPulse] Could not parse SUPAPULSE_SECRETS, ignoring it.");
    }
  }
  return env;
}

function loadProjects(env) {
  const projects = [];

  if (env.SUPABASE_PROJECTS) {
    let parsed;
    try {
      parsed = JSON.parse(env.SUPABASE_PROJECTS);
    } catch (error) {
      throw new Error(`SUPABASE_PROJECTS is not valid JSON: ${error.message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("SUPABASE_PROJECTS must be a JSON array of { name, url, key } objects.");
    }
    parsed.forEach((p, i) => {
      projects.push({ name: p?.name || `project-${i + 1}`, url: p?.url, key: p?.key });
    });
  }

  const indexes = Object.keys(env)
    .map((k) => k.match(/^SUPABASE_URL_(\d+)$/)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
  for (const n of indexes) {
    projects.push({
      name: env[`SUPABASE_NAME_${n}`] || `project-${n}`,
      url: env[`SUPABASE_URL_${n}`],
      key: env[`SUPABASE_KEY_${n}`] || env[`SUPABASE_ANON_KEY_${n}`]
    });
  }

  const legacyKey = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY;
  if (env.SUPABASE_URL || legacyKey) {
    projects.push({ name: env.SUPABASE_NAME || "default", url: env.SUPABASE_URL, key: legacyKey });
  }

  for (const p of projects) {
    if (!p.url || !p.key) {
      throw new Error(`Project "${p.name}" is missing its url or key.`);
    }
    p.url = p.url.trim().replace(/\/+$/, "");
    p.key = p.key.trim();
  }

  // Drop duplicates (same URL configured more than once)
  const seen = new Set();
  return projects.filter((p) => !seen.has(p.url) && seen.add(p.url));
}

// ----------------------------------------------------------------------------
// Heartbeat for a single project
// ----------------------------------------------------------------------------

async function supaPulse({ name, url, key }) {
  const log = (msg, ...rest) => console.log(`[${name}] ${msg}`, ...rest);
  const warn = (msg, ...rest) => console.warn(`[${name}] ${msg}`, ...rest);

  const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
  const timestamp = new Date().toISOString();
  log(`⚡ Initiating database heartbeat (${new URL(url).host})...`);

  // --------------------------------------------------------------------------
  // 1. READ Operation: Fetch the most recent heartbeat record
  // --------------------------------------------------------------------------
  log("📖 STEP 1/3: Reading recent heartbeat log...");
  const readRes = await fetch(`${url}/rest/v1/keep_alive_logs?select=*&order=created_at.desc&limit=1`, {
    method: "GET",
    headers
  });

  if (!readRes.ok) {
    const errText = await readRes.text();
    warn(`⚠️ Read warning (${readRes.status}):`, errText);
  } else {
    const logs = await readRes.json();
    log(`✅ Read successful. Logs retrieved: ${logs.length}`);
  }

  // --------------------------------------------------------------------------
  // 2. WRITE Operation: Insert new heartbeat record
  // --------------------------------------------------------------------------
  log("✍️ STEP 2/3: Writing new heartbeat log...");
  const writePayload = {
    note: `Heartbeat pulse generated via SupaPulse at ${timestamp}`,
    status: "active"
  };

  const writeRes = await fetch(`${url}/rest/v1/keep_alive_logs`, {
    method: "POST",
    headers,
    body: JSON.stringify(writePayload)
  });

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Write failed with HTTP status ${writeRes.status}: ${errText}`);
  }

  const inserted = await writeRes.json();
  log(`✅ Write successful. Record ID: ${inserted[0]?.id || "OK"}`);

  // --------------------------------------------------------------------------
  // 3. CLEANUP Operation: Delete logs older than 7 days to conserve space
  // --------------------------------------------------------------------------
  log("🧹 STEP 3/3: Cleaning up historical logs (> 7 days)...");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const deleteRes = await fetch(`${url}/rest/v1/keep_alive_logs?created_at=lt.${sevenDaysAgo}`, {
    method: "DELETE",
    headers
  });

  if (deleteRes.ok) {
    log("✅ Cleanup completed successfully.");
  } else {
    warn(`⚠️ Cleanup non-critical warning (${deleteRes.status}).`);
  }

  log("🎉 Heartbeat completed! Supabase project is active & healthy.");
}

// ----------------------------------------------------------------------------
// Main: ping all configured projects in parallel, then report a summary
// ----------------------------------------------------------------------------

async function main() {
  let projects;
  try {
    projects = loadProjects(loadEnv());
  } catch (error) {
    console.error(`❌ [SupaPulse] Fatal Error: ${error.message}`);
    process.exit(1);
  }

  if (projects.length === 0) {
    console.error(
      "❌ [SupaPulse] Fatal Error: No Supabase project configured. " +
      "Set SUPABASE_URL/SUPABASE_KEY, SUPABASE_URL_<N>/SUPABASE_KEY_<N>, or SUPABASE_PROJECTS."
    );
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] ⚡ [SupaPulse] Pinging ${projects.length} Supabase project(s)...`);

  const results = await Promise.allSettled(projects.map(supaPulse));

  console.log("\n📊 [SupaPulse] Summary:");
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`  ✅ ${projects[i].name}`);
    } else {
      failed++;
      console.error(`  ❌ ${projects[i].name}: ${result.reason?.message || result.reason}`);
    }
  });

  if (failed > 0) {
    console.error(`❌ [SupaPulse] ${failed}/${projects.length} project(s) failed.`);
    process.exit(1);
  }
  console.log(`🎉 [SupaPulse] All ${projects.length} project(s) are active & healthy.`);
}

main();
