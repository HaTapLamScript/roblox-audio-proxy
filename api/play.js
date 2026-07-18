const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        
        // CẤU HÌNH ĐẶC TRỊ: Sử dụng luồng WEB_EMBEDDED hoặc ANDROID_VR để lấy format ẩn
        let agentOptions = {
            playerClients: ['WEB_EMBEDDED', 'ANDROID']
        };
        
        if (cookieString) {
            try {
                const parsedCookie = JSON.parse(cookieString);
                agentOptions.agent = ytdl.createAgent(parsedCookie);
            } catch (e) {
                agentOptions.requestOptions = {
                    headers: { 
                        'Cookie': cookieString,
                        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0'
                    }
                };
            }
        }

        // 1. Lấy thông tin video bao gồm tất cả format ẩn
        const info = await ytdl.getInfo(url, agentOptions);

        // 2. Thuật toán chọn format tối ưu và an toàn nhất
        // Tìm luồng chỉ có tiếng trước, nếu không có thì lấy bất cứ luồng nào có chứa tiếng
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        if (!format) {
            format = info.formats.find(f => f.hasAudio);
        }

        if (!format) {
            // Dự phòng cuối cùng: Ép chọn định dạng âm thanh bất kỳ
            format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'lowestaudio' });
        }

        if (!format || !format.url) {
            return res.status(404).send("Loi API Vercel: YouTube chan luong kem tu IP nay. Vui long kiem tra lai YOUTUBE_COOKIE.");
        }

        // 3. Cấu hình Header cho file MP3 ảo
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 4. Stream trực tiếp dữ liệu âm thanh về thiết bị
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
