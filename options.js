const DEFAULT_SERVER_URL = "http://127.0.0.1:1234";
const DEFAULT_MODEL_NAME = "phi-4-mini-instruct";
const DEFAULT_PROMPT = "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Traditional Chinese (繁體中文). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.";

const PROMPT_TEMPLATES = {
  "zh-TW": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Traditional Chinese (繁體中文). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.",
  "zh-CN": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Simplified Chinese (简体中文). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.",
  "ja": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Japanese (日本語). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.",
  "ko": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Korean (한국어). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.",
  "fr": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial French (Français). Keep it concise and natural, as if spoken. Output only the translated text, nothing else.",
  "es": "You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Spanish (Español). Keep it concise and natural, as if spoken. Output only the translated text, nothing else."
};

const DEFAULT_MODEL_PROMPTS = {
  "phi-4-mini-instruct": PROMPT_TEMPLATES["zh-TW"],
  "translategemma-4b-it": PROMPT_TEMPLATES["zh-TW"]
};

const serverUrlInput = document.getElementById("serverUrl");
const modelPresetSelect = document.getElementById("modelPreset");
const customModelWrap = document.getElementById("customModelWrap");
const customModelNameInput = document.getElementById("customModelName");
const systemPromptInput = document.getElementById("systemPrompt");
const promptTemplateSelect = document.getElementById("promptTemplate");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusDiv = document.getElementById("status");

let modelPrompts = {};

// 取得目前實際 model name
function getCurrentModelName() {
  const preset = modelPresetSelect.value;
  if (preset === "other") {
    return customModelNameInput.value.trim() || "";
  }
  return preset;
}

// 載入設定
chrome.storage.sync.get(
  {
    serverUrl: DEFAULT_SERVER_URL,
    modelName: DEFAULT_MODEL_NAME,
    modelPrompts: {}
  },
  (items) => {
    serverUrlInput.value = items.serverUrl;
    modelPrompts = items.modelPrompts || {};

    // 設定 preset 下拉
    const savedModel = items.modelName || DEFAULT_MODEL_NAME;
    const presetValues = Array.from(modelPresetSelect.options).map(o => o.value);
    if (presetValues.includes(savedModel)) {
      modelPresetSelect.value = savedModel;
      customModelWrap.classList.add("hidden");
    } else {
      modelPresetSelect.value = "other";
      customModelNameInput.value = savedModel;
      customModelWrap.classList.remove("hidden");
    }

    loadPromptForCurrentModel();
  }
);

// 切換 preset 時
modelPresetSelect.addEventListener("change", () => {
  if (modelPresetSelect.value === "other") {
    customModelWrap.classList.remove("hidden");
  } else {
    customModelWrap.classList.add("hidden");
  }
  loadPromptForCurrentModel();
});

// 輸入 custom model name 時
customModelNameInput.addEventListener("input", () => {
  loadPromptForCurrentModel();
});

function loadPromptForCurrentModel() {
  const modelName = getCurrentModelName();

  if (modelName && modelPrompts[modelName]) {
    // 有儲存過這個模型的 prompt
    systemPromptInput.value = modelPrompts[modelName];
  } else if (modelName && DEFAULT_MODEL_PROMPTS[modelName]) {
    // 有預設 prompt
    systemPromptInput.value = DEFAULT_MODEL_PROMPTS[modelName];
  } else {
    // 用通用預設
    systemPromptInput.value = DEFAULT_PROMPT;
  }
}

// 選擇範本時自動填入
promptTemplateSelect.addEventListener("change", () => {
  const selected = promptTemplateSelect.value;
  if (selected && PROMPT_TEMPLATES[selected]) {
    systemPromptInput.value = PROMPT_TEMPLATES[selected];
  }
  promptTemplateSelect.value = "";
});

// 儲存設定
saveBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  const modelName = getCurrentModelName() || DEFAULT_MODEL_NAME;
  const systemPrompt = systemPromptInput.value.trim() || DEFAULT_PROMPT;

  modelPrompts[modelName] = systemPrompt;

  chrome.storage.sync.set(
    {
      serverUrl,
      modelName,
      modelPrompts
    },
    () => {
      showStatus("success", "✅ 設定已儲存 / Settings saved");
    }
  );
});

// 測試連線
testBtn.addEventListener("click", async () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  const modelName = getCurrentModelName() || DEFAULT_MODEL_NAME;

  showStatus("testing", "🔄 測試連線中 / Testing connection...");

  try {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        stream: false
      })
    });

    if (response.ok) {
      showStatus("success", `✅ 連線成功！/ Connection successful!`);
    } else {
      showStatus("error", `❌ 連線失敗：HTTP ${response.status}`);
    }
  } catch (error) {
    showStatus("error", "❌ 找不到 LM Studio server，請確認已啟動 / Cannot connect to LM Studio");
  }
});

function showStatus(type, message) {
  statusDiv.className = type;
  statusDiv.textContent = message;
}