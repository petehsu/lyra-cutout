import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * 图片压缩器
 * - 调整图片质量减小文件体积
 * - 批量处理
 * - 显示压缩前后对比
 */
const ImageCompressor = () => {
    const [images, setImages] = useState([]);
    const [quality, setQuality] = useState(0.8);
    const [maxWidth, setMaxWidth] = useState(0); // 0 = 不限制
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState([]);
    const canvasRef = useRef(null);

    // 格式化文件大小
    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // 上传图片
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newImages = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
        }));

        setImages((prev) => [...prev, ...newImages]);
        setResults([]);
    };

    // 压缩图片
    const compressImages = async () => {
        setIsProcessing(true);
        const processedResults = [];

        for (const img of images) {
            const result = await compressImage(img);
            processedResults.push(result);
        }

        setResults(processedResults);
        setIsProcessing(false);
    };

    // 压缩单张图片
    const compressImage = (img) => {
        return new Promise((resolve) => {
            const imgEl = new Image();
            imgEl.onload = () => {
                const canvas = canvasRef.current;
                let width = imgEl.naturalWidth;
                let height = imgEl.naturalHeight;

                // 限制最大宽度
                if (maxWidth > 0 && width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgEl, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        const url = URL.createObjectURL(blob);
                        resolve({
                            ...img,
                            result: url,
                            newSize: blob.size,
                            ratio: ((1 - blob.size / img.size) * 100).toFixed(1),
                            blob,
                        });
                    },
                    'image/jpeg',
                    quality
                );
            };
            imgEl.src = img.url;
        });
    };

    // 下载全部
    const downloadAll = async () => {
        const zip = new JSZip();
        const folder = zip.folder('compressed');

        for (const item of results) {
            folder.file(item.name.replace(/\.[^.]+$/, '.jpg'), item.blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'compressed_images.zip');
    };

    // 计算总节省
    const totalOriginal = images.reduce((sum, img) => sum + img.size, 0);
    const totalCompressed = results.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginal - totalCompressed;

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
                        <span className="field-label">压缩质量</span>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={quality}
                            onChange={(e) => setQuality(parseFloat(e.target.value))}
                            style={{ width: 120 }}
                        />
                        <span style={{ marginLeft: 8 }}>{Math.round(quality * 100)}%</span>
                    </div>

                    <div className="field">
                        <span className="field-label">最大宽度</span>
                        <input
                            type="number"
                            className="input-field"
                            value={maxWidth || ''}
                            onChange={(e) => setMaxWidth(parseInt(e.target.value) || 0)}
                            placeholder="不限制"
                            style={{ width: 100 }}
                        />
                        <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>px (0=不限)</span>
                    </div>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="compressor-content">
                {images.length === 0 ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">📊</div>
                        <div className="file-zone-text">图片压缩</div>
                        <div className="file-zone-hint">调整质量减小文件体积</div>
                    </div>
                ) : (
                    <>
                        {results.length > 0 && (
                            <div className="compress-summary">
                                <span>📊 共节省 <strong>{formatSize(totalSaved)}</strong></span>
                                <span> ({((totalSaved / totalOriginal) * 100).toFixed(1)}%)</span>
                            </div>
                        )}
                        <div className="compress-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>图片</th>
                                        <th>原大小</th>
                                        <th>→</th>
                                        <th>压缩后</th>
                                        <th>节省</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {images.map((img, idx) => (
                                        <tr key={img.id}>
                                            <td className="compress-name">{img.name}</td>
                                            <td>{formatSize(img.size)}</td>
                                            <td>{results[idx] ? '→' : '-'}</td>
                                            <td>{results[idx] ? formatSize(results[idx].newSize) : '-'}</td>
                                            <td className={results[idx]?.ratio > 0 ? 'text-success' : ''}>
                                                {results[idx] ? `-${results[idx].ratio}%` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* 隐藏画布 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* 操作按钮 */}
            {images.length > 0 && (
                <div className="actions" style={{ marginTop: 16 }}>
                    <button className="btn-primary" onClick={compressImages} disabled={isProcessing}>
                        {isProcessing ? '压缩中...' : '📊 开始压缩'}
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

export default ImageCompressor;
