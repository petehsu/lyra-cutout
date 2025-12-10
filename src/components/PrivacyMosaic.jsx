import React, { useState, useRef, useEffect } from 'react';

/**
 * 隐私马赛克
 * - 框选区域添加马赛克/模糊/涂黑
 * - 支持多个区域
 * - 撤销功能
 */
const PrivacyMosaic = () => {
    const [image, setImage] = useState(null);
    const [regions, setRegions] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState(null);
    const [mode, setMode] = useState('mosaic'); // mosaic | blur | black
    const [mosaicSize, setMosaicSize] = useState(10);
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const [scale, setScale] = useState(1);

    // 上传图片
    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setImage({ file, url, name: file.name });
        setRegions([]);
    };

    // 绘制画布
    useEffect(() => {
        if (!image || !canvasRef.current || !imageRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;

        // 计算缩放比例
        const maxWidth = 600;
        const imgScale = Math.min(1, maxWidth / img.naturalWidth);
        setScale(imgScale);

        canvas.width = img.naturalWidth * imgScale;
        canvas.height = img.naturalHeight * imgScale;

        // 绘制原图
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 应用马赛克区域
        regions.forEach((rect) => {
            applyEffect(ctx, rect, imgScale);
        });

        // 绘制当前正在框选的区域
        if (currentRect) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
            ctx.setLineDash([]);
        }
    }, [image, regions, currentRect, mode, mosaicSize]);

    // 应用效果
    const applyEffect = (ctx, rect, imgScale) => {
        const x = rect.x;
        const y = rect.y;
        const w = rect.width;
        const h = rect.height;

        if (w <= 0 || h <= 0) return;

        if (mode === 'black' || rect.mode === 'black') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);
        } else if (mode === 'blur' || rect.mode === 'blur') {
            // 简单模糊效果
            ctx.filter = 'blur(8px)';
            const imgData = ctx.getImageData(x, y, w, h);
            ctx.putImageData(imgData, x, y);
            ctx.filter = 'none';
            // 实际使用 StackBlur 或类似库会更好
        } else {
            // 马赛克效果
            const size = rect.size || mosaicSize;
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;

            for (let py = 0; py < h; py += size) {
                for (let px = 0; px < w; px += size) {
                    // 取块内平均颜色
                    let r = 0, g = 0, b = 0, count = 0;
                    for (let dy = 0; dy < size && py + dy < h; dy++) {
                        for (let dx = 0; dx < size && px + dx < w; dx++) {
                            const idx = ((py + dy) * w + (px + dx)) * 4;
                            r += data[idx];
                            g += data[idx + 1];
                            b += data[idx + 2];
                            count++;
                        }
                    }
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    // 填充块
                    for (let dy = 0; dy < size && py + dy < h; dy++) {
                        for (let dx = 0; dx < size && px + dx < w; dx++) {
                            const idx = ((py + dy) * w + (px + dx)) * 4;
                            data[idx] = r;
                            data[idx + 1] = g;
                            data[idx + 2] = b;
                        }
                    }
                }
            }

            ctx.putImageData(imageData, x, y);
        }
    };

    // 鼠标事件处理
    const handleMouseDown = (e) => {
        if (!image) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsDrawing(true);
        setStartPos({ x, y });
        setCurrentRect({ x, y, width: 0, height: 0 });
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCurrentRect({
            x: Math.min(startPos.x, x),
            y: Math.min(startPos.y, y),
            width: Math.abs(x - startPos.x),
            height: Math.abs(y - startPos.y),
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentRect) return;
        setIsDrawing(false);

        if (currentRect.width > 5 && currentRect.height > 5) {
            setRegions((prev) => [...prev, { ...currentRect, mode, size: mosaicSize }]);
        }
        setCurrentRect(null);
    };

    // 撤销
    const undo = () => {
        setRegions((prev) => prev.slice(0, -1));
    };

    // 清空
    const clearAll = () => {
        setRegions([]);
    };

    // 下载
    const download = () => {
        if (!canvasRef.current || !imageRef.current) return;

        // 创建全尺寸画布
        const fullCanvas = document.createElement('canvas');
        const fullCtx = fullCanvas.getContext('2d');
        const img = imageRef.current;

        fullCanvas.width = img.naturalWidth;
        fullCanvas.height = img.naturalHeight;

        // 绘制原图
        fullCtx.drawImage(img, 0, 0);

        // 应用马赛克（按原始尺寸）
        regions.forEach((rect) => {
            const scaledRect = {
                x: rect.x / scale,
                y: rect.y / scale,
                width: rect.width / scale,
                height: rect.height / scale,
                mode: rect.mode,
                size: Math.round(rect.size / scale) || 10,
            };
            applyEffect(fullCtx, scaledRect, 1);
        });

        fullCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mosaic_${image.name}`;
            a.click();
        }, 'image/png');
    };

    return (
        <>
            {/* 控制面板 */}
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            选择图片
                            <input type="file" accept="image/*" onChange={handleUpload} hidden />
                        </label>
                    </div>

                    {image && (
                        <>
                            <div className="field">
                                <span className="field-label">效果类型</span>
                                <div className="mode-selector">
                                    <button
                                        type="button"
                                        className={`mode-btn ${mode === 'mosaic' ? 'active' : ''}`}
                                        onClick={() => setMode('mosaic')}
                                    >
                                        🔲 马赛克
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-btn ${mode === 'blur' ? 'active' : ''}`}
                                        onClick={() => setMode('blur')}
                                    >
                                        🌫️ 模糊
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-btn ${mode === 'black' ? 'active' : ''}`}
                                        onClick={() => setMode('black')}
                                    >
                                        ⬛ 涂黑
                                    </button>
                                </div>
                            </div>

                            {mode === 'mosaic' && (
                                <div className="field">
                                    <span className="field-label">马赛克大小</span>
                                    <input
                                        type="range"
                                        min="5"
                                        max="30"
                                        value={mosaicSize}
                                        onChange={(e) => setMosaicSize(parseInt(e.target.value))}
                                        style={{ width: 100 }}
                                    />
                                    <span style={{ marginLeft: 8 }}>{mosaicSize}px</span>
                                </div>
                            )}

                            <div className="field">
                                <button className="btn-secondary" onClick={undo} disabled={regions.length === 0}>
                                    ↩️ 撤销
                                </button>
                                <button className="btn-secondary" onClick={clearAll} disabled={regions.length === 0} style={{ marginLeft: 8 }}>
                                    🗑️ 清空
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="mosaic-content">
                {!image ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🔲</div>
                        <div className="file-zone-text">隐私马赛克</div>
                        <div className="file-zone-hint">框选区域添加马赛克保护隐私</div>
                    </div>
                ) : (
                    <div className="mosaic-canvas-wrapper">
                        <p className="mosaic-tip">💡 在图片上拖动框选需要打码的区域</p>
                        <img
                            ref={imageRef}
                            src={image.url}
                            alt="source"
                            style={{ display: 'none' }}
                            onLoad={() => setRegions([])}
                        />
                        <canvas
                            ref={canvasRef}
                            className="mosaic-canvas"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                    </div>
                )}
            </div>

            {/* 下载按钮 */}
            {image && regions.length > 0 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button className="btn-primary" onClick={download}>
                        📥 下载处理后的图片
                    </button>
                </div>
            )}
        </>
    );
};

export default PrivacyMosaic;
