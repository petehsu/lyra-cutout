import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { removeBackgroundWithAdobe } from './adobeService.js';
import BatchCrop from './components/BatchCrop';
import logoSvg from './logo.svg';

const BRAND = 'Lyra Cutout';
const BRAND_TAGLINE = 'AI 智能抠图工具';
const BACKENDS = {
  adobe: { key: 'adobe', label: 'Adobe Express（免费）' },
  removebg: { key: 'removebg', label: 'remove.bg 云端' },
  local: { key: 'local', label: '本地 rembg' },
};

function ensurePngName(name) {
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  return `${base}.png`;
}

function formatStatus(processing, files, doneCount) {
  if (processing) {
    return `处理中：${doneCount}/${files.length} 张`;
  }
  if (!files.length) return '就绪';
  if (doneCount === files.length && files.length > 0) return '完成';
  return '等待开始';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('remove');
  const [apiKey, setApiKey] = useState('');
  const [backend, setBackend] = useState(BACKENDS.adobe.key);
  // 默认走本地开发代理 /rembg -> http://localhost:7000
  const [localEndpoint, setLocalEndpoint] = useState('/rembg');
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const doneCount = useMemo(
    () => results.filter((r) => r.status === 'done').length,
    [results],
  );

  const statusText = useMemo(
    () => formatStatus(processing, files, doneCount),
    [processing, files, doneCount],
  );

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setResults(
      list.map((file) => ({
        name: file.name,
        status: 'pending',
        url: '',
        blob: null,
        error: '',
      })),
    );
  };

  // 并发控制：限制同时处理的最大数量
  const MAX_CONCURRENCY = 10;

  const start = async () => {
    if (!files.length) return;
    if (backend === BACKENDS.removebg.key && !apiKey.trim()) return;
    if (backend === BACKENDS.local.key && !localEndpoint.trim()) return;
    setProcessing(true);

    // 选择处理函数
    const processFunc = backend === BACKENDS.adobe.key
      ? processWithAdobe
      : (file) => processSingle(file, apiKey.trim());

    // 并发处理：将文件分成多个批次
    const concurrency = Math.min(MAX_CONCURRENCY, files.length);
    const chunks = [];

    // 使用 Promise 池实现并发限制
    const processPool = async () => {
      const executing = new Set();

      for (const file of files) {
        const promise = processFunc(file).finally(() => {
          executing.delete(promise);
        });
        executing.add(promise);

        // 当达到最大并发数时，等待任意一个完成
        if (executing.size >= concurrency) {
          await Promise.race(executing);
        }
      }

      // 等待所有剩余的任务完成
      await Promise.all(executing);
    };

    await processPool();
    setProcessing(false);
  };

  // Adobe Express 处理
  const processWithAdobe = async (file) => {
    setResults((prev) =>
      prev.map((r) =>
        r.name === file.name ? { ...r, status: 'uploading', error: '' } : r,
      ),
    );

    try {
      const blob = await removeBackgroundWithAdobe(file);
      const objectUrl = URL.createObjectURL(blob);
      setResults((prev) =>
        prev.map((r) =>
          r.name === file.name
            ? {
              ...r,
              status: 'done',
              url: objectUrl,
              blob,
              downloadName: ensurePngName(file.name),
            }
            : r,
        ),
      );
    } catch (err) {
      setResults((prev) =>
        prev.map((r) =>
          r.name === file.name
            ? { ...r, status: 'error', error: err.message || '处理失败' }
            : r,
        ),
      );
    }
  };

  const processSingle = async (file, key) => {
    setResults((prev) =>
      prev.map((r) =>
        r.name === file.name ? { ...r, status: 'uploading', error: '' } : r,
      ),
    );

    const formData = new FormData();
    let url = 'https://api.remove.bg/v1.0/removebg';
    const headers = {};
    if (backend === BACKENDS.removebg.key) {
      formData.append('image_file', file, file.name);
      headers['X-Api-Key'] = key;
      // 使用 full 以请求与原图一致的分辨率（remove.bg 免费额度会强制降为 preview）
      formData.append('size', 'full');
      formData.append('type', 'auto');
    } else {
      // rembg 服务器使用 'file' 字段名，端点是 /api/remove
      formData.append('file', file, file.name);
      const base = localEndpoint.trim().replace(/\/$/, '');
      url = `${base}/api/remove`;
    }

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err) {
      setResults((prev) =>
        prev.map((r) =>
          r.name === file.name
            ? { ...r, status: 'error', error: `网络错误：${err.message}` }
            : r,
        ),
      );
      return;
    }

    if (!res.ok) {
      const msg = await safeText(res);
      setResults((prev) =>
        prev.map((r) =>
          r.name === file.name
            ? { ...r, status: 'error', error: `失败 (${res.status}): ${msg || '未知错误'}` }
            : r,
        ),
      );
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    setResults((prev) =>
      prev.map((r) =>
        r.name === file.name
          ? {
            ...r,
            status: 'done',
            url: objectUrl,
            blob,
            downloadName: ensurePngName(file.name),
          }
          : r,
      ),
    );
  };

  const canZipDownload = useMemo(
    () => results.some((r) => r.status === 'done'),
    [results],
  );

  const downloadAll = async () => {
    if (!canZipDownload) return;
    const zip = new JSZip();
    const doneItems = results.filter((r) => r.status === 'done' && r.blob);
    if (!doneItems.length) return;

    doneItems.forEach((item) => {
      zip.file(item.downloadName || ensurePngName(item.name), item.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'lyra-outputs.zip');
  };


  return (
    <div className="app-shell">
      {/* 左侧：主功能区 */}
      <div className="main-content">
        {/* 页头 */}
        <div className="page-header">
          <h1 className="page-title">{BRAND}</h1>
          <span className="page-badge">Beta</span>
        </div>

        {/* Tab 导航 */}
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'remove' ? 'active' : ''}`}
            onClick={() => setActiveTab('remove')}
          >
            智能抠图
          </button>
          <button
            className={`tab-btn ${activeTab === 'crop' ? 'active' : ''}`}
            onClick={() => setActiveTab('crop')}
          >
            批量裁剪
          </button>
        </div>

        {/* 智能抠图模块 */}
        {activeTab === 'remove' && (
          <>
            {/* 控制面板 */}
            <div className="control-panel">
              <div className="control-section">
                {/* 模式选择 */}
                <div className="field">
                  <span className="field-label">处理引擎</span>
                  <div className="mode-selector">
                    <button
                      type="button"
                      className={`mode-btn ${backend === BACKENDS.adobe.key ? 'active' : ''}`}
                      onClick={() => setBackend(BACKENDS.adobe.key)}
                    >
                      ⭐ Adobe（免费）
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${backend === BACKENDS.removebg.key ? 'active' : ''}`}
                      onClick={() => setBackend(BACKENDS.removebg.key)}
                    >
                      remove.bg
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${backend === BACKENDS.local.key ? 'active' : ''}`}
                      onClick={() => setBackend(BACKENDS.local.key)}
                    >
                      本地 rembg
                    </button>
                  </div>
                </div>

                {/* 模式提示/配置 */}
                <div className="control-row">
                  {backend === BACKENDS.adobe.key && (
                    <div className="hint-card success">
                      <span className="hint-icon">✨</span>
                      <span>Adobe Sensei AI · 免费高质量 · 无需 API Key</span>
                    </div>
                  )}

                  {backend === BACKENDS.removebg.key && (
                    <div className="field">
                      <span className="field-label">API Key</span>
                      <input
                        id="apiKey"
                        type="password"
                        placeholder="输入 remove.bg API Key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                  )}

                  {backend === BACKENDS.local.key && (
                    <div className="field">
                      <span className="field-label">服务地址</span>
                      <input
                        id="localEndpoint"
                        type="text"
                        placeholder="例如 http://localhost:7000"
                        value={localEndpoint}
                        onChange={(e) => setLocalEndpoint(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 文件选择区 */}
            <div className="file-zone" onClick={() => document.getElementById('fileInput').click()}>
              <div className="file-zone-icon">📁</div>
              <div className="file-zone-text">点击选择图片或拖拽至此</div>
              <div className="file-zone-hint">支持 PNG、JPG、WebP 等格式，可多选</div>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* 已选文件列表 */}
            {files.length > 0 && (
              <div className="file-list">
                {files.map((f) => (
                  <span className="file-pill" key={f.name}>
                    📄 {f.name}
                  </span>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="action-bar">
              <button
                className="btn-primary"
                onClick={start}
                disabled={
                  processing ||
                  !files.length ||
                  (backend === BACKENDS.removebg.key && !apiKey.trim()) ||
                  (backend === BACKENDS.local.key && !localEndpoint.trim())
                }
              >
                {processing ? '⏳ 处理中…' : '🚀 开始批处理'}
              </button>
              <button
                className="btn-secondary"
                onClick={downloadAll}
                disabled={!canZipDownload}
              >
                📦 下载全部 ZIP
              </button>
              <div className={`status-badge ${processing ? 'processing' : doneCount === files.length && files.length > 0 ? 'done' : ''}`}>
                {statusText}
              </div>
            </div>

            {/* 结果网格 */}
            {results.length > 0 && (
              <div className="results-grid">
                {results.map((item) => (
                  <ResultCard key={item.name} item={item} />
                ))}
              </div>
            )}

            {/* 提示区 */}
            <div className="tips-section">
              · 输出为 <strong>PNG 透明背景</strong>，文件名保持原名<br />
              · 最多 <strong>10 张并发</strong> 处理，高效快速<br />
              {backend === BACKENDS.adobe.key && (
                <>· Adobe Express 使用 <strong>Adobe Sensei AI</strong>，免费且高质量<br /></>
              )}
              {backend === BACKENDS.removebg.key && (
                <>· remove.bg 免费额度有限，付费可获原始分辨率<br /></>
              )}
              {backend === BACKENDS.local.key && (
                <>· 本地 rembg 模式需自行部署服务<br /></>
              )}
            </div>
          </>
        )}

        {/* 批量裁剪模块 */}
        {activeTab === 'crop' && <BatchCrop />}
      </div>

      {/* 右侧：品牌展示区 */}
      <aside className="brand-panel">
        <div className="brand-logo">
          <img src={logoSvg} alt="Lyra Cutout Logo" />
        </div>
        <h2 className="brand-title">{BRAND}</h2>
        <p className="brand-tagline">
          {activeTab === 'remove' ? (
            <>{BRAND_TAGLINE}<br />批量移除图片背景，一键导出透明 PNG</>
          ) : (
            <>批量图片裁剪工具<br />统一比例，关联调整，高效处理</>
          )}
        </p>
        <div className="brand-features">
          {activeTab === 'remove' ? (
            <>
              <div className="brand-feature">
                <span className="brand-feature-icon">⚡</span>
                <span>10 张并发，极速处理</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">🎨</span>
                <span>多引擎支持，自由选择</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">📦</span>
                <span>批量下载，保留原名</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">🔒</span>
                <span>本地处理，隐私安全</span>
              </div>
            </>
          ) : (
            <>
              <div className="brand-feature">
                <span className="brand-feature-icon">✂️</span>
                <span>专业预设比例</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">🔗</span>
                <span>关联调整，同步所有图片</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">📦</span>
                <span>打包下载，保留原名</span>
              </div>
              <div className="brand-feature">
                <span className="brand-feature-icon">🔒</span>
                <span>浏览器本地处理</span>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function ResultCard({ item }) {
  return (
    <div className="result-card">
      {item.url ? (
        <img className="result-thumb" src={item.url} alt={item.name} />
      ) : (
        <div className="result-thumb-placeholder">
          {item.status === 'uploading'
            ? '⏳ 上传中…'
            : item.status === 'pending'
              ? '⏸️ 等待处理'
              : item.status === 'error'
                ? '❌ 处理失败'
                : '⚙️ 处理中…'}
        </div>
      )}
      <div className="result-info">
        <div className="result-name">{ensurePngName(item.name || '')}</div>
        {item.url && (
          <div className="result-actions">
            <a href={item.url} download={item.downloadName} className="result-btn">
              📥 下载
            </a>
          </div>
        )}
        {item.error && <div className="result-error">{item.error}</div>}
      </div>
    </div>
  );
}

async function safeText(res) {
  try {
    return await res.text();
  } catch (err) {
    return err.message || '';
  }
}

