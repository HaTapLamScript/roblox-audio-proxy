const https = require('https');

// Danh sách các Invidious Node công khai tốt nhất
const NODES = [
    'inv.tux.pizza',
    'invidious.nerdvpn.de',
    'invidious.drgns.space',
    'vid.puffyan.us'
];

function checkNode(node, id) {
    return new Promise((resolve, reject) => {
        const req = https.get(`https://${node}/latest_version?id=${id}&itag=140&local=true`, {
            method: 'HEAD',
            timeout: 2500
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve(`https://${node}/latest_version?id=${id}&itag=140&local=true`);
            } else {
                reject();
            }
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(); });
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const id = (req.query.url || '').match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!id) return res.status(400).json({ success: false, error: 'Invalid URL' });

    let audioUrl = null;

    // Thử lần lượt các node để chọn ra node đang sống
    for (const node of NODES) {
        try {
            audioUrl = await checkNode(node, id);
            if (audioUrl) break;
        } catch (e) {
            continue;
        }
    }

    // Nếu tất cả node HEAD request thất bại, dùng node mặc định
    if (!audioUrl) {
        audioUrl = `https://inv.tux.pizza/latest_version?id=${id}&itag=140&local=true`;
    }

    if (req.query.type === 'json' || req.headers['user-agent']?.includes('Roblox')) {
        return res.status(200).json({ success: true, audioUrl: audioUrl });
    }

    return res.redirect(302, `${audioUrl}&download=true`);
};
