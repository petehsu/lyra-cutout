import https from 'https';

export const config = {
    api: {
        bodyParser: false, // 必须禁用 bodyParser 以支持流式上传
    },
};

export default function handler(req, res) {
    const targetUrl = new URL('https://sensei.adobe.io/services/v2/predict');

    const headers = {
        ...req.headers, // 保留原始 Content-Type (multipart/form-data; boundary=...)
        'Host': 'sensei.adobe.io',
        'Origin': 'https://quick-actions.express.adobe.com', // 关键伪装
        'Referer': 'https://quick-actions.express.adobe.com/', // 关键伪装
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Connection': 'keep-alive',
    };

    // 删除 Vercel/Node 可能自动添加的干扰头
    delete headers.host;
    delete headers.connection;
    delete headers['x-forwarded-for'];
    delete headers['x-real-ip'];

    const proxyReq = https.request(targetUrl, {
        method: req.method,
        headers: headers,
    }, (proxyRes) => {
        // 透传响应状态码和头
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        // 流式透传响应体
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: err.message });
    });

    // 流式透传请求体 (从浏览器 -> Vercel -> Adobe)
    // 这样可以最大程度避免缓冲，减少内存占用
    req.pipe(proxyReq);
}
