// api/weather.js
// Lives in the "api-calls" Vercel project.
// Holds the real OpenWeatherMap key server-side (set as an env var in Vercel).

// simple in-memory rate limit — resets on cold start, but stops casual abuse
const requestLog = new Map();

export default async function handler(req, res) {
    // Wide open for now — friends can call this from anywhere.
    // Tighten later by replacing '*' with specific origin(s).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // --- rate limiting ---
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 20;     // max requests per IP per window

    const timestamps = (requestLog.get(ip) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    timestamps.push(now);
    requestLog.set(ip, timestamps);

    // --- validate input ---
    const { lat, lon, type } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'lat and lon are required' });
    }

    // --- call OpenWeatherMap ---
    const endpoint = type === 'forecast' ? 'forecast' : 'weather';
    const apiKey = process.env.OPENWEATHER_API_KEY;

    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/${endpoint}?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
        );

        if (!response.ok) {
            return res.status(response.status).json({ error: `OpenWeatherMap request failed: ${response.status}` });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch weather data' });
    }
}