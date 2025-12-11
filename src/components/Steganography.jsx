import React, { useState, useRef, useEffect } from 'react';

/**
 * 图片隐写术 + 多因素认证
 * 支持任意组合：密码 / 2FA / 人脸
 */
const Steganography = () => {
    const [mode, setMode] = useState('encode');
    const [image, setImage] = useState(null);
    const [message, setMessage] = useState('');
    const [decodedMessage, setDecodedMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);

    // 验证方式选择（可多选）
    const [usePassword, setUsePassword] = useState(false);
    const [use2FA, setUse2FA] = useState(false);
    const [useFace, setUseFace] = useState(false);

    // 输入值
    const [password, setPassword] = useState('');
    const [decryptPassword, setDecryptPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');

    // 状态标记
    const [authFlags, setAuthFlags] = useState(0); // 解码时检测到的验证类型
    const [showSetup, setShowSetup] = useState(false);
    const [totpSecret, setTotpSecret] = useState('');

    // 人脸相关
    const [showCamera, setShowCamera] = useState(false);
    const [faceTemplate, setFaceTemplate] = useState(null);
    const [faceVerified, setFaceVerified] = useState(false);
    const [faceStatus, setFaceStatus] = useState('');

    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const faceCanvasRef = useRef(null);
    const streamRef = useRef(null);

    // 验证类型标志位
    const AUTH_PASSWORD = 1;  // bit 0
    const AUTH_2FA = 2;       // bit 1
    const AUTH_FACE = 4;      // bit 2

    // 魔数：LYRA + 验证标志
    const MAGIC_BASE = [0x4C, 0x59, 0x52, 0x41]; // "LYRA"

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // ==================== 人脸检测 ====================

    // 使用灰度直方图作为特征（更稳定）
    const extractFaceFeatures = async (imageData) => {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // 将图像分成 4x4 = 16 个区域，每个区域计算 16 bin 直方图
        // 总共 16 * 16 = 256 个特征值
        const features = [];
        const regionW = Math.floor(width / 4);
        const regionH = Math.floor(height / 4);

        for (let ry = 0; ry < 4; ry++) {
            for (let rx = 0; rx < 4; rx++) {
                // 16 bin 直方图
                const hist = new Array(16).fill(0);
                let pixelCount = 0;

                for (let y = ry * regionH; y < (ry + 1) * regionH; y++) {
                    for (let x = rx * regionW; x < (rx + 1) * regionW; x++) {
                        const idx = (y * width + x) * 4;
                        // 灰度值
                        const gray = data[idx]; // 已经是灰度
                        const bin = Math.floor(gray / 16); // 0-15
                        hist[Math.min(bin, 15)]++;
                        pixelCount++;
                    }
                }

                // 归一化到 0-255
                for (let i = 0; i < 16; i++) {
                    features.push(Math.round((hist[i] / pixelCount) * 255));
                }
            }
        }

        return new Uint8Array(features);
    };

    // 使用余弦相似度比较（对幅度变化更鲁棒）
    const compareFaceFeatures = (template, current) => {
        if (template.length !== current.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < template.length; i++) {
            dotProduct += template[i] * current[i];
            normA += template[i] * template[i];
            normB += current[i] * current[i];
        }

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    const startCamera = async () => {
        try {
            setFaceStatus('正在启动摄像头...');

            // 先显示摄像头容器
            setShowCamera(true);

            // 获取视频流
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 320, height: 240 }
            });
            streamRef.current = stream;

            // 等待下一个渲染周期，确保 video 元素已挂载
            await new Promise(resolve => setTimeout(resolve, 100));

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(console.error);
                };
            }

            setFaceStatus('请对准摄像头，点击拍照');
        } catch (err) {
            setFaceStatus('无法访问摄像头: ' + err.message);
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCamera(false);
    };

    const captureAndExtract = async () => {
        if (!videoRef.current || !faceCanvasRef.current) return null;
        const canvas = faceCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 120;
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const imageData = ctx.getImageData(0, 0, 160, 120);
        // 转灰度
        for (let i = 0; i < imageData.data.length; i += 4) {
            const gray = (imageData.data[i] * 0.299 + imageData.data[i + 1] * 0.587 + imageData.data[i + 2] * 0.114) | 0;
            imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = gray;
        }
        return extractFaceFeatures(imageData);
    };

    const enrollFace = async () => {
        setFaceStatus('提取特征中...');
        const features = await captureAndExtract();
        if (features) {
            setFaceTemplate(features);
            setFaceVerified(true);
            stopCamera();
            setFaceStatus('✅ 人脸已录入');
        }
    };

    const verifyFace = async () => {
        if (!faceTemplate) return false;
        setFaceStatus('验证中...');
        const current = await captureAndExtract();
        if (!current) return false;
        const similarity = compareFaceFeatures(faceTemplate, current);
        // 余弦相似度阈值 0.85 (85%)
        if (similarity > 0.85) {
            setFaceVerified(true);
            stopCamera();
            setFaceStatus(`✅ 验证通过 (${(similarity * 100).toFixed(0)}%)`);
            return true;
        }
        setFaceStatus(`❌ 验证失败 (${(similarity * 100).toFixed(0)}%)，请保持相同姿势和光线`);
        return false;
    };

    // ==================== TOTP ====================

    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const base32Encode = (buf) => { let bits = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); let r = ''; for (let i = 0; i < bits.length; i += 5) r += base32Chars[parseInt(bits.substr(i, 5).padEnd(5, '0'), 2)]; return r; };
    const base32Decode = (s) => { let bits = ''; for (const c of s.toUpperCase()) { const i = base32Chars.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); } const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2)); return new Uint8Array(bytes); };
    const generateTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

    const hmacSha1 = async (key, msg) => {
        const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
    };

    const verifyTotp = async (secret, code) => {
        const key = base32Decode(secret);
        for (let i = -1; i <= 1; i++) {
            const time = Math.floor(Date.now() / 1000 / 30) + i;
            const tb = new Uint8Array(8);
            let t = time;
            for (let j = 7; j >= 0; j--) { tb[j] = t & 0xff; t = Math.floor(t / 256); }
            const h = await hmacSha1(key, tb);
            const off = h[h.length - 1] & 0x0f;
            const exp = (((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff)) % 1000000;
            if (code === exp.toString().padStart(6, '0')) return true;
        }
        return false;
    };

    // ==================== 加密 ====================

    const deriveKey = async (pwd, salt) => {
        const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    };

    const encryptData = async (data, pwd) => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(pwd, salt);
        const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
        const r = new Uint8Array(28 + enc.byteLength);
        r.set(salt, 0);
        r.set(iv, 16);
        r.set(new Uint8Array(enc), 28);
        return r;
    };

    const decryptData = async (data, pwd) => {
        const key = await deriveKey(pwd, data.slice(0, 16));
        return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(16, 28) }, key, data.slice(28)));
    };

    // ==================== 工具 ====================

    const stringToBytes = s => new TextEncoder().encode(s);
    const bytesToString = b => new TextDecoder().decode(new Uint8Array(b));
    const byteToBinary = b => b.toString(2).padStart(8, '0');

    const handleUpload = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setImage({ url: URL.createObjectURL(f), name: f.name });
        resetState();
    };

    const resetState = () => {
        setResult(null);
        setDecodedMessage('');
        setAuthFlags(0);
        setShowSetup(false);
        setFaceVerified(false);
        setFaceTemplate(null);
        setFaceStatus('');
        setDecryptPassword('');
        setTotpCode('');
        stopCamera();
    };

    // 计算当前选择的验证标志
    const getCurrentFlags = () => {
        let flags = 0;
        if (usePassword) flags |= AUTH_PASSWORD;
        if (use2FA) flags |= AUTH_2FA;
        if (useFace) flags |= AUTH_FACE;
        return flags;
    };

    // ==================== 编码 ====================
    const encodeMessage = async () => {
        if (!image || !message) return;

        const flags = getCurrentFlags();
        if (flags === 0) return alert('请至少选择一种保护方式');
        if ((flags & AUTH_PASSWORD) && !password) return alert('请输入密码');
        if ((flags & AUTH_FACE) && !faceVerified) return alert('请先录入人脸');

        setIsProcessing(true);

        try {
            const img = new Image();
            img.onload = async () => {
                const canvas = canvasRef.current;
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixelData = imageData.data;

                // 构建数据包
                const parts = [];

                // 2FA: 存储 TOTP 密钥
                if (flags & AUTH_2FA) {
                    const secret = generateTotpSecret();
                    setTotpSecret(secret);
                    setShowSetup(true);
                    const secretBytes = stringToBytes(secret);
                    parts.push(secretBytes.length);
                    parts.push(...secretBytes);
                }

                // 人脸: 存储特征模板
                if (flags & AUTH_FACE) {
                    parts.push(faceTemplate.length);
                    parts.push(...faceTemplate);
                }

                // 消息内容
                const msgBytes = stringToBytes(message);
                parts.push(...msgBytes);

                let payload = new Uint8Array(parts);

                // 如果有密码，加密整个 payload
                if (flags & AUTH_PASSWORD) {
                    payload = await encryptData(payload, password);
                }

                // 头部: 魔数(4) + 标志(1) + 长度(4) + payload
                const length = payload.length;
                const header = new Uint8Array([
                    ...MAGIC_BASE,
                    flags,
                    (length >> 24) & 0xFF,
                    (length >> 16) & 0xFF,
                    (length >> 8) & 0xFF,
                    length & 0xFF,
                    ...payload
                ]);

                // 转二进制
                let binary = '';
                for (const byte of header) binary += byteToBinary(byte);

                if (binary.length > pixelData.length / 4) {
                    alert('消息太长！');
                    setIsProcessing(false);
                    return;
                }

                for (let i = 0; i < binary.length; i++) {
                    pixelData[i * 4] = (pixelData[i * 4] & 0xFE) | parseInt(binary[i]);
                }

                ctx.putImageData(imageData, 0, 0);
                setResult(canvas.toDataURL('image/png'));
                setIsProcessing(false);
            };
            img.src = image.url;
        } catch (err) {
            alert('处理失败: ' + err.message);
            setIsProcessing(false);
        }
    };

    // ==================== 解码 ====================
    const decodeMessage = async () => {
        if (!image) return;
        setIsProcessing(true);

        try {
            const img = new Image();
            img.onload = async () => {
                const canvas = canvasRef.current;
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

                const extractBits = (n) => { let b = ''; for (let i = 0; i < n && i * 4 < pixelData.length; i++) b += (pixelData[i * 4] & 1).toString(); return b; };
                const bitsToBytes = (bits) => { const r = []; for (let i = 0; i < bits.length; i += 8) r.push(parseInt(bits.substr(i, 8), 2)); return r; };

                // 读取头部 (9字节 = 72位)
                const headerBytes = bitsToBytes(extractBits(72));

                // 验证魔数
                if (headerBytes[0] !== MAGIC_BASE[0] || headerBytes[1] !== MAGIC_BASE[1] ||
                    headerBytes[2] !== MAGIC_BASE[2] || headerBytes[3] !== MAGIC_BASE[3]) {
                    setDecodedMessage('❌ 未发现隐藏信息');
                    setIsProcessing(false);
                    return;
                }

                const flags = headerBytes[4];
                const length = (headerBytes[5] << 24) | (headerBytes[6] << 16) | (headerBytes[7] << 8) | headerBytes[8];

                if (length <= 0 || length > 10000000) {
                    setDecodedMessage('❌ 数据损坏');
                    setIsProcessing(false);
                    return;
                }

                setAuthFlags(flags);

                // 检查验证条件
                if ((flags & AUTH_PASSWORD) && !decryptPassword) {
                    setIsProcessing(false);
                    return;
                }
                if ((flags & AUTH_2FA) && !totpCode) {
                    setIsProcessing(false);
                    return;
                }
                if ((flags & AUTH_FACE) && !faceVerified) {
                    setIsProcessing(false);
                    return;
                }

                // 读取 payload
                const allBits = extractBits((9 + length) * 8);
                const allBytes = bitsToBytes(allBits);
                let payload = new Uint8Array(allBytes.slice(9, 9 + length));

                // 解密
                if (flags & AUTH_PASSWORD) {
                    try {
                        payload = await decryptData(payload, decryptPassword);
                    } catch {
                        setDecodedMessage('❌ 密码错误');
                        setIsProcessing(false);
                        return;
                    }
                }

                let offset = 0;

                // 验证 2FA
                if (flags & AUTH_2FA) {
                    const secretLen = payload[offset++];
                    const secret = bytesToString(payload.slice(offset, offset + secretLen));
                    offset += secretLen;
                    if (!(await verifyTotp(secret, totpCode))) {
                        setDecodedMessage('❌ 2FA 验证码错误');
                        setIsProcessing(false);
                        return;
                    }
                }

                // 验证人脸
                if (flags & AUTH_FACE) {
                    const templateLen = payload[offset++];
                    const storedTemplate = payload.slice(offset, offset + templateLen);
                    offset += templateLen;

                    const similarity = compareFaceFeatures(storedTemplate, faceTemplate);
                    if (similarity < 0.85) {
                        setDecodedMessage(`❌ 人脸验证失败 (${(similarity * 100).toFixed(0)}%)，需要 85% 以上`);
                        setIsProcessing(false);
                        return;
                    }
                }

                // 提取消息
                const msgBytes = payload.slice(offset);
                setDecodedMessage(bytesToString(msgBytes) || '（空消息）');
                setAuthFlags(0);
                setIsProcessing(false);
            };
            img.src = image.url;
        } catch (err) {
            setDecodedMessage('❌ 解码失败: ' + err.message);
            setIsProcessing(false);
        }
    };

    const downloadResult = () => {
        if (!result) return;
        const link = document.createElement('a');
        link.href = result;
        const suffix = [usePassword && 'pwd', use2FA && '2fa', useFace && 'face'].filter(Boolean).join('_');
        link.download = `hidden_${suffix || 'plain'}_${image.name}`;
        link.click();
    };

    const getTotpUri = () => `otpauth://totp/LyraImage:Secret?secret=${totpSecret}&issuer=LyraImage`;

    const needsInput = authFlags > 0;
    const needsPwd = authFlags & AUTH_PASSWORD;
    const needs2FA = authFlags & AUTH_2FA;
    const needsFace = authFlags & AUTH_FACE;

    const getSecurityBadge = () => {
        const parts = [];
        if (usePassword) parts.push('🔐');
        if (use2FA) parts.push('📱');
        if (useFace) parts.push('👤');
        return parts.join('') || '✓';
    };

    return (
        <>
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <span className="field-label">模式</span>
                        <div className="mode-selector">
                            <button className={`mode-btn ${mode === 'encode' ? 'active' : ''}`} onClick={() => { setMode('encode'); resetState(); }}>🔒 隐藏</button>
                            <button className={`mode-btn ${mode === 'decode' ? 'active' : ''}`} onClick={() => { setMode('decode'); resetState(); }}>🔓 提取</button>
                        </div>
                    </div>

                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            选择图片
                            <input type="file" accept="image/png" onChange={handleUpload} hidden />
                        </label>
                        {image && <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>✓ {image.name}</span>}
                    </div>

                    {mode === 'encode' && (
                        <>
                            <div className="field">
                                <span className="field-label">信息</span>
                                <textarea className="input-field" value={message} onChange={e => setMessage(e.target.value)} placeholder="输入要隐藏的内容..." rows={3} style={{ width: 300, resize: 'vertical' }} />
                            </div>

                            <div className="field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                                <span className="field-label">保护方式（可多选）</span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={usePassword} onChange={e => setUsePassword(e.target.checked)} />
                                    <span>🔐 密码加密</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={use2FA} onChange={e => setUse2FA(e.target.checked)} />
                                    <span>📱 2FA 验证码</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useFace} onChange={e => setUseFace(e.target.checked)} />
                                    <span>👤 人脸验证</span>
                                </label>
                            </div>

                            {usePassword && (
                                <div className="field">
                                    <span className="field-label">密码</span>
                                    <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码" style={{ width: 200 }} />
                                </div>
                            )}

                            {useFace && (
                                <div className="field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                    {!faceVerified ? (
                                        !showCamera ? <button className="btn-secondary" onClick={startCamera}>📷 录入人脸</button>
                                            : <button className="btn-primary" onClick={enrollFace}>📸 拍照录入</button>
                                    ) : <span style={{ color: 'var(--success)' }}>✅ 人脸已录入</span>}
                                    {faceStatus && <span style={{ fontSize: '0.85rem', marginTop: 4 }}>{faceStatus}</span>}
                                </div>
                            )}
                        </>
                    )}

                    {mode === 'decode' && needsInput && (
                        <>
                            <div style={{ padding: 8, background: 'var(--accent-soft)', borderRadius: 8, marginBottom: 8 }}>
                                需要验证: {needsPwd ? '🔐密码 ' : ''}{needs2FA ? '📱2FA ' : ''}{needsFace ? '👤人脸' : ''}
                            </div>

                            {needsPwd && (
                                <div className="field">
                                    <span className="field-label">🔐 密码</span>
                                    <input type="password" className="input-field" value={decryptPassword} onChange={e => setDecryptPassword(e.target.value)} placeholder="密码" style={{ width: 200 }} />
                                </div>
                            )}

                            {needs2FA && (
                                <div className="field">
                                    <span className="field-label">📱 验证码</span>
                                    <input type="text" className="input-field" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6位码" style={{ width: 100, fontFamily: 'monospace' }} maxLength={6} />
                                </div>
                            )}

                            {needsFace && (
                                <div className="field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <span className="field-label">👤 人脸验证</span>
                                    {!faceVerified ? (
                                        !showCamera ? <button className="btn-secondary" onClick={startCamera}>📷 启动摄像头</button>
                                            : <button className="btn-primary" onClick={async () => {
                                                const f = await captureAndExtract();
                                                if (f) { setFaceTemplate(f); setFaceVerified(true); stopCamera(); setFaceStatus('✅ 已捕获'); }
                                            }}>📸 拍照</button>
                                    ) : <span style={{ color: 'var(--success)' }}>✅ 已拍照</span>}
                                    {faceStatus && <span style={{ fontSize: '0.85rem', marginTop: 4 }}>{faceStatus}</span>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {showCamera && (
                <div style={{ background: 'var(--paper-2)', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center', border: '2px solid var(--border)' }}>
                    <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', display: 'inline-block' }}>
                        <video
                            ref={videoRef}
                            style={{ width: 320, height: 240, display: 'block', transform: 'scaleX(-1)' }}
                            autoPlay
                            muted
                            playsInline
                        />
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <button className="btn-secondary" onClick={stopCamera}>❌ 关闭摄像头</button>
                    </div>
                </div>
            )}
            <canvas ref={faceCanvasRef} style={{ display: 'none' }} />

            {showSetup && totpSecret && (
                <div style={{ background: 'var(--paper-2)', borderRadius: 12, padding: 20, marginBottom: 16, border: '2px solid var(--accent-strong)' }}>
                    <h4>📱 设置 2FA 验证器</h4>
                    <div style={{ textAlign: 'center', margin: '12px 0' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getTotpUri())}`} alt="QR" style={{ borderRadius: 8 }} />
                    </div>
                    <div style={{ background: 'var(--paper)', padding: 8, borderRadius: 8, fontFamily: 'monospace', textAlign: 'center', fontSize: '0.85rem' }}>{totpSecret}</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginTop: 8 }}>⚠️ 请保存密钥！丢失无法解密。</p>
                    <button className="btn-secondary" onClick={() => setShowSetup(false)} style={{ marginTop: 8 }}>✓ 已保存</button>
                </div>
            )}

            <div className="stego-content">
                {!image ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🔐</div>
                        <div className="file-zone-text">图片隐写术</div>
                        <div className="file-zone-hint">密码 + 2FA + 人脸 任意组合</div>
                    </div>
                ) : (
                    <div className="stego-layout">
                        <div className="stego-preview">
                            <img src={result || image.url} alt="preview" />
                            {result && <div className="stego-badge">{getSecurityBadge()} 已保护</div>}
                        </div>
                        {mode === 'decode' && decodedMessage && (
                            <div className="stego-result">
                                <h4>📝 提取到的信息：</h4>
                                <div className="stego-message">{decodedMessage}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {image && (
                <div className="actions" style={{ marginTop: 16 }}>
                    {mode === 'encode' ? (
                        <>
                            <button className="btn-primary" onClick={encodeMessage} disabled={isProcessing || !message || getCurrentFlags() === 0 || (useFace && !faceVerified)}>
                                {isProcessing ? '处理中...' : '🔒 隐藏信息'}
                            </button>
                            {result && <button className="btn-secondary" onClick={downloadResult} style={{ marginLeft: 8 }}>📥 下载</button>}
                        </>
                    ) : (
                        <button className="btn-primary" onClick={decodeMessage} disabled={isProcessing || (needsFace && !faceVerified)}>
                            {isProcessing ? '解析中...' : '🔓 提取信息'}
                        </button>
                    )}
                </div>
            )}

            <div className="stego-info" style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                <p>💡 <strong>隐写：</strong>LSB 像素隐藏</p>
                <p>🔐 <strong>密码：</strong>AES-256-GCM</p>
                <p>📱 <strong>2FA：</strong>TOTP 标准</p>
                <p>👤 <strong>人脸：</strong>特征向量匹配</p>
            </div>
        </>
    );
};

export default Steganography;
