const DEFAULT_SERVER_URL = "http://127.0.0.1:1234";
const DEFAULT_MODEL_NAME = "phi-4-mini-instruct";

const serverUrlInput = document.getElementById("serverUrl");
const modelNameInput = document.getElementById("modelName");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusDiv = document.getElementById("status");

// 載入已儲存的設定
chrome.storage.sync.get(
  {
    serverUrl: DEFAULT_SERVER_URL,
    modelName: DEFAULT_MODEL_NAME
  },
  (items) => {
    serverUrlInput.value = items.serverUrl;
    modelNameInput.value = items.modelName;
  }
);

// 儲存設定
saveBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  const modelName = modelNameInput.value.trim() || DEFAULT_MODEL_NAME;

  chrome.storage.sync.set({ serverUrl, modelName }, () => {
    showStatus("success", "✅ 設定已儲存 / Settings saved");
  });
});

// 測試連線
testBtn.addEventListener("click", async () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  const modelName = modelNameInput.value.trim() || DEFAULT_MODEL_NAME;

  showStatus("testing", "🔄 測試連線中 / Testing connection...");

  try {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "user", content: "Hi" }
        ],
        max_tokens: 5,
        stream: false
      })
    });

    if (response.ok) {
      showStatus("success", `✅ 連線成功！模型 ${modelName} 已就緒 / Connection successful!`);
    } else {
      showStatus("error", `❌ 連線失敗：HTTP ${response.status}，請確認模型名稱是否正確`);
    }
  } catch (error) {
    showStatus("error", "❌ 找不到 LM Studio server，請確認 LM Studio 已啟動並開啟 server");
  }
});

function showStatus(type, message) {
  statusDiv.className = type;
  statusDiv.textContent = message;
}