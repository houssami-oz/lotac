export const config = { runtime: 'nodejs' };

const UA = 'LOTAC/1.0 (+https://lotac.vercel.app)';

export default async function handler(req, res) {
  try {
    const q = (req.query?.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'missing q' });

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
    if (!r.ok) throw new Error('geocode http ' + r.status);
    const arr = await r.json();
    if (!arr?.length) return res.status(404).json({ error: 'not found' });

    const { lat, lon, display_name } = arr[0];
    // ville best-effort
    let city = '';
    const m = display_name.split(',').map(s=>s.trim());
    if (m.length >= 3) city = m[m.length-3]; // heuristique

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ lat: parseFloat(lat), lon: parseFloat(lon), city });
  } catch (e) {
    res.status(500).json({ error: 'server', message: String(e) });
  }
}
