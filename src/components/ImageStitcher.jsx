import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * 长图拼接器
 * - 将多张截图垂直/水平拼接成一张长图
 * - 支持拖拽排序
 * - 支持间距设置
 */
const ImageStitcher = () => {
    const [images, setImages] = useState([]);
    const [direction, setDirection] = useState('vertical'); // vertical | horizontal
    const [gap, setGap] = useState(0);
    const [bgColor, setBgColor] = useState('#ffffff');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
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
            width: 0,
            height: 0,
        }));

        // 加载图片尺寸
        newImages.forEach((img, idx) => {
            const imgEl = new Image();
            imgEl.onload = () => {
                setImages((prev) => {
                    const updated = [...prev];
                    const target = updated.find((i) => i.id === img.id);
                    if (target) {
                        target.width = imgEl.naturalWidth;
                        target.height = imgEl.naturalHeight;
                    }
                    return updated;
                });
            };
            imgEl.src = img.url;
        });

        setImages((prev) => [...prev, ...newImages]);
        setResult(null);
    };

    // 移动图片顺序
    const moveImage = (index, dir) => {
        const newIndex = index + dir;
        if (newIndex < 0 || newIndex >= images.length) return;
        const newImages = [...images];
        [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
        setImages(newImages);
        setResult(null);
    };

    // 删除图片
    const deleteImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setResult(null);
    };

    // 拼接图片
    const stitchImages = async () => {
        if (images.length < 2) return;
        setIsProcessing(true);

        // 等待所有图片加载完成
        const loadedImages = await Promise.all(
            images.map((img) => {
                return new Promise((resolve) => {
                    const imgEl = new Image();
                    imgEl.onload = () => resolve({ ...img, element: imgEl });
                    imgEl.src = img.url;
                });
            })
        );

        // 计算画布尺寸
        let canvasWidth, canvasHeight;
        if (direction === 'vertical') {
            canvasWidth = Math.max(...loadedImages.map((img) => img.element.naturalWidth));
            canvasHeight = loadedImages.reduce((sum, img) => sum + img.element.naturalHeight, 0) + gap * (loadedImages.length - 1);
        } else {
            canvasWidth = loadedImages.reduce((sum, img) => sum + img.element.naturalWidth, 0) + gap * (loadedImages.length - 1);
            canvasHeight = Math.max(...loadedImages.map((img) => img.element.naturalHeight));
        }

        // 创建画布
        const canvas = canvasRef.current;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        // 填充背景
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 绘制图片
        let offset = 0;
        for (const img of loadedImages) {
            const { element } = img;
            if (direction === 'vertical') {
                const x = (canvasWidth - element.naturalWidth) / 2; // 居中
                ctx.drawImage(element, x, offset);
                offset += element.naturalHeight + gap;
            } else {
                const y = (canvasHeight - element.naturalHeight) / 2; // 居中
                ctx.drawImage(element, offset, y);
                offset += element.naturalWidth + gap;
            }
        }

        // 生成结果
        const dataUrl = canvas.toDataURL('image/png');
        setResult(dataUrl);
        setIsProcessing(false);
    };

    // 下载结果
    const downloadResult = () => {
        if (!result) return;
        const link = document.createElement('a');
        link.href = result;
        link.download = `stitched_${Date.now()}.png`;
        link.click();
    };

    // 清空
    const clearAll = () => {
        setImages([]);
        setResult(null);
    };

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
                        <span className="field-label">拼接方向</span>
                        <div className="mode-selector">
                            <button
                                type="button"
                                className={`mode-btn ${direction === 'vertical' ? 'active' : ''}`}
                                onClick={() => { setDirection('vertical'); setResult(null); }}
                            >
                                ↕️ 垂直
                            </button>
                            <button
                                type="button"
                                className={`mode-btn ${direction === 'horizontal' ? 'active' : ''}`}
                                onClick={() => { setDirection('horizontal'); setResult(null); }}
                            >
                                ↔️ 水平
                            </button>
                        </div>
                    </div>

                    <div className="field">
                        <span className="field-label">间距 (px)</span>
                        <input
                            type="number"
                            className="input-field"
                            value={gap}
                            onChange={(e) => { setGap(parseInt(e.target.value) || 0); setResult(null); }}
                            min="0"
                            max="100"
                            style={{ width: 80 }}
                        />
                    </div>

                    <div className="field">
                        <span className="field-label">背景色</span>
                        <input
                            type="color"
                            value={bgColor}
                            onChange={(e) => { setBgColor(e.target.value); setResult(null); }}
                            style={{ width: 40, height: 30, padding: 0, border: 'none', cursor: 'pointer' }}
                        />
                    </div>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="stitcher-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">📸</div>
                        <div className="file-zone-text">长图拼接</div>
                        <div className="file-zone-hint">将多张截图拼接成一张长图</div>
                    </div>
                ) : (
                    <div className="stitcher-layout">
                        {/* 左侧：图片列表 */}
                        <div className="stitcher-list">
                            <h4>图片列表 ({images.length})</h4>
                            {images.map((img, idx) => (
                                <div key={img.id} className="stitcher-item">
                                    <span className="item-order">{idx + 1}</span>
                                    <img src={img.url} alt="thumb" className="stitcher-thumb" />
                                    <div className="stitcher-item-info">
                                        <div className="stitcher-item-name">{img.name}</div>
                                        <div className="stitcher-item-size">{img.width}×{img.height}</div>
                                    </div>
                                    <div className="stitcher-item-actions">
                                        <button onClick={() => moveImage(idx, -1)} disabled={idx === 0}>↑</button>
                                        <button onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1}>↓</button>
                                        <button onClick={() => deleteImage(idx)}>×</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 右侧：预览 */}
                        <div className="stitcher-preview">
                            {result ? (
                                <img src={result} alt="result" className="stitcher-result" />
                            ) : (
                                <div className="stitcher-placeholder">
                                    点击下方按钮预览拼接效果
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 隐藏的画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {images.length >= 2 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button
                        className="btn-primary"
                        onClick={stitchImages}
                        disabled={isProcessing}
                    >
                        {isProcessing ? '拼接中...' : '🔗 拼接图片'}
                    </button>
                    {result && (
                        <button className="btn-secondary" onClick={downloadResult} style={{ marginLeft: 8 }}>
                            📥 下载结果
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default ImageStitcher;
