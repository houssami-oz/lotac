// /api/geocode.js
export default async function handler(req, res) {
  const q = req.query.q || '';
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=1`;
    const r = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
        'User-Agent': 'LOTAC/1.0 (+https://lotac.vercel.app; contact: contact@lotac.vercel.app)'
      },
      cache: 'no-store'
    });
    if (!r.ok) return res.status(502).json({ error: 'Upstream error', status: r.status });

    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) return res.status(404).json({ error: 'Not found' });

    const { lat, lon, address } = data[0];
    const city = address?.city || address?.town || address?.village || address?.municipality || address?.county || '';
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ lat: parseFloat(lat), lon: parseFloat(lon), city });
  } catch (e) {
    res.status(500).json({ error: 'Server error', message: e.message });
  }
}
