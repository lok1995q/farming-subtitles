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

  if (!text) {
    hideTranslation();
    return;
  }

  if (shouldOutput(text)) {
    console.log("送去翻譯的新字幕：", text);

    try {
      const translation = await requestTranslation(text);
      showTranslation(translation);
    } catch (error) {
      console.error("字幕翻譯錯誤：", error);
    }
  }
}, 200);