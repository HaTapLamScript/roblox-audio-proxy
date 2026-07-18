const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        
        if (!cookieString) {
            return res.status(401).send("Loi API Vercel: Thieu YOUTUBE_COOKIE. YouTube chan IP bot neu khong co Cookie xac thuc.");
        }

        // 1. TẠO AGENT SỬ DỤNG COOKIE CHUẨN JSON
        let parsedCookie;
        try {
            parsedCookie = JSON.parse(cookieString);
        } catch (e) {
            return res.status(400).send("Loi API: YOUTUBE_COOKIE tren Vercel khong phai dang JSON hop le.");
        }

        // 2. ÉP CLIENT TV/IOS ĐỂ BYPASS BOT DETECTION
        const agent = ytdl.createAgent(parsedCookie);
        const agentOptions = {
            agent,
            playerClients: ['TV', 'IOS']
        };

        // 3. LẤY THÔNG TIN TRÍCH XUẤT TỪ YOUTUBE
        const info = await ytdl.getInfo(url, agentOptions);

        if (!info || !info.formats || info.formats.length === 0) {
            return res.status(404).send("Loi API Vercel: Khong tim thay format hop le (YouTube blocked format grid).");
        }

        // 4. THUẬT TOÁN LỌC LUỒNG AUDIO TỐI ƯU CHO ROBLOX
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo); // Ưu tiên m4a/webm audio-only
        if (!format) {
            format = info.formats.find(f => f.hasAudio); // Fallback: Lấy luồng bất kỳ có tiếng
        }
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowestaudio' }); // Fallback ép chất lượng thấp nhất
        }

        if (!format || !format.url) {
            return res.status(404).send("Loi API Vercel: Khong the giai ma link phat (.url bi an).");
        }

        // 5. THIẾT LẬP HEADER CHUẨN TRẢ VỀ FILE MP3 (audio/mpeg)
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Tránh lỗi CORS nếu gọi từ client ngoài

        // 6. TRUYỀN LUỒNG DỮ LIỆU QUA BỘ ĐỆM VERCEL VỀ LUA SCRIPT
        ytdl.downloadFromInfo(info, {
            format: format,
            highWaterMark: 1 << 24, // Mở rộng bộ nhớ đệm lên 16MB giúp ổn định stream
            ...agentOptions
        })
        .on('error', (err) => {
            console.error("Streaming Error:", err.message);
            if (!res.headersSent) {
                res.status(500).send("Loi Stream: " + err.message);
            }
        })
        .pipe(res);

    } catch (error) {
        console.error("System Core Error:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Loi API Vercel: " + error.message);
        }
    }
};
