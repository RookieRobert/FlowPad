# `.flowpad v1` 冻结协议（S8 revision 1.0.0）

本规范与同目录 schema/fixtures 是 Desktop 和未来 VS Code 的共同接口。
格式版本继续为 1；本轮澄清桌面行为与跨运行时安全交换范围，不修改已有桌面应用。

## 编码和身份

UTF-8 JSON 对象，写出无 BOM、LF 换行；允许读入 UTF-8 BOM。
只含普通 JSON 值，不执行用户文本。`format` 必须为 `flowpad`，`schemaVersion` 必须为数值 1。
必须有 `document`、`canvas` 对象以及 `nodes`、`edges` 数组。
`document.id` 为非空稳定字符串，`document.title` 缺省 `未命名`，与界面语言无关。
节点 ID 和边 ID 分别唯一，两个命名空间可以重名；ID 不修剪、不变更大小写，不从数组下标重建。
允许 Unicode、`__proto__` 等合法字符串 ID，必须用 Map 或安全字典处理。

字段顺序、JSON 缩进、数字拼写不是协议。规范化节点和边按 ID 的 UTF-16 code unit 顺序排序，
与 Qt QString 比较一致，不能用 localeCompare。作者不生成重复对象键；兼容读入时解析器采用最后值，
重写不保留重复键或原始排版。

## 数值与文本互操作边界

已知和未知字段中的数字必须有限，绝对值不超过 9007199254740991；坐标等另有较小限制。
采用 IEEE-754 binary64 语义，比较解析后的值而非十进制词面；需要逐位精确的标识或金额写为字符串。
文本和字段名必须由完整 Unicode 标量构成，不能含孤立 UTF-16 代理项；不做 NFC/NFD 规范化。
schema 检查数值范围，codec 额外检查 Unicode。超出互操作范围时 TS 拒绝并保留原文，禁止转换后覆盖。
对象/数组嵌套最多 256 层（根对象为第 1 层），由 codec 额外验证，避免不同解析器的深度上限影响互操作。
旧 Qt 读写器可能接受范围外整数或字符串；旧桌面能打开不表示属于已冻结的跨客户端集合。
文件 UTF-8 字节最多 32 MiB，节点最多 100000、边最多 200000；这是拒绝阈值，不是性能承诺。

## 节点

必需 `id/type/x/y/text`。type 仅限 `goalStart/step/question/repeat/info/result/note`。
x/y 为世界坐标，表示卡片左上角，单位 logical px，各自在 ±1000000 范围内。
width/height 可选，为正有限数、最大 100000，缺省 240/104。
正文为纯文本，可空、可换行；占位提示和节点标题不写入正文。
style 是未解释的 JSON，原样保留，推荐对象，但旧桌面未强制其类型；v1 不承诺其中键有跨渲染器语义。
存储尺寸应保留，字体度量可能导致显示增高；不得仅因渲染器不同就在加载时改写 TextDocument。
真正编辑后需改变尺寸时，在同一个语义提交中处理。

## 连线

必需 id/source/target，两端必需非空 nodeId。
端口仅限 left/top/right/bottom，缺省 source.port=right、target.port=left。
label 缺省空字符串；autoLabel 可选布尔，缺省 false。

额外语义验证：节点存在、两端都不是 note、不能连接同一节点同一端口；
拒绝相同 source.nodeId/port → target.nodeId/port 的重复有向连接。
允许不同端口的自身回路、反向边、环、多条不同端口的边；不强制 DAG 或每端口一条边。
目标/开始、结果等节点不额外禁止入边或出边。方向只由 source → target 决定。

新系统标签存储中文回退值，并设 autoLabel=true：question.right=是、question.bottom=否、
repeat.right=继续、repeat.bottom=完成，其他出口为空。
显示时按当前语言翻译；用户提交自定义标签后清除标记，即使新正文恰好也是“是”。
旧文件无标记时视为用户文字，不按内容猜测来源。autoLabel 仅是来源标记，未知回退文本原样展示。

route 为非语义的派生缓存。桌面不解释其 JSON 类型，跨端兼容读取也接受；写出统一为 []，可重算。
route 内扩展随缓存丢弃，不属于需要保留的业务数据。

## 画布和本地状态

canvas.zoom 缺省 1，必须 >0；center 缺省 {x:0,y:0}，提供时 x/y 都必需且各在 ±1000000。
codec 保留合法 zoom 原值；Desktop 显示范围 0.25–4，超限打开后手动保存可能记录受限后的视图。
VS Code 应区分存储相机和临时显示相机，不能因首次渲染就重写文件。
主题、语言、减少动效、选择、悬停、焦点、性能数据、恢复路径不加入协议。
恢复信封、portable.flag、preferences.ini、PNG/JPG 均不是 `.flowpad` 文件。

## 规范化与保留

完整校验成功后才替换模型。失败保留原文件、TextDocument 和最后可解析视图，不保存部分对象。
写出补全默认值、按稳定 ID 排序、route=[]，autoLabel=false 时省略键。
根对象、document、canvas、canvas.center、节点（含 style）、边、source/target 的未知字段均保留 JSON 值。
编辑正文不影响扩展字段；删除对象时删除其扩展，撤销须一起恢复。
已知字段以已提交 domain 状态为准，不能把旧原始 JSON 覆盖到新编辑结果上。

TS parse() 返回独立规范化对象，serialize() 再校验后输出；调用方仍负责核对 TextDocument 版本。
未编辑的无效文本不得回填；VS Code 保存由 TextDocument 流程负责，不能复用桌面的磁盘写入实现。

## 版本与迁移

不支持的 schemaVersion 必须拒绝编辑，不得静默按 v1 打开并降级保存。
缺省补全及 autoLabel=false 是当前同版本兼容迁移；没有已发布 v0，不虚构 v0 转换。
新增可选、可保留字段可修订规范包版本；破坏性字段/枚举/语义改变必须升 schemaVersion，
提供迁移、独立前后 fixtures、双方回归和兼容矩阵。迁移由用户可见操作触发，不自动覆盖原文件。
