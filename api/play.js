const ytdl = require('iguro-ytdl');

module.exports = async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    try {
        // Lấy thông tin audio
        const audioInfo = await ytdl.ytmp3(url);
        
        // Kiểm tra xem có link không
        if (!audioInfo || !audioInfo.download_url) {
            return res.status(404).json({ error: 'Không tìm thấy audio' });
        }

        // Redirect sang link tải thực tế
        // Hoặc bạn có thể fetch link đó và stream về
        return res.redirect(302, audioInfo.download_url);
        
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: error.message });
    }
};
