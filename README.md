# FlowPad shared spec — v1 / revision 1.0.0

- [FORMAT.md](FORMAT.md)：字段、校验、默认值、规范化、未知字段及迁移规则。
- [flowpad.schema.json](flowpad.schema.json)：离线 Draft 2020-12 schema，图关系还需语义校验。
- [fixtures](fixtures) / [golden](golden)：11 个输入和独立编写的规范化预期 JSON。
- [invalid](invalid)：27 个双方均拒绝的输入，失败不得覆盖原文件或文本。
- [src/flowpad.ts](src/flowpad.ts)：无运行时依赖的 TypeScript 类型、读写及标签辅助函数。
- [REFERENCE_BEHAVIOR.md](REFERENCE_BEHAVIOR.md) / [reference](reference)：节点语义与桌面渲染参考。
- [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md)：已验证和待插件验证的边界。
- [manifest.json](manifest.json)：冻结文件 SHA-256，测试只核对，绝不自动改写。

## 验证

开发环境使用 Node >=24（测试直接运行可擦除类型的 TS）、npm、Desktop 的 Qt/MSVC 构建工具。
TypeScript 7.0.2、Ajv 8.20.0 为锁定的开发依赖，运行时模块不导入它们。
首次 `npm ci` 需要包缓存或网络，之后构建和测试离线运行。

```powershell
cd spec
npm ci
npm run typecheck
cd ../desktop
./build.cmd
cd ../spec
npm test
npm run benchmark
```

Windows Release preset 已启用 `cross_client_contract` CTest 门禁。
纯 Qt 环境可显式 `-DFLOWPAD_TEST_SHARED_CONTRACT=OFF`，但其通过不代表完成 S8 跨运行时验证。
独立 TS 开发可 `npm test -- --codec-only`，报告明确标注 `desktopTested: false`。
完整测试通过生产 C++ serializer 的测试桥完成 Qt → TS、TS → Qt、双方文字编辑后的往返。
这仍不是 VS Code Extension Host / TextDocument 集成测试。

`results/` 为可重跑输出，不纳入冻结。正式证据见 `../desktop/release/results/s8-*`。
`desktop/tests/make_fixtures.py` 现仅同步镜像，不再从指南重建 schema。

## 变更规则

先审查 FORMAT、schema、两端影响与 fixtures；破坏性改变提升 schemaVersion 并提供显式迁移。
确认预期 golden 不是通过被测 codec 自动生成后，运行 `node tools/seal.mjs --reviewed`，
再重跑类型检查、Desktop CTest、双向测试。不得靠重封存掩盖无意差异。
当前 revision 1.0.0；后续修订需同时修改版本说明与 seal 工具中的 revision。

## 许可证

本目录及其中的 FlowPad shared spec 内容（除非文件中另有明确说明）按 **GNU General Public License v3.0 only (GPL-3.0-only)** 发布。
允许在 GPL-3.0 条款下使用、研究、修改、商业使用和再分发；分发修改版本或衍生作品时，应继续遵守 GPL-3.0 的相应源码开放与许可证义务。
完整许可证文本见 [LICENSE](LICENSE)。第三方开发依赖仍分别适用其自身许可证。
