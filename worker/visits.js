/**
 * visits — a tiny visit beacon for musaorak.com, deployed as a Cloudflare Worker.
 *
 * Each page on the site makes one request here (see assets/beacon.js). The Worker
 * records which network the visitor came from (the organization that owns the IP
 * block, e.g. a university or central bank), roughly where, and which page was read.
 * It stores no IP addresses and sets no cookies.
 *
 * Data goes to a Workers Analytics Engine dataset bound as `VISITS`; read it with
 * worker/report.sh. Note: request.cf is empty in the dashboard's Preview pane, so
 * test from the live site rather than from the editor.
 */

const ALLOWED_ORIGINS = new Set(['https://musaorak.com', 'https://www.musaorak.com']);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const fromSite = ALLOWED_ORIGINS.has(origin);
    const headers = {
      'Access-Control-Allow-Origin': fromSite ? origin : 'https://musaorak.com',
      'Cache-Control': 'no-store',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });

    // Count only requests made by the site's own pages; ignore stray hits.
    if (fromSite) {
      const params = new URL(request.url).searchParams;
      const cf = request.cf || {};
      const page = clip(params.get('p') || '/', 64);
      env.VISITS.writeDataPoint({
        indexes: [page],
        blobs: [
          clip(cf.asOrganization || 'unknown', 200), // blob1 organization owning the IP block
          String(cf.asn || ''),                       // blob2 autonomous system number
          cf.country || '',                           // blob3 ISO country code
          cf.region || '',                            // blob4 state or region
          cf.city || '',                              // blob5 city
          page,                                       // blob6 page path
          hostOf(params.get('r') || ''),              // blob7 referring site
        ],
        doubles: [1],
      });
    }
    return new Response(null, { status: 204, headers });
  },
};

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
