import React, { useState, useRef } from 'react';

/**
 * 图片隐写术
 * - 在图片像素中隐藏文字
 * - 完全不可见
 * - 可用于版权保护
 */
const Steganography = () => {
    const [mode, setMode] = useState('encode'); // encode | decode
    const [image, setImage] = useState(null);
    const [message, setMessage] = useState('');
    const [decodedMessage, setDecodedMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const canvasRef = useRef(null);

    // 将文字转换为二进制
    const textToBinary = (text) => {
        return text.split('').map((char) => {
            return char.charCodeAt(0).toString(2).padStart(8, '0');
        }).join('');
    };

    // 将二进制转换为文字
    const binaryToText = (binary) => {
        const bytes = binary.match(/.{8}/g) || [];
        return bytes.map((byte) => {
            const charCode = parseInt(byte, 2);
            if (charCode === 0) return '';
            return String.fromCharCode(charCode);
        }).join('');
    };

    // 上传图片
    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImage({ url: URL.createObjectURL(file), name: file.name });
        setResult(null);
        setDecodedMessage('');
    };

    // 编码（隐藏信息）
    const encodeMessage = () => {
        if (!image || !message) return;
        setIsProcessing(true);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 添加结束标记
            const binaryMessage = textToBinary(message + '\0\0\0');

            if (binaryMessage.length > data.length / 4) {
                alert('消息太长，请使用更大的图片或更短的消息');
                setIsProcessing(false);
                return;
            }

            // 在 RGB 通道的最低位隐藏信息
            for (let i = 0; i < binaryMessage.length; i++) {
                const bit = parseInt(binaryMessage[i]);
                const pixelIndex = i * 4; // 每个像素4个值 (RGBA)
                // 修改 R 通道的最低位
                data[pixelIndex] = (data[pixelIndex] & 0xFE) | bit;
            }

            ctx.putImageData(imageData, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            setResult(dataUrl);
            setIsProcessing(false);
        };
        img.src = image.url;
    };

    // 解码（提取信息）
    const decodeMessage = () => {
        if (!image) return;
        setIsProcessing(true);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 提取 R 通道的最低位
            let binary = '';
            for (let i = 0; i < data.length; i += 4) {
                binary += (data[i] & 1).toString();

                // 每8位检查是否为结束标记
                if (binary.length % 8 === 0 && binary.length >= 24) {
                    const lastThreeChars = binaryToText(binary.slice(-24));
                    if (lastThreeChars === '\0\0\0') {
                        binary = binary.slice(0, -24);
                        break;
                    }
                }

                // 防止无限循环
                if (binary.length > 100000) break;
            }

            const decoded = binaryToText(binary);
            setDecodedMessage(decoded || '未发现隐藏信息');
            setIsProcessing(false);
        };
        img.src = image.url;
    };

    // 下载结果
    const downloadResult = () => {
        if (!result) return;
        const link = document.createElement('a');
        link.href = result;
        link.download = `hidden_${image.name}`;
        link.click();
    };

    return (
        <>
            {/* 控制面板 */}
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <span className="field-label">模式</span>
                        <div className="mode-selector">
                            <button
                                type="button"
                                className={`mode-btn ${mode === 'encode' ? 'active' : ''}`}
                                onClick={() => { setMode('encode'); setResult(null); setDecodedMessage(''); }}
                            >
                                🔒 隐藏信息
                            </button>
                            <button
                                type="button"
                                className={`mode-btn ${mode === 'decode' ? 'active' : ''}`}
                                onClick={() => { setMode('decode'); setResult(null); setDecodedMessage(''); }}
                            >
                                🔓 提取信息
                            </button>
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
                        <div className="field">
                            <span className="field-label">要隐藏的信息</span>
                            <textarea
                                className="input-field"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="输入要隐藏的文字..."
                                rows={3}
                                style={{ width: 300, resize: 'vertical' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="stego-content">
                {!image ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🔐</div>
                        <div className="file-zone-text">图片隐写术</div>
                        <div className="file-zone-hint">在图片像素中隐藏秘密信息（需使用 PNG 格式）</div>
                    </div>
                ) : (
                    <div className="stego-layout">
                        {/* 图片预览 */}
                        <div className="stego-preview">
                            <img src={result || image.url} alt="preview" />
                            {result && <div className="stego-badge">✓ 已隐藏信息</div>}
                        </div>

                        {/* 解码结果 */}
                        {mode === 'decode' && decodedMessage && (
                            <div className="stego-result">
                                <h4>📝 提取到的信息：</h4>
                                <div className="stego-message">{decodedMessage}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 隐藏画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {image && (
                <div className="actions" style={{ marginTop: 16 }}>
                    {mode === 'encode' ? (
                        <>
                            <button
                                className="btn-primary"
                                onClick={encodeMessage}
                                disabled={isProcessing || !message}
                            >
                                {isProcessing ? '处理中...' : '🔒 隐藏信息'}
                            </button>
                            {result && (
                                <button className="btn-secondary" onClick={downloadResult} style={{ marginLeft: 8 }}>
                                    📥 下载图片
                                </button>
                            )}
                        </>
                    ) : (
                        <button className="btn-primary" onClick={decodeMessage} disabled={isProcessing}>
                            {isProcessing ? '解析中...' : '🔓 提取信息'}
                        </button>
                    )}
                </div>
            )}

            {/* 说明 */}
            <div className="stego-info" style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                <p>💡 <strong>原理：</strong>在图片像素的最低有效位 (LSB) 中隐藏二进制数据，肉眼完全看不出区别。</p>
                <p>⚠️ <strong>注意：</strong>必须使用 PNG 格式保存，JPG 压缩会破坏隐藏的信息。</p>
            </div>
        </>
    );
};

export default Steganography;
