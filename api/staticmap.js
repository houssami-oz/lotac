// /api/staticmap.js
export default async function handler(req, res) {
  const { lat, lon, zoom = '15', w = '1100', h = '650' } = req.query || {};
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

  // 1) cible OSM directe
  const osmUrl =
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${encodeURIComponent(lat)},${encodeURIComponent(lon)}` +
    `&zoom=${encodeURIComponent(zoom)}` +
    `&size=${encodeURIComponent(w)}x${encodeURIComponent(h)}` +
    `&markers=${encodeURIComponent(lat)},${encodeURIComponent(lon)},red-pushpin`;

  // 2) fallback via weserv (proxy d'images, très robuste)
  const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(
    'staticmap.openstreetmap.de/staticmap.php' +
      `?center=${lat},${lon}&zoom=${zoom}&size=${w}x${h}&markers=${lat},${lon},red-pushpin`
  )}`;

  async function fetchAsBuffer(url, label) {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'LOTAC/1.0 (+https://lotac.vercel.app; contact: tonmail@domaine.com)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || 'image/png';
    const ab = await r.arrayBuffer();
    return { buf: Buffer.from(ab), contentType: ct };
  }

  try {
    // essai direct OSM
    let payload;
    try {
      payload = await fetchAsBuffer(osmUrl, 'OSM');
    } catch (e1) {
      // fallback weserv
      payload = await fetchAsBuffer(weservUrl, 'WESERV');
    }

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(200).send(payload.buf);
  } catch (e) {
    res.status(502).json({ error: 'Upstream static map error', message: String(e) });
  }
}
