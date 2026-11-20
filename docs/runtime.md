# moejs 运行时能力与边界

Manggo 内置 moejs 运行环境，安装插件无需额外安装 Bun 或 Node.js。原生插件使用
`runtime.kind:"moejs"` 和 `manggo.plugin.v1`；`kind:"bun"` 是可接受的兼容声明，同样使用 moejs。

本页帮助插件作者选择可用 API、准备依赖并处理运行限制。Manggo 提供的是适合插件的
JavaScript 环境，不包含完整的 Node、Bun 或浏览器 API。

## 调用规则

- 入口可以同步返回或返回 Promise；需要等待的异步工作应由入口 `await`，再返回结果。
- 不同入口调用不共享变量或定时器状态。持久数据请保存到插件的私有目录。
- 请求完成、取消或超时后，不能继续提交结果、使用网络或执行桌面操作。
- 同一插件可能并发处理请求；临时文件请使用不同名称，避免互相覆盖。
- 动作预检查与动作执行分别调用，不共享变量。预检查最多 **500 ms**，禁止网络、文件写入和桌面操作。
  模块顶层代码也要满足这些限制；把必要的请求和写入放在执行入口中。

入口的 `options.signal` 是本次请求的 `AbortSignal`，可传给 Fetch 并监听取消：

```js
const response = await options.utils.fetch(options.config.endpoint, {
  method: "POST",
  body: JSON.stringify({text}),
  signal: options.signal
});
```

翻译上下文 `options.query` 包含 `text`、预处理前的 `originalText`，以及映射后的
`from`、`to`、`detectFrom`、`detectTo`。其他服务继续使用各自入口的图片、语言和请求参数。
已经通过动作启动的桌面应用可以继续运行；请求取消会阻止后续操作。

## 宿主信息与能力

公共 API 可从全局 `manggo` 或入口的 `options.manggo` 读取，包含：

| 成员 | 用途 |
| --- | --- |
| `env.appVersion` | 当前 Manggo 应用版本。 |
| `env.apiVersion` | 当前宿主接口版本 `1.1`；清单协议使用 `manggo.plugin.v1`。 |
| `env.engine` / `env.engineVersion` | JavaScript 引擎名称与版本。 |
| `env.platform` / `env.arch` | 当前平台 `darwin`、`windows` 或 `linux`，以及处理器架构。 |
| `env.capabilities` | 支持的接口能力列表，可用于特性检测。 |
| `log.debug/info/warn/error` | 向当前插件的诊断记录输出日志。 |
| `ServiceError` | 构造带类型、用户提示及排障链接的错误。 |
| `sqlite` | 打开插件包内的只读数据库和插件私有的可写数据库。详见 [SQLite](#sqlite)。 |

`env` 及其中的能力列表只读。可在清单 `requires.capabilities` 声明以下名称：

| 能力名称 | 支持内容 |
| --- | --- |
| `runtime.info` | 宿主环境与能力查询。 |
| `runtime.log` | 插件日志及诊断入口。 |
| `service.validate` | 配置验证函数。 |
| `service.errors` | 结构化错误。 |
| `translation.context` | 翻译原文、语言和取消上下文。 |
| `translation.structured` | 译文格式、独立思考内容与附带音频。 |
| `translation.glossary` | 通过 `options.glossary.getTerms()` 读取本次翻译的术语。 |
| `config.shared` | 插件级共享设置。 |
| `sqlite` | 原生 SQLite API。 |
| `desktop.openURI` | 打开已注册的应用协议。 |
| `desktop.openPath` | 使用默认应用打开本地路径。 |
| `desktop.reveal` | 在文件管理器定位路径。 |
| `desktop.launch` | 按绝对路径和参数数组启动应用。 |

能力检测说明接口是否存在；桌面动作还须在顶层或服务级 `permissions` 中声明同名权限。
预检查不提供 `options.manggo`。通过全局 `manggo` 可以查询环境、记录日志或执行 SQLite 只读查询。
配置验证只提供公共 API。配置、自检、错误及动作示例见 [开发指南](../README.md)。

原生环境支持 `console.log/debug/info/warn/error`，与 `manggo.log` 使用同一诊断记录。
用户可在插件管理中打开“诊断”查看加载、预检查和执行错误。日志只保留在当前应用进程中，
不随遥测上传。不要把密钥、完整用户文本或接口原始响应写入日志。

## 模块与依赖

原生插件推荐使用 `.js` / `.mjs` 的 ESM，支持命名导出、默认导出对象、动态 `import()`
和顶层 `await`。导出函数名称必须与清单中的 `entry` / `precheck` / `validate` 一致；
省略 `validate` 时，可直接导出同名的可选验证函数。

- 使用相对路径导入包内模块；也支持 `/package/` 路径、包内 `file:` URL 和 JSON 模块。
- `.cjs` 支持 CommonJS 的包内 `require`、JSON 和循环引用；CommonJS 不能 `require` ESM，可改用 `import()`。
- 下节列出的内置模块可使用 bare 名称或 `node:` 前缀，例如 `path` 和 `node:path`。
- npm 依赖需要提前构建并随包分发；不要依赖完整的 Node 包解析、`package.json` exports 或任意 import attributes。
- 安装和运行时不会执行 npm 或构建脚本。TypeScript 需要提前编译成 JavaScript，清单不能指向 `.ts`。

第三方库宜选择纯 JavaScript、无 DOM、只使用下列可用 API 的实现，并在 Manggo 中实际验证。

### Node 模块子集

| 模块 | 可使用的功能 | 使用限制 |
| --- | --- | --- |
| `buffer` / `node:buffer` | Buffer 与字节、编码操作；同时提供全局 `Buffer` | 不包含其他 Node 模块。 |
| `crypto` / `node:crypto` | `createHash`、`createHmac`、`getHashes`、`randomBytes`、`randomUUID`、`timingSafeEqual` | 算法以 `getHashes()` 为准；不提供完整 cipher、KeyObject、证书或 WebCrypto subtle API。 |
| `path` / `node:path` | join/resolve/relative、路径拆解与格式化、`posix` | 各平台统一使用 `/`，相对路径以插件目录为基准；不提供 `win32`。 |
| `url` / `node:url` | `URL`、`URLSearchParams`、`pathToFileURL`、`fileURLToPath` | 文件 URL 仅用于插件文件，不支持 Windows 路径选项。 |
| `fs` / `node:fs` | 常规文件读写、追加、状态检查、目录读取/创建、删除、重命名、复制和 chmod；同步、callback、Promise 形式 | 仅访问插件目录和私有数据；不提供文件描述符、文件流、watch 或创建符号链接。 |
| `fs/promises` / `node:fs/promises` | 对应的 Promise 文件操作 | 与 `fs.promises` 使用相同限制。 |

`fs.chmod` 仅能修改私有普通文件/目录的受限权限，不能授予执行权限。
`process` 只提供只读 `pid` 供临时文件命名，不提供环境变量、cwd、退出或进程控制。
不提供 `child_process`、原始 TCP/UDP、Node 原生扩展或 shell 命令执行。
需要启动已配置的桌面应用时，使用声明权限的 `options.manggo.launchApplication(path,args)`。

## Web API 与网络

可使用 `fetch`、`Headers`、`Request`、`Response`、流式 body、`ReadableStream`、
`AbortController` / `AbortSignal`、`URL`、`URLSearchParams`、`TextEncoder` / `TextDecoder`、
`Blob`、`File`、`FormData`、`WebSocket`，以及 Promise 和定时器。
支持文件上传、字节读取、切片、重复表单字段和流式响应。

`fetch` 和 `utils.fetch` 遵循 Manggo 的代理、证书与取消设置。访问网络时在清单声明 `network`。
请求未设置 `User-Agent` 时，宿主使用 `Manggo/<应用版本>`。
本地服务可使用明确的 HTTP(S) endpoint，读取文件则使用文件 API。

不提供 `window`、`document`、DOM、Canvas、浏览器存储或页面渲染。
全局 `crypto` 仅提供随机数/UUID 子集；不要假定存在完整 `crypto.subtle`。
未列出的 ECMAScript/Intl 行为和第三方库仍需在实际插件中验证。

### WebSocket 请求头

原生插件可以在建立 WebSocket 连接时发送自定义请求头，例如把用户在插件配置中填写的 API 密钥放进 `Authorization`。

```js
const socket = new WebSocket(options.config.endpoint, {
  headers: { Authorization: `Bearer ${options.config.apiKey}` },
});
```

`headers` 接受普通对象、`Headers` 实例或 `[名称, 值]` 列表。服务要求子协议时，在同一个选项对象中添加
`protocols`，传入一个子协议名或字符串列表。WebSocket 连接使用 Manggo 的代理和证书设置。

WebSocket 支持文本、ArrayBuffer/typed array、Blob、子协议和关闭事件。
默认 `binaryType` 为 `nodebuffer`，也可设置 `arraybuffer` 或 `blob`。
TypeScript 写法见 [SDK 指南](../README.md#typescript-与-sdk)。

## 文件与 Bun 兼容子集

使用 `utils.pluginDir` 读取随插件分发的资源，使用 `utils.cacheDir` 保存私有持久数据。
它们当前分别为 `/package` 和 `/data`；相对文件路径从插件目录解析。
插件目录只读，私有数据可写，不能读取宿主的任意目录。

除了 `utils.readTextFile`、`utils.readBinaryFile` 和上文的 fs 子集，还可使用：

```js
const resource = Bun.file(`${utils.pluginDir}/assets/input.txt`);
if (await resource.exists()) {
  const text = await resource.text();
  await Bun.write(`${utils.cacheDir}/last.txt`, text);
}
```

`Bun.file(path, {type?})` 返回 Blob 风格对象，支持 `size`、`type`、`name`、
`exists()`、`text()`、`json()`、`arrayBuffer()`、`bytes()`、`slice()` 和 `stream()`。
`Bun.write(path, value)` 接受字符串、字节数组、ArrayBuffer/view 或带 `arrayBuffer()` 的对象，返回写入字节数。
不提供 Bun 的 spawn、shell、serve、包管理等其他 API。

## SQLite

在清单的 `requires.capabilities` 中添加 `"sqlite"`。在入口中可以用 `options.manggo.sqlite`，
也可以用全局的 `manggo.sqlite`。相对路径从 `/package` 解析。

| 开库方式 | 行为 |
| --- | --- |
| `sqlite.open("words.db")` 或 `sqlite.open("words.db", {mode: "readOnly"})` | 只读打开随插件分发的数据库。 |
| `sqlite.open("words.db", {mode: "readWrite"})` | 首次用随包数据库初始化私有库，之后读写同一份私有库。 |
| `sqlite.open("/data/words.db")` | 只读打开已有的私有数据库。 |
| `sqlite.open("/data/words.db", {mode: "readWrite"})` | 读写打开已有的私有数据库，或创建一个空库。 |

`/data/words.db` 用于在 SQLite API 中打开插件自己的私有库。覆盖安装相同插件 ID 时会保留私有数据。
随包分发时，请包含一份可独立打开的 SQLite 文件。

`db.query(statement, parameters?)` 返回行对象数组。读写连接还提供
`db.execute(statement, parameters?)`，返回 `{changes, lastInsertRowid}`。
参数使用数组绑定，支持字符串、数字、布尔值、`null`、`ArrayBuffer` 和 `Uint8Array`。
查询结果的 BLOB 列返回 `ArrayBuffer`。连接仅在当前调用中可用，可用 `await db.close()` 提前关闭。

下面的翻译入口查询随包分发的 `words.db`：

```js
export async function translate(text, _from, _to, {manggo}) {
  const db = await manggo.sqlite.open("words.db");
  try {
    const [row] = await db.query("SELECT translation FROM words WHERE word = ?", [text]);
    if (!row) throw new manggo.ServiceError("notFound", "未找到词条");
    return row.translation;
  } finally {
    await db.close();
  }
}
```

需要维护插件数据时，可以直接在 `/data` 下创建私有库：

```js
const db = await manggo.sqlite.open("/data/preferences.db", {mode: "readWrite"});
try {
  await db.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
  await db.execute("INSERT OR REPLACE INTO settings VALUES (?, ?)", ["language", "en"]);
} finally {
  await db.close();
}
```

数据库文件不限大小。SQL 仅访问当前打开的数据库。单次查询最多返回 10,000 行和 8 MiB 数据，
最多绑定 256 个参数，参数合计最多 1 MiB。查询大量数据时请分批读取。

## 原生、Bob 与 Pot API

原生 `PluginUtils` 提供 fetch、文件读取、目录、系统类型与结果回调。
常规入口的 `options.manggo` 提供环境、日志、结构化错误和 SQLite。动作执行入口还提供复制、替换、
打开网页、应用协议、本地路径、文件定位和应用启动。动作的权限与用法见
[划词动作](../README.md#划词动作)。

多个服务或动作需要共享地址、密钥或软件路径时，在清单顶层声明 `config`，通过
`options.sharedConfig` 读取。文件和数据库访问范围为当前插件的包和私有数据。

Bob 的 `$http`、`$data`、`$file` 等，以及 Pot 的 `http`、`Body`、`Database`、`run`、
CryptoJS 等额外 API，只适用于对应包格式。支持范围与开发注意事项见 [Bob / Pot 兼容说明](compatibility.md)。

## 使用限制

处理较大图片、音频或批量请求时应控制体积和并发，并处理超限错误。当前主要限制如下：

| 项目 | 限制 |
| --- | --- |
| 清单 / 单个脚本文件 | 1 MiB / 8 MiB。 |
| 插件包 | 普通文件单个最多 256 MiB，合计最多 512 MiB。SQLite 数据库文件不计入字节限额。 |
| 文件 API 读写 | 单个常规文件 16 MiB。数据库操作见 [SQLite](#sqlite)。 |
| 服务 JSON 结果 / 文本更新累计 | 各 8 MiB。 |
| 结构化译文快照更新 | 单次 8 MiB，每次请求的更新累计 64 MiB。 |
| HTTP 请求体或响应体 | 每个 64 MiB。 |
| WebSocket | 单消息 1 MiB；每个连接的收发累计分别 64 MiB。 |
| OCR 图片输入 / 音频输出 | 各 64 MiB，另受图像格式与服务限制。 |
| OCR 文字区域 | 每次 10,000 个区域，每区 3–64 个点。 |
| 调用超时 | 动作预检查 500 ms。普通调用最多 2 分钟，并遵守更短的服务超时设置。 |
| 插件日志 | 每条 4 KiB，每次请求共 64 KiB；每插件最多保留最近 64 条记录。 |
| 结构化错误 | type 最多 64 字节，message 和 addition 各 4 KiB，排障链接最多 2048 字节。 |
| 本地路径 / 应用协议地址 | 分别最多 4096 / 32767 字节；仍受操作系统限制。 |
| 应用启动参数 | 最多 256 个参数，共 1 MiB；操作系统可有更低限制。 |

发布前请在 Manggo 中安装生成的 `.mplugin`，检查每种服务的配置、正常结果、网络错误和取消行为。
本地开发工具中的成功运行不能代替在 Manggo 中的实际验证。
