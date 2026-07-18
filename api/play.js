const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thiếu tham số ?url=");
    }

    try {
        // Kiểm tra xem cookie cấu hình có tồn tại không
        const cookieString = process.env.YOUTUBE_COOKIE;
        let agentOptions = {};

        if (cookieString) {
            // Khởi tạo cookie agent từ chuỗi JSON đã lưu trong Env
            agentOptions = {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Cookie': cookieString
                    }
                }
            };
        }

        // Thiết lập Header phản hồi dạng luồng âm thanh cho Roblox nhận diện
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Ép lấy luồng audioonly với chất lượng mượt nhất cho script Executor
        ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // Tăng bộ nhớ đệm chống nghẽn stream
            ...agentOptions
        })
        .on('error', (err) => {
            console.error(err);
            if (!res.headersSent) {
                res.status(500).send("Loi API Vercel: " + err.message);
            }
        })
        .pipe(res); // Đẩy luồng trực tiếp về phía Roblox

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send("Loi he thong: " + error.message);
        }
    }
};
