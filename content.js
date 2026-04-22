chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SHOW_TRANSLATION") return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const translation = message.translation;

  const box = document.createElement("span");
  box.textContent = ` 譯：${translation} `;
  box.style.background = "#fff3bf";
  box.style.color = "#222";
  box.style.border = "1px solid #e0c36c";
  box.style.borderRadius = "6px";
  box.style.padding = "2px 6px";
  box.style.marginLeft = "6px";
  box.style.fontSize = "0.95em";
  box.style.lineHeight = "1.6";
  box.style.display = "inline";
  box.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";

  const closeBtn = document.createElement("span");
  closeBtn.textContent = " ×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.marginLeft = "4px";
  closeBtn.addEventListener("click", () => box.remove());

  box.appendChild(closeBtn);

  range.collapse(false);
  range.insertNode(box);

  selection.removeAllRanges();
});