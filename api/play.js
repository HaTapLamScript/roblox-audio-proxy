const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        let agentOptions = {};
        
        // Cấu hình Cookie xác thực cao cấp chống bot của YouTube
        if (cookieString) {
            try {
                const parsedCookie = JSON.parse(cookieString);
                agentOptions = { agent: ytdl.createAgent(parsedCookie) };
            } catch (e) {
                agentOptions = {
                    requestOptions: {
                        headers: { 
                            'Cookie': cookieString,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                        }
                    }
                };
            }
        }

        // 1. Phân tích video để bóc tách luồng dữ liệu âm thanh
        const info = await ytdl.getInfo(url, agentOptions);

        // 2. Ép bộ lọc lấy luồng âm thanh có dung lượng thấp để tối ưu hóa tốc độ tải file của Delta X
        const format = ytdl.chooseFormat(info.formats, { 
            filter: 'audioonly', 
            quality: 'lowestaudio' 
        });

        if (!format) {
            return res.status(404).send("Khong tim thay luong am thanh.");
        }

        // 3. THIẾT LẬP HEADER CHUẨN MP3 - Đánh lừa hàm request() của Roblox nhận diện làm file .mp3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 4. Stream trực tiếp luồng dữ liệu thô về Roblox qua cơ chế Pipe
        const stream = ytdl(url, {
            format: format,
            highWaterMark: 1 << 25, // Tạo bộ đệm 32MB chống đứt kết nối giữa chừng khi ghi file
            ...agentOptions
        });

        stream.on('error', (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
                res.status(500).send("Loi Stream: " + err.message);
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error("System Error:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Loi API Vercel: " + error.message);
        }
    }
};
