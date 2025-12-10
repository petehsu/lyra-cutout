import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * 批量水印
 * - 添加文字/图片水印
 * - 位置、透明度、大小可调
 * - 批量应用
 */
const Watermark = () => {
    const [images, setImages] = useState([]);
    const [watermarkType, setWatermarkType] = useState('text'); // text | image
    const [text, setText] = useState('© Lyra Cutout');
    const [fontSize, setFontSize] = useState(24);
    const [fontColor, setFontColor] = useState('#ffffff');
    const [opacity, setOpacity] = useState(0.7);
    const [position, setPosition] = useState('bottom-right');
    const [padding, setPadding] = useState(20);
    const [watermarkImage, setWatermarkImage] = useState(null);
    const [watermarkScale, setWatermarkScale] = useState(0.2);
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const canvasRef = useRef(null);

    // 上传图片
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newImages = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            name: file.name,
        }));

        setImages((prev) => [...prev, ...newImages]);
        setResults([]);
    };

    // 上传水印图片
    const handleWatermarkUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setWatermarkImage({
            file,
            url: URL.createObjectURL(file),
        });
    };

    // 计算水印位置
    const getWatermarkPosition = (canvasW, canvasH, watermarkW, watermarkH) => {
        const p = padding;
        switch (position) {
            case 'top-left': return { x: p, y: p + watermarkH };
            case 'top-right': return { x: canvasW - watermarkW - p, y: p + watermarkH };
            case 'top-center': return { x: (canvasW - watermarkW) / 2, y: p + watermarkH };
            case 'bottom-left': return { x: p, y: canvasH - p };
            case 'bottom-right': return { x: canvasW - watermarkW - p, y: canvasH - p };
            case 'bottom-center': return { x: (canvasW - watermarkW) / 2, y: canvasH - p };
            case 'center': return { x: (canvasW - watermarkW) / 2, y: (canvasH + watermarkH) / 2 };
            default: return { x: canvasW - watermarkW - p, y: canvasH - p };
        }
    };

    // 处理图片
    const processImages = async () => {
        setIsProcessing(true);
        const processedResults = [];

        for (const img of images) {
            const result = await addWatermarkToImage(img);
            processedResults.push(result);
        }

        setResults(processedResults);
        setIsProcessing(false);
    };

    // 添加水印到单张图片
    const addWatermarkToImage = (img) => {
        return new Promise((resolve) => {
            const imgEl = new Image();
            imgEl.onload = () => {
                const canvas = canvasRef.current;
                canvas.width = imgEl.naturalWidth;
                canvas.height = imgEl.naturalHeight;
                const ctx = canvas.getContext('2d');

                // 绘制原图
                ctx.drawImage(imgEl, 0, 0);

                // 设置透明度
                ctx.globalAlpha = opacity;

                if (watermarkType === 'text') {
                    // 文字水印
                    ctx.font = `${fontSize}px Arial, sans-serif`;
                    ctx.fillStyle = fontColor;
                    ctx.textBaseline = 'bottom';

                    const metrics = ctx.measureText(text);
                    const pos = getWatermarkPosition(canvas.width, canvas.height, metrics.width, fontSize);

                    // 添加阴影
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    ctx.fillText(text, pos.x, pos.y);
                } else if (watermarkType === 'image' && watermarkImage) {
                    // 图片水印
                    const wmImg = new Image();
                    wmImg.onload = () => {
                        const wmWidth = wmImg.naturalWidth * watermarkScale;
                        const wmHeight = wmImg.naturalHeight * watermarkScale;
                        const pos = getWatermarkPosition(canvas.width, canvas.height, wmWidth, wmHeight);

                        ctx.drawImage(wmImg, pos.x, pos.y - wmHeight, wmWidth, wmHeight);

                        const dataUrl = canvas.toDataURL('image/png');
                        resolve({ ...img, result: dataUrl });
                    };
                    wmImg.src = watermarkImage.url;
                    return;
                }

                ctx.globalAlpha = 1;
                const dataUrl = canvas.toDataURL('image/png');
                resolve({ ...img, result: dataUrl });
            };
            imgEl.src = img.url;
        });
    };

    // 下载全部
    const downloadAll = async () => {
        const zip = new JSZip();
        const folder = zip.folder('watermarked');

        for (const item of results) {
            const response = await fetch(item.result);
            const blob = await response.blob();
            folder.file(`wm_${item.name}`, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'watermarked_images.zip');
    };

    // 删除图片
    const deleteImage = (id) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
        setResults([]);
    };

    // 清空
    const clearAll = () => {
        setImages([]);
        setResults([]);
    };

    const positions = [
        { value: 'top-left', label: '↖️ 左上' },
        { value: 'top-center', label: '⬆️ 上中' },
        { value: 'top-right', label: '↗️ 右上' },
        { value: 'center', label: '⏺️ 居中' },
        { value: 'bottom-left', label: '↙️ 左下' },
        { value: 'bottom-center', label: '⬇️ 下中' },
        { value: 'bottom-right', label: '↘️ 右下' },
    ];

    return (
        <>
            {/* 控制面板 */}
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            + 添加图片
                            <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
                        </label>
                        {images.length > 0 && (
                            <button className="btn-secondary" onClick={clearAll} style={{ marginLeft: 8 }}>
                                清空
                            </button>
                        )}
                    </div>

                    <div className="field">
                        <span className="field-label">水印类型</span>
                        <div className="mode-selector">
                            <button
                                type="button"
                                className={`mode-btn ${watermarkType === 'text' ? 'active' : ''}`}
                                onClick={() => setWatermarkType('text')}
                            >
                                📝 文字
                            </button>
                            <button
                                type="button"
                                className={`mode-btn ${watermarkType === 'image' ? 'active' : ''}`}
                                onClick={() => setWatermarkType('image')}
                            >
                                🖼️ 图片
                            </button>
                        </div>
                    </div>

                    {watermarkType === 'text' ? (
                        <>
                            <div className="field">
                                <span className="field-label">水印文字</span>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    style={{ width: 200 }}
                                />
                            </div>
                            <div className="field">
                                <span className="field-label">字号</span>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={fontSize}
                                    onChange={(e) => setFontSize(parseInt(e.target.value) || 24)}
                                    min="12"
                                    max="100"
                                    style={{ width: 60 }}
                                />
                            </div>
                            <div className="field">
                                <span className="field-label">颜色</span>
                                <input
                                    type="color"
                                    value={fontColor}
                                    onChange={(e) => setFontColor(e.target.value)}
                                    style={{ width: 40, height: 30 }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="field">
                                <label className="btn-secondary" style={{ display: 'inline-block' }}>
                                    选择水印图片
                                    <input type="file" accept="image/*" onChange={handleWatermarkUpload} hidden />
                                </label>
                                {watermarkImage && (
                                    <img src={watermarkImage.url} alt="wm" style={{ height: 30, marginLeft: 8, verticalAlign: 'middle' }} />
                                )}
                            </div>
                            <div className="field">
                                <span className="field-label">缩放</span>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.5"
                                    step="0.05"
                                    value={watermarkScale}
                                    onChange={(e) => setWatermarkScale(parseFloat(e.target.value))}
                                    style={{ width: 100 }}
                                />
                                <span style={{ marginLeft: 8 }}>{Math.round(watermarkScale * 100)}%</span>
                            </div>
                        </>
                    )}

                    <div className="field">
                        <span className="field-label">透明度</span>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={opacity}
                            onChange={(e) => setOpacity(parseFloat(e.target.value))}
                            style={{ width: 100 }}
                        />
                        <span style={{ marginLeft: 8 }}>{Math.round(opacity * 100)}%</span>
                    </div>

                    <div className="field">
                        <span className="field-label">位置</span>
                        <select
                            className="input-field"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                        >
                            {positions.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="watermark-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">💧</div>
                        <div className="file-zone-text">批量水印</div>
                        <div className="file-zone-hint">为多张图片添加文字或图片水印</div>
                    </div>
                ) : (
                    <div className="watermark-grid">
                        {images.map((img, idx) => (
                            <div key={img.id} className="watermark-item">
                                <img src={results[idx]?.result || img.url} alt="preview" />
                                <button className="del-btn" onClick={() => deleteImage(img.id)}>×</button>
                                <div className="watermark-item-name">{img.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 隐藏画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {images.length > 0 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button
                        className="btn-primary"
                        onClick={processImages}
                        disabled={isProcessing || (watermarkType === 'image' && !watermarkImage)}
                    >
                        {isProcessing ? '处理中...' : '💧 应用水印'}
                    </button>
                    {results.length > 0 && (
                        <button className="btn-secondary" onClick={downloadAll} style={{ marginLeft: 8 }}>
                            📦 打包下载
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default Watermark;
