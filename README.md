# Manggo 原生插件示例：OpenAI Translation / OCR / TTS

这个目录是一个完整的 Manggo 原生插件示例。安装后，你可以在 Manggo 里添加三个服务：

- `OpenAI Compatible Translator`：调用 OpenAI 兼容 `/chat/completions` 做翻译。
- `OpenAI Compatible OCR`：调用 OpenAI 兼容 `/chat/completions` 做图片文字识别。
- `OpenAI Text-to-Speech`：调用 OpenAI `/audio/speech` 把文本读成音频。

本示例只使用 Manggo 原生插件格式：`manggo.plugin.json` + ES module `main.js`。

## 打包和安装

在此目录运行：

```bash
./package.sh
```

脚本会生成：

```text
dist/com.manggo.examples.openai-compatible-services.mplugin
```

`.mplugin` 本质是 zip 文件，要求 `manggo.plugin.json` 位于压缩包根目录。生成后到 Manggo 的“插件管理”页安装，然后分别在翻译、OCR、语音服务页添加插件服务。

## 目录结构

```text
manggo-plugin/
├── manggo.plugin.json
├── main.js
└── icon.png
```

## Manggo 原生 manifest

原生插件必须包含 `manggo.plugin.json`。

```json
{
  "manifestVersion": 1,
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Optional description",
  "author": "Example",
  "homepage": "https://example.com",
  "icon": "icon.svg",
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
      "displayName": "My Translation",
      "entry": "translate",
      "main": "main.js",
      "icon": "icon.svg",
      "permissions": ["network"],
      "language": {
        "auto": "auto",
        "en_US": "en",
        "zh_CN": "zh"
      },
      "config": []
    }
  ]
}
```

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `manifestVersion` | number | 是 | 当前必须是 `1`。 |
| `id` | string | 是 | 插件唯一 ID，建议使用反向域名。 |
| `name` | string | 是 | 插件名称。 |
| `version` | string | 是 | 插件版本。 |
| `description` | string | 否 | 插件说明。 |
| `author` | string | 否 | 作者。 |
| `homepage` | string | 否 | 项目主页。 |
| `icon` | string | 否 | 插件图标路径，相对插件根目录。 |
| `permissions` | string[] | 否 | 权限声明。网络插件写 `["network"]`。 |
| `runtime` | object | 是 | JS 运行时配置。 |
| `services` | object[] | 是 | 插件提供的服务列表，必须非空。 |

## runtime 字段

```json
"runtime": {
  "kind": "bun",
  "api": "manggo.plugin.v1",
  "main": "main.js"
}
```

| 字段 | 可选值 | 说明 |
| --- | --- | --- |
| `kind` | `bun` | 当前原生插件运行在 Bun。 |
| `api` | `manggo.plugin.v1` | 当前原生插件 API。 |
| `main` | JS 文件路径 | 默认入口脚本，相对插件根目录。 |

## services[] 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 插件内部服务 ID。 |
| `kind` | string | 是 | `translation`、`ocr`、`speech`。 |
| `providerId` | string | 否 | 服务提供方 ID。省略时 Manggo 生成 `插件ID#服务ID`。 |
| `displayName` | string | 是 | 用户添加服务时看到的名称。 |
| `entry` | string | 是 | `main.js` 中导出的入口函数名。 |
| `main` | string | 否 | 服务专用入口脚本。省略时使用 `runtime.main`。 |
| `icon` | string | 否 | 服务图标。省略时使用顶层 `icon`。 |
| `permissions` | string[] | 否 | 服务权限，会和顶层权限合并。 |
| `language` | object | 否 | Manggo 语言代码到插件/API 语言代码的映射。 |
| `config` | object[] | 否 | 添加或编辑服务时展示给用户的配置表单。 |

服务类型：

| `kind` | 默认用途 | 入口函数签名 |
| --- | --- | --- |
| `translation` | 翻译 | `translate(text, from, to, options)` |
| `ocr` | 图片文字识别 | `recognize(base64, language, options)` |
| `speech` | 文本转语音 | `tts(text, language, options)` |

## config[] 字段

`services[].config` 会生成服务配置表单。用户保存后，插件运行时从 `options.config` 读取这些值。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | string | 是 | 配置键。插件里用 `options.config[key]` 读取。 |
| `label` | string | 是 | 表单标签。 |
| `placeholder` | string | 否 | 输入框占位提示。 |
| `description` | string | 否 | 字段说明。 |
| `control` | string | 是 | 控件类型，见下表。 |
| `required` | boolean | 否 | 保存服务时要求非空。 |
| `secret` | boolean | 否 | 按敏感字段处理。`password` 控件默认是敏感字段。 |
| `editable` | boolean | 否 | 仅对 `select` 有效，允许用户输入自定义值。 |
| `default` | any | 否 | 默认值。 |
| `options` | object[] | 否 | `select` 选项。每项必须包含 `label` 和 `value`。 |

`control` 支持：

| 值 | UI 控件 | 值类型 |
| --- | --- | --- |
| `text` | 单行文本 | string |
| `password` | 密码输入 | string |
| `textarea` | 多行文本 | string |
| `select` | 下拉选择 | 取决于 option value |
| `integer` | 整数输入 | number |
| `decimal` | 小数输入 | number |
| `boolean` | 开关 | boolean |

`select` 示例：

```json
{
  "key": "responseFormat",
  "label": "Audio format",
  "control": "select",
  "default": "mp3",
  "options": [
    { "label": "MP3", "value": "mp3" },
    { "label": "WAV", "value": "wav" }
  ]
}
```

## JS 原生上下文

Manggo 原生插件必须使用 ES module 导出入口函数：

```js
export async function translate(text, from, to, options) {
  return "translated text";
}

export async function recognize(base64, language, options) {
  return "recognized text";
}

export async function tts(text, language, options) {
  return new Uint8Array([/* audio bytes */]);
}
```

也支持默认导出对象：

```js
export default {
  translate,
  recognize,
  tts,
};
```

原生上下文不支持 CommonJS `require()`，也不支持 Pot 风格的全局函数入口。

## translate 签名

```js
export async function translate(text, from, to, options) {}
```

| 参数 | 说明 |
| --- | --- |
| `text` | 待翻译文本。 |
| `from` | 源语言，已经经过 `language` 映射。自动检测时可能是 `auto`。 |
| `to` | 目标语言，已经经过 `language` 映射。 |
| `options.detect` | Manggo 检测出的源语言，也会经过 `language` 映射。 |
| `options.config` | 当前服务的用户配置。 |
| `options.setResult(chunk)` | 输出增量文本。 |
| `options.utils` | Manggo 提供的工具对象。 |

返回字符串即可。流式输出时可以多次调用 `options.setResult(delta)`。

## recognize 签名

```js
export async function recognize(base64, language, options) {}
```

| 参数 | 说明 |
| --- | --- |
| `base64` | PNG 图片 Base64 内容，不包含 `data:image/png;base64,` 前缀。 |
| `language` | 识别语言，已经经过 `language` 映射。自动时可能是 `auto`。 |
| `options.config` | 当前服务的用户配置。 |
| `options.setResult(chunk)` | 输出增量 OCR 文本。 |
| `options.utils` | Manggo 提供的工具对象。 |

返回识别出的文本。

## tts 签名

```js
export async function tts(text, language, options) {}
```

| 参数 | 说明 |
| --- | --- |
| `text` | 待朗读文本。 |
| `language` | 文本语言，已经经过 `language` 映射。自动时可能是 `auto`。 |
| `options.config` | 当前服务的用户配置。 |
| `options.utils` | Manggo 提供的工具对象。 |

TTS 必须返回音频数据。Manggo 支持：

```js
return new Uint8Array(bytes);
return await response.arrayBuffer();
return [255, 251, 144, 68];
return "base64-audio-data";
return { base64: "base64-audio-data", format: "mp3" };
return { bytes: new Uint8Array(bytes), format: "wav" };
```

对象里可以使用 `base64`、`data`、`audio`、`bytes` 放音频内容；可以使用 `format`、`audioFormat`、`responseFormat`、`mimeType`、`contentType` 告诉 Manggo 音频格式。

## options.utils

原生 Manggo 上下文只提供这些工具：

| 字段 / 函数 | 说明 |
| --- | --- |
| `utils.fetch(url, init)` | 标准 Fetch 风格请求。 |
| `utils.readTextFile(path)` | 读取文本文件。 |
| `utils.readBinaryFile(path)` | 读取二进制文件，返回数字数组。 |
| `utils.cacheDir` | 当前插件缓存目录。 |
| `utils.pluginDir` | 当前插件安装目录。 |
| `utils.osType` | `Darwin`、`Windows_NT` 或 `Linux`。 |
| `utils.setResult(chunk)` | 等价于 `options.setResult(chunk)`。 |

Pot 兼容插件才会获得 `Body`、`http`、`tauriFetch` 和全局函数入口。原生插件不要依赖这些对象。

## 本示例的 OpenAI 实现

翻译和 OCR 调用：

```text
POST https://api.openai.com/v1/chat/completions
```

TTS 调用：

```text
POST https://api.openai.com/v1/audio/speech
```

TTS 默认配置：

```json
{
  "model": "gpt-4o-mini-tts",
  "voice": "marin",
  "response_format": "mp3",
  "speed": 1
}
```

OpenAI Speech API 支持的常用模型包括 `gpt-4o-mini-tts`、`tts-1`、`tts-1-hd`，音频格式包括 `mp3`、`opus`、`aac`、`flac`、`wav`、`pcm`。本示例默认列出更适合桌面直接播放的封装格式。

参考官方文档：

- https://platform.openai.com/docs/guides/text-to-speech
- https://platform.openai.com/docs/api-reference/audio/createSpeech

## 重新打包

```bash
./package.sh
```

然后到 Manggo 插件管理页安装新的 `.mplugin`。
