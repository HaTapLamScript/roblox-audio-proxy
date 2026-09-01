module.exports = (req, res) => {
    const id = (req.query.url || '').match(/(?:v=|\/)([\w-]{11})/)?.[1];
    if (!id) return res.status(400).json({ success: false, error: 'Invalid URL' });

    // Thay đổi instance tại đây nếu một trong các node bị ngắt kết nối
    const instance = req.query.node === '2' ? 'invidious.nerdvpn.de' : 'inv.tux.pizza';
    return res.redirect(302, `https://${instance}/latest_version?id=${id}&itag=140&local=true`);
};
