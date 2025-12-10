<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-light.svg" width="120">
    <source media="(prefers-color-scheme: light)" srcset="assets/logo-dark.svg" width="120">
    <img alt="Lyra Cutout Logo" src="assets/logo-dark.svg" width="120">
  </picture>
</p>

<h1 align="center">Lyra Cutout</h1>

<p align="center">
  <strong>AI 智能批量抠图工具</strong>
</p>

<p align="center">
  <a href="README.md">🇺🇸 English</a> •
  <a href="https://lyra-cutout.pages.dev/" target="_blank">🌟 在线演示</a> •
  <a href="#功能特点">功能特点</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用指南">使用指南</a> •
  <a href="#许可证">许可证</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite&logoColor=white" alt="Vite">
</p>

<p align="center">
  <!-- Live Demo Badge -->
  <a href="https://lyra-cutout.pages.dev/" target="_blank">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Flyra-cutout.pages.dev%2F&up_message=%E5%9C%A8%E7%BA%BF&down_message=%E7%A6%BB%E7%BA%BF&label=%E5%9C%A8%E7%BA%BF%E6%BC%94%E7%A4%BA&style=for-the-badge&logo=vercel&logoColor=white&color=success" alt="Live Demo">
  </a>
  <!-- Deploy Badge -->
  <a href="https://deploy.cloudflare.com/?url=https://github.com/petehsu/lyra-cutout" target="_blank">
    <img src="https://img.shields.io/badge/%E4%B8%80%E9%94%AE%E9%83%A8%E7%BD%B2-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy to Cloudflare Pages">
  </a>
</p>

---

## ⚠️ 免责声明

**本项目仅供学习交流使用，严禁用于商业用途。**

本工具使用第三方 AI 服务（Adobe Sensei、remove.bg）。请遵守相关服务条款和使用条件。作者不对任何滥用或违反第三方条款的行为承担责任。

---

## ✨ 功能特点

- 🎨 **三种处理引擎** - Adobe Express（免费）、remove.bg（API）、本地 rembg
- ⚡ **批量处理** - 最多 10 张图片同时并发处理
- 📦 **批量下载** - 一键打包下载所有结果，保留原始文件名
- 🔒 **隐私优先** - 所有处理都在浏览器中完成
- 🎯 **高质量** - 采用 Adobe Sensei AI 技术
- 💰 **免费使用** - Adobe 模式无需 API 密钥或注册

---

## 🚀 快速开始

### 环境要求

- Node.js 18+ 和 npm

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/petehalverson/lyra-cutout.git
cd lyra-cutout

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

在浏览器中打开 http://localhost:5173

---

## 📖 使用指南

Lyra Cutout 支持三种背景移除引擎。根据您的需求选择最适合的：

### 方案一：Adobe Express（推荐）⭐

**适用场景：** 免费、高质量，无需任何设置

1. 选择 **"⭐ Adobe（免费）"** 模式
2. 上传图片（支持多选）
3. 点击 **"🚀 开始批处理"**
4. 下载单个结果或打包下载

**优点：**
- ✅ 完全免费
- ✅ 无需 API 密钥
- ✅ 无需注册账号
- ✅ Adobe Sensei AI 高质量输出
- ✅ 最多 10 张并发处理

**缺点：**
- ⚠️ 需要网络连接
- ⚠️ 可能存在速率限制

---

### 方案二：remove.bg API

**适用场景：** 专业用途，需付费 API 访问

1. 从 [remove.bg](https://www.remove.bg/api) 获取 API 密钥
2. 选择 **"remove.bg"** 模式
3. 输入 API 密钥
4. 上传并处理图片

**优点：**
- ✅ 质量稳定
- ✅ 原始分辨率输出（付费计划）
- ✅ 专业 API 支持

**缺点：**
- ⚠️ 需要 API 密钥
- ⚠️ 免费额度有限
- ⚠️ 浏览器中会暴露 API 密钥（生产环境建议使用后端代理）

---

### 方案三：本地 rembg 服务器

**适用场景：** 离线处理、注重隐私、无限量使用

此选项需要设置本地 rembg 服务器。以下是详细步骤：

#### 步骤一：安装 rembg

```bash
# 使用 pip 安装
pip install rembg[gpu]  # GPU 支持
# 或者
pip install rembg        # 仅 CPU

# 使用 Docker（推荐）
docker pull danielgatis/rembg
```

#### 步骤二：启动服务

**使用 Python：**

```bash
# 在 7000 端口启动 rembg 服务器
rembg s --host 0.0.0.0 --port 7000
```

**使用 Docker：**

```bash
docker run -d -p 7000:5000 danielgatis/rembg s
```

#### 步骤三：在 Lyra Cutout 中配置

1. 选择 **"本地 rembg"** 模式
2. 输入服务地址：`http://localhost:7000`（或开发代理使用 `/rembg`）
3. 上传并处理图片

**优点：**
- ✅ 无需网络
- ✅ 完全隐私
- ✅ 无限量处理
- ✅ 无需 API 密钥

**缺点：**
- ⚠️ 需要本地部署
- ⚠️ 建议使用 GPU 加速
- ⚠️ 质量取决于模型

#### 进阶：使用 GPU 加速

为获得更快的处理速度，使用 CUDA GPU：

```bash
# 安装带 ONNX GPU 支持的版本
pip install rembg[gpu] onnxruntime-gpu

# 验证 GPU 检测
python -c "import onnxruntime; print(onnxruntime.get_device())"
```

---

## 🔬 技术实现原理 (Adobe 方案)

本项目的一个核心亮点是逆向并集成了 Adobe Express 的免费抠图 API。实现流程如下：

### 1. 匿名认证 (Guest Token)

Adobe Express 允许未登录用户试用。通过分析网络请求，发现其使用 OAuth 访客模式：

- **端点**: `POST /ims/check/v6/token`
- **参数**: `guest_allowed=true`, `client_id=quickactions_hz_webapp`
- **结果**: 获取一个临时的 `access_token`，有效期通常为 24 小时。

### 2. CORS 与请求伪造 (Vite Proxy)

直接在浏览器调用 Adobe API 会触发 CORS 错误，且无法修改 `Origin` 和 `Referer` 头。
项目利用 Vite 的代理功能 (`vite.config.js`)：

- 前端请求 `/adobe-api` → 代理转发至 `https://sensei.adobe.io`
- 代理服务器自动注入以下 Headers 欺骗服务器：
  - `Origin: https://quick-actions.express.adobe.com`
  - `Referer: https://quick-actions.express.adobe.com/`

### 3. Sensei API 交互

Adobe Sensei API 不直接返回透明 PNG，而是返回原图的 **Mask（遮罩层）**。

- **请求**: `multipart/form-data`，包含 JSON 配置 (`contentAnalyzerRequests`) 和图片文件。
- **响应**: 一个多部分响应，其中一部分是 JPEG 格式的黑白 Mask 图片。

### 4. 前端图像合成

最终的透明图片完全在浏览器端通过 Canvas API 合成：

1. 创建 `<canvas>`，尺寸与原图一致。
2. 绘制原图到 Canvas。
3. 获取 Mask 图片的像素数据。
4. 遍历像素，将原图 Alpha 通道根据 Mask 的灰度值进行更新（黑色=透明，白色=保留）。
5. 导出为 PNG Blob。

这种方式既利用了 Adobe 强大的 AI 能力，又避免了将原图暴露给非官方的后端服务，最大程度保证了隐私和速度。

---#### 常见问题

**Q: rembg 服务器启动失败？**
```bash
# 检查端口是否被占用
lsof -i :7000

# 使用其他端口
rembg s --port 8000
```

**Q: 处理速度很慢？**
- 确保安装了 GPU 版本
- 检查 CUDA 是否正确配置
- 考虑使用更快的模型：`rembg s -m u2netp`

**Q: 内存不足？**
- 使用轻量模型：`rembg s -m u2netp`
- 降低图片分辨率后处理

---

## 🏗️ 项目结构

```
lyra-cutout/
├── src/
│   ├── App.jsx           # 主 React 组件
│   ├── adobeService.js   # Adobe Sensei API 集成
│   ├── theme.css         # 样式（本子风格）
│   ├── logo.svg          # 应用图标
│   └── main.jsx          # 入口文件
├── assets/
│   ├── logo-light.svg    # 深色模式 Logo
│   └── logo-dark.svg     # 浅色模式 Logo
├── index.html            # HTML 模板
├── vite.config.js        # Vite 配置（含代理）
└── package.json
```

---

## 🔧 开发指南

### Vite 代理配置

开发服务器包含 Adobe API 和本地 rembg 的代理：

```javascript
// vite.config.js
proxy: {
  '/adobe-api': {
    target: 'https://sensei.adobe.io',
    changeOrigin: true,
    // ... Adobe Express 所需的 headers
  },
  '/rembg': {
    target: 'http://localhost:7000',
    changeOrigin: true,
  }
}
```

### 生产构建

```bash
npm run build
npm run preview
```

> ⚠️ **注意：** 生产部署需要后端代理来处理 Adobe API 请求，因为浏览器无法设置 CORS headers。

---

## 📄 许可证

本项目采用 **知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议 (CC BY-NC-SA 4.0)**。

### 您可以自由地：

- **共享** — 在任何媒介或格式中复制、发行本作品
- **演绎** — 修改、转换或以本作品为基础进行创作

### 须遵循以下条款：

- **署名** — 您必须给出适当的署名
- **非商业性使用** — 您不得将本作品用于商业目的
- **相同方式共享** — 如果您再混合、转换或者基于本作品进行创作，必须基于相同的许可协议发布

完整许可证文本请查看 [LICENSE](LICENSE)。

---

## 🙏 致谢

- [Adobe Sensei](https://www.adobe.com/sensei.html) - AI 背景移除技术
- [remove.bg](https://www.remove.bg) - 专业背景移除 API
- [rembg](https://github.com/danielgatis/rembg) - 开源背景移除工具
- [React](https://reactjs.org) & [Vite](https://vitejs.dev) - 前端框架和构建工具

---

## 🤝 参与贡献

欢迎贡献！请随时提交 Issues 和 Pull Requests。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

<p align="center">
  用 ❤️ 为开源社区制作
</p>

<p align="center">
  <strong>⚠️ 仅供学习交流，禁止商业使用 ⚠️</strong>
</p>
