import React, { useState, useRef, useEffect } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// 预设比例
const ASPECT_RATIOS = [
    { label: '自由调整', value: NaN },
    { label: '原始比例', value: 'ORIGINAL' },
    { label: '1:1', value: 1 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '18:9', value: 2 },
    { label: '9:18', value: 0.5 },
    { label: '1.39:1 (证件)', value: 1.39 },
];

const BatchCrop = () => {
    const [images, setImages] = useState([]); // Array<{id, file, url, cropData, aspectRatio}>
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [globalAspectRatio, setGlobalAspectRatio] = useState(NaN);
    const [isSync, setIsSync] = useState(true); // 默认关联
    const [isProcessing, setIsProcessing] = useState(false);
    const cropperRef = useRef(null);

    // 上传处理
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newImages = files.map((file) => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            cropData: null,
            aspectRatio: globalAspectRatio, // 继承当前全局比例
        }));

        setImages((prev) => [...prev, ...newImages]);
    };

    const currentImage = images[selectedIndex];

    // 切换图片
    const handleSelectImage = (index) => {
        // 切换前保存当前 cropper 数据（如果 cropper 存在）
        // 其实 react-cropper 的 onCrop 已经实时更新了 state，不需手动保存
        setSelectedIndex(index);
    };

    // 比例变更
    const handleAspectRatioChange = (ratioValue) => {
        if (ratioValue === 'REFERENCE') {
            // 触发参考图上传逻辑
            document.getElementById('ref-img-upload').click();
            return;
        }

        if (isSync) {
            // 关联模式：应用到所有图片
            setGlobalAspectRatio(ratioValue);
            setImages((prev) =>
                prev.map((img) => ({
                    ...img,
                    aspectRatio: ratioValue === 'ORIGINAL' ? calculateOriginalRatio(img) : ratioValue,
                }))
            );
        } else {
            // 单图模式：只应用到当前
            updateImage(selectedIndex, {
                aspectRatio: ratioValue === 'ORIGINAL' ? calculateOriginalRatio(currentImage) : ratioValue,
            });
        }
    };

    // 辅助：获取图片原始比例（需要图片加载完成，这里简化处理，在 onImageLoaded 获取）
    const calculateOriginalRatio = (img) => {
        // 复杂点：我们可能还没加载图片详情。
        // 简化：传 'ORIGINAL' 字符串给 Cropper 并没有用，Cropper 需要 number。
        // 我们设为 NaN (Free) 但初始化 Box 为全图? 
        // 其实 Cropper 如果设为 NaN 就是自由。用户说“原始比例”通常指锁定为原图的 W/H。
        // 我们暂且用 NaN (自由) 来模拟 "不限制"，或者获取 naturalWidth/Height 设置。
        // 为了体验，"原始比例" 我们设为 null (在 Cropper 里 aspect ratio 为 null 即自由)，
        // 或者是锁定比例为 initialAspectRatio。
        return NaN;
    };

    // 处理参考图上传
    const handleRefUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            const ratio = img.width / img.height;
            handleAspectRatioChange(ratio);
        };
        img.src = URL.createObjectURL(file);
        e.target.value = ''; // reset
    };

    // 更新单个图片状态
    const updateImage = (index, updates) => {
        setImages((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates };
            return next;
        });
    };

    // 使用 Ref 追踪最新的 currentImage，避免闭包陷阱
    const currentImageRef = useRef(currentImage);
    useEffect(() => {
        currentImageRef.current = currentImage;
    }, [currentImage]);

    // 强制应用比例变化
    useEffect(() => {
        if (!currentImage || !cropperRef.current) return;
        const cropper = cropperRef.current.cropper;
        cropper.setAspectRatio(currentImage.aspectRatio);
    }, [currentImage?.aspectRatio]);

    // Cropper 变化回调 (移动/缩放)
    const onCropEnd = () => {
        if (!currentImage || !cropperRef.current) return;
        const cropper = cropperRef.current.cropper;
        const data = cropper.getData();

        // 更新当前图片数据
        updateImage(selectedIndex, { cropData: data });

        // 关联同步逻辑：位置同步
        if (isSync) {
            const imgData = cropper.getImageData();
            // 防御性检查：确保有尺寸数据
            if (!imgData.naturalWidth || !imgData.naturalHeight) return;

            // 计算相对位置（百分比）
            const relativeData = {
                x: data.x / imgData.naturalWidth,
                y: data.y / imgData.naturalHeight,
                width: data.width / imgData.naturalWidth,
                height: data.height / imgData.naturalHeight,
            };

            setImages((prev) =>
                prev.map((img, idx) => {
                    if (idx === selectedIndex) return img; // 当前图不动
                    return {
                        ...img,
                        relativeCropData: relativeData, // 只有非当前图才会被标记需要同步
                        cropData: null, // 清除绝对数据，强迫它下次加载时使用 relativeData 计算
                    };
                })
            );
        }
    };

    // 图片加载完成时（包括切换图片时）
    const onCropperReady = () => {
        if (!cropperRef.current) return;
        const img = currentImageRef.current; // 从 Ref 获取最新状态
        if (!img) return;

        const cropper = cropperRef.current.cropper;
        const imgData = cropper.getImageData(); // 确保此时已拿到新图尺寸

        // 如果有相对位置数据（来自同步），应用它
        if (img.relativeCropData) {
            const newData = {
                x: img.relativeCropData.x * imgData.naturalWidth,
                y: img.relativeCropData.y * imgData.naturalHeight,
                width: img.relativeCropData.width * imgData.naturalWidth,
                height: img.relativeCropData.height * imgData.naturalHeight,
            };
            cropper.setData(newData);
        } else if (img.cropData) {
            cropper.setData(img.cropData);
        }
    };

    // 批量下载
    const handleDownloadAll = async () => {
        setIsProcessing(true);
        const zip = new JSZip();
        const folder = zip.folder('lyra_cropped');

        for (let i = 0; i < images.length; i++) {
            const item = images[i];
            // 我们利用一个临时的 canvas 或者重新利用 cropper 逻辑
            // 由于需要 backend processing，最高效的方式是：
            // 既然我们要在浏览器做，可以创建一个 Image 对象和一个 Canvas 离屏裁剪

            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 获取裁剪数据
                    let crop = item.cropData;
                    if (!crop && item.relativeCropData) {
                        crop = {
                            x: item.relativeCropData.x * img.naturalWidth,
                            y: item.relativeCropData.y * img.naturalHeight,
                            width: item.relativeCropData.width * img.naturalWidth,
                            height: item.relativeCropData.height * img.naturalHeight,
                        };
                    }
                    // 默认全图
                    if (!crop) {
                        crop = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
                    }

                    canvas.width = crop.width;
                    canvas.height = crop.height;

                    // Draw cropped region
                    ctx.drawImage(
                        img,
                        crop.x, crop.y, crop.width, crop.height,
                        0, 0, crop.width, crop.height
                    );

                    canvas.toBlob((blob) => {
                        folder.file(item.file.name, blob);
                        resolve();
                    });
                };
                img.src = item.url;
            });
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'lyra_cropped_images.zip');
        setIsProcessing(false);
    };

    // 删除图片
    const handleDelete = (index, e) => {
        e.stopPropagation();
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
        if (selectedIndex >= newImages.length) {
            setSelectedIndex(Math.max(0, newImages.length - 1));
        }
    };

    return (
        <div className="crop-workspace">
            {/* 1. 左侧列表 */}
            <div className="crop-sidebar">
                <label className="btn-secondary add-btn">
                    <span>+ 添加图片</span>
                    <input type="file" multiple accept="image/*" onChange={handleUpload} hidden />
                </label>
                <div className="scroll-list">
                    {images.map((img, idx) => (
                        <div
                            key={img.id}
                            className={`list-item ${idx === selectedIndex ? 'active' : ''}`}
                            onClick={() => handleSelectImage(idx)}
                        >
                            <img src={img.url} alt="thumb" />
                            <button className="del-btn" onClick={(e) => handleDelete(idx, e)}>×</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. 中间编辑区 */}
            <div className="crop-main">
                {currentImage ? (
                    <Cropper
                        src={currentImage.url}
                        style={{ height: '100%', width: '100%' }}
                        aspectRatio={currentImage.aspectRatio} // 响应式比例
                        guides={true}
                        ref={cropperRef}
                        viewMode={1} // 限制裁剪框在画布内
                        dragMode="move"
                        ready={onCropperReady}
                        cropend={onCropEnd} // 只有手放开才同步，防止卡顿
                    />
                ) : (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">✂️</div>
                        <div className="file-zone-text">批量即时裁剪</div>
                        <div className="file-zone-hint">从左侧添加图片开始</div>
                        <label className="btn-primary" style={{ marginTop: 20, display: 'inline-block' }}>
                            选择图片
                            <input type="file" multiple accept="image/*" onChange={handleUpload} hidden />
                        </label>
                    </div>
                )}
            </div>

            {/* 3. 右侧控制栏 */}
            <div className="crop-controls control-panel">
                <div className="control-section">
                    <h3 className="section-title">裁剪设置</h3>

                    <div className="control-row">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={isSync}
                                onChange={(e) => setIsSync(e.target.checked)}
                            />
                            关联调整 (同步所有图片)
                        </label>
                    </div>

                    <div className="ratio-grid">
                        {ASPECT_RATIOS.map((r) => (
                            <button
                                key={r.label}
                                className={`mode-btn ${((currentImage?.aspectRatio === r.value) || (Number.isNaN(currentImage?.aspectRatio) && Number.isNaN(r.value))) ? 'active' : ''}`}
                                onClick={() => handleAspectRatioChange(r.value)}
                            >
                                {r.label}
                            </button>
                        ))}

                        <button
                            className="mode-btn"
                            onClick={() => handleAspectRatioChange('REFERENCE')}
                        >
                            参考图片...
                        </button>
                        <input
                            type="file"
                            id="ref-img-upload"
                            hidden
                            accept="image/*"
                            onChange={handleRefUpload}
                        />
                    </div>

                    <div className="actions" style={{ marginTop: 'auto' }}>
                        <button
                            className="btn-primary full-width"
                            onClick={handleDownloadAll}
                            disabled={images.length === 0 || isProcessing}
                        >
                            {isProcessing ? '处理中...' : '打包下载全部'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchCrop;
