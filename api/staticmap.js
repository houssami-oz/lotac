// /api/staticmap.js
export default async function handler(req, res) {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const zoom = req.query.zoom || '15';
  const w = req.query.w || '1100';
  const h = req.query.h || '650';

  if (!lat || !lon) {
    res.status(400).json({ error: 'Missing lat/lon' });
    return;
  }

  // URL upstream OSM static map
  const upstream = `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(
    lat
  )},${encodeURIComponent(lon)}&zoom=${encodeURIComponent(
    zoom
  )}&size=${encodeURIComponent(w)}x${encodeURIComponent(
    h
  )}&markers=${encodeURIComponent(lat)},${encodeURIComponent(lon)},red-pushpin`;

  try {
    const r = await fetch(upstream, {
      headers: {
        // user-agent propre, ça évite certains blocages
        'User-Agent': 'LOTAC/1.0 (+https://tondomaine.com; contact: toi@tondomaine.com)'
      },
      cache: 'no-store'
    });

    if (!r.ok) {
      res.status(502).json({ error: 'Upstream static map error' });
      return;
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    // permissif pour html2canvas/html2pdf
    res.setHeader('Access-Control-Allow-Origin', '*');
    // petit cache CDN (10 min) pour accélérer
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Server error', message: String(e) });
  }
}
