# Manggo 原生插件开发指南

Manggo 原生插件可以扩展翻译、OCR、语音合成、生词本服务和划词动作。一个插件由清单文件、JavaScript 入口和可选资源组成，使用 Manggo 内置的 **moejs** 运行环境和 `manggo.plugin.v1` API。用户无需安装或下载 Bun、Node.js。

本仓库根目录的 `main.js`、`manggo.plugin.json` 和资源本身就是一个可安装的示例插件，
同时维护插件开发指南和 [TypeScript SDK](sdk/manggo-plugin.d.ts)。
开始开发前请阅读 [moejs 运行时能力与边界](docs/runtime.md)；现有 Bob / Pot 插件请参考
[兼容说明](docs/compatibility.md)。

当前 SDK 描述原生宿主 API **1.1**，清单中的 `runtime.api` 使用 `manggo.plugin.v1`。
通过清单 `requires.capabilities` 声明所需接口，包括 SQLite、翻译术语库、配置验证和桌面动作。

本文只描述 Manggo 原生插件格式：

- 清单文件固定为 `manggo.plugin.json`。
- 原生入口推荐使用 ES module，其他受支持的入口形式见运行时说明。
- 一个插件可以在 `services` 中声明一个或多个普通服务或划词动作。
- 插件包扩展名为 `.mplugin`，本质上是 zip 文件。

## 目录

- [安装与更新](#安装与更新)
- [快速开始](#快速开始)
- [插件清单](#插件清单)
- [服务配置表单](#服务配置表单)
- [配置验证](#配置验证)
- [JavaScript 运行时](#javascript-运行时)
- [TypeScript 与 SDK](#typescript-与-sdk)
- [翻译服务](#翻译服务)
- [OCR 服务](#ocr-服务)
- [语音服务](#语音服务)
- [生词本服务](#生词本服务)
- [划词动作](#划词动作)
- [错误处理与工程实践](#错误处理与工程实践)
- [打包、安装与发布](#打包安装与发布)
  - [发布可更新的插件](#发布可更新的插件)
- [本仓库示例](#本仓库示例)

## 安装与更新

在 Manggo 的「插件管理」中点击「安装插件」，选择下载的 `.mplugin` 文件。安装和使用插件需要 Pro 授权。 [Bob / Pot 插件安装说明](docs/compatibility.md)

打开「插件管理」时，Manggo 会自动检查已有更新源的插件。发现兼容的新版后，卡片上的「已加载」会变成绿色的「可更新」。点击徽标可查看版本和发布说明，再确认安装。更新后可继续使用原来的服务配置。

如果已安装的版本没有更新地址，可以下载新版插件包，在「插件管理」中直接覆盖安装。

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
    "kind": "moejs",
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

[安装生成的插件包](#安装与更新)后，到对应的服务设置添加翻译、OCR、语音或生词本服务。划词动作会自动出现在「划词助手」的动作列表中。

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
| `updateUrl` | string | 否 | HTTPS 更新清单地址。 [发布方法](#发布可更新的插件) |
| `icon` | string | 否 | 图标路径，相对插件根目录。 |
| `permissions` | string[] | 否 | 插件级权限。需要访问网络时声明 `network`。 |
| `requires` | object | 否 | 最低应用版本、所需宿主能力和支持的平台。 |
| `config` | object[] | 否 | 当前插件所有服务与动作共用的配置字段。 |
| `runtime` | object | 是 | JavaScript 运行时配置。 |
| `services` | object[] | 是 | 服务声明，至少包含一项；划词动作使用 `kind: "action"`。 |

普通服务和划词动作统一在 `services` 中声明。一个仅提供划词动作的插件仍然需要提供非空的 `services` 数组。

### runtime

原生插件使用以下运行时配置：

```json
{
  "kind": "moejs",
  "api": "manggo.plugin.v1",
  "main": "main.js"
}
```

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `kind` | `moejs` | 内置 JavaScript 引擎；也接受兼容声明 `bun`，同样由 moejs 执行。 |
| `api` | `manggo.plugin.v1` | 原生插件 API 版本。 |
| `main` | 文件路径 | 默认入口脚本，相对插件根目录。 |

### 版本与能力要求

`requires` 可声明最低应用版本、需要的能力和支持的平台。安装时和每次调用前都会检查，
不满足时显示兼容性错误。此字段可选，应按插件实际依赖填写。

```json
{
  "requires": {
    "capabilities": ["runtime.info", "service.validate", "config.shared", "desktop.openURI"],
    "platforms": ["darwin", "windows", "linux"]
  }
}
```

这是应合并到完整清单的字段片段。`minAppVersion` 可另设为三段数字的稳定版本，
例如 `"1.3.1"`；它约束应用版本，`manggo.env.apiVersion` 则是宿主接口版本，二者不同。
能力检查也适用于开发版；接口名称和环境字段见 [宿主信息与能力](docs/runtime.md#宿主信息与能力)。

### services

一个插件可以在 `services` 中声明多个服务，例如同时提供翻译和语音合成。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 插件内部唯一的服务 ID。 |
| `kind` | string | 是 | `translation`、`ocr`、`speech`、`wordbook` 或 `action`。 |
| `providerId` | string | 否 | 普通服务的提供方 ID；省略时生成 `插件ID#服务ID`。action 不使用此字段。 |
| `displayName` | string | 是 | 用户在服务列表中看到的名称。 |
| `entry` | string | 是 | 入口脚本导出的函数名；action 点击后同样调用此函数。 |
| `validate` | string | 否 | 自定义配置验证函数名；省略时尝试可选的 `validate` 导出。 |
| `precheck` | string | 否 | action 的预检函数名；返回严格布尔值 `true` 时才显示。 |
| `main` | string | 否 | 服务专用入口脚本；省略时使用 `runtime.main`。 |
| `resultType` | string | 否 | 仅用于翻译服务，可为 `text`、`dictionary` 或 `structured`，默认 `text`。 |
| `glossary` | boolean | 否 | 翻译服务设为 `true` 后，插件负责将本次请求的术语用于翻译。见 [术语库](#术语库)。 |
| `icon` | string | 否 | 普通服务图标；省略时使用顶层 `icon`。 |
| `iconName` | string | 否 | action 使用的 Material Symbols Rounded 图标名，默认 `extension`；按名称从完整目录选择。 |
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

传给对应入口函数的语言参数已经完成映射。宿主先处理应用语言标签和旧版别名，优先使用非空映射，再采用通用语言代码回退；未知语言按原值传入。映射不是支持语言白名单，插件仍应校验第三方服务是否接受该语言。单词本请求中的语言标签不经过此映射。

## 服务配置表单

`services[].config` 用于生成当前服务或动作的配置界面。顶层 `config` 使用相同字段结构，
用于整个插件的共享设置。保存后的值通过 `options.config` 提供给入口函数。

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

插件只应依赖自己声明的配置键，不要使用保留前缀 `_plugin`。原生字段没有默认值时为 `null`；用户保存的 `false`、`0`、空字符串或 `null` 不会被默认值覆盖。历史配置可能继续传入，重命名或删除字段时应处理旧值。

### 插件级共享配置

在清单顶层声明公共字段，可让翻译、OCR、语音或多个划词动作共享服务地址、密钥或软件路径。
例如，将软件路径放到顶层，两个动作的配置中都可以编辑它：

```json
{
  "config": [
    {"key": "applicationPath", "label": "软件路径", "control": "text", "default": ""}
  ],
  "services": [
    {"id": "search", "kind": "action", "displayName": "搜索", "entry": "searchFiles"},
    {"id": "send", "kind": "action", "displayName": "发送", "entry": "sendText"}
  ]
}
```

入口通过 `options.sharedConfig.applicationPath` 读取共享值，合并后的 `options.config`
也包含它。优先级从低到高是：共享字段默认值、已保存共享设置、当前服务字段默认值、
当前实例保存配置。因此，同名服务字段可覆盖公共设置。

共享值由宿主管理、持久化并随服务配置备份；脚本只获得当前清单声明字段的调用快照。
修改 `config` 或 `sharedConfig` 对象不会自动保存设置。不要读取 Manggo 的配置数据库；
临时缓存和插件自己产生的数据仍写入 `utils.cacheDir`。

## 配置验证

普通服务和划词动作的编辑界面均提供“测试连接”。服务可以声明 `validate` 入口，
该函数只接收一个 `options` 参数，获得未保存的配置草稿、共享配置、网络工具和取消信号。
它使用公共 `manggo` API，不提供复制、替换或其他桌面动作。

```js
export function validate({config, manggo}) {
  if (!config.apiKey) {
    throw new manggo.ServiceError("secretKey", "请填写 API Key", {
      troubleshootingLink: "https://example.com/help"
    });
  }
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new manggo.ServiceError("param", "服务地址必须使用 HTTP 或 HTTPS");
  }
  return true;
}
```

需要验证远端鉴权、模型或配额时，可以在异步验证函数中调用 `utils.fetch`，并传入
`signal`。成功返回 `true` 或 `{result:true}`；失败抛出结构化错误，或返回
`{result:false,error:{type,message,troubleshootingLink?}}`。单独返回 `false` 会显示通用验证失败。

省略清单 `validate` 时，宿主先尝试可选的 `validate` 导出；未找到时，翻译/OCR/TTS
沿用示例请求，动作只检查入口模块能否加载。插件生词本的“测试连接”需要自定义 `validate`。
测试配置不会保存草稿。

## JavaScript 运行时

### 模块导出

原生入口推荐使用 ES module。可以使用命名导出：

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

原生入口推荐使用 `.js` / `.mjs` 的 ESM 导出。支持相对 ESM 导入、动态 `import()`、包内 JSON、`.cjs` 和受限内置模块；Bob / Pot 也可使用各自的入口形式。依赖需要提前打包，安装时不会自动下载 npm 包。完整说明见 [模块与依赖](docs/runtime.md#模块与依赖)。

### options

所有入口函数最后一个参数都是 `options`：

| 字段 | 说明 |
| --- | --- |
| `options.config` | 合并共享设置与当前实例设置后的配置，包含清单默认值。 |
| `options.sharedConfig` | 当前清单声明的插件级共享字段及其默认值。 |
| `options.detect` | 翻译请求映射后的检测语言，缺失时回退到 `from`；其他服务为空字符串。 |
| `options.query` | 只读调用上下文；翻译时包含 `text`、`originalText`、`from`、`to`、`detectFrom` 和 `detectTo`。 |
| `options.glossary` | 翻译入口的只读术语接口，通过 `getTerms()` 读取。 |
| `options.signal` | 本次调用的 `AbortSignal`，可传给 Fetch 并监听取消。 |
| `options.setResult(value)` | 服务专属结果回调，具体规则见下表。 |
| `options.utils` | Manggo 提供的运行时工具。 |
| `options.image` | 仅 OCR 可用；只读的 `pixelWidth` / `pixelHeight`，对应实际输入 PNG。 |
| `options.manggo` | 公共宿主 API 包含 `env`、`log`、`ServiceError` 和 `sqlite`。动作执行时还提供桌面操作。 |

`options.setResult()` 与 `options.utils.setResult()` 是同一函数，行为随服务变化：

| 服务 | 回调行为 | 与最终返回值的关系 |
| --- | --- | --- |
| 翻译 | 字符串追加片段；结构化译文保存权威快照 | 文本流优先于返回字符串；有效字典或显式结构化译文优先。 |
| OCR | 字符串追加文本；`OCRResult` 对象保存最新快照 | 对象返回值覆盖文本流；无显式返回值时提交快照；返回字符串仅在没有文本流时采用。 |
| 语音 | 保存最后一个非空的完整音频候选结果 | 无显式返回值时使用候选；不会拼接音频片段。 |
| 生词本 | 保存最新非空消息 | 字符串或对象回执可覆盖消息；`true` / `null` / 不返回保留消息。 |
| 动作 | 可输出文本，但不作为动作界面结果展示 | 执行返回值忽略；失败应抛出异常。 |

仅 `undefined` 表示没有返回值。翻译显式返回 `null` 会报错，语音显式返回 `null` 也不会回退到候选音频。

`options.query.originalText` 保留预处理前的原始文本，没有单独原文时回退到 `text`。
翻译语言字段已经过服务的 `language` 映射。其他服务不应假定存在有意义的翻译查询数据；
继续使用各自入口的图片、语言和单词本请求参数。取消与生命周期详见 [调用规则](docs/runtime.md#调用规则)。

公共 API 也可通过全局 `manggo` 读取。桌面操作使用动作执行入口的 `options.manggo`，
避免在顶层、预检查或配置验证阶段调用。

### options.utils

| 字段或函数 | 说明 |
| --- | --- |
| `utils.fetch(url, init)` | Fetch 风格网络请求，遵循 Manggo 的代理、证书、重定向和取消设置。 |
| `utils.readTextFile(path)` | 读取 UTF-8 文本并移除一个前导 BOM。 |
| `utils.readBinaryFile(path)` | 返回 `Promise<number[]>`，保留原始字节。 |
| `utils.cacheDir` | 虚拟私有持久目录 `/data`，按插件隔离。 |
| `utils.pluginDir` | 虚拟只读包目录 `/package`。 |
| `utils.osType` | `Darwin`、`Windows_NT` 或 `Linux`。 |
| `utils.setResult(chunk)` | 等价于 `options.setResult(chunk)`。 |

需要访问随插件分发的文件时，使用 `utils.pluginDir` 构造路径；需要写入运行数据时，使用 `utils.cacheDir`，不要写入插件安装目录。

写文件可使用受限的 `Bun.write` 或 `node:fs/promises`，目标路径应位于插件私有数据目录。
原生插件通过 `manggo.sqlite` 读取随包分发的数据库或维护插件私有数据库。
只读查询与读写示例见 [SQLite](docs/runtime.md#sqlite)。Pot 插件通过 `utils.Database` 使用数据库。
网络、文件与全局 API 的具体范围见 [运行时能力](docs/runtime.md)。

## TypeScript 与 SDK

[SDK 声明](sdk/manggo-plugin.d.ts) 是开发工具，不含运行时代码。可用泛型声明自己的配置接口：

```ts
import type { Translate } from "./sdk/manggo-plugin";

interface Config { endpoint: string; apiKey: string }

export const translate: Translate<Config> = async (text, from, to, {config, utils}) => {
  const response = await utils.fetch(config.endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}`},
    body: JSON.stringify({text, from, to})
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};
```

JavaScript 可通过 JSDoc 使用同一套类型：

```js
// @ts-check
/** @type {import("./sdk/manggo-plugin").PrecheckAction} */
export const check = text => text.trim().length > 0;

/** @type {import("./sdk/manggo-plugin").RunAction} */
export const run = (text, {manggo}) => manggo.copyToClipboard(text);
```

| 类型 | 用途 |
| --- | --- |
| `Translate` / `TranslationOptions` / `TranslationResult` | 文本、词典和结构化译文。 |
| `GlossaryTerm` / `PluginGlossary` | 翻译入口读取的术语。 |
| `StructuredTranslationResult` | 译文格式和独立思考内容。 |
| `DictionaryPronunciation` / `PronunciationAudio` | 词典音标和对应的发音音频。 |
| `Recognize` / `OCROptions` / `OCRResult` | OCR 文字、图像尺寸、区域坐标。 |
| `Speak` / `SpeechOptions` / `SpeechResult` / `SpeechCandidate` | 语音返回值与可序列化候选结果。`Speak` 类型也适用于名为 `tts` 的入口。 |
| `AddToWordbook` / `WordbookRequest` / `WordbookReceipt` | 单词本请求和回执。 |
| `RunAction` / `PrecheckAction` / `SelectionActions` | 动作执行、只读预检查与宿主操作。 |
| `ValidateConfig` / `ValidationOptions` / `ValidationResult` | 未保存配置的自定义验证。 |
| `HostAPI` / `PluginEnvironment` / `PluginQuery` / `ServiceErrorDetails` | 宿主信息、调用上下文和结构化错误。 |
| `SQLiteAPI` / `SQLiteDatabase` / `SQLiteWritableDatabase` | SQLite 开库、参数化查询和写入。 |
| `PluginManifest` / `PluginService` / `PluginConfigField` | 原生清单与配置表单。 |

`tsconfig.json` 使用包含 `ES2022`、`DOM` 的 `lib`，为 Fetch 等 Web API 提供类型。

使用自定义请求头时，可用 SDK 的 `PluginWebSocketConstructor` 标注 `WebSocket` 构造器。
[WebSocket 请求头用法](docs/runtime.md#websocket-请求头)

```ts
import type { PluginWebSocketConstructor } from "./sdk/manggo-plugin";

const ManggoWebSocket = WebSocket as PluginWebSocketConstructor;

function connect(endpoint: string, apiKey: string) {
  return new ManggoWebSocket(endpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
```

发布前由开发工具把 TypeScript 编译/打包为 JavaScript，清单指向生成的 `.js`；
发布包不支持直接使用 `.ts` 源码，也不会在安装时执行 npm 安装或 TypeScript 构建。
SDK 只描述原生服务契约；完整 Node/Bun 类型包中的其他声明不代表宿主支持相应 API。

需要为共享设置标注类型时，可使用第二个配置泛型，例如 `Translate<Config, SharedConfig>`。
动作预检查的类型不包含 `options.manggo`，验证函数则只包含公共 `HostAPI`。

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

返回翻译字符串。流式接口多次调用 `options.setResult(delta)` 时只发送新增片段；已有非空文本流后，宿主以这些片段的拼接作为结果，返回的完整字符串不会覆盖文本流。没有文本流时采用返回字符串。

### 术语库

翻译服务可以声明 `glossary: true`，并在顶层的 `requires.capabilities` 中添加
`"translation.glossary"`。在翻译入口通过 `options.glossary.getTerms()` 同步读取
本次源语言到目标语言方向的全部启用术语。每项包含原词 `source` 和译词 `target`。
数组和条目都是只读的。术语库关闭、语言尚未确定或该方向没有启用术语时，返回空数组。

```js
const terms = options.glossary.getTerms();
const body = JSON.stringify({text, from, to, glossary: terms});
```

启用后，插件收到待译文本和术语，可按上游接口要求把术语传给后端，或写入模型提示。
服务未声明 `glossary: true` 时，`getTerms()` 返回空数组，普通翻译可能收到按术语库替换后的文本。
预处理前的原文可通过 `options.query.originalText` 读取。词典查找使用原查询词，返回普通译文时适用文本翻译的术语规则。

### 结构化译文

需要指定格式或区分思考内容时，在翻译服务中声明 `resultType:"structured"`，
并要求 `translation.structured` 能力：

```json
{
  "id": "translation",
  "kind": "translation",
  "displayName": "Rich Translation",
  "entry": "translate",
  "resultType": "structured"
}
```

```js
export async function translate(text, from, to, {config, utils, signal, setResult}) {
  setResult({kind: "translation", text: "", thinking: "正在翻译…"});
  const response = await utils.fetch(config.endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({text, from, to}),
    signal
  });
  if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
  const result = await response.json();
  return {kind: "translation", text: result.translation, format: "markdown", thinking: ""};
}
```

| 字段 | 说明 |
| --- | --- |
| `kind` | 固定为 `translation`。 |
| `text` | 译文正文；结构化 `setResult` 传累计全文。 |
| `format` | `plain`、`markdown` 或 `lines`。`plain`/`lines` 保持纯文本，Markdown 还遵从用户的渲染开关。 |
| `thinking` | 独立显示的思考内容或状态，不进入复制、朗读和普通译文文本。 |
| `from` / `to` | 可选的结果语言代码，缺失时沿用本次请求。 |

结构化快照与最终显式返回值都作为权威译文。无显式返回值时采用最新快照；字符串
`setResult` 追加片段。省略 `format` 或 `thinking` 可保留此前元数据，传入 `thinking:""`
可清空状态。可选字段应省略，不传 `null`，也不返回没有 `kind` 的 `{text:"..."}`。

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
        audio: { url: "https://example.com/hello-uk.mp3" },
      },
      {
        label: "US",
        phonetic: "həˈloʊ",
        audio: { url: "https://example.com/hello-us.mp3" },
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
  },
};
```

词条字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `word` | string | 否 | 原词，也是默认朗读文本；省略或空白时使用请求的原文。 |
| `language` | string | 否 | 原词语言，例如 `en_US`。 |
| `pronunciations` | object[] | 否 | 音标和发音资源。 |
| `meanings` | object[] | 否 | 按词性或义项组织的内容。 |
| `tags` | string[] | 否 | 整个词条的标签。 |
| `forms` | object[] | 否 | 词形变化。 |
| `properties` | object[] | 否 | 其他展示属性。 |

`pronunciations[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `label` | string | 读音标签，例如 `UK`、`US`。 |
| `phonetic` | string | 必填的音标。 |
| `audio` | object | 可选的发音音频。提供 HTTP(S) `url` 或 Base64 `base64`，可附 `contentType`。 |

Manggo 会在带有 `audio` 的音标旁显示播放按钮。用户点击后播放该音标的发音。
插件依赖发音播放时，可在清单的 `requires.capabilities` 中添加 `translation.pronunciationAudio`。

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

词典结果会严格校验。外层只能使用 `kind` 和 `dictionary`，不要返回裸词条、额外包装或字段别名。
普通文本直接返回字符串；富译文使用上一节明确的 `kind:"translation"` 结构。

内部字典字段同样不接受未知字段或 `null`；没有内容时应省略字段。`language` 省略或空白时，宿主使用检测语言，或者非 `auto` 的源语言。即使先输出了文本片段，最终返回的有效字典仍为权威结果。

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

需要图片选字、选区翻译或原图翻译时，返回带定位的结果：

下面的接口示例假设 OCR 后端接收 `{image, language}`，返回
`{text?, lines:[{text, polygon:[{x,y}, ...], confidence?}]}`。在服务配置中声明 `endpoint`
后，将区域映射逻辑用于自己的 `recognize` 入口。

```js
export async function recognize(base64, language, {config, utils, image}) {
  const response = await utils.fetch(config.endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({image: base64, language})
  });
  if (!response.ok) throw new Error(`OCR HTTP ${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.lines)) throw new Error("OCR backend did not return lines");
  // 此后端约定 lines[].polygon 已还原到 image.pixelWidth × image.pixelHeight。
  return {
    text: result.text,
    coordinateSystem: "pixels",
    textRegions: result.lines.map(line => ({
      text: line.text, polygon: line.polygon, confidence: line.confidence
    }))
  };
}
```

`text` 显式传入时为权威全文，包括空字符串；省略时按区域顺序连接文字。`textRegions`
中的每项为 `{text, polygon:[{x,y}, ...], confidence?}`；置信度省略表示未知。
多边形应为凸多边形，建议四个角点。坐标原点在左上角，x 向右、y 向下：

- `coordinateSystem` 省略或为 `normalized`：坐标相对于实际输入图像，通常在 `[0,1]`。
- `coordinateSystem:"pixels"`：使用 `options.image.pixelWidth/pixelHeight` 对应的原图像素。
- 后端缩放、旋转或裁剪过输入时，插件必须把坐标还原到未修改的输入图像。

宿主统一角点顺序并裁切到图像内；坐标缺失、非有限值或退化形状不会产生可选区域，
识别文字仍保留。宿主不推测文字位置。每次最多 10,000 个区域，每区 3–64 个点，另受结果大小限制。

`setResult({text, textRegions, coordinateSystem})` 保存最新快照，在入口无显式返回值时提交；
对象返回值会覆盖之前的文本流。纯字符串 OCR 结果不提供可选文字区域。
本仓库根目录的示例使用视觉模型提取纯文本；接入提供坐标的后端时，可参考本节调整 `recognize`。

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
return new Blob([bytes], { type: "audio/wav" });
return response; // 宿主调用 arrayBuffer() 读取 Response。
```

对象可以使用 `base64`、`data`、`audio` 或 `bytes` 携带音频内容；可以使用 `format`、`audioFormat`、`responseFormat`、`mimeType` 或 `contentType` 描述格式。

这些音频字段可以嵌套，也支持从零开始、键连续的数字键对象。字节必须是 `[0,255]` 的整数。
字符串可为 Base64 或音频 Data URI；原生插件不能把 URL 字符串当音频返回，应先用 `fetch` 下载。
格式提示按上述顺序取首个非空值，然后回退到服务配置中的格式，最后默认 `mp3`；实际内容仍须能被播放解码器识别。

也可通过 `setResult` 提交完整音频候选，最后一个非空候选在入口不返回时使用；显式返回值优先。
候选经过 JSON 序列化，只支持 Base64、普通字节数组、`Uint8Array`/数字键对象及其嵌套音频对象。
`ArrayBuffer`、`Blob` 和 `Response` 应直接返回，不能传给 `setResult`；回调不是音频分片播放接口。

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
| `translationResult` | string \| object | 完整规范化结果：字符串、结构化译文或词典对象。 |

成功时可以不返回值、返回 `true`、返回提示字符串，或返回 `{ success: true, message: "..." }`。失败时可以抛出异常、返回 `false`，或返回 `{ success: false, message: "..." }`。也可以使用 `ok` 代替 `success`，或使用 `error` 提供错误信息。

`setResult(message)` 保存最新非空消息。返回 `true`、`null` 或不返回保留它；字符串返回值替换它，
对象回执以自己的 `message` 为准。没有最终消息时宿主使用默认成功提示。`translationResult`
中的字典已经规范化并补齐 `word`；请求语言标签不经过插件的 `language` 映射。

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
    "kind": "moejs",
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

划词动作在安装后自动注册，无需另行添加服务。动作列表均提供编辑入口，可填写动作字段、
共享字段并测试连接；没有字段的动作也可检查入口模块或运行自定义验证。

`services[].config` 按 action 独立保存，顶层 `config` 则在整个插件共享，合并值通过
`options.config` 同时传给 `precheck` 和 `entry`。未保存的字段取 `default`，没有默认值时为
`null`。一个插件可以同时声明普通服务和多个划词动作。

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
- `precheck` 不提供 `options.manggo`，不能复制、替换文本或打开浏览器。可通过全局 `manggo.sqlite` 进行只读查询。
- 预检最多运行 500 ms，禁止网络和文件写入；预检与动作执行不共享变量。模块顶层代码也要满足预检限制。

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
| `manggo.openURI(uri)` | 打开已注册的应用协议；声明 `desktop.openURI` 权限。 |
| `manggo.openPath(path)` | 使用默认应用打开现有绝对路径；声明 `desktop.openPath` 权限。 |
| `manggo.revealFile(path)` | 在文件管理器定位现有绝对路径；声明 `desktop.reveal` 权限。 |
| `manggo.launchApplication(path, args)` | 通过绝对路径和参数数组启动应用；声明 `desktop.launch` 权限。 |

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

桌面操作返回 `undefined`；使用 `await` 也不会得到实际操作结果。操作失败可抛出异常，
但不能用返回值推断后续复制、替换或应用内操作是否完成。

复制成功后的通知遵循用户的“复制后显示通知”设置。

替换文字前，Manggo 会校验选区目标。无法安全替换时可能回退为复制，并通过提示告知用户。

### 应用协议与本地程序

声明所需能力和权限后，插件可以直接使用应用注册的协议，无需查找 EXE：

```js
export function createReminder(selectedText, {manggo}) {
  const query = new URLSearchParams({title: selectedText.trim()});
  manggo.openURI(`ticktick://x-callback-url/v1/add_task?${query}`);
}

export function searchInLertaro(selectedText, {manggo}) {
  manggo.openURI(`lertaro://search/${encodeURIComponent(selectedText)}`);
}
```

这些动作需在顶层或服务级声明 `permissions:["desktop.openURI"]`；
`requires.capabilities` 也应包含 `desktop.openURI`。`openURI` 不接受 `file`、`data`、
`javascript`、`vbscript` 和 `shell`，本地文件使用独立路径接口。

需要命令行参数的桌面应用可使用：

```js
export function searchFiles(selectedText, {config, manggo}) {
  manggo.launchApplication(config.applicationPath, ["-search", selectedText]);
}
```

此动作声明 `desktop.launch` 权限，`applicationPath` 由用户配置，必须是本机的绝对路径。
macOS 还接受 `.app` 目录。参数按数组传递，不解析 shell 命令，不接收自定义环境变量。
应用成功启动后可继续运行；取消阻止后续启动，不终止已经打开的应用。原生程序拥有当前
用户权限；限制启动入口不构成操作系统级原生代码沙箱。

`openPath` 和 `revealFile` 不向插件授予路径内容读取权限。Linux 文件管理器不支持
ShowItems 时，定位操作回退到打开父目录。上述桌面操作只在动作执行期间可用，
不提供窗口输入自动化或完整 `Bun.spawn` 行为。

## 错误处理与工程实践

### 结构化错误

公共宿主 API 提供 `manggo.ServiceError`。可以抛出错误，也可以在验证结果的 `error` 字段
返回 `{type,message,troubleshootingLink?,addition?}`：

```js
throw new manggo.ServiceError("unsupportedLanguage", "此服务不支持当前语言", {
  troubleshootingLink: "https://example.com/languages"
});
```

`type` 可使用 `secretKey`、`param`、`unsupportedLanguage`、`notFound`、`network`、`api`
等描述问题；`unsupportedLanguage` 与 `notFound` 会折叠对应翻译卡片。`message` 用于展示，
`troubleshootingLink` 必须是 HTTP(S)，`addition` 只放可序列化的调试数据。
普通 `Error` 继续可用。错误和日志的体积限制见 [运行时限制](docs/runtime.md#使用限制)。

### 插件诊断

使用 `manggo.log.debug/info/warn/error` 输出开发日志，或使用原生环境的
`console.log/debug/info/warn/error`。用户可从插件管理的“诊断”入口查看当前插件的最近记录，
包括预检查、模块加载和执行失败的位置。

日志仅保存在当前应用运行期间，每插件最多 64 条，卸载或退出后清除，不随遥测上传。
Manggo 会替换当前配置中已识别的密钥，插件也应主动避免输出敏感信息。

### 工程实践

- 网络请求前校验必填配置，请求后检查 `response.ok`。
- 使用 `throw new Error("...")` 返回可读错误，不要吞掉异常。
- 不要在日志、错误消息或返回值中输出 API Key、Token 等敏感配置。
- 对外部响应做类型和空值校验，不要把不稳定的第三方结构直接返回给 Manggo。
- 原生字符串流只发送新增片段，结构化译文提交完整快照；Pot 的累计文本规则见 [兼容说明](docs/compatibility.md)。
- 字典直接返回；OCR 快照和完整音频候选可按各自的 `setResult` 契约提交。
- 资源和缓存使用 `utils.pluginDir`、`utils.cacheDir`；桌面程序路径由用户配置，不硬编码开发机路径。
- action 的 `precheck` 只返回布尔值并保持轻量，不要在预检阶段执行副作用。
- action 的桌面操作不返回执行结果；不要依据其返回值继续业务流程。
- 更新插件内容时同步更新 `version`，发布前重新安装生成的 `.mplugin` 做验证。

## 打包、安装与发布

`.mplugin` 是 ZIP 文件。安装器也接受 `.zip`。将 `manggo.plugin.json` 放在压缩包根目录
或唯一包含清单的顶层目录。打包大型 SQLite 词库时可以使用 ZIP64。

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

使用相同插件 ID 覆盖安装时，Manggo 会更新包内容，原有的服务实例和私有数据仍按 ID 保留。
保留已发布的服务类型、服务 ID 和提供方 ID，已配置的实例就能找到对应入口。

发布前建议完成以下检查：

1. `manifestVersion`、`runtime.kind` 和 `runtime.api` 使用受支持的值。
2. 所有服务的 `entry` 以及 action 可选的 `precheck` 都能从对应入口脚本导出。
3. 清单引用的脚本、图标和资源都已包含在插件包中。
4. 在 Manggo 中安装插件，实际添加、配置和调用每种普通服务，并在划词助手中验证 action 的启停、预检和执行。
5. 修改内容后更新插件版本并重新打包。

在 GitHub 仓库添加 `manggo-plugin` 话题标签，用户可从 Manggo 的“下载插件”入口打开该话题页。

插件依赖必须提前构建并随包分发；用户安装时不会下载 Node、Bun 或 npm 包。第三方库应优先选择
纯 JavaScript、无 DOM 且只依赖已支持宿主 API 的实现，并在 Manggo 中验证。

### 发布可更新的插件

为更新清单选一个长期可用的 HTTPS 地址，在 `manggo.plugin.json` 顶层添加 `"updateUrl": "https://example.com/my-translator/updates.json"`。从第一个支持更新的插件包起就写入这个地址。

1. 保持插件的 `id`，提高 `version`，例如从 `1.0.0` 升到 `1.1.0`。重新打包并上传到可直接下载的 HTTPS 地址。
2. 对发布的插件包计算 SHA-256。运行 `shasum -a 256 my-translator-1.1.0.mplugin`，取输出的第一列。
3. 将版本、下载地址和校验值写入 `updates.json`，再把清单发布到 `updateUrl` 指定的地址。

```json
{
  "id": "com.example.my-translator",
  "versions": [
    {
      "version": "1.1.0",
      "url": "https://example.com/my-translator/my-translator-1.1.0.mplugin",
      "sha256": "<替换为插件包的 SHA-256>",
      "notes": "改进翻译选项的提示。"
    }
  ]
}
```

`id` 和 `version` 要与插件包内的清单一致。`notes` 是可选的纯文本发布说明。
清单可保留多个版本。如果某个版本有最低 Manggo 版本、平台或能力要求，在对应条目中填写与包内一致的 `requires`，以便用户看到可安装的新版。 [版本与能力要求](#版本与能力要求)

发布后，可安装已包含 `updateUrl` 的上一版，打开「插件管理」验证能否更新。

## 本仓库示例

本仓库根目录就是一个使用 OpenAI 兼容接口实现翻译、OCR 和语音合成的可安装原生插件。
[`manggo.plugin.json`](./manggo.plugin.json) 声明三个服务，入口统一位于 [`main.js`](./main.js)，
可直接参考其中的网络请求、流式响应及音频返回实现。

在仓库根目录运行以下命令，即可打包为 `dist/com.manggo.examples.openai-compatible-services.mplugin`：

```bash
./package.sh
```

安装后在 Manggo 中添加并配置对应服务。根目录 OCR 示例使用视觉模型提取文字，不提供坐标；
OCR 定位、单词本、字典和划词动作的接口示例见本文对应章节。

示例中的模型名和接口配置是可编辑的演示默认值；第三方服务的可用模型、鉴权和参数以所用服务为准。
