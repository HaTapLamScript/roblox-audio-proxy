const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        // Tự động bóc tách ID video để chạy stream trực tiếp, giảm thiểu việc bị quét bot
        const videoId = ytdl.getVideoID(url);
        if (!videoId) {
            return res.status(400).send("Loi: Link video YouTube không hợp lệ.");
        }

        const cookieString = process.env.YOUTUBE_COOKIE;
        let requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Mode': 'navigate'
            }
        };

        if (cookieString) {
            requestOptions.headers['Cookie'] = cookieString;
        }

        // Thiết lập header phản hồi âm thanh dạng luồng chuẩn cho Delta X nhận diện
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*'); 

        // Thực hiện stream trực tiếp thông qua ID video
        ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25, // Tăng bộ nhớ đệm chống ngắt kết nối giữa chừng
            requestOptions: requestOptions
        })
        .on('error', (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
                res.status(500).send("Loi Stream Vercel: " + err.message);
            }
        })
        .pipe(res);

    } catch (error) {
        console.error("Catch Error:", error);
        if (!res.headersSent) {
            res.status(500).send("Loi he thong: " + error.message);
        }
    }
};
