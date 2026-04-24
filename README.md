# 🌾 Farming Subtitles

**Local AI subtitle translation for YouTube. Safe, private, and steady. Just like farming.**

本機 AI YouTube 字幕翻譯工具。安全私密，一步一步來，就像耕田一樣。

---

## ✨ Features / 功能

- 🎬 Real-time YouTube subtitle translation / 即時翻譯 YouTube 字幕
- 🔒 100% local AI — your data never leaves your device / 完全本機 AI，資料不會離開你的電腦
- 🌿 Bilingual display — Traditional Chinese above English subtitles / 雙語顯示，繁中緊貼英文字幕上方
- ⚡ Smart debounce — waits for complete sentences before translating / 智能防抖，等待完整句子才翻譯
- 💾 Translation cache — faster repeated content / 翻譯快取，重複內容更快
- ⏸️ Pause button — toggle translation on/off anytime / 暫停按鈕，隨時開關翻譯
- 🔄 Auto-reset on video switch / 切換影片自動重置

---

## 🛠️ Requirements / 系統需求

- Google Chrome browser / Google Chrome 瀏覽器
- [LM Studio](https://lmstudio.ai/) (free) / LM Studio（免費）
- Recommended model / 推薦模型：`Phi-4-mini-instruct` (Q4_K_M)
- At least 8GB RAM / 至少 8GB 記憶體
- GPU recommended for faster translation / 建議有 GPU 以獲得更快的翻譯速度

---

## 📦 Installation / 安裝步驟

### Step 1 — Set up LM Studio / 設定 LM Studio

1. Download and install [LM Studio](https://lmstudio.ai/).
2. Search for `Phi-4-mini-instruct` in the Discover tab.
3. Download the `Q4_K_M` version from `lmstudio-community`.
4. Go to the Developer tab and load the model.
5. Start the local server (default port: `1234`).

---

1. 下載並安裝 [LM Studio](https://lmstudio.ai/)。
2. 在 Discover 頁搜尋 `Phi-4-mini-instruct`。
3. 下載 `lmstudio-community` 的 `Q4_K_M` 版本。
4. 進入 Developer 頁，載入模型。
5. 啟動本機 server（預設 port：`1234`）。

---

### Step 2 — Install the Extension / 安裝 Extension

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked**.
5. Select the folder containing this extension.

---

1. 下載或 clone 這個 repository。
2. 打開 Chrome，前往 `chrome://extensions/`。
3. 開啟右上角的**開發人員模式**。
4. 點擊**載入未封裝項目**。
5. 選擇這個 extension 的資料夾。

---

### Step 3 — Watch YouTube / 觀看 YouTube

1. Go to any YouTube video with English subtitles.
2. Enable subtitles (CC button).
3. Traditional Chinese translation will appear above the English subtitles.

---

1. 前往任何有英文字幕的 YouTube 影片。
2. 開啟字幕（CC 按鈕）。
3. 繁體中文翻譯會顯示在英文字幕上方。

---

## 🎮 Usage / 使用方式

| Feature / 功能 | How to use / 使用方式 |
|---|---|
| Pause translation / 暫停翻譯 | Click the **譯 ON** button (bottom right) / 點擊右下角的**譯 ON** 按鈕 |
| Resume translation / 恢復翻譯 | Click the **譯 OFF** button / 點擊**譯 OFF** 按鈕 |
| Switch video / 切換影片 | Automatic reset / 自動重置 |

---

## 🏗️ Tech Stack / 技術架構

- Chrome Extension (Manifest V3)
- Local LLM via [LM Studio](https://lmstudio.ai/) API
- Streaming translation for faster response
- DOM-based subtitle detection
- Page bridge for YouTube player metadata

---

## ⚠️ Known Limitations / 已知限制

- Requires LM Studio running locally / 需要本機運行 LM Studio
- Works best with English subtitles / 最適合英文字幕
- Auto-generated (ASR) subtitles may have lower accuracy / 自動產生字幕的準確度較低
- Translation speed depends on your hardware / 翻譯速度取決於你的硬體

---

## 📄 License / 授權

MIT License — feel free to use, modify, and share.

MIT 授權 — 歡迎自由使用、修改和分享。

---

## 🌾 About the Name / 關於名字

*Farming Subtitles* is inspired by the idea that good translation, like good farming, takes patience — one row at a time.

*Farming Subtitles* 的名字靈感來自「好的翻譯就像耕田，需要耐心，一步一步來」。
