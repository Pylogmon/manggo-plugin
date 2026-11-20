# Bob / Pot 插件兼容说明

在 Manggo 的「设置 → 插件 → 安装插件」中选择 `.bobplugin` 或 `.potext`，再到对应的服务设置添加插件服务并填写配置。
安装和调用插件需要 Pro 授权。运行环境已内置。

本文列出用户和插件作者可以依赖的兼容范围。编写原生插件请使用
[开发指南](../README.md) 与 [SDK](../sdk/manggo-plugin.d.ts)；Bob / Pot 的额外 API 不属于原生 `PluginUtils`。

## Bob

支持翻译、OCR 和 TTS 三类服务。API 用法可参考 Bob 的
[官方 API](https://bobtranslate.com/plugin/api/intro.html)、
[翻译入口](https://bobtranslate.com/plugin/quickstart/translate.html)、
[OCR 入口](https://bobtranslate.com/plugin/quickstart/ocr.html) 和
[OCR 结果](https://bobtranslate.com/plugin/object/ocrresult.html)。

| API / 功能 | 支持范围 |
| --- | --- |
| 清单与模块 | `info.json`、选项默认值、语言映射、完整 `$info`；CommonJS 的相对/包根路径 require、JSON 和循环引用。 |
| `$http` | callback / Promise、表单 / JSON / `$data` / multipart、秒级 timeout、取消和流式字节响应。 |
| `$data` | UTF-8 / Hex / Base64、字节读写、截取、复制和拼接；无效 UTF-8 返回 undefined。 |
| `$file` | `$data` 读取、对象形式写入，list/copy/move/delete/mkdir/exists/isDirectory；使用 `$sandbox` 保存私有持久数据。 |
| `$timer` / `$signal` | 秒级 schedule/invalidate；send/subscribe/dispose/removeAllSubscriber。 |
| `$websocket` | 请求头、子协议、握手超时、显式自签名选项；文本/二进制消息、ping/pong、关闭码/原因和 readyState。 |
| 工具与加密 | `$util`、`require("crypto-js")` 及子模块；CryptoJS 4.2.0 的 hash/HMAC、AES、mode、padding 和 KDF。 |
| 翻译结果 | `toParagraphs`、`toDict`、Bob 1.21 `content.format/text`；支持流式更新、最终结果、独立的 `thinkInfo` 与附带的 `toTTS` 音频。 |
| OCR 结果 | `texts`、`regionInfos` / `paragraphInfos`、`boundingBox.points` 和图像尺寸；有坐标时可用于图片选字，纯文本结果也可用。 |
| TTS | `$data`、字节、Base64 和可访问的音频 URL。 |
| 配置验证 | `pluginValidate(completion)` 接入 Manggo 编辑界面的“测试连接”，使用当前配置草稿。 |
| 错误与日志 | 保留 `service error` 的类型、提示、排障链接及调试信息；`$log` 可在插件“诊断”中查看。 |

`$env` 的 Bob 兼容版本为 1.21.0；其中的 `$env.manggo` 提供实际 Manggo 版本和运行环境。
回调只对本次请求有效；完成或取消后，不应继续提交结果。服务的启用、配置和总超时在
Manggo 中设置。没有验证函数时，“测试连接”使用示例请求；appcast 自动更新不在 Manggo 中提供。

## Pot

支持 translate、recognize、tts、collection。可参考 Pot 的
[官方插件说明](https://pot-app.com/en/docs/plugin.html) 及四类模板：
[translate](https://github.com/pot-app/pot-app-translate-plugin-template)、
[recognize](https://github.com/pot-app/pot-app-recognize-plugin-template)、
[tts](https://github.com/pot-app/pot-app-tts-plugin-template)、
[collection](https://github.com/pot-app/pot-app-collection-plugin-template)。

| API / 功能 | 支持范围 |
| --- | --- |
| 清单与入口 | `info.json`、needs/language；ESM、default 对象和全局函数，参数包含 config/detect/setResult/utils。 |
| HTTP | `http.fetch` / `tauriFetch`，Headers、query、Body.json/text/bytes/form、ResponseType 和 timeout；也可使用 fetch、Blob、File、FormData、WebSocket。 |
| 字典 | pronunciations/explanations/associations/sentence。 |
| 流式翻译 | `setResult` 传入累计全文，可追加或替换之前文本；最终返回值优先。 |
| CryptoJS | `utils.CryptoJS` / 全局 `CryptoJS`，提供完整 4.2.0 API。 |
| Database | SQLite 的 load/select/execute/close 与参数绑定，修改内容保存在插件私有数据中。 |
| 截图 | `cacheDir/pot_screenshot_cut.png` 为当前 OCR 输入，二进制读取返回 Uint8Array；并发请求各自读取对应图片。 |
| run | `utils.run(program, args)` 执行包内程序，返回 status/stdout/stderr；支持兼容性的 `chmod +x`。 |

Pot 插件可以用 `utils.Database` 查询和更新自己的数据库。数据库文件不限大小，
大批量查询需要分批读取，提交的数据会保存在该插件的私有数据中。 [SQLite 查询限制](runtime.md#sqlite)

`run` 的程序路径必须位于 `/package/`，参数使用数组；它不接收 shell 命令字符串，
也不从系统 PATH 查找工具。程序必须匹配用户系统和架构，所需动态库需可用。
原生程序拥有当前用户权限，不受 JavaScript 文件目录限制；用户只应安装可信来源的这类插件。

## 安装与验证

如果插件安装后无法使用，请先检查服务地址、账号凭据和插件配置。
包含原生程序的插件还需要匹配当前操作系统和处理器。

插件作者可以核对上面的兼容接口，并用实际请求验证各项服务。 [运行时能力与边界](runtime.md)
