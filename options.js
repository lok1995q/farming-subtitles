const DEFAULT_SERVER_URL = 'http://127.0.0.1:1234'
const DEFAULT_MODEL_API_NAME = 'phi-4-mini-instruct'
const DEFAULT_PROMPT = PROMPT_TEMPLATES['zh-TW']

const PROMPT_TEMPLATES = {
  'zh-TW': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Traditional Chinese (繁體中文).

Rules:
1. Output MUST be in Traditional Chinese (繁體中文) only. Never use Simplified Chinese (简体中文).
2. Keep proper nouns as-is: car models (e.g. RAV4, Civic, F-150), brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning. If the speaker says "a little bit", translate "一點點", not "些許".
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`,

  'zh-CN': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Simplified Chinese (简体中文).

Rules:
1. Output MUST be in Simplified Chinese (简体中文) only.
2. Keep proper nouns as-is: car models, brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning.
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`,

  'ja': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Japanese (日本語).

Rules:
1. Output MUST be in Japanese (日本語) only.
2. Keep proper nouns as-is: car models, brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning.
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`,

  'ko': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Korean (한국어).

Rules:
1. Output MUST be in Korean (한국어) only.
2. Keep proper nouns as-is: car models, brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning.
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`,

  'fr': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial French (Français).

Rules:
1. Output MUST be in French (Français) only.
2. Keep proper nouns as-is: car models, brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning.
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`,

  'es': `You are a subtitle translation tool. Translate the user's English subtitle text into natural, colloquial Spanish (Español).

Rules:
1. Output MUST be in Spanish (Español) only.
2. Keep proper nouns as-is: car models, brand names, person names, and product names must NOT be translated.
3. Translate the exact words used — do not paraphrase, summarize, or change the meaning.
4. Do not add words that are not in the original, do not omit any words.
5. Keep it concise and natural, as if spoken aloud.
6. Output only the translated text, nothing else.`
}

// 預設內建模型（API Name → 顯示名稱）
const BUILT_IN_MODELS = {
  'phi-4-mini-instruct': 'Phi-4-Mini-Instruct',
  'gemma-4-e4b-it': 'Gemma 4 E4B'
}

// DOM 元素
const serverUrlInput = document.getElementById('serverUrl')
const modelPresetSelect = document.getElementById('modelPreset')
const systemPromptInput = document.getElementById('systemPrompt')
const promptTemplateSelect = document.getElementById('promptTemplate')
const saveBtn = document.getElementById('saveBtn')
const testBtn = document.getElementById('testBtn')
const deleteModelBtn = document.getElementById('deleteModelBtn')
const addModelBtn = document.getElementById('addModelBtn')
const newModelDisplayName = document.getElementById('newModelDisplayName')
const newModelApiName = document.getElementById('newModelApiName')
const statusDiv = document.getElementById('status')

// 儲存的資料
let modelPrompts = {}
let customModels = {} // API Name → 顯示名稱（用家自訂）

// 取得目前選擇的模型 API Name
function getCurrentModelApiName() {
  return modelPresetSelect.value
}

// 重新建立下拉選單
function rebuildModelSelect(selectedApiName) {
  modelPresetSelect.innerHTML = ''

  // 內建模型
  const builtInGroup = document.createElement('optgroup')
  builtInGroup.label = '內建模型 / Built-in Models'
  Object.entries(BUILT_IN_MODELS).forEach(([apiName, displayName]) => {
    const opt = document.createElement('option')
    opt.value = apiName
    opt.textContent = displayName
    builtInGroup.appendChild(opt)
  })
  modelPresetSelect.appendChild(builtInGroup)

  // 自訂模型
  if (Object.keys(customModels).length > 0) {
    const customGroup = document.createElement('optgroup')
    customGroup.label = '自訂模型 / Custom Models'
    Object.entries(customModels).forEach(([apiName, displayName]) => {
      const opt = document.createElement('option')
      opt.value = apiName
      opt.textContent = `${displayName} (${apiName})`
      customGroup.appendChild(opt)
    })
    modelPresetSelect.appendChild(customGroup)
  }

  // 設定選中的模型
  if (selectedApiName && modelPresetSelect.querySelector(`option[value="${selectedApiName}"]`)) {
    modelPresetSelect.value = selectedApiName
  } else {
    modelPresetSelect.value = DEFAULT_MODEL_API_NAME
  }
}

// 載入目前模型的 prompt
function loadPromptForCurrentModel() {
  const apiName = getCurrentModelApiName()
  if (modelPrompts[apiName]) {
    systemPromptInput.value = modelPrompts[apiName]
  } else {
    systemPromptInput.value = PROMPT_TEMPLATES['zh-TW'] || DEFAULT_PROMPT
  }
}

// 初始化：從 storage 載入
chrome.storage.sync.get(
  { serverUrl: DEFAULT_SERVER_URL, modelName: DEFAULT_MODEL_API_NAME, modelPrompts: {}, customModels: {} },
  (items) => {
    serverUrlInput.value = items.serverUrl
    modelPrompts = items.modelPrompts || {}
    customModels = items.customModels || {}

    rebuildModelSelect(items.modelName)
    loadPromptForCurrentModel()
  }
)

// 切換模型時更新 prompt
modelPresetSelect.addEventListener('change', loadPromptForCurrentModel)

// 快速範本選擇
promptTemplateSelect.addEventListener('change', () => {
  const selected = promptTemplateSelect.value
  if (selected && PROMPT_TEMPLATES[selected]) {
    systemPromptInput.value = PROMPT_TEMPLATES[selected]
  }
  // 不重設，保留顯示已選擇的選項
})

// 儲存
saveBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL
  const modelName = getCurrentModelApiName()
  const systemPrompt = systemPromptInput.value.trim() || DEFAULT_PROMPT

  modelPrompts[modelName] = systemPrompt

  chrome.storage.sync.set({ serverUrl, modelName, modelPrompts, customModels }, () => {
    showStatus('success', '設定已儲存 / Settings saved.')
  })
})

// 測試連線
testBtn.addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL
  const modelName = getCurrentModelApiName()
  showStatus('testing', '正在測試連線.../Testing...')
  try {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false
      })
    })
    if (response.ok) {
      showStatus('success', '連線成功！/ Connection successful!')
    } else {
      showStatus('error', `連線失敗 / Connection failed：HTTP ${response.status}`)
    }
  } catch (error) {
    showStatus('error', '無法連接 LM Studio，請確認已啟動並載入模型 / Cannot connect to LM Studio. Please ensure it is running with a model loaded.')
  }
})

// 刪除模型
deleteModelBtn.addEventListener('click', () => {
  const apiName = getCurrentModelApiName()

  // 不允許刪除內建模型
  if (BUILT_IN_MODELS[apiName]) {
    showStatus('error', `「${BUILT_IN_MODELS[apiName]}」是內建模型，不能刪除 / This is a built-in model and cannot be deleted.`)
    return
  }

  const displayName = customModels[apiName] || apiName
  const confirmed = confirm(`確定要刪除「${displayName}」的所有設定嗎？此操作不可復原。\nDelete all settings for "${displayName}"? This cannot be undone.`)
  if (!confirmed) return

  delete customModels[apiName]
  delete modelPrompts[apiName]

  rebuildModelSelect(DEFAULT_MODEL_API_NAME)
  loadPromptForCurrentModel()

  chrome.storage.sync.set({ modelPrompts, customModels, modelName: DEFAULT_MODEL_API_NAME }, () => {
    showStatus('success', `「${displayName}」已刪除 / "${displayName}" has been deleted.`)
  })
})

// 新增自訂模型
addModelBtn.addEventListener('click', () => {
  const displayName = newModelDisplayName.value.trim()
  const apiName = newModelApiName.value.trim()

  if (!displayName) {
    showStatus('error', '請填寫顯示名稱 / Please enter a display name.')
    return
  }
  if (!apiName) {
    showStatus('error', '請填寫 API Model Name / Please enter the API Model Name.')
    return
  }
  if (BUILT_IN_MODELS[apiName]) {
    showStatus('error', `「${apiName}」已是內建模型，無需新增 / "${apiName}" is already a built-in model.`)
    return
  }

  customModels[apiName] = displayName
  if (!modelPrompts[apiName]) {
    modelPrompts[apiName] = PROMPT_TEMPLATES['zh-TW'] || DEFAULT_PROMPT
  }

  rebuildModelSelect(apiName)
  loadPromptForCurrentModel()

  chrome.storage.sync.set({ modelPrompts, customModels, modelName: apiName }, () => {
    showStatus('success', `「${displayName}」已新增並選取 / "${displayName}" has been added and selected.`)
    newModelDisplayName.value = ''
    newModelApiName.value = ''
  })
})

function showStatus(type, message) {
  statusDiv.className = type
  statusDiv.textContent = message
}