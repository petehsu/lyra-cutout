import React, { useState, useRef } from 'react';
import { saveAs } from 'file-saver';

/**
 * 拼贴画/九宫格
 * - 多图拼成模板
 * - 多种布局选择
 */
const Collage = () => {
    const [images, setImages] = useState([]);
    const [layout, setLayout] = useState('grid-2x2');
    const [gap, setGap] = useState(4);
    const [bgColor, setBgColor] = useState('#ffffff');
    const [outputSize, setOutputSize] = useState(1200);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const canvasRef = useRef(null);

    const layouts = [
        { value: 'grid-2x2', label: '2×2', slots: 4, cols: 2, rows: 2 },
        { value: 'grid-3x3', label: '3×3', slots: 9, cols: 3, rows: 3 },
        { value: 'grid-2x3', label: '2×3', slots: 6, cols: 2, rows: 3 },
        { value: 'grid-3x2', label: '3×2', slots: 6, cols: 3, rows: 2 },
        { value: 'grid-1x3', label: '1×3', slots: 3, cols: 1, rows: 3 },
        { value: 'grid-3x1', label: '3×1', slots: 3, cols: 3, rows: 1 },
    ];

    const currentLayout = layouts.find((l) => l.value === layout) || layouts[0];

    // 上传图片
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newImages = files.slice(0, currentLayout.slots - images.length).map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            name: file.name,
        }));

        setImages((prev) => [...prev, ...newImages].slice(0, currentLayout.slots));
        setResult(null);
    };

    // 删除图片
    const deleteImage = (id) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
        setResult(null);
    };

    // 生成拼贴画
    const generateCollage = async () => {
        if (images.length === 0) return;
        setIsProcessing(true);

        const canvas = canvasRef.current;
        const cellWidth = (outputSize - gap * (currentLayout.cols + 1)) / currentLayout.cols;
        const cellHeight = (outputSize - gap * (currentLayout.rows + 1)) / currentLayout.rows;

        canvas.width = outputSize;
        canvas.height = gap + (cellHeight + gap) * currentLayout.rows;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 加载所有图片
        const loadedImages = await Promise.all(
            images.map((img) => {
                return new Promise((resolve) => {
                    const imgEl = new Image();
                    imgEl.onload = () => resolve(imgEl);
                    imgEl.src = img.url;
                });
            })
        );

        // 绘制图片
        loadedImages.forEach((img, idx) => {
            if (idx >= currentLayout.slots) return;

            const col = idx % currentLayout.cols;
            const row = Math.floor(idx / currentLayout.cols);
            const x = gap + col * (cellWidth + gap);
            const y = gap + row * (cellHeight + gap);

            // 计算裁剪位置（居中裁剪）
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const cellRatio = cellWidth / cellHeight;

            let sx, sy, sw, sh;
            if (imgRatio > cellRatio) {
                sh = img.naturalHeight;
                sw = sh * cellRatio;
                sx = (img.naturalWidth - sw) / 2;
                sy = 0;
            } else {
                sw = img.naturalWidth;
                sh = sw / cellRatio;
                sx = 0;
                sy = (img.naturalHeight - sh) / 2;
            }

            ctx.drawImage(img, sx, sy, sw, sh, x, y, cellWidth, cellHeight);
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setResult(dataUrl);
        setIsProcessing(false);
    };

    // 下载
    const downloadResult = () => {
        if (!result) return;
        const link = document.createElement('a');
        link.href = result;
        link.download = `collage_${layout}.jpg`;
        link.click();
    };

    return (
        <>
            {/* 控制面板 */}
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            + 添加图片 ({images.length}/{currentLayout.slots})
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleUpload}
                                hidden
                                disabled={images.length >= currentLayout.slots}
                            />
                        </label>
                        {images.length > 0 && (
                            <button className="btn-secondary" onClick={() => { setImages([]); setResult(null); }} style={{ marginLeft: 8 }}>
                                清空
                            </button>
                        )}
                    </div>

                    <div className="field">
                        <span className="field-label">布局</span>
                        <div className="mode-selector">
                            {layouts.map((l) => (
                                <button
                                    key={l.value}
                                    type="button"
                                    className={`mode-btn ${layout === l.value ? 'active' : ''}`}
                                    onClick={() => { setLayout(l.value); setResult(null); }}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field">
                        <span className="field-label">间距</span>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            value={gap}
                            onChange={(e) => { setGap(parseInt(e.target.value)); setResult(null); }}
                            style={{ width: 80 }}
                        />
                        <span style={{ marginLeft: 8 }}>{gap}px</span>
                    </div>

                    <div className="field">
                        <span className="field-label">背景</span>
                        <input
                            type="color"
                            value={bgColor}
                            onChange={(e) => { setBgColor(e.target.value); setResult(null); }}
                            style={{ width: 40, height: 30 }}
                        />
                    </div>

                    <div className="field">
                        <span className="field-label">输出宽度</span>
                        <input
                            type="number"
                            className="input-field"
                            value={outputSize}
                            onChange={(e) => setOutputSize(parseInt(e.target.value) || 1200)}
                            style={{ width: 80 }}
                        />
                        <span style={{ marginLeft: 8 }}>px</span>
                    </div>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="collage-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🧩</div>
                        <div className="file-zone-text">拼贴画</div>
                        <div className="file-zone-hint">将多张图片拼成九宫格或其他布局</div>
                    </div>
                ) : (
                    <div className="collage-layout">
                        {/* 左侧：图片列表 */}
                        <div className="collage-list">
                            {images.map((img, idx) => (
                                <div key={img.id} className="collage-item">
                                    <span className="collage-index">{idx + 1}</span>
                                    <img src={img.url} alt="thumb" />
                                    <button className="del-btn" onClick={() => deleteImage(img.id)}>×</button>
                                </div>
                            ))}
                            {images.length < currentLayout.slots && (
                                <label className="collage-item add">
                                    <span>+</span>
                                    <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
                                </label>
                            )}
                        </div>

                        {/* 右侧：预览 */}
                        <div className="collage-preview">
                            {result ? (
                                <img src={result} alt="result" />
                            ) : (
                                <div className="collage-placeholder">
                                    点击下方按钮生成预览
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 隐藏画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {images.length > 0 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button className="btn-primary" onClick={generateCollage} disabled={isProcessing}>
                        {isProcessing ? '生成中...' : '🧩 生成拼贴'}
                    </button>
                    {result && (
                        <button className="btn-secondary" onClick={downloadResult} style={{ marginLeft: 8 }}>
                            📥 下载
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default Collage;
