const { ytmp3 } = require('iguro-ytdl');

module.exports = async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    try {
        const result = await ytmp3(url);
        
        // Kiểm tra kết quả trả về
        if (!result.status || !result.result?.url) {
            return res.status(404).json({ 
                error: 'Không tìm thấy audio',
                detail: result.error || 'Không có link tải'
            });
        }

        // Redirect sang link tải thực tế
        return res.redirect(302, result.result.url);
        
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: error.message });
    }
};
