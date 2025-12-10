export async function onRequest(context) {
    const { request, params } = context;
    const url = new URL(request.url);

    // 拼接目标 URL: https://www.bing.com/...
    // params.path 会捕获 bing-proxy 之后的所有路径片段
    const pathStr = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
    const search = url.search;
    const targetUrl = `https://www.bing.com/${pathStr}${search}`;

    // 复制并伪造请求头
    const headers = new Headers(request.headers);
    headers.set('Host', 'www.bing.com');
    headers.set('Origin', 'https://www.bing.com');
    headers.set('Referer', 'https://www.bing.com/images/create');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');

    // 从自定义 Header 获取 Cookie
    const userCookie = request.headers.get('X-Bing-Cookie');
    if (userCookie) {
        // 确保 Cookie 格式正确，至少包含 _U
        headers.set('Cookie', userCookie);
    }

    // 清理指纹
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.delete('x-forwarded-proto');
    headers.delete('x-real-ip');
    headers.delete('X-Bing-Cookie'); // 移除我们自定义的头

    const init = {
        method: request.method,
        headers: headers,
        redirect: 'manual', // 拦截重定向
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
    }

    try {
        const response = await fetch(targetUrl, init);

        // 处理 CORS 预检 (OPTIONS) - 虽然通常由框架处理，但为了保险
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                }
            });
        }

        // 拦截重定向：如果是 302，说明任务创建成功，通过 JSON 返回 Location
        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('Location');
            // 修正 Location: 如果是相对路径，补全为绝对路径？Bing 通常返回相对路径 /images/create/async/results/...
            let fullLocation = location;
            if (location && location.startsWith('/')) {
                fullLocation = `https://www.bing.com${location}`;
            }

            return new Response(JSON.stringify({ redirect: fullLocation }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 正常响应
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers),
        });

        // 覆盖 CORS
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.delete('set-cookie'); // 为了安全，不透传 Bing 的 Set-Cookie

        return newResponse;

    } catch (err) {
        return new Response(JSON.stringify({ error: `Proxy Error: ${err.message}` }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
