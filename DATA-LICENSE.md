# 数据与素材授权 · Data & Assets License

本仓库的**代码**部分采用 MIT（见 [LICENSE](LICENSE)）。本文件说明**非代码部分**的授权。

本项目是「代码 + 数据 + 素材」的混合体：课程结构派生自教材、字形轮廓沿用上游授权字体、
释义与美术为原创，因此采用**分离授权**，各部分授权不可互相覆盖。

---

## 1. 字形数据 — Arphic Public License

| 范围 | 说明 |
|---|---|
| `data/strokes/*.js` | 汉字笔顺轮廓与笔顺中心线 |

来源：Make Me a Hanzi / hanzi-writer-data。字形数据来自 **Arphic Public License** 授权的字体，
按上游授权条件「可自由使用与再分发」。

- 许可证全文：<https://github.com/skishore/makemeahanzi/blob/master/ARPHICPL.TXT>
- 相关声明：见 [`data/LICENSE-NOTICE.txt`](data/LICENSE-NOTICE.txt)

> ⚠️ 该部分**不可改为 MIT**。再分发时请保留 Arphic Public License 的授权条件与声明。

---

## 2. 自建数据 — CC BY-NC-SA 4.0

| 范围 | 说明 |
|---|---|
| `data/curriculum.js` | 课程结构（册 → 单元 → 课 → 生字），依据统编版小学语文教材《写字表》公开整理资料编排 |
| `data/dict.js` | 拼音、部首、笔画数、组词（`w`）、组词释义（`wm`）、英文单词（`en`）、国际音标（`ipa`）、多音字词音（`pw`） |

本作品采用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**
（署名—非商业性使用—相同方式共享 4.0 国际）许可协议。

- 查看协议全文：<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.zh-Hans>
- 协议摘要：<https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-Hans>

主要条件：

| 条件 | 含义 |
|---|---|
| **署名**（BY） | 使用时须注明来源为本项目，并标明是否作出修改 |
| **非商业性使用**（NC） | 不得用于商业目的 |
| **相同方式共享**（SA） | 基于本数据的衍生作品，须以相同协议分发 |

选择该协议的原因：课程结构派生自教材，NC 避免商业滥用，SA 保证衍生数据同样保持开放。

---

## 3. 美术素材 — CC BY-NC 4.0

| 范围 | 说明 |
|---|---|
| `assets/pets/*.png` | 宠物形象（原创设计） |
| `assets/icon-*.png` | 应用图标（原创设计） |

本作品采用 **Creative Commons Attribution-NonCommercial 4.0 International**
（署名—非商业性使用 4.0 国际）许可协议。

- 查看协议全文：<https://creativecommons.org/licenses/by-nc/4.0/legalcode.zh-Hans>
- 协议摘要：<https://creativecommons.org/licenses/by-nc/4.0/deed.zh-Hans>

主要条件：**署名** + **非商业性使用**（无 ShareAlike 要求）。

> 若希望这些素材也能被自由用于教学材料等场景，可将其改为随代码一并 MIT 授权——
> 需自行修改本文件与 `LICENSE`，并确认素材为你本人原创（当前为 AI 按原创描述生成）。

---

## 4. 教材内容说明

课程结构（课文标题、编号、生字归属）依据统编版（部编版）小学语文教材《写字表》公开整理资料编排，
**仅供学习参考**；不同教材印次可能存在少量差异，可在 `data/curriculum.js` 中自行调整。

本仓库不分发教材原文、扫描页或任何教材配套资源文件；上游原始数据与中间产物已在 `.gitignore` 中排除。

---

## 5. 授权速查

| 部分 | 授权 |
|---|---|
| 代码（`index.html`、`css/`、`js/`、`scripts/`、`smoke-test.html`、`*.command`） | **MIT** |
| `data/strokes/` | **Arphic Public License**（上游授权） |
| `data/curriculum.js`、`data/dict.js` | **CC BY-NC-SA 4.0** |
| `assets/` | **CC BY-NC 4.0** |

简写：Code: MIT · Data: CC BY-NC-SA 4.0 · Glyphs: Arphic Public License · Art: CC BY-NC 4.0
