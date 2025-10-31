export default async function handler(req, res) {
  const q = req.query.q || '';
  if (!q) {
    res.status(400).json({ error: 'Missing q' });
    return;
  }

  try {
    // requête vers Nominatim (service géocodage openstreetmap)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=1`;
    const r = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
        // le User-Agent est obligatoire selon la politique d'utilisation de Nominatim
        'User-Agent': 'LOTAC/1.0 (+https://lotac.vercel.app; contact: contact@lotac.com)'
      },
      cache: 'no-store'
    });

    if (!r.ok) {
      res.status(502).json({ error: 'Upstream error' });
      return;
    }

    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const { lat, lon, address } = data[0];
    const city = address?.city || address?.town || address?.village || address?.municipality || address?.county || '';

    // pas de cache pour éviter les blocages
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ lat: parseFloat(lat), lon: parseFloat(lon), city });
  } catch (e) {
    res.status(500).json({ error: 'Server error', message: e.message });
  }
}
