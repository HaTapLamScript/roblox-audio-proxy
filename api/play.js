const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Thieu tham so ?url=");
    }

    try {
        const cookieString = process.env.YOUTUBE_COOKIE;
        
        // CẤU HÌNH ĐẶC TRỊ: Buộc thư viện sử dụng Client ổn định nhất hiện tại
        let agentOptions = {
            playerClients: ['TV', 'WEB'] 
        };
        
        // Khởi tạo Agent xử lý Cookie an toàn
        if (cookieString) {
            try {
                const parsedCookie = JSON.parse(cookieString);
                agentOptions.agent = ytdl.createAgent(parsedCookie);
                console.log("Cookie JSON applied.");
            } catch (e) {
                // Nếu cookie dạng chuỗi thô
                agentOptions.agent = ytdl.createAgent();
                agentOptions.requestOptions = {
                    headers: { 'Cookie': cookieString }
                };
            }
        }

        // 1. Lấy siêu dữ liệu (metadata) của video
        const info = await ytdl.getInfo(url, agentOptions);

        if (!info || !info.formats || info.formats.length === 0) {
            throw new Error("Không lấy được danh sách formats từ YouTube.");
        }

        // 2. Thuật toán nhặt luồng thông minh, không phụ thuộc vào bộ lọc filter chuẩn
        // Ưu tiên 1: Lấy luồng chỉ chứa âm thanh (M4A / WebM Audio)
        let format = info.formats.find(f => f.hasAudio && !f.hasVideo);
        
        // Ưu tiên 2: Nếu không thấy, lấy bất cứ luồng nào phát được ra tiếng (bao gồm cả luồng video+audio thấp)
        if (!format) {
            format = info.formats.find(f => f.hasAudio);
        }

        // Ưu tiên 3: Dự phòng khẩn cấp bằng hàm nén định dạng thấp nhất
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
        }

        // Nếu duyệt hết sạch danh sách mà YouTube chặn đường link truyền dữ liệu trực tiếp
        if (!format || !format.url) {
            return res.status(404).send("Loi API Vercel: YouTube tu choi cung cap format phat lai cho IP nay.");
        }

        // 3. Thiết lập Header chuẩn để streaming trực tiếp về Roblox
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        // 4. Khởi chạy luồng đọc dữ liệu từ YouTube và trả về trình duyệt
        ytdl(url, {
            format: format,
            highWaterMark: 1 << 23, // 8MB buffer tối ưu tốc độ đọc của Vercel
            ...agentOptions
        })
        .on('error', (err) => {
            console.error("Stream error:", err.message);
            if (!res.headersSent) {
                res.status(500).send("Loi Stream: " + err.message);
            }
        })
        .pipe(res);

    } catch (error) {
        console.error("Lỗi hệ thống:", error.message);
        if (!res.headersSent) {
            res.status(500).send("Loi API Vercel: " + error.message);
        }
    }
};
