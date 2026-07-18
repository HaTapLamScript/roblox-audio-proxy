const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        let agentOptions = {
            // PRO CONFIG: Ép ép các luồng Client ít bị quét bot nhất (TV và IOS)
            playerClients: ['TV', 'IOS']
        };
        
        if (cookieString) {
            try {
                const parsedCookie = JSON.parse(cookieString);
                agentOptions.agent = ytdl.createAgent(parsedCookie);
            } catch (e) {
                agentOptions.requestOptions = {
                    headers: { 
                        'Cookie': cookieString,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                    }
                };
            }
        }

        // 1. Phân tích luồng dựa trên cấu hình client an toàn
        const info = await ytdl.getInfo(url, agentOptions);

        // 2. Chọn định dạng chỉ có âm thanh (audioonly)
        const format = ytdl.chooseFormat(info.formats, { 
            filter: 'audioonly', 
            quality: 'lowestaudio' 
        });

        if (!format) {
            return res.status(404).send("Khong tim thay luong am thanh.");
        }

        // 3. Header bắt buộc để trình duyệt và hàm request() của game hiểu đây là file MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 4. Tiến hành stream về thiết bị
        ytdl(url, {
            format: format,
            highWaterMark: 1 << 25, 
            ...agentOptions
        })
        .on('error', (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
                res.status(500).send("Loi Stream: " + err.message);
            }
        })
        .pipe(res);

    } catch (error) {
        console.error("System Error:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Loi API Vercel: " + error.message);
        }
    }
};
