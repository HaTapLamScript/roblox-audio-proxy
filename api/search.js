const ytSearch = require('yt-search');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { q, query } = req.query;
    const searchTerm = q || query;

    if (!searchTerm) {
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu từ khóa tìm kiếm ?q=' 
        });
    }

    try {
        // Tìm kiếm YouTube với từ khóa người dùng nhập (lấy tối đa 15 kết quả)
        const searchResult = await ytSearch(searchTerm);
        const videos = searchResult.videos.slice(0, 15);

        if (!videos || videos.length === 0) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy kết quả phù hợp!' });
        }

        const tracks = videos.map(item => ({
            title: item.title,
            videoId: item.videoId,
            duration: item.timestamp,
            url: item.url
        }));

        return res.status(200).json({
            success: true,
            keyword: searchTerm,
            total: tracks.length,
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
          
