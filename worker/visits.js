/**
 * visits — a tiny visit beacon for musaorak.com, deployed as a Cloudflare Worker.
 *
 * Each page on the site makes one request here (see assets/beacon.js). The Worker
 * records which network the visitor came from (the organization that owns the IP
 * block, e.g. a university or central bank), roughly where, and which page was read.
 * It stores no IP addresses and sets no cookies.
 *
 * Data goes to a Workers Analytics Engine dataset bound as `VISITS`. Read it either
 * with worker/report.sh or in a browser at /report?key=<REPORT_KEY>, which needs
 * three Worker variables (Settings → Variables and Secrets):
 *   CF_ACCOUNT_ID  text    the Cloudflare account ID
 *   CF_API_TOKEN   secret  API token with permission Account | Account Analytics | Read
 *   REPORT_KEY     secret  any long random string; the report URL must carry it as ?key=
 *
 * Note: request.cf is empty in the dashboard's Preview pane, so test the beacon from
 * the live site rather than from the editor.
 */

const ALLOWED_ORIGINS = new Set(['https://musaorak.com', 'https://www.musaorak.com']);
const TIMEZONE = 'America/New_York';
const NO_STORE = { 'Cache-Control': 'no-store' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/report') return report(url, env);
    return beacon(request, url, env);
  },
};

// ---------------------------------------------------------------- beacon ----

function beacon(request, url, env) {
  const origin = request.headers.get('Origin') || '';
  const fromSite = ALLOWED_ORIGINS.has(origin);
  const headers = {
    ...NO_STORE,
    'Access-Control-Allow-Origin': fromSite ? origin : 'https://musaorak.com',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });

  // Count only requests made by the site's own pages; ignore stray hits.
  if (fromSite) {
    const cf = request.cf || {};
    const page = clip(url.searchParams.get('p') || '/', 64);
    env.VISITS.writeDataPoint({
      indexes: [page],
      blobs: [
        clip(cf.asOrganization || 'unknown', 200), // blob1 organization owning the IP block
        String(cf.asn || ''),                       // blob2 autonomous system number
        cf.country || '',                           // blob3 ISO country code
        cf.region || '',                            // blob4 state or region
        cf.city || '',                              // blob5 city
        page,                                       // blob6 page path
        hostOf(url.searchParams.get('r') || ''),    // blob7 referring site
      ],
      doubles: [1],
    });
  }
  return new Response(null, { status: 204, headers });
}

// ---------------------------------------------------------------- report ----

async function report(url, env) {
  const key = url.searchParams.get('key') || '';
  if (!env.REPORT_KEY || !safeEqual(key, env.REPORT_KEY)) {
    return new Response('Not found', { status: 404, headers: NO_STORE });
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return new Response('Report not configured: set CF_ACCOUNT_ID and CF_API_TOKEN on the Worker.', {
      status: 500, headers: NO_STORE,
    });
  }

  const requested = parseInt(url.searchParams.get('days') || '30', 10);
  const days = Math.min(Math.max(Number.isFinite(requested) ? requested : 30, 1), 90);
  const since = `WHERE timestamp > now() - INTERVAL '${days}' DAY`;
  const lastSeen = `formatDateTime(max(timestamp), '%Y-%m-%d %H:%i', '${TIMEZONE}') AS last_seen`;
  const sections = [
    {
      title: 'By organization',
      sql: `SELECT blob1 AS organization, blob3 AS country, blob5 AS city, sum(_sample_interval) AS visits, ${lastSeen}
            FROM visits ${since} GROUP BY organization, country, city ORDER BY visits DESC LIMIT 200`,
    },
    {
      title: 'By page',
      sql: `SELECT blob6 AS page, sum(_sample_interval) AS visits, ${lastSeen}
            FROM visits ${since} GROUP BY page ORDER BY visits DESC LIMIT 200`,
    },
    {
      title: 'By referring site',
      sql: `SELECT blob7 AS referrer, sum(_sample_interval) AS visits, ${lastSeen}
            FROM visits ${since} GROUP BY referrer ORDER BY visits DESC LIMIT 200`,
    },
    {
      title: 'By day',
      sql: `SELECT formatDateTime(toStartOfInterval(timestamp, INTERVAL '1' DAY, '${TIMEZONE}'), '%Y-%m-%d', '${TIMEZONE}') AS day,
                   sum(_sample_interval) AS visits
            FROM visits ${since} GROUP BY day ORDER BY day DESC LIMIT 200`,
    },
  ];

  const results = await Promise.all(
    sections.map((s) => query(env, s.sql).then((r) => ({ title: s.title, ...r }))),
  );
  return new Response(renderReport(days, key, results), {
    headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

async function query(env, sql) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: sql,
    });
  } catch (e) {
    return { error: `Could not reach the SQL API: ${e.message}` };
  }
  const text = await res.text();
  if (!res.ok) return { error: `SQL API returned ${res.status}: ${clip(text, 300)}` };
  try {
    const json = JSON.parse(text);
    return { columns: json.meta.map((m) => m.name), rows: json.data };
  } catch {
    return { error: `Unreadable SQL API response: ${clip(text, 300)}` };
  }
}

function renderReport(days, key, results) {
  const rangeLink = (n) =>
    n === days
      ? `<strong>${n} days</strong>`
      : `<a href="/report?key=${encodeURIComponent(key)}&amp;days=${n}">${n} days</a>`;

  const sectionsHtml = results.map((r) => {
    let body;
    if (r.error) {
      body = `<p class="error">${esc(r.error)}</p>`;
    } else if (!r.rows.length) {
      body = `<p class="empty">No visits in this period.</p>`;
    } else {
      const head = r.columns.map((c) => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('');
      const rows = r.rows
        .map((row) => `<tr>${r.columns.map((c) => `<td>${esc(cell(row[c]))}</td>`).join('')}</tr>`)
        .join('');
      body = `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    return `<section><h2>${esc(r.title)}</h2>${body}</section>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Visits to musaorak.com</title>
<style>
  :root { color-scheme: light dark; --fg: #1b1b1b; --bg: #fff; --muted: #666; --line: #ddd; --accent: #1a5fb4; --zebra: #f6f6f6; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e6e6e6; --bg: #141414; --muted: #9a9a9a; --line: #333; --accent: #7fb2ff; --zebra: #1c1c1c; }
  }
  body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--fg);
         font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 32px 0 8px; }
  .range { color: var(--muted); margin: 0 0 8px; }
  .range a { color: var(--accent); }
  .note { color: var(--muted); font-size: 0.9rem; margin: 0; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 0.85rem; text-transform: capitalize; }
  tbody tr:nth-child(even) { background: var(--zebra); }
  td:nth-last-child(-n+2), th:nth-last-child(-n+2) { white-space: nowrap; }
  .empty, .error { color: var(--muted); font-style: italic; }
  .error { color: #c0392b; }
</style>
</head>
<body>
<main>
  <h1>Visits to musaorak.com</h1>
  <p class="range">Last ${rangeLink(7)} · ${rangeLink(30)} · ${rangeLink(90)} · times in Eastern</p>
  <p class="note">Organization is the owner of the visitor's network. Residential and mobile carriers and
  Apple's iCloud Private Relay (shown as Cloudflare) are expected; institutions appear only for visits from
  their office or campus network or VPN.</p>
  ${sectionsHtml}
</main>
</body>
</html>`;
}

// --------------------------------------------------------------- helpers ----

function clip(s, n) {
  return String(s).slice(0, n);
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function cell(v) {
  return v === '' || v === null || v === undefined ? '—' : String(v);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.byteLength !== y.byteLength) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}
