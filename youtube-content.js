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

// ===== 全域變數（只宣告一次）=====
let lastSubtitleText = "";
let lastStableSubtitle = "";
let lastOutputTime = 0;
let overlay = null;
let isAsrTrack = false;
let streamingBuffer = "";
let isStreaming = false;
let currentTranslatingText = "";

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

// ===== 字幕輸出判斷 =====

function isMostlyPrefix(shorter, longer) {
  if (!shorter || !longer) return false;
  if (shorter.length < 4) return false;
  if (shorter.length >= longer.length) return false;

  const prefix = longer.slice(0, shorter.length);
  let sameCount = 0;

  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === prefix[i]) sameCount++;
  }

  const ratio = sameCount / shorter.length;
  return ratio > 0.8;
}

// 保留供未來句分割優化使用
function isClearlyNewSentence(prev, current) {
  if (!prev) return true;

  const prevTrim = prev.trim();
  const currTrim = current.trim();

  if (prevTrim === currTrim) return false;

  const prevLastPunct = /[.!?…]$/.test(prevTrim);
  const currHasNewClause = /[,;:]/.test(currTrim) && !/[,;:]/.test(prevTrim);

  if (prevLastPunct && !isMostlyPrefix(prevTrim, currTrim)) {
    return true;
  }

  if (currHasNewClause && !isMostlyPrefix(prevTrim, currTrim)) {
    return true;
  }

  if (!isMostlyPrefix(prevTrim, currTrim) && currTrim.length > prevTrim.length + 12) {
    return true;
  }

  return false;
}

function shouldOutput(newText) {
  if (!newText) return false;

  const now = Date.now();
  const text = newText.trim();

  if (text.length < 2) {
    lastSubtitleText = text;
    return false;
  }

  if (!lastStableSubtitle) {
    lastSubtitleText = text;
    lastStableSubtitle = text;
    lastOutputTime = now;
    return true;
  }

  if (text === lastStableSubtitle) {
    lastSubtitleText = text;
    return false;
  }

  const sameAsLastSeen = text === lastSubtitleText;
  lastSubtitleText = text;

  if (sameAsLastSeen) {
    return false;
  }

  const timeSinceLastOutput = now - lastOutputTime;
  const mostlyPrefix = isMostlyPrefix(lastStableSubtitle, text);
  const lengthDiff = text.length - lastStableSubtitle.length;

  if (isAsrTrack) {
    if (mostlyPrefix && lengthDiff > 0) {
      if (lengthDiff < 5 && timeSinceLastOutput < 350) {
        return false;
      }
    }

    if (text.length <= lastStableSubtitle.length - 6 && timeSinceLastOutput < 250) {
      return false;
    }
  } else {
    if (mostlyPrefix && lengthDiff > 0 && lengthDiff < 3 && timeSinceLastOutput < 150) {
      return false;
    }
  }

  if (isAsrTrack) {
    if (mostlyPrefix && lengthDiff > 0 && lengthDiff < 10 && timeSinceLastOutput < 700) {
      return false;
    }

    const hasStrongPunct = /[.!?…]$/.test(text);
    const hasComma = /[,;:]/.test(text);

    if (!hasStrongPunct && !hasComma && timeSinceLastOutput < 600 && lengthDiff < 16) {
      return false;
    }
  }

  lastStableSubtitle = text;
  lastOutputTime = now;
  return true;
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

function showTranslation(translation) {
  const box = ensureOverlay();
  box.textContent = translation;
  box.style.opacity = "1";
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
      return;
    }

    streamingBuffer += message.chunk;
    // 不在這裡顯示，等 done 才一次顯示
  }
});

// ===== 字幕輪詢主迴圈 =====

setInterval(() => {
  const text = getCurrentSubtitleText();

  if (!text) {
    if (!isStreaming) {
      hideTranslation();
    }
    return;
  }

  if (isStreaming) return;

    if (shouldOutput(text)) {
    console.log("送去翻譯的新字幕：", text);

    if (translationCache.has(text)) {
      showTranslation(translationCache.get(text));
      console.log("使用翻譯快取結果");
      currentTranslatingText = "";
      return;
    }

    // 如果新字幕只是目前正在翻譯的句子的延長版，就不要重複送
    if (
      currentTranslatingText &&
      text.startsWith(currentTranslatingText) &&
      text.length - currentTranslatingText.length < 20
    ) {
      console.log("延長版，跳過重複翻譯：", text);
      return;
    }

    currentTranslatingText = text;

    chrome.runtime.sendMessage({
      type: "YT_TRANSLATE_SUBTITLE_STREAM",
      text: text
    });
  }
}, 200);