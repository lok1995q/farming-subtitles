console.log("youtube-content.js loaded");

let lastSubtitleText = "";
let lastOutputTime = 0;
let overlay = null;

function getCurrentSubtitleText() {
  const segments = document.querySelectorAll(".ytp-caption-segment");

  if (!segments || segments.length === 0) {
    return "";
  }

  return Array.from(segments)
    .map(el => el.textContent.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldOutput(newText) {
  if (!newText) return false;

  const now = Date.now();

  if (!lastSubtitleText) {
    lastSubtitleText = newText;
    lastOutputTime = now;
    return true;
  }

  if (newText === lastSubtitleText) {
    return false;
  }

  const isExtension =
    newText.startsWith(lastSubtitleText) &&
    newText.length - lastSubtitleText.length < 12;

  if (isExtension) {
    lastSubtitleText = newText;
    return false;
  }

  const tooSoon = now - lastOutputTime < 500;
  if (tooSoon && newText.length < lastSubtitleText.length + 8) {
    lastSubtitleText = newText;
    return false;
  }

  lastSubtitleText = newText;
  lastOutputTime = now;
  return true;
}

function ensureOverlay() {
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "yt-translation-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "80px";
  overlay.style.right = "20px";
  overlay.style.zIndex = "999999";
  overlay.style.maxWidth = "360px";
  overlay.style.background = "rgba(20, 20, 20, 0.9)";
  overlay.style.color = "#fff";
  overlay.style.padding = "12px 14px";
  overlay.style.borderRadius = "10px";
  overlay.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  overlay.style.fontSize = "14px";
  overlay.style.lineHeight = "1.5";
  overlay.style.whiteSpace = "normal";
  overlay.style.fontFamily = "Arial, sans-serif";

  document.body.appendChild(overlay);
  return overlay;
}

function showTranslation(original, translation) {
  const box = ensureOverlay();
  box.innerHTML = `
    <div style="font-size:12px;color:#bbb;margin-bottom:6px;">YouTube 字幕翻譯</div>
    <div style="margin-bottom:8px;"><strong>原文：</strong> ${original}</div>
    <div><strong>譯文：</strong> ${translation}</div>
  `;
}

async function requestTranslation(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "YT_TRANSLATE_SUBTITLE",
        text: text
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.success) {
          reject(new Error(response?.error || "翻譯失敗"));
          return;
        }

        resolve(response.translation);
      }
    );
  });
}

setInterval(async () => {
  const text = getCurrentSubtitleText();
  if (!text) return;

  if (shouldOutput(text)) {
    console.log("送去翻譯的新字幕：", text);

    try {
      const translation = await requestTranslation(text);
      showTranslation(text, translation);
    } catch (error) {
      console.error("字幕翻譯錯誤：", error);
    }
  }
}, 200);