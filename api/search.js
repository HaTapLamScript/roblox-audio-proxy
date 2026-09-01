const ytSearch = require('yt-search');

const searchCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { q, query } = req.query;
    const searchTerm = (q || query || '').trim().toLowerCase();

    if (!searchTerm) {
        return res.status(400).json({ success: false, error: 'Missing ?q=' });
    }

    const cached = searchCache.get(searchTerm);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.status(200).json({
            success: true,
            keyword: searchTerm,
            total: cached.videos.length,
            cached: true,
            videos: cached.videos
        });
    }

    try {
        const searchResult = await ytSearch(searchTerm);
        const videos = searchResult.videos.slice(0, 50);

        if (!videos || videos.length === 0) {
            return res.status(404).json({ success: false, error: 'No results' });
        }

        const domain = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const proxyBaseUrl = `${protocol}://${domain}/api/image?url=`;

        const tracks = videos.map(item => {
            let rawThumb = item.thumbnail || item.image || '';
            if (!rawThumb && item.videoId) {
                rawThumb = `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
            }
            const safeThumbUrl = rawThumb ? `${proxyBaseUrl}${encodeURIComponent(rawThumb)}` : '';
            return {
                title: item.title,
                videoId: item.videoId,
                duration: item.timestamp,
                thumbnail: safeThumbUrl,
                url: item.url
            };
        });

        searchCache.set(searchTerm, {
            timestamp: Date.now(),
            videos: tracks
        });

        return res.status(200).json({
            success: true,
            keyword: searchTerm,
            total: tracks.length,
            cached: false,
            videos: tracks
        });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
