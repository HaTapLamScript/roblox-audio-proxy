module.exports = async (req, res) => {
    // Cho phép Roblox HttpService / Executor gửi request
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const id = (req.query.url || '').match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!id) return res.status(400).json({ success: false, error: 'Invalid URL' });

    // Link direct audio itag 140 (M4A/MP3 128kbps)
    const streamUrl = `https://inv.tux.pizza/latest_version?id=${id}&itag=140&local=true`;

    // Nếu gọi từ Roblox Script (cần JSON)
    if (req.query.type === 'json' || req.headers['user-agent']?.includes('Roblox')) {
        return res.status(200).json({
            success: true,
            videoId: id,
            audioUrl: streamUrl
        });
    }

    // Mặc định ép tải file về máy khi mở bằng trình duyệt
    return res.redirect(302, `${streamUrl}&download=true`);
};
