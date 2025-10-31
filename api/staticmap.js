// /api/staticmap.js
export default async function handler(req, res) {
  const { lat, lon, zoom = '15', w = '1100', h = '650' } = req.query || {};
  if (!lat || !lon)
    return res.status(400).json({ error: 'Missing lat/lon' });

  const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(
    lat
  )},${encodeURIComponent(lon)}&zoom=${encodeURIComponent(
    zoom
  )}&size=${encodeURIComponent(w)}x${encodeURIComponent(
    h
  )}&markers=${encodeURIComponent(lat)},${encodeURIComponent(lon)},red-pushpin`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'LOTAC/1.0 (+https://lotac.vercel.app; contact: contact@lotac.vercel.app)',
      },
      cache: 'no-store',
    });
    if (!r.ok)
      return res
        .status(502)
        .json({ error: 'Upstream error', status: r.status });

    const buffer = Buffer.from(await r.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    // ici on renvoie directement l'image encodée
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ dataUrl });
  } catch (e) {
    res
      .status(500)
      .json({ error: 'Server error', message: e.message || String(e) });
  }
}
