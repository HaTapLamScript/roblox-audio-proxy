const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    // Thiết lập CORS Header cho phép mọi Request từ Client / Roblox Executor
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'Thiếu tham số ?url=' 
        });
    }

    const cleanUrl = url.trim();

    // Kiểm tra liên kết YouTube hợp lệ
    if (!ytdl.validateURL(cleanUrl)) {
        return res.status(400).json({
            success: false,
            error: 'Đường dẫn YouTube không hợp lệ'
        });
    }

    try {
        // Cấu hình Header phản hồi định dạng dữ liệu âm thanh MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');

        // Tạo Stream lấy dữ liệu âm thanh trực tiếp từ YouTube
        const audioStream = ytdl(cleanUrl, {
            quality: 'highestaudio',
            filter: 'audioonly',
            highWaterMark: 1 << 25
        });

        audioStream.on('error', (err) => {
            console.error('Lỗi Stream Audio:', err);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: 'Không thể xử lý dòng dữ liệu âm thanh'
                });
            }
        });

        // Đổ dữ liệu MP3 trực tiếp về Client (StatusCode 200)
        audioStream.pipe(res);

    } catch (error) {
        console.error('Lỗi Play API:', error);
        if (!res.headersSent) {
            return res.status(500).json({ 
                success: false, 
                error: error.message || 'Lỗi server khi trích xuất audio' 
            });
        }
    }
};
