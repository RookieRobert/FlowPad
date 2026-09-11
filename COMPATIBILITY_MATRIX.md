# S8 兼容矩阵

2026-09-09，协议 revision 1.0.0。Qt 端为 Desktop 0.1.2 的生产 domain/serializer，TS 端为共享模块。
下表“通过”均为实际测试；VS Code 插件尚未构建，不能将共享 codec 测试写成插件验收。

| 范围 | Qt → TS | TS → Qt | VS Code 实际编辑器 |
| --- | --- | --- | --- |
| 11 个有效 fixtures 读写、默认值、确定性规范化 | 通过 | 通过 | 待 V1 |
| 七种节点、中文/Emoji/组合字符/多行/长文本 | 通过 | 通过 | 待 V3 / IME |
| 负数、小数、边界坐标、相机、1000 节点/857 边 | 通过 | 通过 | 待 V2/V7 |
| 四边端口、环、反向边、特殊 ID | 通过 | 通过 | 待 V4 |
| 自动标签与用户同名标签 | 通过；TS 编辑清除标记另测 | 通过 | 待 V4 |
| 未知 root/document/canvas/center/node/style/edge/endpoint 字段 | 编辑正文后仍保留 | 编辑正文后仍保留 | 待 V5 |
| 27 个非法样例 | 两端拒绝 | 两端拒绝；原输出文件不变 | 待 V1/V5 |
| Qt 磁盘原子提交 | 生产 writer 经测试桥验证 | 生产 writer 经测试桥验证 | 不适用；用 TextDocument |
| 主题/字形/路由像素一致 | 不要求；提供参考图 | 不要求 | 待 Canvas 实现 |
| Undo/Redo、外部修改、多视图、无效 JSON 修复 | 桌面已有回归 | 不由 codec 测试证明 | 待 V5/F5 |
| VSIX / 离线 Extension Host / CSP / webview 消息 | 不适用 | 不适用 | 待 V0/V8 |

## 范围外的旧桌面行为

Qt 读写器可能接受超过 ±(2^53−1) 的 JSON 数字或异常 Unicode；共享 TS codec 会拒绝这些数据，
防止 JavaScript 数值/字符串转换造成不透明元数据丢失。必须保留原文本并提示用户，不能静默修复。
此限制是跨客户端 profile 的明确边界，未修改桌面旧版接受范围。
schema 覆盖结构与数值，图引用、唯一性、自连/便签限制、Unicode/字节及 256 层容器深度上限由 codec 验证。

Desktop <=0.1.0 不认识 autoLabel，能显示 label 的中文回退但不能保证编辑时清除来源标记；
不列为自动标签跨语言保真客户端。Desktop >=0.1.1 按标记区分系统与用户文本。
旧 v1 文件无 autoLabel 时继续可读，其中文默认标签也按用户文本保留。
