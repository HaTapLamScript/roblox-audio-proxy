const ytSearch = require('yt-search');

// Bộ nhớ đệm (Cache) nằm trực tiếp trên RAM của Serverless Function
// Giúp lưu lại kết quả tìm kiếm trong vòng 1 tiếng, không phải gọi lại YouTube nhiều lần
const searchCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ (tính bằng mili-giây)

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
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu từ khóa tìm kiếm ?q=' 
        });
    }

    // 1. KIỂM TRA TRONG CACHE TRƯỚC (Tiết kiệm 100% tài nguyên nếu từ khóa đã được tìm trước đó)
    const cachedData = searchCache.get(searchTerm);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        return res.status(200).json({
            success: true,
            keyword: searchTerm,
            total: cachedData.videos.length,
            cached: true, // Đánh dấu là đang lấy từ cache
            videos: cachedData.videos
        });
    }

    try {
        // 2. GỌI YOUTUBE NẾU CHƯA CÓ TRONG CACHE
        const searchResult = await ytSearch(searchTerm);
        const videos = searchResult.videos.slice(0, 50);

        if (!videos || videos.length === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy kết quả phù hợp!' });
        }

        const domain = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const proxyBaseUrl = `${protocol}://${domain}/api/image?url=`;

        const tracks = videos.map(item => {
            let rawThumb = item.thumbnail || item.image || '';
            if (!rawThumb && item.videoId) {
                rawThumb = `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
            }

            // Đưa link ảnh đi qua Proxy của chúng ta để tránh bị Roblox chặn
            const safeThumbUrl = rawThumb ? `${proxyBaseUrl}${encodeURIComponent(rawThumb)}` : '';

            return {
                title: item.title,
                videoId: item.videoId,
                duration: item.timestamp,
                thumbnail: safeThumbUrl,
                url: item.url
            };
        });

        // Đóng gói kết quả vào Cache
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
        console.error('Lỗi Search API:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Lỗi server khi tìm kiếm' 
        });
    }
};
