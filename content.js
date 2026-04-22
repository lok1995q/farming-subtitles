function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch (err) {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API 失敗，改用 fallback：", err);
  }

  return fallbackCopyText(text);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SHOW_TRANSLATION") return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const originalText = message.originalText;
  const translation = message.translation;

  const wrapper = document.createElement("span");
  wrapper.style.display = "inline-block";
  wrapper.style.verticalAlign = "middle";
  wrapper.style.marginLeft = "8px";
  wrapper.style.marginTop = "4px";
  wrapper.style.marginBottom = "4px";
  wrapper.style.padding = "8px 10px";
  wrapper.style.background = "#fff8db";
  wrapper.style.border = "1px solid #e6d48f";
  wrapper.style.borderRadius = "8px";
  wrapper.style.boxShadow = "0 1px 4px rgba(0,0,0,0.12)";
  wrapper.style.maxWidth = "420px";
  wrapper.style.fontSize = "14px";
  wrapper.style.lineHeight = "1.5";
  wrapper.style.color = "#222";
  wrapper.style.whiteSpace = "normal";

  const originalLine = document.createElement("div");
  originalLine.style.marginBottom = "6px";
  originalLine.innerHTML = `<strong>原文：</strong> ${originalText}`;

  const translationLine = document.createElement("div");
  translationLine.style.marginBottom = "8px";
  translationLine.innerHTML = `<strong>譯文：</strong> ${translation}`;

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  buttonRow.style.alignItems = "center";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "複製";
  copyBtn.style.cursor = "pointer";
  copyBtn.style.border = "1px solid #c9b66d";
  copyBtn.style.background = "#fff";
  copyBtn.style.padding = "2px 8px";
  copyBtn.style.borderRadius = "6px";
  copyBtn.style.fontSize = "13px";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "關閉";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.border = "1px solid #c9b66d";
  closeBtn.style.background = "#fff";
  closeBtn.style.padding = "2px 8px";
  closeBtn.style.borderRadius = "6px";
  closeBtn.style.fontSize = "13px";

  const statusText = document.createElement("span");
  statusText.style.fontSize = "12px";
  statusText.style.color = "#666";

  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(translation);
    statusText.textContent = ok ? "已複製" : "複製失敗";

    setTimeout(() => {
      statusText.textContent = "";
    }, 1500);
  });

  closeBtn.addEventListener("click", () => {
    wrapper.remove();
  });

  buttonRow.appendChild(copyBtn);
  buttonRow.appendChild(closeBtn);
  buttonRow.appendChild(statusText);

  wrapper.appendChild(originalLine);
  wrapper.appendChild(translationLine);
  wrapper.appendChild(buttonRow);

  range.collapse(false);
  range.insertNode(wrapper);

  selection.removeAllRanges();
});