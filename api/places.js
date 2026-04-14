export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { query, location = 'Tupelo, MS' } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const apiKey = process.env.GOOGLE_PLACES_KEY;

  try {
    // First get coordinates for the location
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
    );
    const geoData = await geoRes.json();

    let lat = 34.2576;
    let lng = -88.7034;

    if (geoData.results && geoData.results.length > 0) {
      lat = geoData.results[0].geometry.location.lat;
      lng = geoData.results[0].geometry.location.lng;
    }

    // Search for businesses
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&location=${lat},${lng}&radius=50000&key=${apiKey}`
    );
    const searchData = await searchRes.json();

    if (!searchData.results) {
      return res.status(200).json({ results: [] });
    }

    // Format and score results
    const leads = searchData.results.slice(0, 10).map(place => {
      const rating = place.rating || 0;
      const reviewCount = place.user_ratings_total || 0;

      // Score opportunity — lower rating and fewer reviews = bigger opportunity
      let score = 'new';
      if (rating < 3.5 || reviewCount < 10) score = 'hot';
      else if (rating < 4.2 || reviewCount < 50) score = 'warm';

      return {
        name: place.name,
        address: place.formatted_address,
        rating: rating,
        reviews: reviewCount,
        placeId: place.place_id,
        status: place.business_status,
        score,
        isCyber: false,
      };
    });

    return res.status(200).json({ results: leads });

  } catch (error) {
    console.error('Places API error:', error);
    return res.status(500).json({ error: 'Failed to fetch places' });
  }
}
