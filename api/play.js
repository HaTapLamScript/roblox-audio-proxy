const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        let agentOptions = {};

        if (cookieString) {
            agentOptions = {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Cookie': cookieString
                    }
                }
            };
        }

        // 1. Lấy thông tin video trước để bóc tách luồng audio chuẩn nhất
        const info = await ytdl.getInfo(url, agentOptions);
        
        // 2. Lọc ra luồng chỉ có âm thanh (audioonly) với dung lượng/định dạng tối ưu nhất
        const format = ytdl.chooseFormat(info.formats, { 
            filter: 'audioonly', 
            quality: 'highestaudio' 
        });

        if (!format) {
            return res.status(400).send("Loi API Vercel: Khong tim thay luong Audio phu hop.");
        }

        // 3. Thiết lập Header động dựa trên kiểu file gốc của YouTube (thường là audio/webm hoặc audio/mp4)
        res.setHeader('Content-Type', format.mimeType || 'audio/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Cho phép Roblox truy cập xuyên nền tảng

        // 4. Tiến hành stream luồng âm thanh về thiết bị
        ytdl(url, {
            format: format,
            highWaterMark: 1 << 25, // Tăng buffer lên 32MB chống nghẽn mạng di động
            ...agentOptions
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
