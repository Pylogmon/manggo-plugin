# moejs 运行时能力与边界

Manggo 内置 moejs 运行环境，安装插件无需额外安装 Bun 或 Node.js。新原生插件使用
`runtime.kind:"moejs"` 和 `manggo.plugin.v1`；旧清单中的 `kind:"bun"` 仍可安装。

本页帮助插件作者选择可用 API、准备依赖并处理运行限制。Manggo 提供的是适合插件的
JavaScript 环境，不包含完整的 Node、Bun 或浏览器 API。

## 调用规则

- 入口可以同步返回或返回 Promise；需要等待的异步工作应由入口 `await`，再返回结果。
- 不同入口调用不共享变量或定时器状态。持久数据请保存到插件的私有目录。
- 请求完成、取消或超时后，不能继续提交结果、使用网络或执行桌面操作。
- 同一插件可能并发处理请求；临时文件请使用不同名称，避免互相覆盖。
- 动作预检查与动作执行分别调用，不共享变量。预检查最多 **500 ms**，禁止网络、文件写入和桌面操作。
  模块顶层代码也要满足这些限制；把必要的请求和写入放在执行入口中。

## 模块与依赖

新原生插件推荐使用 `.js` / `.mjs` 的 ESM，支持命名导出、默认导出对象、动态 `import()`
和顶层 `await`。导出函数名称必须与清单中的 `entry` / `precheck` 一致。

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
不支持 `child_process`、原始 TCP/UDP、Node 原生扩展或任意系统命令。

## Web API 与网络

可使用 `fetch`、`Headers`、`Request`、`Response`、流式 body、`ReadableStream`、
`AbortController` / `AbortSignal`、`URL`、`URLSearchParams`、`TextEncoder` / `TextDecoder`、
`Blob`、`File`、`FormData`、`WebSocket`，以及 Promise 和定时器。
支持文件上传、字节读取、切片、重复表单字段和流式响应。

`fetch` 和 `utils.fetch` 遵循 Manggo 的代理、证书与取消设置；访问网络时在清单声明 `network`。
本地服务可使用明确的 HTTP(S) endpoint，读取文件则使用文件 API。

WebSocket 支持文本、ArrayBuffer/typed array、Blob、子协议和关闭事件。
默认 `binaryType` 为 `nodebuffer`，也可设置 `arraybuffer` 或 `blob`。
构造器不支持 Bun 专属的自定义 headers/options；旧 Bob 插件可使用自己的 `$websocket` 接口。

不提供 `window`、`document`、DOM、Canvas、浏览器存储或页面渲染。
全局 `crypto` 仅提供随机数/UUID 子集；不要假定存在完整 `crypto.subtle`。
未列出的 ECMAScript/Intl 行为和第三方库仍需在实际插件中验证。

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

## 原生、Bob 与 Pot API

原生 `PluginUtils` 提供 fetch、文件读取、目录、系统类型与结果回调；
只有动作执行入口提供 `options.manggo` 的复制、替换和打开网页操作。

Bob 的 `$http`、`$data`、`$file` 等，以及 Pot 的 `http`、`Body`、`Database`、`run`、
CryptoJS 等额外 API，只适用于对应包格式。支持范围与开发注意事项见 [Bob / Pot 兼容说明](compatibility.md)。

## 使用限制

处理较大图片、音频或批量请求时应控制体积和并发，并处理超限错误。当前主要限制如下：

| 项目 | 限制 |
| --- | --- |
| 清单 / 单个脚本文件 | 1 MiB / 8 MiB。 |
| 单个常规文件 | 16 MiB。 |
| 服务 JSON 结果 / 文本更新累计 | 各 8 MiB。 |
| HTTP 请求体或响应体 | 每个 64 MiB。 |
| WebSocket | 单消息 1 MiB；每个连接的收发累计分别 64 MiB。 |
| OCR 图片输入 / 音频输出 | 各 64 MiB，另受图像格式与服务限制。 |
| OCR 文字区域 | 每次 10,000 个区域，每区 3–64 个点。 |
| 动作预检查 | 500 ms；普通调用使用应用中配置的总超时。 |

发布前请在 Manggo 中安装生成的 `.mplugin`，检查每种服务的配置、正常结果、网络错误和取消行为。
本地开发工具中的成功运行不能代替在 Manggo 中的实际验证。
