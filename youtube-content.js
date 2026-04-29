console.log("youtube-content.js loaded");

function injectPageBridge() {
  const existing = document.getElementById("yt-page-bridge-script");
  if (existing) return;

  const script = document.createElement("script");
  script.id = "yt-page-bridge-script";
  script.src = chrome.runtime.getURL("yt-page-bridge.js");
  script.onload = () => {
    script.remove();
  };

  (document.head || document.documentElement).appendChild(script);
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "YT_PAGE_BRIDGE") return;

  if (event.data.type === "CAPTION_TRACKS_RESULT") {
    console.log("page world captionTracks：", event.data.payload);

    const tracks = event.data.payload || [];
    if (!tracks.length) {
      console.log("沒有可用字幕軌");
      return;
    }

    const preferredTrack =
      tracks.find((track) => track.languageCode === "en" && track.kind !== "asr") ||
      tracks.find((track) => track.languageCode === "en") ||
      tracks[0];

    console.log("選用字幕軌：", preferredTrack);
    console.log("字幕 baseUrl：", preferredTrack.baseUrl);
    isAsrTrack = !!preferredTrack && preferredTrack.kind === "asr";
    console.log("目前字幕是否為 ASR：", isAsrTrack);

    try {
      const debugUrl = new URL(preferredTrack.baseUrl);
      console.log(
        "baseUrl query params：",
        Object.fromEntries(debugUrl.searchParams.entries())
      );
    } catch (error) {
      console.warn("baseUrl 解析失敗：", error);
    }
  }

  if (event.data.type === "PAGE_FETCH_DEBUG") {
    console.log("page world fetch debug：", event.data.payload);
  }

  if (event.data.type === "PAGE_FETCH_RESULT") {
    console.log("page world fetch result：", event.data.payload);
  }

  if (event.data.type === "PAGE_FETCH_ERROR") {
    console.error("page world fetch error：", event.data.payload);
  }

  if (event.data.type === "CAPTION_TRACKS_ERROR") {
    console.error("page world 讀取失敗：", event.data.payload);
  }
});

setTimeout(() => {
  injectPageBridge();
}, 3000);

// 監聽 YouTube SPA 切換影片
window.addEventListener("yt-navigate-finish", () => {
  resetState();
});

// ===== 全域變數（只宣告一次）=====
let lastSubtitleText = "";
let lastStableSubtitle = "";
let lastOutputTime = 0;
let overlay = null;
let isAsrTrack = false;
let streamingBuffer = "";
let isStreaming = false;
let currentTranslatingText = "";
let isPaused = false;
let pauseButton = null;
let subtitleDebounceTimer = null;
let lastSentSubtitle = "";
let pendingSubtitle = "";
let errorTimer = null;

function resetState() {
  console.log("YouTube 影片切換，重置狀態");

  lastSubtitleText = "";
  lastStableSubtitle = "";
  lastOutputTime = 0;
  isAsrTrack = false;
  streamingBuffer = "";
  isStreaming = false;
  currentTranslatingText = "";
  lastSentSubtitle = "";
  pendingSubtitle = "";

  if (subtitleDebounceTimer) {
    clearTimeout(subtitleDebounceTimer);
    subtitleDebounceTimer = null;
  }

  if (errorTimer) {
    clearTimeout(errorTimer);
    errorTimer = null;
  }

  hideTranslation();

  const existing = document.getElementById("yt-page-bridge-script");
  if (existing) existing.remove();

  setTimeout(() => {
    injectPageBridge();
  }, 2000);
}

const translationCache = new Map();

// ===== 字幕抓取與清洗 =====

function getCurrentSubtitleText() {
  const captionWindow = document.querySelector(".ytp-caption-window-container");

  if (!captionWindow) {
    return "";
  }

  const segments = captionWindow.querySelectorAll(".ytp-caption-segment");

  if (!segments || segments.length === 0) {
    return "";
  }

  const raw = Array.from(segments)
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join(" ");

  return cleanSubtitleText(raw);
}

function cleanSubtitleText(raw) {
  if (!raw) return "";

  let text = raw;

  const noisePatterns = [
    "英文 (自動產生)",
    "English (auto-generated)",
    "按一下 進入設定",
    "點選 進入設定",
    "Press c to toggle captions",
    "字幕",
    "自動產生",
    "English (United States)",
    "語言",
    "設定",
    "開啟自動翻譯",
    "關閉自動翻譯"
  ];

  for (const pattern of noisePatterns) {
    text = text.replace(pattern, "");
  }

  text = text.replace(/\s+/g, " ").trim();

  if (!text && raw.length <= 40) {
    console.log("疑似 UI 但未被清掉的字幕片段：", raw);
  }

  return text;
}

// ===== Overlay 顯示 =====

function ensureOverlay() {
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "yt-translation-overlay";
  overlay.style.position = "fixed";
  overlay.style.left = "50%";
  overlay.style.bottom = "110px";
  overlay.style.transform = "translateX(-50%)";
  overlay.style.transition = "bottom 0.1s ease, opacity 0.15s ease";
  overlay.style.zIndex = "999999";
  overlay.style.maxWidth = "70vw";
  overlay.style.minWidth = "240px";
  overlay.style.padding = "6px 14px";
  overlay.style.background = "rgba(0, 0, 0, 0.55)";
  overlay.style.color = "#ffffff";
  overlay.style.borderRadius = "10px";
  overlay.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
  overlay.style.fontSize = "24px";
  overlay.style.fontWeight = "600";
  overlay.style.lineHeight = "1.5";
  overlay.style.textAlign = "center";
  overlay.style.whiteSpace = "normal";
  overlay.style.pointerEvents = "none";
  overlay.style.fontFamily =
    "'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', Arial, sans-serif";
  overlay.style.textShadow = "0 2px 6px rgba(0,0,0,0.9)";
  overlay.style.transition = "opacity 0.15s ease";
  overlay.style.opacity = "0";

  document.body.appendChild(overlay);
  return overlay;
}

function updateOverlayPosition() {
  if (!overlay) return;

  const captionWindow = document.querySelector(".caption-window");
  if (!captionWindow) return;

  const captionRect = captionWindow.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  if (captionRect.height === 0) return;

  // 垂直：貼在字幕上方 8px
  const newBottom = Math.round(viewportHeight - captionRect.top + 8);
  overlay.style.bottom = `${newBottom}px`;

  // 水平：對齊字幕的水平中心，而不是 viewport 中心
  const captionCenterX = captionRect.left + captionRect.width / 2;
  overlay.style.left = `${captionCenterX}px`;
  overlay.style.transform = "translateX(-50%)";

  // 寬度：最多和字幕一樣寬，不要更寬
  const maxWidth = Math.min(captionRect.width + 40, window.innerWidth * 0.7);
  overlay.style.maxWidth = `${maxWidth}px`;
}

function ensurePauseButton() {
  if (pauseButton) return pauseButton;

  pauseButton = document.createElement("div");
  pauseButton.id = "yt-translation-pause-btn";
  pauseButton.textContent = "譯 ON";
  pauseButton.style.position = "fixed";
  pauseButton.style.bottom = "160px";
  pauseButton.style.right = "20px";
  pauseButton.style.zIndex = "999999";
  pauseButton.style.padding = "4px 10px";
  pauseButton.style.background = "rgba(0, 0, 0, 0.5)";
  pauseButton.style.color = "#ffffff";
  pauseButton.style.borderRadius = "6px";
  pauseButton.style.fontSize = "12px";
  pauseButton.style.fontWeight = "600";
  pauseButton.style.cursor = "pointer";
  pauseButton.style.userSelect = "none";
  pauseButton.style.opacity = "0.4";
  pauseButton.style.transition = "opacity 0.2s ease";
  pauseButton.style.fontFamily = "Arial, sans-serif";
  pauseButton.style.pointerEvents = "auto";

  pauseButton.addEventListener("mouseenter", () => {
    pauseButton.style.opacity = "1";
  });

  pauseButton.addEventListener("mouseleave", () => {
    pauseButton.style.opacity = isPaused ? "1" : "0.4";
  });

  pauseButton.addEventListener("click", () => {
    isPaused = !isPaused;

    if (isPaused) {
      pauseButton.textContent = "譯 OFF";
      pauseButton.style.opacity = "1";
      pauseButton.style.background = "rgba(180, 0, 0, 0.7)";
      hideTranslation();
    } else {
      pauseButton.textContent = "譯 ON";
      pauseButton.style.opacity = "0.4";
      pauseButton.style.background = "rgba(0, 0, 0, 0.5)";
    }
  });

  document.body.appendChild(pauseButton);
  return pauseButton;
}

function showTranslation(translation) {
  const box = ensureOverlay();
  box.textContent = translation;
  box.style.opacity = "1";
  updateOverlayPosition();
}

function showError(message) {
  const box = ensureOverlay();
  box.textContent = message;
  box.style.opacity = "1";
  box.style.background = "rgba(180, 0, 0, 0.75)";

  if (errorTimer) {
    clearTimeout(errorTimer);
  }

  errorTimer = setTimeout(() => {
    box.style.background = "rgba(0, 0, 0, 0.55)";
    hideTranslation();
    errorTimer = null;
  }, 4000);
}

function hideTranslation() {
  if (!overlay) return;
  overlay.style.opacity = "0";
}

// ===== Streaming 接收 =====

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "YT_SUBTITLE_STREAM_START") {
    streamingBuffer = "";
    isStreaming = true;
    return;
  }

    if (message.type === "YT_SUBTITLE_STREAM_CHUNK") {
        if (message.done) {
      isStreaming = false;
      currentTranslatingText = "";

      if (streamingBuffer) {
        showTranslation(streamingBuffer);
        translationCache.set(lastStableSubtitle, streamingBuffer);
      }

      // 如果有排隊的字幕，立刻送去翻譯
      if (pendingSubtitle && pendingSubtitle !== lastSentSubtitle) {
        const toTranslate = pendingSubtitle;
        pendingSubtitle = "";

        if (translationCache.has(toTranslate)) {
          showTranslation(translationCache.get(toTranslate));
          lastSentSubtitle = toTranslate;
        } else {
          console.log("送去翻譯排隊字幕：", toTranslate);
          lastSentSubtitle = toTranslate;
          currentTranslatingText = toTranslate;
          lastStableSubtitle = toTranslate;

          chrome.runtime.sendMessage({
            type: "YT_TRANSLATE_SUBTITLE_STREAM",
            text: toTranslate
          });
        }
      }

      return;
    }

    streamingBuffer += message.chunk;
    // 不在這裡顯示，等 done 才一次顯示
  }

  if (message.type === "YT_TRANSLATION_ERROR") {
    isStreaming = false;
    currentTranslatingText = "";

    if (message.errorType === "connection") {
      showError("⚠️ 找不到本機 AI，請確認 LM Studio 已開啟");
    } else {
      showError("⚠️ 翻譯失敗，請稍後再試");
    }
    return;
  }
});

// ===== 字幕輪詢主迴圈 =====

setInterval(() => {
  ensurePauseButton();
  updateOverlayPosition();

  const text = getCurrentSubtitleText();

  if (!text) {
    if (!isStreaming) {
      hideTranslation();
    }
    if (subtitleDebounceTimer) {
      clearTimeout(subtitleDebounceTimer);
      subtitleDebounceTimer = null;
    }
    return;
  }

  if (isPaused) return;
  if (isStreaming) return;

  // 如果字幕沒有變化，不需要重設計時器
  if (text === lastSubtitleText) return;
  lastSubtitleText = text;

  // 每次字幕有變化，重設 debounce 計時器
  if (subtitleDebounceTimer) {
    clearTimeout(subtitleDebounceTimer);
  }

  subtitleDebounceTimer = setTimeout(() => {
    subtitleDebounceTimer = null;

    // 計時器到期，字幕已穩定，準備送翻譯
    const stableText = getCurrentSubtitleText();
    if (!stableText) return;
    if (stableText === lastSentSubtitle) return;

    if (translationCache.has(stableText)) {
      showTranslation(translationCache.get(stableText));
      lastSentSubtitle = stableText;
      return;
    }

        if (
      currentTranslatingText &&
      stableText.startsWith(currentTranslatingText) &&
      stableText.length - currentTranslatingText.length < 20
    ) {
      return;
    }

    // 如果正在翻譯，先排隊
    if (isStreaming) {
      console.log("翻譯進行中，排隊等候：", stableText);
      pendingSubtitle = stableText;
      return;
    }

    console.log("送去翻譯的穩定字幕：", stableText);
    lastSentSubtitle = stableText;
    currentTranslatingText = stableText;
    lastStableSubtitle = stableText;

    chrome.runtime.sendMessage({
      type: "YT_TRANSLATE_SUBTITLE_STREAM",
      text: stableText
    });
  }, 400);

}, 200);