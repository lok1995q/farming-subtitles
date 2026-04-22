chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "翻譯選取文字",
      contexts: ["selection"]
    });
  });
});

async function translateText(text) {
  const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gemma-4-e4b-it",
      messages: [
        {
          role: "system",
          content: "你是一個翻譯助手。請把使用者提供的文字翻成繁體中文，只輸出翻譯結果，不要加解釋，不要加引號。"
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const selectedText = info.selectionText;
  if (!selectedText || !tab?.id) return;

  try {
    const translated = await translateText(selectedText);

    console.log("原文：", selectedText);
    console.log("翻譯：", translated || "沒有收到翻譯結果");

    if (translated) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_TRANSLATION",
        originalText: selectedText,
        translation: translated
      });
    }
  } catch (error) {
    console.error("翻譯失敗：", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "YT_TRANSLATE_SUBTITLE") return;

  (async () => {
    try {
      const translated = await translateText(message.text);
      sendResponse({
        success: true,
        translation: translated
      });
    } catch (error) {
      console.error("YouTube 字幕翻譯失敗：", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  })();

  return true;
});