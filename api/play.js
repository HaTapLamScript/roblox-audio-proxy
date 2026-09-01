const express = require('express');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// API Endpoint: /play?url=<youtube_url>
app.get('/play', async (req, res) => {
    try {
        const videoURL = req.query.url;

        // Kiểm tra xem người dùng đã truyền URL hay chưa
        if (!videoURL || !ytdl.validateURL(videoURL)) {
            return res.status(400).json({ 
                error: 'Vui lòng cung cấp một URL YouTube hợp lệ thông qua tham số ?url=' 
            });
        }

        // Lấy thông tin video để đặt tên file tải về (tùy chọn)
        const info = await ytdl.getInfo(videoURL);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, ''); // Xóa ký tự đặc biệt

        // Thiết lập header để trình duyệt/client hiểu đây là file audio cần tải/stream
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // Lấy stream audio chất lượng cao nhất có cả âm thanh
        const audioStream = ytdl(videoURL, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        // Xử lý lỗi trong quá trình stream
        audioStream.on('error', (err) => {
            console.error('Lỗi Stream:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Không thể xử lý luồng âm thanh.' });
            }
        });

        // Pipe trực tiếp stream vào Response của Express
        audioStream.pipe(res);

    } catch (error) {
        console.error('Lỗi API:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý yêu cầu.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
 
