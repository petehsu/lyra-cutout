import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * 格式转换器
 * - PNG/JPG/WebP 互转
 * - 批量处理
 */
const FormatConverter = () => {
    const [images, setImages] = useState([]);
    const [targetFormat, setTargetFormat] = useState('png');
    const [quality, setQuality] = useState(0.92);
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const canvasRef = useRef(null);

    const formats = [
        { value: 'png', label: 'PNG', mime: 'image/png' },
        { value: 'jpeg', label: 'JPG', mime: 'image/jpeg' },
        { value: 'webp', label: 'WebP', mime: 'image/webp' },
    ];

    // 上传图片
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newImages = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            name: file.name,
            format: file.type.split('/')[1],
        }));

        setImages((prev) => [...prev, ...newImages]);
        setResults([]);
    };

    // 转换图片
    const convertImages = async () => {
        setIsProcessing(true);
        const processedResults = [];

        for (const img of images) {
            const result = await convertImage(img);
            processedResults.push(result);
        }

        setResults(processedResults);
        setIsProcessing(false);
    };

    // 转换单张图片
    const convertImage = (img) => {
        return new Promise((resolve) => {
            const imgEl = new Image();
            imgEl.onload = () => {
                const canvas = canvasRef.current;
                canvas.width = imgEl.naturalWidth;
                canvas.height = imgEl.naturalHeight;
                const ctx = canvas.getContext('2d');

                // PNG 需要透明背景，JPG 需要白色背景
                if (targetFormat === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(imgEl, 0, 0);

                const mimeType = formats.find((f) => f.value === targetFormat).mime;
                canvas.toBlob(
                    (blob) => {
                        const url = URL.createObjectURL(blob);
                        const newName = img.name.replace(/\.[^.]+$/, `.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`);
                        resolve({ ...img, result: url, newName, blob });
                    },
                    mimeType,
                    quality
                );
            };
            imgEl.src = img.url;
        });
    };

    // 下载全部
    const downloadAll = async () => {
        const zip = new JSZip();
        const folder = zip.folder('converted');

        for (const item of results) {
            folder.file(item.newName, item.blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `converted_to_${targetFormat}.zip`);
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
                        <span className="field-label">目标格式</span>
                        <div className="mode-selector">
                            {formats.map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    className={`mode-btn ${targetFormat === f.value ? 'active' : ''}`}
                                    onClick={() => { setTargetFormat(f.value); setResults([]); }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {targetFormat !== 'png' && (
                        <div className="field">
                            <span className="field-label">质量</span>
                            <input
                                type="range"
                                min="0.5"
                                max="1"
                                step="0.05"
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                style={{ width: 100 }}
                            />
                            <span style={{ marginLeft: 8 }}>{Math.round(quality * 100)}%</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="converter-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🔄</div>
                        <div className="file-zone-text">格式转换</div>
                        <div className="file-zone-hint">PNG / JPG / WebP 互转</div>
                    </div>
                ) : (
                    <div className="converter-list">
                        {images.map((img, idx) => (
                            <div key={img.id} className="converter-item">
                                <img src={img.url} alt="thumb" className="converter-thumb" />
                                <div className="converter-info">
                                    <div className="converter-name">{img.name}</div>
                                    <div className="converter-change">
                                        <span className="format-badge">{img.format?.toUpperCase()}</span>
                                        <span> → </span>
                                        <span className="format-badge active">{targetFormat.toUpperCase()}</span>
                                    </div>
                                </div>
                                {results[idx] && (
                                    <a href={results[idx].result} download={results[idx].newName} className="btn-sm">
                                        📥
                                    </a>
                                )}
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
                    <button className="btn-primary" onClick={convertImages} disabled={isProcessing}>
                        {isProcessing ? '转换中...' : '🔄 开始转换'}
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

export default FormatConverter;
