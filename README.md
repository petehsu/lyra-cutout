<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-light.svg" width="120">
    <source media="(prefers-color-scheme: light)" srcset="assets/logo-dark.svg" width="120">
    <img alt="Lyra Cutout Logo" src="assets/logo-dark.svg" width="120">
  </picture>
</p>

<h1 align="center">Lyra Cutout</h1>

<p align="center">
  <strong>AI-Powered Batch Background Removal Tool</strong>
</p>

<p align="center">
  <a href="README_CN.md">🇨🇳 中文文档</a> •
  <a href="https://lyra-cutout.pages.dev/" target="_blank">🌟 Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage-guide">Usage Guide</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite&logoColor=white" alt="Vite">
</p>

<p align="center">
  <!-- Live Demo Badge -->
  <a href="https://lyra-cutout.pages.dev/" target="_blank">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Flyra-cutout.pages.dev%2F&up_message=online&down_message=offline&label=Live%20Demo&style=for-the-badge&logo=vercel&logoColor=white&color=success" alt="Live Demo">
  </a>
  <!-- Deploy Badge -->
  <a href="https://deploy.cloudflare.com/?url=https://github.com/petehsu/lyra-cutout" target="_blank">
    <img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy to Cloudflare Pages">
  </a>
</p>

---

## ⚠️ Disclaimer

**This project is for educational and learning purposes only. Commercial use is strictly prohibited.**

This tool leverages third-party AI services (Adobe Sensei, remove.bg). Please comply with the respective service terms and conditions. The author assumes no responsibility for any misuse or violation of third-party terms.

---

## ✨ Features

- 🎨 **Three Processing Engines** - Adobe Express (Free), remove.bg (API), Local rembg
- ⚡ **Batch Processing** - Up to 10 images processed concurrently
- 📦 **Bulk Download** - Download all results as a ZIP file with original filenames
- 🔒 **Privacy-First** - All processing happens in your browser
- 🎯 **High Quality** - Powered by Adobe Sensei AI technology
- 💰 **Free to Use** - Adobe mode requires no API key or registration

## ✂️ Batch Cropping Tool (New)

Lyra Cutout now features a powerful **Batch Cropping Module**, allowing you to process images locally without uploading:
- **Batch Management**: Import multiple images at once and manage them in a list.
- **Synced Adjustment**: Unique "Sync" feature—adjust one image's crop box (ratio/relative position), and all other images sync automatically. Perfect for e-commerce/ID photos.
- **Professional Presets**: Built-in 1:1, 4:3, 16:9, 2.35:1 (Cinematic), and more.
- **Privacy First**: Powered by browser Canvas technology, all cropping is done locally. Fast and data-saving.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/petehalverson/lyra-cutout.git
cd lyra-cutout

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 📖 Usage Guide

Lyra Cutout supports three background removal engines. Choose the one that best fits your needs:

### Option 1: Adobe Express (Recommended) ⭐

**Best for:** Free, high-quality results without any setup

1. Select **"⭐ Adobe (Free)"** mode
2. Upload your images (supports multiple selection)
3. Click **"🚀 Start Batch Processing"**
4. Download individual results or ZIP all

**Pros:**
- ✅ Completely free
- ✅ No API key required
- ✅ No registration needed
- ✅ High-quality Adobe Sensei AI
- ✅ Up to 10 concurrent processing

**Cons:**
- ⚠️ Requires internet connection
- ⚠️ May have rate limits

---

### Option 2: remove.bg API

**Best for:** Professional use with paid API access

1. Get your API key from [remove.bg](https://www.remove.bg/api)
2. Select **"remove.bg"** mode
3. Enter your API key
4. Upload and process images

**Pros:**
- ✅ Consistent quality
- ✅ Full resolution output (with paid plan)
- ✅ Professional API support

**Cons:**
- ⚠️ Requires API key
- ⚠️ Free tier has limited credits
- ⚠️ API key exposed in browser (use backend proxy for production)

---

### Option 3: Local rembg Server

**Best for:** Offline processing, privacy-sensitive workflows, unlimited usage

This option requires setting up a local rembg server. Here's how:

#### Step 1: Install rembg

```bash
# Using pip
pip install rembg[gpu]  # For GPU support
# or
pip install rembg        # CPU only

# Using Docker (recommended)
docker pull danielgatis/rembg
```

#### Step 2: Start the Server

**Using Python:**

```bash
# Start rembg server on port 7000
rembg s --host 0.0.0.0 --port 7000
```

**Using Docker:**

```bash
docker run -d -p 7000:5000 danielgatis/rembg s
```

#### Step 3: Configure in Lyra Cutout

1. Select **"Local rembg"** mode
2. Enter server address: `http://localhost:7000` (or `/rembg` if using dev proxy)
3. Upload and process images

**Pros:**
- ✅ No internet required
- ✅ Complete privacy
- ✅ Unlimited processing
- ✅ No API keys needed

**Cons:**
- ⚠️ Requires local setup
- ⚠️ GPU recommended for speed
- ⚠️ Quality depends on model

#### Advanced: Using GPU Acceleration

For faster processing, use CUDA GPU:

```bash
# Install with ONNX GPU support
pip install rembg[gpu] onnxruntime-gpu

# Verify GPU detection
python -c "import onnxruntime; print(onnxruntime.get_device())"
```

---

## 🔬 Technical Implementation (Adobe Method)

A key feature of this project is the integration of the Adobe Express free background removal API via reverse engineering.

### 1. Anonymous Authentication (Guest Token)

Adobe Express allows guest usage. By analyzing network traffic, we identified an OAuth guest flow:
- **Endpoint**: `POST /ims/check/v6/token`
- **Params**: `guest_allowed=true`, `client_id=quickactions_hz_webapp`
- **Result**: Obtains a temporary `access_token`.

### 2. CORS & Request Forgery (Vite Proxy)

Direct browser calls to Adobe APIs fail due to CORS. The project uses Vite's proxy (`vite.config.js`) to:
- Forward frontend requests from `/adobe-api` to `https://sensei.adobe.io`.
- Inject necessary headers to spoof the origin:
  - `Origin: https://quick-actions.express.adobe.com`
  - `Referer: https://quick-actions.express.adobe.com/`

### 3. Sensei API Interaction

The Adobe Sensei API returns a **Mask** (black & white image) instead of a transparent PNG.
- **Request**: `multipart/form-data` with JSON config and the source image.
- **Response**: A multipart response containing the mask as a JPEG.

### 4. Client-Side Composition

The final transparent image is composited entirely in the browser using the Canvas API:
1. Draw original image to Canvas.
2. Fetch the Mask image pixel data.
3. Update the Alpha channel of the original image based on the Mask's grayscale values (Black = Transparent, White = Opaque).
4. Export as PNG Blob.

This approach leverages Adobe's powerful AI while keeping image processing client-side (via proxy), ensuring privacy and speed.

---

## 🏗️ Project Structure

```
lyra-cutout/
├── src/
│   ├── App.jsx           # Main React component
│   ├── adobeService.js   # Adobe Sensei API integration
│   ├── theme.css         # Styling (notepad aesthetic)
│   ├── logo.svg          # App logo
│   └── main.jsx          # Entry point
├── assets/
│   ├── logo-light.svg    # Logo for dark mode
│   └── logo-dark.svg     # Logo for light mode
├── index.html            # HTML template
├── vite.config.js        # Vite configuration with proxies
└── package.json
```

---

## 🔧 Development

### Vite Proxy Configuration

The development server includes proxies for Adobe API and local rembg:

```javascript
// vite.config.js
proxy: {
  '/adobe-api': {
    target: 'https://sensei.adobe.io',
    changeOrigin: true,
    // ... headers for Adobe Express
  },
  '/rembg': {
    target: 'http://localhost:7000',
    changeOrigin: true,
  }
}
```

### Build for Production

```bash
npm run build
npm run preview
```

> ⚠️ **Note:** Production deployment requires a backend proxy to handle Adobe API requests, as CORS headers cannot be set from the browser.

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**.

### You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

### Under the following terms:

- **Attribution** — You must give appropriate credit
- **NonCommercial** — You may not use the material for commercial purposes
- **ShareAlike** — If you remix, you must distribute under the same license

See [LICENSE](LICENSE) for the full license text.

---

## 🙏 Acknowledgments

- [Adobe Sensei](https://www.adobe.com/sensei.html) - AI background removal technology
- [remove.bg](https://www.remove.bg) - Professional background removal API
- [rembg](https://github.com/danielgatis/rembg) - Open source background removal tool
- [React](https://reactjs.org) & [Vite](https://vitejs.dev) - Frontend framework and build tool

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit Issues and Pull Requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<p align="center">
  Made with ❤️ for the open source community
</p>

<p align="center">
  <strong>⚠️ For Educational Use Only - Not for Commercial Use ⚠️</strong>
</p>
