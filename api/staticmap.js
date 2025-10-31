// /api/staticmap.js
export const config = { runtime: 'nodejs' }; // force Node (pas Edge), pour Buffer etc.

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

async function fetchAsBase64(url, label) {
  // timeout 6s pour éviter de bloquer
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);

  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' },
    cache: 'no-store',
    signal: ctrl.signal
  }).catch(err => {
    throw new Error(`${label} fetch failed: ${err?.message || err}`);
  });

  clearTimeout(t);

  if (!r.ok) {
    throw new Error(`${label} HTTP ${r.status}`);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  const base64 = buf.toString('base64');
  // on suppose PNG en priorité; si le content-type indique autre chose, on l’utilise
  const ct = r.headers.get('content-type') || 'image/png';
  const mime = ct.includes('jpeg') ? 'image/jpeg' : (ct.includes('webp') ? 'image/webp' : 'image/png');
  return `data:${mime};base64,${base64}`;
}

function fallbackSvg(w, h, msg = 'carte indisponible') {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6f7f9"/>
        <stop offset="1" stop-color="#eceef1"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <g fill="#c0392b" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" text-anchor="middle">
      <text x="${w/2}" y="${h/2 - 10}" font-size="22">🥺 ${msg}</text>
      <text x="${w/2}" y="${h/2 + 22}" font-size="14" fill="#7f8c8d">réessaie dans un instant</text>
    </g>
  </svg>`;
  const b64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

export default async function handler(req, res) {
  try {
    const { lat, lon, zoom = '15', w = '1100', h = '650' } = req.query || {};
    if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

    const osm = buildOSM(lat, lon, zoom, w, h);
    const weserv = buildWeserv(lat, lon, zoom, w, h);

    let dataUrl;

    // 1) essai OSM direct
    try {
      dataUrl = await fetchAsBase64(osm, 'OSM');
    } catch (e1) {
      // 2) fallback via Weserv (proxy images)
      try {
        dataUrl = await fetchAsBase64(weserv, 'WESERV');
      } catch (e2) {
        // 3) fallback final : image de secours pour que le PDF sorte quand même
        dataUrl = fallbackSvg(w, h);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ dataUrl });
  } catch (e) {
    // en dernier recours, on renvoie au moins une image de secours
    const dataUrl = fallbackSvg(1100, 650);
    res.status(200).json({ dataUrl, note: 'fallback' });
  }
}
