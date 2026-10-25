# Float panel 层级约束

FP 状态由相互独立的 `parent`、`mode`、`dismiss` 与几何快照组成。`mode ∈ {modal, non-modal}` 不参与层级排序。

普通 FP 的 parent 关系形成无环森林。按同级 focus 顺序做先序遍历，令第 i 个节点的层级为 `Lᵢ = 10 + 2i`，其 modal 遮罩为 `Lᵢ − 1`。因此普通父子边满足：

```text
L(page) = 0
L(parent) < L(child)
L(backdrop(p)) = L(p) − 1
L(content) < L(editor) < L(title)
```

title 与 editor 是保留 strata。来自这两层的 source 关系不会将普通 FP 提升进保留层；普通父子严格递增的约束不跨保留层。

focus 到 x 时，关闭集合是 `{p | L(p) > L(x) ∧ dismiss(p) ≠ explicit ∧ ¬persistent(p)}`。raise 调整父链与同级顺序，不打破父子偏序；关闭父节点时，存活子节点重挂到最近存活祖先。循环 parent 被拒绝。

最高可见 modal 的 layer 是交互边界。其下的页面与 FP 被 inert，其上子窗口仍可操作。所有 modal 使用同一遮罩机制；mode 切换只增减该窗口遮罩，不降低窗口层级。

组件只调用 `registerFloatingPanel`、`setFloatingParent`、`setFloatingModal`、`raiseFloatingPanel` 与 `unregisterFloatingPanel`；不直接指定 z-index。保留的 viewer 使用 `dismiss=explicit`，临时 note 与 editor 遵循 focus 关闭集合。

URL 描述 modal FP；本地会话以文章路径和仓库版本为边界，保存全部 viewer 的模式、几何、父子关系和实际堆叠顺序。切换文章先保存当前会话，再载入目标文章会话。固定 note、批注草稿及图片快照保存在同页会话，依赖的父窗口准备好后原位恢复，不移动焦点。

`tests/fp-layer-invariants.test.mjs` 验证偏序、保留层、遮罩、关闭和重挂规则，并对多组森林执行 focus/mode 排列回归。
