chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "翻譯選取文字",
      contexts: ["selection"]
    });
  });
});

const translationCache = new Map();
const MAX_CONCURRENT = 1;
let activeRequests = 0;

async function translateText(text) {
  const normalizedText = text.trim();

  if (!normalizedText) return "";

  if (translationCache.has(normalizedText)) {
    console.log("快取命中：", normalizedText);
    return translationCache.get(normalizedText);
  }

  console.log("快取未命中，呼叫模型：", normalizedText);

  const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "phi-4-mini-instruct",
      messages: [
        {
          role: "system",
          content: "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Traditional Chinese (繁體中文). Keep it concise and natural, as if spoken. Output only the translated text, nothing else."
        },
        {
          role: "user",
          content: normalizedText
        }
      ],
      temperature: 0.2,
      stream: false,
      max_tokens: 80
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();

  if (translated) {
    translationCache.set(normalizedText, translated);
  }

  return translated;
}

async function translateTextStreaming(text, tabId) {
  const normalizedText = text.trim();
  if (!normalizedText) return;

  // 如果快取有，直接送完整結果，不用 streaming
  if (translationCache.has(normalizedText)) {
    console.log("快取命中（streaming path）：", normalizedText);
    const cached = translationCache.get(normalizedText);

    chrome.tabs.sendMessage(tabId, {
      type: "YT_SUBTITLE_STREAM_CHUNK",
      chunk: cached,
      done: true
    });
    return;
  }

  const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "phi-4-mini-instruct",
      messages: [
        {
          role: "system",
          content: "You are a translation tool. Translate the user's English text into Traditional Chinese (繁體中文). Output only the translated text, nothing else."
        },
        {
          role: "user",
          content: normalizedText
        }
      ],
      temperature: 0.2,
      stream: true,
      max_tokens: 80
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  // 先通知 content script 開始新的 streaming
  chrome.tabs.sendMessage(tabId, {
    type: "YT_SUBTITLE_STREAM_START"
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const chunk = parsed.choices?.[0]?.delta?.content;

        if (chunk) {
          fullText += chunk;

          chrome.tabs.sendMessage(tabId, {
            type: "YT_SUBTITLE_STREAM_CHUNK",
            chunk: chunk,
            done: false
          });
        }
      } catch (e) {
        // 忽略無法 parse 的行
      }
    }
  }

  // 結束
  chrome.tabs.sendMessage(tabId, {
    type: "YT_SUBTITLE_STREAM_CHUNK",
    chunk: "",
    done: true
  });

  // 存進快取
  if (fullText) {
    translationCache.set(normalizedText, fullText);
  }
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
  if (message.type === "YT_TRANSLATE_SUBTITLE_STREAM") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: "no tab id" });
      return;
    }

    if (activeRequests >= MAX_CONCURRENT) {
      const cached = translationCache.get(message.text?.trim());
      if (cached) {
        chrome.tabs.sendMessage(tabId, {
          type: "YT_SUBTITLE_STREAM_CHUNK",
          chunk: cached,
          done: true
        });
      } else {
        console.log("並行限制：跳過這次字幕翻譯請求");
      }
      sendResponse({ success: true });
      return;
    }

    activeRequests++;

    translateTextStreaming(message.text, tabId)
      .catch(error => {
        console.error("Streaming 翻譯失敗：", error);
      })
      .finally(() => {
        activeRequests--;
      });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "YT_TRANSLATE_SUBTITLE") {
    (async () => {
      if (activeRequests >= MAX_CONCURRENT) {
        const cached = translationCache.get(message.text?.trim());
        if (cached) {
          sendResponse({ success: true, translation: cached });
        } else {
          sendResponse({ success: false, error: "busy" });
        }
        return;
      }

      activeRequests++;

      try {
        const translated = await translateText(message.text);
        sendResponse({ success: true, translation: translated });
      } catch (error) {
        console.error("YouTube 字幕翻譯失敗：", error);
        sendResponse({ success: false, error: error.message });
      } finally {
        activeRequests--;
      }
    })();

    return true;
  }
});