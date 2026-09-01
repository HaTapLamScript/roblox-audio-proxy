const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    // Cho phép CORS nếu bạn cần gọi từ frontend khác
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const videoURL = req.query.url;

    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).json({ 
            error: 'Vui lòng cung cấp một URL YouTube hợp lệ thông qua tham số ?url=' 
        });
    }

    try {
        // Lấy thông tin video để đặt tên file
        const info = await ytdl.getInfo(videoURL);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '').trim() || 'audio';

        // Thiết lập header trả về file mp3
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Tạo stream audio và pipe thẳng về client
        const audioStream = ytdl(videoURL, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        audioStream.on('error', (err) => {
            console.error('Lỗi Stream:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Không thể xử lý luồng âm thanh.' });
            }
        });

        audioStream.pipe(res);

    } catch (error) {
        console.error('Lỗi API:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Đã xảy ra lỗi hoặc video quá dài/bị chặn.' });
        }
    }
};
