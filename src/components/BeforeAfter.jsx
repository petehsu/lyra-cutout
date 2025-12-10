import React, { useState, useRef, useEffect } from 'react';

/**
 * Before/After 对比滑块
 * - 滑动对比两张图片
 * - 支持水平/垂直方向
 */
const BeforeAfter = () => {
    const [beforeImage, setBeforeImage] = useState(null);
    const [afterImage, setAfterImage] = useState(null);
    const [sliderPos, setSliderPos] = useState(50);
    const [direction, setDirection] = useState('horizontal');
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    // 上传 Before 图片
    const handleBeforeUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBeforeImage({ url: URL.createObjectURL(file), name: file.name });
    };

    // 上传 After 图片
    const handleAfterUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAfterImage({ url: URL.createObjectURL(file), name: file.name });
    };

    // 处理滑动
    const handleMove = (e) => {
        if (!isDragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        let pos;

        if (direction === 'horizontal') {
            pos = ((e.clientX - rect.left) / rect.width) * 100;
        } else {
            pos = ((e.clientY - rect.top) / rect.height) * 100;
        }

        setSliderPos(Math.min(100, Math.max(0, pos)));
    };

    // 触摸事件
    const handleTouchMove = (e) => {
        if (!containerRef.current) return;
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        let pos;

        if (direction === 'horizontal') {
            pos = ((touch.clientX - rect.left) / rect.width) * 100;
        } else {
            pos = ((touch.clientY - rect.top) / rect.height) * 100;
        }

        setSliderPos(Math.min(100, Math.max(0, pos)));
    };

    // 添加全局事件
    useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMove);
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMove);
        };
    }, [isDragging, direction]);

    // 交换图片
    const swapImages = () => {
        const temp = beforeImage;
        setBeforeImage(afterImage);
        setAfterImage(temp);
    };

    return (
        <>
            {/* 控制面板 */}
            <div className="control-panel">
                <div className="control-section">
                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            📷 Before 图片
                            <input type="file" accept="image/*" onChange={handleBeforeUpload} hidden />
                        </label>
                        {beforeImage && <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>✓</span>}
                    </div>

                    <div className="field">
                        <label className="btn-secondary" style={{ display: 'inline-block' }}>
                            📷 After 图片
                            <input type="file" accept="image/*" onChange={handleAfterUpload} hidden />
                        </label>
                        {afterImage && <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>✓</span>}
                    </div>

                    {beforeImage && afterImage && (
                        <>
                            <div className="field">
                                <span className="field-label">方向</span>
                                <div className="mode-selector">
                                    <button
                                        type="button"
                                        className={`mode-btn ${direction === 'horizontal' ? 'active' : ''}`}
                                        onClick={() => setDirection('horizontal')}
                                    >
                                        ↔️ 水平
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-btn ${direction === 'vertical' ? 'active' : ''}`}
                                        onClick={() => setDirection('vertical')}
                                    >
                                        ↕️ 垂直
                                    </button>
                                </div>
                            </div>

                            <div className="field">
                                <button className="btn-secondary" onClick={swapImages}>
                                    🔄 交换
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="compare-content">
                {!beforeImage || !afterImage ? (
                    <div className="empty-state file-zone">
                        <div className="file-zone-icon">🎭</div>
                        <div className="file-zone-text">图片对比</div>
                        <div className="file-zone-hint">上传两张图片进行滑动对比</div>
                    </div>
                ) : (
                    <div
                        ref={containerRef}
                        className={`compare-container ${direction}`}
                        onTouchMove={handleTouchMove}
                    >
                        {/* After 图片（底层） */}
                        <div className="compare-after">
                            <img src={afterImage.url} alt="after" />
                            <span className="compare-label after">After</span>
                        </div>

                        {/* Before 图片（裁剪层） */}
                        <div
                            className="compare-before"
                            style={{
                                clipPath: direction === 'horizontal'
                                    ? `inset(0 ${100 - sliderPos}% 0 0)`
                                    : `inset(0 0 ${100 - sliderPos}% 0)`
                            }}
                        >
                            <img src={beforeImage.url} alt="before" />
                            <span className="compare-label before">Before</span>
                        </div>

                        {/* 滑块 */}
                        <div
                            className="compare-slider"
                            style={{
                                left: direction === 'horizontal' ? `${sliderPos}%` : '50%',
                                top: direction === 'vertical' ? `${sliderPos}%` : '50%',
                                transform: direction === 'horizontal'
                                    ? 'translateX(-50%)'
                                    : 'translateY(-50%) rotate(90deg)'
                            }}
                            onMouseDown={() => setIsDragging(true)}
                            onTouchStart={() => setIsDragging(true)}
                        >
                            <div className="slider-line" style={{
                                width: direction === 'horizontal' ? '2px' : '100%',
                                height: direction === 'horizontal' ? '100%' : '2px',
                            }} />
                            <div className="slider-handle">
                                ◀ ▶
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default BeforeAfter;
