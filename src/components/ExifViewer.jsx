import React, { useState } from 'react';

/**
 * EXIF 查看器
 * - 查看图片元数据
 * - 清除 EXIF 信息保护隐私
 */
const ExifViewer = () => {
    const [image, setImage] = useState(null);
    const [exifData, setExifData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // 读取 EXIF 数据（使用 DataView 手动解析）
    const readExif = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                const exif = {};

                // 检查 JPEG 标记
                if (view.getUint16(0) !== 0xFFD8) {
                    resolve({ error: '不是有效的 JPEG 文件' });
                    return;
                }

                // 基本文件信息
                exif['文件名'] = file.name;
                exif['文件大小'] = formatSize(file.size);
                exif['文件类型'] = file.type;
                exif['最后修改'] = new Date(file.lastModified).toLocaleString();

                // 尝试解析图片尺寸
                const img = new Image();
                img.onload = () => {
                    exif['图片宽度'] = img.naturalWidth + ' px';
                    exif['图片高度'] = img.naturalHeight + ' px';
                    exif['像素总数'] = (img.naturalWidth * img.naturalHeight / 1000000).toFixed(2) + ' 百万';

                    // 尝试找 EXIF 段
                    let offset = 2;
                    while (offset < buffer.byteLength) {
                        if (view.getUint8(offset) !== 0xFF) break;
                        const marker = view.getUint8(offset + 1);

                        // APP1 段可能包含 EXIF
                        if (marker === 0xE1) {
                            const length = view.getUint16(offset + 2);
                            // 检查是否是 EXIF
                            const exifHeader = String.fromCharCode(
                                view.getUint8(offset + 4),
                                view.getUint8(offset + 5),
                                view.getUint8(offset + 6),
                                view.getUint8(offset + 7)
                            );
                            if (exifHeader === 'Exif') {
                                exif['EXIF 数据'] = '存在（' + length + ' 字节）';
                            }
                        }

                        if (marker === 0xD9 || marker === 0xDA) break; // EOI 或 SOS

                        const segmentLength = view.getUint16(offset + 2);
                        offset += 2 + segmentLength;
                    }

                    if (!exif['EXIF 数据']) {
                        exif['EXIF 数据'] = '无或已清除';
                    }

                    resolve(exif);
                };
                img.src = URL.createObjectURL(file);
            };
            reader.readAsArrayBuffer(file);
        });
    };

    // 格式化文件大小
    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // 上传图片
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setImage({
            file,
            url: URL.createObjectURL(file),
            name: file.name,
        });

        const exif = await readExif(file);
        setExifData(exif);
        setIsLoading(false);
    };

    // 清除 EXIF（通过重新绘制到 Canvas）
    const clearExif = () => {
        if (!image) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `clean_${image.name}`;
                a.click();
            }, 'image/jpeg', 0.95);
        };
        img.src = image.url;
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

                    {image && exifData && !exifData.error && (
                        <div className="field">
                            <button className="btn-primary" onClick={clearExif}>
                                🔒 清除元数据并下载
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="exif-content">
                {!image ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🔍</div>
                        <div className="file-zone-text">EXIF 查看器</div>
                        <div className="file-zone-hint">查看和清除图片元数据</div>
                    </div>
                ) : (
                    <div className="exif-layout">
                        {/* 左侧：图片预览 */}
                        <div className="exif-preview">
                            <img src={image.url} alt="preview" />
                        </div>

                        {/* 右侧：EXIF 数据 */}
                        <div className="exif-data">
                            {isLoading ? (
                                <div className="exif-loading">读取中...</div>
                            ) : exifData?.error ? (
                                <div className="exif-error">{exifData.error}</div>
                            ) : (
                                <table className="exif-table">
                                    <tbody>
                                        {Object.entries(exifData || {}).map(([key, value]) => (
                                            <tr key={key}>
                                                <td className="exif-key">{key}</td>
                                                <td className="exif-value">{value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ExifViewer;
