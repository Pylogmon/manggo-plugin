# Manggo 原生插件开发指南

Manggo 原生插件可以扩展翻译、OCR、语音合成、生词本服务和划词动作。一个插件由清单文件、JavaScript 入口和可选资源组成，使用 Bun 运行，并通过 `manggo.plugin.v1` API 与 Manggo 通信。

本文只描述 Manggo 原生插件格式：

- 清单文件固定为 `manggo.plugin.json`。
- 入口脚本使用 ES module。
- 一个插件可以在 `services` 中声明一个或多个普通服务或划词动作。
- 插件包扩展名为 `.mplugin`，本质上是 zip 文件。

## 目录

- [快速开始](#快速开始)
- [插件清单](#插件清单)
- [服务配置表单](#服务配置表单)
- [JavaScript 运行时](#javascript-运行时)
- [翻译服务](#翻译服务)
- [OCR 服务](#ocr-服务)
- [语音服务](#语音服务)
- [生词本服务](#生词本服务)
- [划词动作](#划词动作)
- [错误处理与工程实践](#错误处理与工程实践)
- [打包、安装与发布](#打包安装与发布)
- [本仓库示例](#本仓库示例)

## 快速开始

最小目录结构：

```text
my-plugin/
├── manggo.plugin.json
├── main.js
└── icon.png
```

创建 `manggo.plugin.json`：

```json
{
  "manifestVersion": 1,
  "id": "com.example.my-translator",
  "name": "My Translator",
  "version": "1.0.0",
  "description": "A minimal Manggo translation plugin.",
  "author": "Example",
  "icon": "icon.png",
  "permissions": ["network"],
  "runtime": {
    "kind": "bun",
    "api": "manggo.plugin.v1",
    "main": "main.js"
  },
  "services": [
    {
      "id": "translation",
      "kind": "translation",
      "displayName": "My Translator",
      "entry": "translate",
      "config": []
    }
  ]
}
```

创建 `main.js`：

```js
export async function translate(text, from, to, options) {
  return `[${from} -> ${to}] ${text}`;
}
```

将文件打包到 zip 根目录并使用 `.mplugin` 扩展名：

```bash
zip -r my-translator.mplugin manggo.plugin.json main.js icon.png
```

在 Manggo 的“插件管理”页面安装生成的文件。翻译、OCR、语音和生词本服务需要到对应的服务设置页面添加；划词动作会在安装后自动出现在“划词助手”的动作列表中，无需再次添加。

## 插件清单

原生插件根目录必须包含有效的 `manggo.plugin.json`。

### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `manifestVersion` | number | 是 | 清单版本，当前必须为 `1`。 |
| `id` | string | 是 | 插件唯一 ID，建议使用反向域名，例如 `com.example.my-plugin`。 |
| `name` | string | 是 | 插件名称。 |
| `version` | string | 是 | 插件版本，建议遵循语义化版本。 |
| `description` | string | 否 | 插件简介。 |
| `author` | string | 否 | 作者或组织名称。 |
| `homepage` | string | 否 | 项目主页或源码地址。 |
| `icon` | string | 否 | 图标路径，相对插件根目录。 |
| `permissions` | string[] | 否 | 插件级权限。需要访问网络时声明 `network`。 |
| `runtime` | object | 是 | JavaScript 运行时配置。 |
| `services` | object[] | 是 | 服务声明，至少包含一项；划词动作使用 `kind: "action"`。 |

普通服务和划词动作统一在 `services` 中声明。一个仅提供划词动作的插件仍然需要提供非空的 `services` 数组。

### runtime

当前原生运行时配置固定为：

```json
{
  "kind": "bun",
  "api": "manggo.plugin.v1",
  "main": "main.js"
}
```

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `kind` | `bun` | JavaScript 运行时。 |
| `api` | `manggo.plugin.v1` | 原生插件 API 版本。 |
| `main` | 文件路径 | 默认入口脚本，相对插件根目录。 |

### services

一个插件可以在 `services` 中声明多个服务，例如同时提供翻译和语音合成。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 插件内部唯一的服务 ID。 |
| `kind` | string | 是 | `translation`、`ocr`、`speech`、`wordbook` 或 `action`。 |
| `providerId` | string | 否 | 普通服务的提供方 ID；省略时生成 `插件ID#服务ID`。action 不使用此字段。 |
| `displayName` | string | 是 | 用户在服务列表中看到的名称。 |
| `entry` | string | 是 | 入口脚本导出的函数名；action 点击后同样调用此函数。 |
| `precheck` | string | 否 | action 的预检函数名；返回严格布尔值 `true` 时才显示。 |
| `main` | string | 否 | 服务专用入口脚本；省略时使用 `runtime.main`。 |
| `resultType` | string | 否 | 仅用于翻译服务，可为 `text` 或 `dictionary`，默认 `text`。 |
| `icon` | string | 否 | 普通服务图标；省略时使用顶层 `icon`。 |
| `iconName` | string | 否 | action 使用的 Material Symbols 图标名，默认 `extension`。 |
| `enabledByDefault` | boolean | 否 | action 安装后是否默认启用，默认 `true`。 |
| `permissions` | string[] | 否 | 服务级权限，会与顶层权限合并。 |
| `language` | object | 否 | Manggo 语言代码到插件所需语言代码的映射。 |
| `config` | object[] | 否 | 配置表单。普通服务在服务编辑器中填写；action 在划词动作列表的编辑按钮中填写。 |

服务类型及推荐入口名：

| `kind` | 用途 | 入口函数签名 |
| --- | --- | --- |
| `translation` | 文本翻译或结构化词典 | `translate(text, from, to, options)` |
| `ocr` | 图片文字识别 | `recognize(base64, language, options)` |
| `speech` | 文本转语音 | `tts(text, language, options)` |
| `wordbook` | 添加生词 | `add(request, options)` |
| `action` | 划词助手动作 | `entry(selectedText, options)` |

入口名称可以自定义，但必须与清单中的 `entry` 或 `precheck` 完全一致。

### 语言映射

翻译、OCR 和语音服务可以通过 `language` 将 Manggo 语言代码映射为第三方 API 所需的值：

```json
{
  "language": {
    "auto": "auto",
    "en_US": "en",
    "zh_CN": "zh-Hans",
    "zh_TW": "zh-Hant",
    "ja_JP": "ja"
  }
}
```

传给对应入口函数的语言参数已经完成映射。只声明插件实际支持的语言；没有映射的语言不会被自动猜测为第三方格式。

## 服务配置表单

`services[].config` 用于生成服务配置界面。保存后的值通过 `options.config` 提供给入口函数。

```json
{
  "config": [
    {
      "key": "apiKey",
      "label": "API key",
      "control": "password",
      "required": true,
      "secret": true,
      "placeholder": "sk-..."
    },
    {
      "key": "model",
      "label": "Model",
      "control": "select",
      "editable": true,
      "default": "default-model",
      "options": [
        { "label": "Default", "value": "default-model" },
        { "label": "Fast", "value": "fast-model" }
      ]
    }
  ]
}
```

配置字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | string | 是 | 配置键，通过 `options.config[key]` 读取。 |
| `label` | string | 是 | 表单标签。 |
| `control` | string | 是 | 控件类型。 |
| `placeholder` | string | 否 | 输入框占位提示。 |
| `description` | string | 否 | 字段帮助文字。 |
| `required` | boolean | 否 | 是否要求用户填写。 |
| `secret` | boolean | 否 | 是否按敏感字段处理；`password` 默认启用。 |
| `editable` | boolean | 否 | `select` 是否允许输入自定义值。 |
| `default` | any | 否 | 默认值。 |
| `options` | object[] | 否 | `select` 选项，每项必须包含 `label` 和 `value`。 |

支持的控件：

| `control` | UI | 值类型 |
| --- | --- | --- |
| `text` | 单行输入框 | string |
| `password` | 密码输入框 | string |
| `textarea` | 多行输入框 | string |
| `select` | 下拉选择 | 取决于选项值 |
| `integer` | 整数输入 | number |
| `decimal` | 小数输入 | number |
| `boolean` | 开关 | boolean |

插件只应依赖自己声明的配置键。以下划线开头的内部字段不属于稳定 API。

## JavaScript 运行时

### 模块导出

入口脚本必须使用 ES module。可以使用命名导出：

```js
export async function translate(text, from, to, options) {}
export async function recognize(base64, language, options) {}
export async function tts(text, language, options) {}
export async function add(request, options) {}
export function shouldShowAction(selectedText, options) {}
export async function executeAction(selectedText, options) {}
```

也可以使用默认导出对象：

```js
export default {
  translate,
  recognize,
  tts,
  add,
  shouldShowAction,
  executeAction,
};
```

不要使用 CommonJS `require()` 或依赖未声明的全局对象。

### options

所有入口函数最后一个参数都是 `options`：

| 字段 | 说明 |
| --- | --- |
| `options.config` | 当前服务或划词动作的用户配置；尚未保存的字段使用清单中的默认值。 |
| `options.detect` | 翻译请求检测出的源语言，已经过语言映射。 |
| `options.setResult(chunk)` | 输出增量字符串。适用于流式翻译或 OCR。 |
| `options.utils` | Manggo 提供的运行时工具。 |
| `options.manggo` | 仅划词动作的入口函数可用，包含由 Manggo 执行的宿主操作。 |

`options.setResult()` 只用于文本增量。结构化词典、音频和生词本操作结果应作为入口函数的最终返回值。

### options.utils

| 字段或函数 | 说明 |
| --- | --- |
| `utils.fetch(url, init)` | 标准 Fetch 风格网络请求。 |
| `utils.readTextFile(path)` | 读取文本文件。 |
| `utils.readBinaryFile(path)` | 读取二进制文件，返回数字数组。 |
| `utils.cacheDir` | 当前插件的缓存目录。 |
| `utils.pluginDir` | 当前插件的安装目录。 |
| `utils.osType` | `Darwin`、`Windows_NT` 或 `Linux`。 |
| `utils.setResult(chunk)` | 等价于 `options.setResult(chunk)`。 |

需要访问随插件分发的文件时，使用 `utils.pluginDir` 构造路径；需要写入运行数据时，使用 `utils.cacheDir`，不要写入插件安装目录。

## 翻译服务

### 普通文本翻译

Manifest：

```json
{
  "id": "translation",
  "kind": "translation",
  "displayName": "My Translator",
  "entry": "translate",
  "resultType": "text",
  "language": {
    "auto": "auto",
    "en_US": "en",
    "zh_CN": "zh"
  }
}
```

入口：

```js
export async function translate(text, from, to, options) {
  const response = await options.utils.fetch(options.config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, from, to }),
  });

  if (!response.ok) {
    throw new Error(`Translation failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.translation;
}
```

| 参数 | 说明 |
| --- | --- |
| `text` | 待翻译文本。 |
| `from` | 映射后的源语言；自动检测时可能是 `auto`。 |
| `to` | 映射后的目标语言。 |
| `options.detect` | Manggo 检测出的源语言，已经过映射。 |

返回翻译字符串。流式接口可以多次调用 `options.setResult(delta)`，最终返回完整文本或不返回值。

### 结构化词典

词典属于翻译服务。将 `kind` 保持为 `translation`，并声明 `resultType: "dictionary"`：

```json
{
  "id": "dictionary",
  "kind": "translation",
  "displayName": "My Dictionary",
  "entry": "translate",
  "resultType": "dictionary"
}
```

最终返回值必须使用以下结构：

```js
return {
  kind: "dictionary",
  dictionary: {
    word: "hello",
    language: "en_US",
    pronunciations: [
      {
        label: "UK",
        phonetic: "həˈləʊ",
        audioUrl: "https://example.com/hello-uk.mp3",
      },
      {
        label: "US",
        phonetic: "həˈloʊ",
      },
    ],
    meanings: [
      {
        partOfSpeech: "interjection",
        translations: ["你好", "喂"],
        definitions: ["Used as a greeting."],
        extendedDefinitions: ["Used when meeting or calling someone."],
        examples: ["Hello, world!"],
        synonyms: ["hi"],
        antonyms: ["goodbye"],
        tags: ["spoken"],
      },
    ],
    tags: ["common", "CET4"],
    forms: [
      { type: "plural", word: "hellos" },
    ],
    properties: [
      { key: "source", label: "来源", value: "My Dictionary" },
    ],
    audioUrl: "https://example.com/hello.mp3",
  },
};
```

词条字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `word` | string | 是 | 原词，也是默认朗读文本。 |
| `language` | string | 否 | 原词语言，例如 `en_US`。 |
| `pronunciations` | object[] | 否 | 音标和发音资源。 |
| `meanings` | object[] | 否 | 按词性或义项组织的内容。 |
| `tags` | string[] | 否 | 整个词条的标签。 |
| `forms` | object[] | 否 | 词形变化。 |
| `properties` | object[] | 否 | 其他展示属性。 |
| `audioUrl` | string | 否 | 词条级发音资源 URL。 |

`pronunciations[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `label` | string | 读音标签，例如 `UK`、`US`。 |
| `phonetic` | string | 音标。 |
| `audioUrl` | string | 发音资源 URL。 |

每项至少提供 `phonetic` 或 `audioUrl`。

`meanings[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `partOfSpeech` | string | 词性。 |
| `translations` | string[] | 面向目标语言的简明释义。 |
| `definitions` | string[] | 基础定义。 |
| `extendedDefinitions` | string[] | 扩展释义。 |
| `examples` | string[] | 例句。 |
| `synonyms` | string[] | 同义词。 |
| `antonyms` | string[] | 反义词。 |
| `tags` | string[] | 当前义项标签。 |

每个义项至少包含一个非空字段。

`forms[]` 固定为 `{ type, word }`，其中 `word` 必填。推荐使用稳定的 `type` 值，例如 `plural`、`past`、`past_participle`、`present_participle`、`third_person_singular`、`comparative`、`superlative`、`lemma` 或 `variant`。

`properties[]` 固定为 `{ key, label, value }`，其中 `value` 必填；`label` 省略时可以使用 `key` 作为展示名。

结构化结果会严格校验。外层只能使用 `kind` 和 `dictionary`，不要返回裸词条、额外包装或字段别名。普通文本也必须直接返回字符串，而不是 `{ text: "..." }`。

## OCR 服务

Manifest：

```json
{
  "id": "ocr",
  "kind": "ocr",
  "displayName": "My OCR",
  "entry": "recognize"
}
```

入口：

```js
export async function recognize(base64, language, options) {
  // 调用 OCR API。
  return "recognized text";
}
```

| 参数 | 说明 |
| --- | --- |
| `base64` | PNG 图片的 Base64 内容，不包含 `data:image/png;base64,` 前缀。 |
| `language` | 映射后的识别语言；自动识别时可能是 `auto`。 |

返回识别文本。流式接口可以通过 `options.setResult(chunk)` 输出增量字符串。

## 语音服务

Manifest：

```json
{
  "id": "speech",
  "kind": "speech",
  "displayName": "My Speech",
  "entry": "tts"
}
```

入口：

```js
export async function tts(text, language, options) {
  const response = await options.utils.fetch(options.config.endpoint, {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });
  return await response.arrayBuffer();
}
```

| 参数 | 说明 |
| --- | --- |
| `text` | 待朗读文本。 |
| `language` | 映射后的文本语言；自动识别时可能是 `auto`。 |

支持以下返回形式：

```js
return new Uint8Array(bytes);
return arrayBuffer;
return [255, 251, 144, 68];
return "base64-audio-data";
return { base64: "base64-audio-data", format: "mp3" };
return { bytes: new Uint8Array(bytes), format: "wav" };
```

对象可以使用 `base64`、`data`、`audio` 或 `bytes` 携带音频内容；可以使用 `format`、`audioFormat`、`responseFormat`、`mimeType` 或 `contentType` 描述格式。

## 生词本服务

Manifest：

```json
{
  "id": "wordbook",
  "kind": "wordbook",
  "displayName": "My Wordbook",
  "entry": "add",
  "permissions": ["network"],
  "config": [
    {
      "key": "endpoint",
      "label": "Endpoint",
      "control": "text",
      "required": true
    },
    {
      "key": "token",
      "label": "Token",
      "control": "password",
      "required": true,
      "secret": true
    }
  ]
}
```

入口：

```js
export async function add(request, { config, utils }) {
  const response = await utils.fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Wordbook request failed: HTTP ${response.status}`);
  }

  return {
    success: true,
    message: "Added to wordbook.",
  };
}
```

`request`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sourceText` | string | 原文，已去除首尾空白。 |
| `translatedText` | string | 普通译文；词典结果会合并各义项的 `translations`，以换行分隔。 |
| `sourceLanguage` | string | Manggo 源语言代码；必要时使用词条的 `dictionary.language`。 |
| `targetLanguage` | string | Manggo 目标语言代码。 |
| `translationResult` | string \| object | 完整翻译结果：字符串或结构化词典对象。 |

成功时可以不返回值、返回 `true`、返回提示字符串，或返回 `{ success: true, message: "..." }`。失败时可以抛出异常、返回 `false`，或返回 `{ success: false, message: "..." }`。也可以使用 `ok` 代替 `success`，或使用 `error` 提供错误信息。

## 划词动作

划词动作使用 `kind: "action"` 声明。它与其他插件服务的关键区别是：插件安装成功后，动作会直接注册到 Manggo 的“划词助手”动作列表中，不需要用户创建服务实例。用户仍然可以在该列表中启用、停用和排序动作。

### 清单声明

推荐在 `services` 中声明 action：

```json
{
  "manifestVersion": 1,
  "id": "com.example.selection-actions",
  "name": "Example Selection Actions",
  "version": "1.0.0",
  "runtime": {
    "kind": "bun",
    "api": "manggo.plugin.v1",
    "main": "main.js"
  },
  "services": [
    {
      "id": "search-web",
      "kind": "action",
      "displayName": "Search Web",
      "iconName": "search",
      "precheck": "canSearchWeb",
      "entry": "searchWeb",
      "config": [
        {
          "key": "searchUrl",
          "label": "Search URL",
          "control": "text",
          "required": true,
          "default": "https://www.google.com/search"
        }
      ],
      "enabledByDefault": true
    }
  ]
}
```

action 的 `id` 必须在当前插件内唯一。`main` 可以覆盖 `runtime.main`。`entry` 为必填字段，与其他服务使用同一入口字段。`precheck` 为可选字段，省略后动作对所有非空选区可见。

划词动作不会创建服务实例。声明了非空 `config` 的 action 会在“划词助手”动作列表的显示行中出现编辑按钮，点击后使用与普通插件服务相同的字段控件填写配置；没有配置字段的 action 不显示该按钮。

配置按 action 独立保存，并通过 `options.config` 同时传给 `precheck` 和 `entry`。用户尚未保存配置时，字段值取清单中的 `default`；修改插件后已经删除的字段不会继续传给运行时。一个插件可以同时声明普通服务和多个划词动作。

### precheck 预检函数

预检函数签名：

```js
export function canSearchWeb(selectedText, options) {
  return selectedText.trim().length > 0;
}
```

Manggo 在每次读取到新的选区后，对当前已启用且声明了 `precheck` 的动作调用一次预检函数：

- `selectedText` 是本次选中的文本。
- 只有最终返回值为严格布尔值 `true` 时，动作才会在本次划词弹窗中显示。
- 返回 `false`、其他类型、不返回值或抛出异常时，本次不显示该动作。
- `precheck` 可以返回 `Promise<boolean>`，但应尽量保持快速、确定且无副作用。
- `precheck` 不提供 `options.manggo`，不能复制、替换文本或打开浏览器。

预检是“本次选区是否显示”的判断，不会改变用户在动作列表中的启用状态。没有声明 `precheck` 的已启用动作会直接显示。

### entry 执行函数

用户点击动作后，Manggo 调用 `entry` 指定的函数，签名为 `entry(selectedText, options)`：

```js
export async function searchWeb(selectedText, { config, manggo }) {
  const url = new URL(config.searchUrl || "https://www.google.com/search");
  url.searchParams.set("q", selectedText.trim());
  manggo.openWithDefaultBrowser(url.toString());
}
```

入口函数可以是同步或异步函数，也可以使用 `options.utils` 发起网络请求或读取插件资源。函数的普通返回值不会展示给用户；抛出的异常会作为动作执行错误显示。需要与桌面环境交互时，应调用 `options.manggo` 提供的宿主操作。

### options.manggo

| 函数 | 说明 |
| --- | --- |
| `manggo.copyToClipboard(text)` | 将参数转换为字符串并写入系统剪贴板。 |
| `manggo.replaceSelectedText(text)` | 请求 Manggo 将经过校验的原选区替换为指定文本。 |
| `manggo.openWithDefaultBrowser(url)` | 使用系统默认浏览器打开 URL；只接受带有效主机名的 HTTP 或 HTTPS 地址。 |

复制示例：

```js
export function copyMarkdown(selectedText, { manggo }) {
  manggo.copyToClipboard(`**${selectedText}**`);
}
```

替换示例：

```js
export function uppercase(selectedText, { manggo }) {
  manggo.replaceSelectedText(selectedText.toUpperCase());
}
```

打开网页示例：

```js
export function openDictionary(selectedText, { manggo }) {
  manggo.openWithDefaultBrowser(
    `https://example.com/dictionary?q=${encodeURIComponent(selectedText)}`
  );
}
```

宿主操作在 JavaScript 调用时进入 Manggo 的执行队列，不向插件返回操作结果。即使对它们使用 `await`，也只会立即得到 `undefined`，并不表示剪贴板写入、选区替换或浏览器打开已经完成。

`copyToClipboard` 与内置“翻译并复制”动作使用相同的剪贴板和通知流程。复制成功后，Manggo 会按照用户的“复制后显示通知”设置展示通知，通知内容为本次复制的文本。

`replaceSelectedText` 与内置“翻译并替换”动作使用相同的安全替换流程。Manggo 会使用用户点击动作时保存的原选区快照重新校验目标，避免在焦点或选区已经变化后修改错误位置；直接替换失败时会在可以安全访问剪贴板的情况下回退为复制，并通过通知和提示说明已经复制。对于支持兼容粘贴的目标，Manggo 还会在复制后尝试完成粘贴。

## 错误处理与工程实践

- 网络请求前校验必填配置，请求后检查 `response.ok`。
- 使用 `throw new Error("...")` 返回可读错误，不要吞掉异常。
- 不要在日志、错误消息或返回值中输出 API Key、Token 等敏感配置。
- 对外部响应做类型和空值校验，不要把不稳定的第三方结构直接返回给 Manggo。
- 流式输出只发送新增的字符串片段，避免重复发送完整累计文本。
- 结构化结果作为最终返回值，不要传给 `options.setResult()`。
- 使用 `utils.pluginDir` 和 `utils.cacheDir`，不要依赖开发机绝对路径。
- action 的 `precheck` 只返回布尔值并保持轻量，不要在预检阶段执行副作用。
- action 的宿主操作没有 JavaScript 回执；不要依据其返回值继续业务流程。
- 更新插件内容时同步更新 `version`，发布前重新安装生成的 `.mplugin` 做验证。

## 打包、安装与发布

`.mplugin` 是 zip 文件，`manggo.plugin.json` 必须位于压缩包根目录：

```text
my-plugin.mplugin
├── manggo.plugin.json
├── main.js
├── icon.png
└── assets/
```

打包示例：

```bash
mkdir -p dist
zip -r dist/my-plugin.mplugin manggo.plugin.json main.js icon.png assets
```

发布前建议完成以下检查：

1. `manifestVersion`、`runtime.kind` 和 `runtime.api` 使用受支持的值。
2. 所有服务的 `entry` 以及 action 可选的 `precheck` 都能从对应入口脚本导出。
3. 清单引用的脚本、图标和资源都已包含在插件包中。
4. 在 Manggo 中安装插件，实际添加、配置和调用每种普通服务，并在划词助手中验证 action 的启停、预检和执行。
5. 修改内容后更新插件版本并重新打包。

将插件发布到 GitHub 后，可以为仓库添加 `manggo-plugin` 话题标签，使其能够被 Manggo 插件列表索引。

## 本仓库示例

本仓库包含一个使用 OpenAI 兼容接口实现翻译、OCR 和语音合成的原生插件示例。可参考 [`manggo.plugin.json`](./manggo.plugin.json) 的多服务声明和 [`main.js`](./main.js) 的网络请求、流式响应及音频返回实现；运行 `./package.sh` 可在 `dist/` 下生成示例 `.mplugin`。
