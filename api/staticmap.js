// /api/staticmap.js
// ✅ priorise Google Static Maps si GOOGLE_MAPS_KEY est définie
// ✅ sinon: OSM ➜ Weserv ➜ SVG de secours
// ✅ renvoie TOUJOURS { dataUrl, source }, dataUrl = "data:image/...;base64,..."

export const config = { runtime: 'nodejs' }; // Buffer dispo (pas d’Edge)

const UA = 'LOTAC/1.0 (+https://lotac.vercel.app; contact: contact@lotac.vercel.app)';

function buildOSM(lat, lon, zoom, w, h) {
  return 'https://staticmap.openstreetmap.de/staticmap.php'
    + `?center=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
    + `&zoom=${encodeURIComponent(zoom)}`
    + `&size=${encodeURIComponent(w)}x${encodeURIComponent(h)}`
    + `&markers=${encodeURIComponent(lat)},${encodeURIComponent(lon)},red-pushpin`;
}

function buildWeserv(lat, lon, zoom, w, h) {
  const raw = `staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${w}x${h}&markers=${lat},${lon},red-pushpin`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
}

function buildGoogle(lat, lon, zoom, w, h, key) {
  // Google limite size à 640x640 (sans premium). On “clamp” et on met scale=2 pour du HiDPI.
  const gw = Math.min(parseInt(w, 10) || 640, 640);
  const gh = Math.min(parseInt(h, 10) || 640, 640);
  const scale = 2; // rend net sans dépasser les quotas de taille
  return 'https://maps.googleapis.com/maps/api/staticmap'
    + `?center=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
    + `&zoom=${encodeURIComponent(zoom)}`
    + `&size=${gw}x${gh}&scale=${scale}`
    + `&markers=color:red|${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
    + `&key=${encodeURIComponent(key)}`;
}

async function fetchAsBase64(url, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000); // timeout 8s
  let r;
  try {
    r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' },
      cache: 'no-store',
      signal: ctrl.signal
    });
  } catch (err) {
    throw new Error(`${label} fetch failed: ${err?.message || err}`);
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);

  const ct = (r.headers.get('content-type') || '').toLowerCase();
  const mime = ct.includes('jpeg') ? 'image/jpeg'
            : ct.includes('webp') ? 'image/webp'
            : 'image/png';
  const buf = Buffer.from(await r.arrayBuffer());
  return { dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
}

function fallbackSvg(w, h, msg = 'carte indisponible') {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6f7f9"/><stop offset="1" stop-color="#eceef1"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <g fill="#c0392b" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial" text-anchor="middle">
      <text x="${w/2}" y="${h/2 - 10}" font-size="22">🥺 ${msg}</text>
      <text x="${w/2}" y="${h/2 + 22}" font-size="14" fill="#7f8c8d">réessaie dans un instant</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export default async function handler(req, res) {
  try {
    const { lat, lon, zoom = '15', w = '1100', h = '650' } = req.query || {};
    if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

    const GMAPS_KEY = process.env.GOOGLE_MAPS_KEY;

    // ordre: GOOGLE (si clé) -> OSM -> WESERV -> SVG
    const tryQueue = [];

    if (GMAPS_KEY) tryQueue.push({ url: buildGoogle(lat, lon, zoom, w, h, GMAPS_KEY), label: 'GOOGLE' });
    tryQueue.push({ url: buildOSM(lat, lon, zoom, w, h), label: 'OSM' });
    tryQueue.push({ url: buildWeserv(lat, lon, zoom, w, h), label: 'WESERV' });

    let result = null;
    let source = 'fallback';
    for (const cand of tryQueue) {
      try {
        const { dataUrl } = await fetchAsBase64(cand.url, cand.label);
        result = dataUrl;
        source = cand.label.toLowerCase();
        break;
      } catch (e) {
        // on continue avec le candidat suivant
      }
    }

    if (!result) {
      result = fallbackSvg(w, h);
      source = 'fallback';
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ dataUrl: result, source });
  } catch (e) {
    const dataUrl = fallbackSvg(1100, 650);
    res.status(200).json({ dataUrl, source: 'fallback', note: String(e) });
  }
}
