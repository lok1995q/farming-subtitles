chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "翻譯選取文字",
      contexts: ["selection"]
    });
  });
});

const DEFAULT_SERVER_URL = "http://127.0.0.1:1234";
const DEFAULT_MODEL_NAME = "phi-4-mini-instruct";
const DEFAULT_SYSTEM_PROMPT = "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Traditional Chinese (繁體中文). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.";

const translationCache = new Map();
const MAX_CONCURRENT = 1;
let activeRequests = 0;

async function autoDetectModel() {
  try {
    const res = await fetch('http://127.0.0.1:1234/v1/models', {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const models = data?.data;
    if (!models || models.length === 0) return null;
    return models[0].id; // 回傳第一個已載入的模型
  } catch (e) {
    return null;
  }
}

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { serverUrl: DEFAULT_SERVER_URL, modelName: '', modelPrompts: {} },
      async (items) => {
        let modelName = items.modelName;

        // 若未設定模型，自動偵測 LM Studio 已載入的模型
        if (!modelName) {
          modelName = await autoDetectModel() || DEFAULT_MODEL_NAME;
        }

        const modelPrompts = items.modelPrompts || {};
        const systemPrompt = modelPrompts[modelName] || DEFAULT_SYSTEM_PROMPT;

        resolve({
          serverUrl: items.serverUrl || DEFAULT_SERVER_URL,
          modelName,
          systemPrompt
        });
      }
    );
  });
}

function buildRequestBody(modelName, systemPrompt, text, stream = false) {
  const normalizedText = text.trim();

  return {
    model: modelName,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: normalizedText
      }
    ],
    temperature: 0.2,
    stream,
    max_tokens: 80
  };
}

function extractTranslation(modelName, data) {
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function translateText(text) {
  const normalizedText = text.trim();
  if (!normalizedText) return "";

  if (translationCache.has(normalizedText)) {
    console.log("快取命中：", normalizedText);
    return translationCache.get(normalizedText);
  }

  const { serverUrl, modelName, systemPrompt } = await getSettings();
  console.log("快取未命中，呼叫模型：", modelName, normalizedText);

  const requestBody = buildRequestBody(modelName, systemPrompt, normalizedText, false);

  const response = await fetch(`${serverUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const translated = extractTranslation(modelName, data);

  if (translated) {
    translationCache.set(normalizedText, translated);
  }

  return translated;
}

async function translateTextStreaming(text, tabId) {
  const normalizedText = text.trim();
  if (!normalizedText) return;

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

  const { serverUrl, modelName, systemPrompt } = await getSettings();
  console.log("streaming 呼叫模型：", modelName, normalizedText);

  const requestBody = buildRequestBody(modelName, systemPrompt, normalizedText, true);

  const response = await fetch(`${serverUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  chrome.tabs.sendMessage(tabId, {
    type: "YT_SUBTITLE_STREAM_START"
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

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
            chunk,
            done: false
          });
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }

  chrome.tabs.sendMessage(tabId, {
    type: "YT_SUBTITLE_STREAM_CHUNK",
    chunk: "",
    done: true
  });

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

        const isConnectionError =
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("ECONNREFUSED");

        chrome.tabs.sendMessage(tabId, {
          type: "YT_TRANSLATION_ERROR",
          errorType: isConnectionError ? "connection" : "general",
          message: error.message
        });
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