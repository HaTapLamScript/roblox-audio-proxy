const ytpl = require('ytpl');

module.exports = async (req, res) => {
    // Bật CORS đầy đủ để Roblox / Delta gọi API không bị chặn
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { list, url } = req.query;
    const targetQuery = list || url;

    if (!targetQuery) {
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu tham số ?list= hoặc ?url=' 
        });
    }

    try {
        // Tự động bóc tách ID Playlist chính xác từ mọi định dạng link YouTube / YT Music
        let playlistId = targetQuery;
        if (targetQuery.includes('list=')) {
            const match = targetQuery.match(/list=([a-zA-Z0-9\-_]+)/);
            if (match && match[1]) {
                playlistId = match[1];
            }
        }

        // Lấy danh sách bài hát (giới hạn 150 bài đầu tiên để tối ưu tốc độ cho Serverless Function)
        const playlist = await ytpl(playlistId, { limit: 150 });

        const tracks = playlist.items.map(item => ({
            title: item.title,
            videoId: item.id,
            url: item.url
        }));

        return res.status(200).json({
            success: true,
            title: playlist.title,
            total: tracks.length,
            videos: tracks
        });

    } catch (error) {
        console.error('Lỗi trích xuất playlist:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Không thể lấy dữ liệu playlist từ YouTube' 
        });
    }
};
