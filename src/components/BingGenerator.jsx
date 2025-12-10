import React, { useState, useEffect } from 'react';
// import { saveAs } from 'file-saver'; // 复用已有的库 - Removed as per diff
// import JSZip from 'jszip'; - Removed as per diff

const BingGenerator = () => {
    // 状态管理
    const [cookie, setCookie] = useState(() => localStorage.getItem('bing_cookie') || '');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [logs, setLogs] = useState([]); // 日志/状态信息
    const [images, setImages] = useState([]); // 生成结果 URL 列表
    const [error, setError] = useState(null);
    const [showTutorial, setShowTutorial] = useState(false); // Added as per diff

    // 持久化 Cookie
    useEffect(() => {
        localStorage.setItem('bing_cookie', cookie);
    }, [cookie]);

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // 智能处理 Cookie 输入：支持完整 Cookie 字符串或单独的 _U 值 - Added as per diff
    const handleCookieChange = (e) => {
        let input = e.target.value.trim();

        // 如果输入包含 "_U=" 说明是完整的 Cookie 字符串，尝试提取
        if (input.includes('_U=')) {
            const match = input.match(/_U=([^;]+)/);
            if (match) {
                input = match[1];
            }
        }
        setCookie(input);
    };

    // 核心生成逻辑
    const handleGenerate = async () => {
        if (!cookie) {
            setError('请先提供 _U Cookie');
            return;
        }
        if (!prompt) return;

        setIsGenerating(true);
        setError(null);
        setImages([]);
        setLogs([]);
        addLog('正在提交任务...');

        try {
            // 1. 构造请求 URL
            // 注意：Vite 代理前缀是 /bing-proxy
            const baseUrl = '/bing-proxy'; // Simplified as per diff
            const query = new URLSearchParams({
                q: prompt,
                rt: '4',
                FORM: 'GENCRE'
            });

            // 2. 发起创建请求 (POST)
            const createRes = await fetch(`${baseUrl}/images/create?${query.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Bing-Cookie': `_U=${cookie}` // 通过自定义头传递 Cookie
                },
                body: new URLSearchParams({ q: prompt }) // Body 也可以带上 q
            });

            // 3. 处理重定向获取 ID
            // Cloudflare Function 会拦截 302 并返回 JSON { redirect: "..." }
            // 本地 Vite Proxy 也会透传 302，浏览器会自动跟随。
            // 这是一个难点：如果是浏览器自动跟随，我们可能拿不到中间的 ID，直接跳到了结果页（可能是空页）。
            // 我们的 Cloudflare Function 做了 JSON 包装，所以这里预期是 JSON。

            let requestId = '';

            // 检查内容类型
            const contentType = createRes.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await createRes.json();
                if (data.redirect) {
                    // 从 redirect URL 中提取 ID
                    // 格式：/images/create/async/results/1-xxxx?q=...
                    const match = data.redirect.match(/id=([^&]+)/) || data.redirect.match(/results\/([^?]+)/);
                    if (match) {
                        requestId = match[1];
                        addLog(`任务创建成功，ID: ${requestId}`);
                    } else {
                        throw new Error('无法从重定向 URL 提取 ID');
                    }
                } else if (data.error) {
                    throw new Error(data.error);
                }
            } else {
                // 如果是 HTML（可能是出错了，或者直接返回了页面），尝试解析
                const text = await createRes.text();
                // 这种情况下通常是 Cookie 失效或 IP 被封
                addLog('收到非 JSON 响应，可能 Cookie 无效或需要验证');
                // 简单的错误检测
                if (text.includes('拒绝访问') || text.includes('Sign in') || text.includes('login')) { // Added 'login' as per diff
                    throw new Error('Cookie 无效或已过期，请重新获取');
                }
                throw new Error('未收到预期的重定向响应');
            }

            // 4. 开始轮询
            if (requestId) {
                await pollResults(requestId, baseUrl);
            }

        } catch (err) {
            console.error(err);
            setError(err.message);
            addLog(`错误: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // 轮询函数
    const pollResults = async (id, baseUrl) => {
        const maxAttempts = 30; // 30次 * 2秒 = 60秒超时
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            addLog(`轮询中... (${attempts}/${maxAttempts})`);

            // 构造轮询 URL
            // https://www.bing.com/images/create/async/results/{id}?{query}
            const pollUrl = `${baseUrl}/images/create/async/results/${id}?q=${encodeURIComponent(prompt)}`;

            const res = await fetch(pollUrl, {
                headers: {
                    'X-Bing-Cookie': `_U=${cookie}`
                }
            });

            const html = await res.text();

            // 检查 HTML 中是否有图片
            // Bing 返回的 HTML 中图片通常在 <img class="mimg" src="..." />
            // 或者 JSON 数据在脚本里。通常只需正则匹配 src

            // 简单的正则匹配所有结果图片
            // 这里的图片通常是 jpeg 格式
            // const imgRegex = /src="([^"]+)"/g; // Original regex
            const foundImages = [];
            let match;

            // 下面这个类名通常是缩略图，但也包含了高质量链接的特征
            // 实际上 Bing 返回的是一段 HTML 片段，里面包含 <a href="..."> <img src="..."> </a>
            // 我们提取 <img class="mimg" src="..." /> 
            // 或者直接查找 src="https://...bing.com/th/id/OIG..."

            const specificRegex = /src="(https:\/\/[^"]*bing\.com\/th\/id\/OIG[^"]*)"/g;

            while ((match = specificRegex.exec(html)) !== null) {
                // 解码 HTML spec chars (&amp;)
                const cleanUrl = match[1].replace(/&amp;/g, '&');
                if (!foundImages.includes(cleanUrl)) {
                    foundImages.push(cleanUrl);
                }
            }

            if (foundImages.length > 0) {
                addLog(`获取到 ${foundImages.length} 张图片！`);
                setImages(foundImages);
                return; // 成功结束
            }

            // 如果还没好，可能是一个空的或者 "Your image is being created" 的提示
            if (html.includes('errorMessage')) {
                // 遇到错误
                throw new Error('Bing 返回了错误信息（可能是敏感词拦截）');
            }

            // 等待 2 秒
            await new Promise(r => setTimeout(r, 2000));
        }

        throw new Error('生成超时');
    };

    return (
        <div className="crop-workspace" style={{ display: 'flex', flexDirection: 'column', padding: '20px', maxWidth: '1000px', margin: '0 auto', height: 'auto' }}>
            <div className="control-panel notebook-lines" style={{ marginBottom: '20px', width: '100%' }}>
                <h2 className="section-title">🧪 Bing Image Creator (Beta)</h2>

                <div className="control-section">
                    {/* Cookie 输入区 - Updated as per diff */}
                    <div className="control-row">
                        <label className="input-label">Cookie (_U):</label>
                        <input
                            type="password"
                            className="text-input"
                            placeholder="粘贴 _U 值或完整 Cookie 字符串"
                            value={cookie}
                            onChange={handleCookieChange} // Changed to new handler
                        />
                        <button
                            className="btn-secondary"
                            style={{ marginTop: '8px', fontSize: '12px' }}
                            onClick={() => setShowTutorial(!showTutorial)}
                        >
                            {showTutorial ? '📖 收起教程' : '❓ 如何获取 Cookie？'}
                        </button>
                    </div>

                    {/* 可折叠的详细教程 - Added as per diff */}
                    {showTutorial && (
                        <div className="tutorial-box" style={{
                            background: 'var(--paper-2)',
                            padding: '16px',
                            borderRadius: '12px',
                            marginTop: '12px',
                            marginBottom: '16px',
                            fontSize: '14px',
                            lineHeight: '1.8'
                        }}>
                            <h4 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent-strong)' }}>📝 获取 Bing Cookie 步骤</h4>

                            <div style={{ marginBottom: '16px' }}>
                                <strong>步骤 1：登录 Bing</strong>
                                <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                                    打开 <a href="https://www.bing.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-strong)' }}>www.bing.com</a>，
                                    点击右上角登录你的 <strong>Microsoft 账号</strong>。
                                </p>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <strong>步骤 2：打开开发者工具</strong>
                                <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                                    按下 <code style={{ background: '#e0d9c8', padding: '2px 6px', borderRadius: '4px' }}>F12</code> 或
                                    <code style={{ background: '#e0d9c8', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + Shift + I</code> (Mac: <code style={{ background: '#e0d9c8', padding: '2px 6px', borderRadius: '4px' }}>Cmd + Option + I</code>)
                                </p>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <strong>步骤 3：找到 Cookie</strong>
                                <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                                    方法 A (推荐)：点击顶部的 <strong>「Application」</strong> 标签 → 左侧 <strong>「Cookies」</strong> → <strong>「www.bing.com」</strong> → 找到 <code style={{ background: '#e0d9c8', padding: '2px 6px', borderRadius: '4px' }}>_U</code>，复制它的 <strong>Value</strong>。
                                </p>
                                <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                                    方法 B：点击 <strong>「Network」</strong> 标签 → 刷新页面 → 点击任意请求 → 找到 <strong>「Request Headers」</strong> 中的 <code style={{ background: '#e0d9c8', padding: '2px 6px', borderRadius: '4px' }}>Cookie</code>，复制整行（本工具会自动提取 _U）。
                                </p>
                            </div>

                            <div style={{ marginBottom: '8px' }}>
                                <strong>步骤 4：粘贴到上方输入框</strong>
                                <p style={{ margin: '4px 0', color: 'var(--muted)' }}>
                                    将复制的内容粘贴到上方输入框。Cookie 会自动保存，下次访问无需重复操作。
                                </p>
                            </div>

                            <div style={{
                                background: 'rgba(211, 178, 96, 0.2)',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                marginTop: '12px',
                                borderLeft: '3px solid var(--accent)'
                            }}>
                                <strong>⚠️ 注意事项</strong>
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'var(--muted)' }}>
                                    <li>Cookie 有效期约 1-2 周，过期后需重新获取</li>
                                    <li>请勿分享你的 Cookie，它等同于登录凭证</li>
                                    <li>如遇到"验证码"提示，请在 Bing 官网完成验证后重试</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Prompt 输入区 - Updated as per diff */}
                    <div className="control-row">
                        <label className="input-label">Prompt:</label>
                        <textarea
                            className="text-input"
                            rows={3}
                            placeholder="描述你想生成的画面... (英文效果更佳)" // Updated placeholder
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div className="actions">
                        <button
                            className="btn-primary"
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt || !cookie}
                        >
                            {isGenerating ? '创造中...' : '🎨 开始生成'}
                        </button>
                    </div>

                    {error && (
                        <div className="error-message" style={{ color: 'var(--error)', marginTop: '10px' }}>
                            ❌ {error} {/* Added ❌ as per diff */}
                        </div>
                    )}
                </div>
            </div>

            {/* 状态日志区 - Updated as per diff */}
            {logs.length > 0 && ( // Changed condition from isGenerating to logs.length > 0
                <div className="status-log" style={{
                    background: 'var(--paper-2)',
                    padding: '12px', // Updated padding
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--muted)',
                    maxHeight: '150px', // Added maxHeight
                    overflowY: 'auto' // Added overflowY
                }}>
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            )}

            {/* 结果展示区 - Updated as per diff */}
            {images.length > 0 && (
                <div className="results-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', // Updated minmax
                    gap: '20px'
                }}>
                    {images.map((url, idx) => (
                        <div key={idx} className="result-card" style={{
                            background: 'white',
                            padding: '12px', // Updated padding
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)' // Updated boxShadow
                        }}>
                            <img
                                src={url}
                                alt={`Result ${idx + 1}`} // Updated alt text
                                style={{
                                    width: '100%',
                                    borderRadius: '8px',
                                    aspectRatio: '1/1',
                                    objectFit: 'cover'
                                }}
                            />
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer" // Added rel
                                className="btn-secondary"
                                style={{
                                    display: 'block',
                                    marginTop: '10px',
                                    textAlign: 'center',
                                    textDecoration: 'none'
                                }}
                            >
                                🔍 查看原图 {/* Updated text */}
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BingGenerator;
