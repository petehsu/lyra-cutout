import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * 尺寸调整器
 * - 批量缩放到指定尺寸
 * - 保持比例或强制拉伸
 */
const ImageResizer = () => {
    const [images, setImages] = useState([]);
    const [mode, setMode] = useState('width'); // width | height | both | percent
    const [targetWidth, setTargetWidth] = useState(800);
    const [targetHeight, setTargetHeight] = useState(600);
    const [percent, setPercent] = useState(50);
    const [keepRatio, setKeepRatio] = useState(true);
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

    // 调整尺寸
    const resizeImages = async () => {
        setIsProcessing(true);
        const processedResults = [];

        for (const img of images) {
            const result = await resizeImage(img);
            processedResults.push(result);
        }

        setResults(processedResults);
        setIsProcessing(false);
    };

    // 调整单张图片尺寸
    const resizeImage = (img) => {
        return new Promise((resolve) => {
            const imgEl = new Image();
            imgEl.onload = () => {
                const canvas = canvasRef.current;
                let newWidth, newHeight;
                const origWidth = imgEl.naturalWidth;
                const origHeight = imgEl.naturalHeight;
                const ratio = origWidth / origHeight;

                switch (mode) {
                    case 'width':
                        newWidth = targetWidth;
                        newHeight = keepRatio ? targetWidth / ratio : origHeight;
                        break;
                    case 'height':
                        newHeight = targetHeight;
                        newWidth = keepRatio ? targetHeight * ratio : origWidth;
                        break;
                    case 'both':
                        if (keepRatio) {
                            const scaleW = targetWidth / origWidth;
                            const scaleH = targetHeight / origHeight;
                            const scale = Math.min(scaleW, scaleH);
                            newWidth = origWidth * scale;
                            newHeight = origHeight * scale;
                        } else {
                            newWidth = targetWidth;
                            newHeight = targetHeight;
                        }
                        break;
                    case 'percent':
                        newWidth = origWidth * (percent / 100);
                        newHeight = origHeight * (percent / 100);
                        break;
                    default:
                        newWidth = origWidth;
                        newHeight = origHeight;
                }

                canvas.width = Math.round(newWidth);
                canvas.height = Math.round(newHeight);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    resolve({
                        ...img,
                        result: url,
                        newWidth: canvas.width,
                        newHeight: canvas.height,
                        origWidth,
                        origHeight,
                        blob,
                    });
                }, 'image/png');
            };
            imgEl.src = img.url;
        });
    };

    // 下载全部
    const downloadAll = async () => {
        const zip = new JSZip();
        const folder = zip.folder('resized');

        for (const item of results) {
            folder.file(`resized_${item.name}`, item.blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'resized_images.zip');
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
                            <button className="btn-secondary" onClick={() => { setImages([]); setResults([]); }} style={{ marginLeft: 8 }}>
                                清空
                            </button>
                        )}
                    </div>

                    <div className="field">
                        <span className="field-label">调整方式</span>
                        <div className="mode-selector">
                            <button type="button" className={`mode-btn ${mode === 'width' ? 'active' : ''}`} onClick={() => setMode('width')}>
                                按宽度
                            </button>
                            <button type="button" className={`mode-btn ${mode === 'height' ? 'active' : ''}`} onClick={() => setMode('height')}>
                                按高度
                            </button>
                            <button type="button" className={`mode-btn ${mode === 'both' ? 'active' : ''}`} onClick={() => setMode('both')}>
                                指定尺寸
                            </button>
                            <button type="button" className={`mode-btn ${mode === 'percent' ? 'active' : ''}`} onClick={() => setMode('percent')}>
                                按比例
                            </button>
                        </div>
                    </div>

                    {mode === 'width' && (
                        <div className="field">
                            <span className="field-label">目标宽度</span>
                            <input type="number" className="input-field" value={targetWidth} onChange={(e) => setTargetWidth(parseInt(e.target.value) || 800)} style={{ width: 80 }} />
                            <span style={{ marginLeft: 8 }}>px</span>
                        </div>
                    )}

                    {mode === 'height' && (
                        <div className="field">
                            <span className="field-label">目标高度</span>
                            <input type="number" className="input-field" value={targetHeight} onChange={(e) => setTargetHeight(parseInt(e.target.value) || 600)} style={{ width: 80 }} />
                            <span style={{ marginLeft: 8 }}>px</span>
                        </div>
                    )}

                    {mode === 'both' && (
                        <div className="field">
                            <span className="field-label">尺寸</span>
                            <input type="number" className="input-field" value={targetWidth} onChange={(e) => setTargetWidth(parseInt(e.target.value) || 800)} style={{ width: 70 }} />
                            <span style={{ margin: '0 8px' }}>×</span>
                            <input type="number" className="input-field" value={targetHeight} onChange={(e) => setTargetHeight(parseInt(e.target.value) || 600)} style={{ width: 70 }} />
                            <span style={{ marginLeft: 8 }}>px</span>
                        </div>
                    )}

                    {mode === 'percent' && (
                        <div className="field">
                            <span className="field-label">缩放比例</span>
                            <input type="range" min="10" max="200" value={percent} onChange={(e) => setPercent(parseInt(e.target.value))} style={{ width: 120 }} />
                            <span style={{ marginLeft: 8 }}>{percent}%</span>
                        </div>
                    )}

                    {mode !== 'percent' && (
                        <div className="field">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
                                保持宽高比
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="resizer-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">📏</div>
                        <div className="file-zone-text">尺寸调整</div>
                        <div className="file-zone-hint">批量缩放图片到指定尺寸</div>
                    </div>
                ) : (
                    <div className="resize-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>图片</th>
                                    <th>原尺寸</th>
                                    <th>→</th>
                                    <th>新尺寸</th>
                                </tr>
                            </thead>
                            <tbody>
                                {images.map((img, idx) => (
                                    <tr key={img.id}>
                                        <td className="resize-name">{img.name}</td>
                                        <td>{results[idx] ? `${results[idx].origWidth}×${results[idx].origHeight}` : '-'}</td>
                                        <td>{results[idx] ? '→' : '-'}</td>
                                        <td className="text-success">{results[idx] ? `${results[idx].newWidth}×${results[idx].newHeight}` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 隐藏画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {images.length > 0 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button className="btn-primary" onClick={resizeImages} disabled={isProcessing}>
                        {isProcessing ? '处理中...' : '📏 调整尺寸'}
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

export default ImageResizer;
