export const config = { runtime: 'nodejs' };

const UA = 'LOTAC/1.0 (+https://lotac.vercel.app)';

function qs(obj){ return Object.entries(obj).map(([k,v])=>`${k}=${encodeURIComponent(v||'')}`).join('&'); }

export default async function handler(req, res) {
  try {
    const street = (req.query.street || '').toString().trim();
    const postalcode = (req.query.postalcode || '').toString().trim();
    const city = (req.query.city || '').toString().trim();
    const country = (req.query.country || '').toString().trim();

    // besoin au minimum de city + country
    if (!city || !country) return res.status(400).json({ error: 'missing city/country' });

    const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1';
    const url = `${base}&${qs({ street, postalcode, city, country })}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });

    if (!r.ok) throw new Error('geocode http ' + r.status);
    const arr = await r.json();
    if (!arr?.length) return res.status(404).json({ error: 'not found' });

    const { lat, lon, display_name, address } = arr[0];
    const bestCity = address?.city || address?.town || address?.village || address?.municipality || '';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ lat: parseFloat(lat), lon: parseFloat(lon), city: bestCity || city, display_name });
  } catch (e) {
    return res.status(500).json({ error: 'server', message: String(e) });
  }
}
