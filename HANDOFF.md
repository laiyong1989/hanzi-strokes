# HANDOFF · 生字笔顺乐园 工作交接

> **最新进度（2026-10-14）见 `docs/交接-2026-10-14.md`** —— 2022 课表升级**全部 12 册已完成**
> （1a→6b，95 单元 418 课 2501 字），四套校验全绿，仅剩「升 sw 版本号 + 重建发布目录」这一步。
> 发布前必读该文件的「发布前最小检查清单」。

> 生成时间：2026-10-13 14:20（GMT+8）
> 用途：切换模型 / 换会话后，读完这份文档即可无缝继续工作。
> 当前仓库状态：`main` 分支 7 次提交，工作区干净，78 个文件已纳入版本库。

---

## 0. 三十秒速览

| 项 | 状态 |
|---|---|
| 项目本体 | 纯静态单页 Web，无构建步骤，`index.html` 双击可跑 |
| 本会话做了什么 | 课文数据补全 / 拼音与三档发音 / 组词释义 / 多音字纠正 / 英文 IPA / Git 仓库与自动同步 / 产品评估 / 修首页白屏 |
| 数据规模 | 12 册 · 95 单元 · 418 课 · 2501 生字（去重 2344），字典字段近乎全覆盖 |
| 校验 | `verify.js` 85 + `regress.js` 38 + `run-smoke.js` 113 + `verify-mobile.js` 6，全通过 |
| 线上 | https://hanzi-strokes.app.workbuddy.host/ （**缺最后一次白屏修复，见待办 T1**） |
| 卡住的地方 | GitHub 推送搁置（用户登不上）；headless Chrome 在本机不可用 |

---

## 1. 环境速查

### 运行时（按本机实际安装位置取，不要假设裸命令可用）

```bash
# 若 node / python3 不在 PATH，用 `command -v` 或包管理器前缀定位后固定下来
NODE=$(command -v node)              # 需 Node 18+（本机验证过 22.x）
PY=$(command -v python3)             # 需 Python 3.10+；生成音标另需 cmudict
NODE_PATH=<jsdom 所在的 node_modules 目录>   # 例：<npm 前缀>/lib/node_modules
```

- Node.js 22.x（isolated managed 运行时）；`jsdom` 装在上述 `NODE_PATH` 指向的目录，**运行校验脚本必须显式传入**
- Python 3.13（isolated managed 运行时）；其 venv 里额外装了 `cmudict`（生成英文音标用）、`pyobjc-framework-CoreServices`
- 无 npm 全局安装、无 brew、无 `gh` CLI（推送走 SSH，不需要 gh）

### 常用命令

```bash
# 本地预览（推荐，file:// 下 localStorage 不可用）
$PY -m http.server 8000 --bind 127.0.0.1
# 注意：Bash 会话结束后该进程会被回收，测试脚本已自带临时服务，不必依赖它

# 功能校验（本轮改动）
NODE_PATH=$NODE_PATH $NODE .build/verify.js     # 57 项
# 既有功能回归（自带临时静态服务 + jsdom）
NODE_PATH=$NODE_PATH $NODE .build/regress.js    # 38 项
# 移动端语音行为（beforeParse 里伪造 iPhone 环境，6 项）
NODE_PATH=$NODE_PATH $NODE .build/verify-mobile.js
# 真实浏览器冒烟测试（113 项，自动起服务 + headless Chrome + CDP，无需人工）
$NODE .build/run-smoke.js                        # 约 20 秒
$NODE .build/run-smoke.js --keep                 # 跑完保留浏览器便于人工排查

# 自动同步（暂存 → 安全校验 → Conventional Commits → 提交 → 推送）
bash scripts/auto-sync.sh -m "fix(app): 说明改了什么"
bash scripts/auto-sync.sh --dry                # 演练，不改仓库
bash scripts/watch-sync.sh                     # 常驻监听，落盘静默 8s 后自动同步

# 同步到发布目录（发布前必做）
cp index.html sw.js manifest.webmanifest dist/ && cp -R css js data assets dist/
```

### 环境限制（会反复踩，记牢）

1. **headless Chrome 的 `--dump-dom` 输出通道不可靠**（返回 0 字节），且不带参数时沙箱初始化
   可能失败（`sandbox initialization failed: Operation not permitted`）。
   **但加 `--no-sandbox` 后 CDP 调试端口工作正常** → 已据此写 `.build/run-smoke.js`，
   用 CDP 连上去直接读页面 `#out` 文本，绕开坏掉的输出通道。
   jsdom 校验（`.build/verify.js`、`.build/regress.js）仍作为快速回归，两者互补。
2. **GitHub 推送已通**：`origin` 已配置，SSH 认证可用，`hzpb.pushDisabled` 已解除。
   若某次推送失败，脚本会分类给出处理命令（详见 `scripts/auto-sync.sh`）。
3. **外网下载不稳定**：曾尝试下载 chinese-xinhua 的 `word.json`（26MB）失败，释义改为手写。
4. **Bash 里的 `grep` 常被沙箱静默失败**：多分支匹配一律用 Grep 工具；macOS 是 BSD grep，**不支持 `-P`**。

---

## 2. 本次会话已完成的任务

### 2.1 识字/课文学习三项优化

- **补全课本**：核对发现《彩虹》本来就没丢（一下第 11 课）。真正的问题是二上 17–20 课生字串位、第八单元整单元为空。已按教材原页校正并补齐 21–24 课，二上 → 28 课 / 248 字；其余 11 册零改动。
- **拼音 + 自动朗读**：生字卡与练字页显示拼音；切到新字自动读一次，用 `TTS.spoken` 记忆保证同一字不因重渲染重复朗读；有「自动朗读」开关。
- **组词 + 释义**：2344 个课内字（去重）每个 2–3 个组词，4707 条手写释义（字段 `wm`）。

### 2.2 发音：修粤语 bug + 三档发音

- **粤语 bug**：原代码取「语音列表里第一个中文语音」，macOS 上 `zh-HK`(Sinji) 常排在 `zh-CN` 前面 → 读成粤语。已改为按 lang 精确匹配并明确排除。
- 三档：**国语 / 粤语 / English**，各有独立语音对象、互不串用；英语档读这个字的英文单词并同步显示。

### 2.3 多音字 / 粤语隔离 / 英文 IPA

- **多音字**：源数据每字只存一个主读音且常错（长=zhǎng、地=de…）。已加 `pw`（词→读音）字段，教材注音 + 人工校对 289 字；运行时 `pickPinyin()` 按组词选音；朗读改为**先读词再读单字**（引擎读单字"处"只会念 chù）。
- **粤语独立**：三档各自持有 voice，切换只换自己那套；切换时大字与生字页同步刷新。
- **英文 IPA**：CMU 发音词典转美式 IPA，2477 词 100% 覆盖，方括号标注（如 `spring [ˈsprɪŋ]`）。

### 2.4 Git 仓库与自动同步

- `git init -b main`、`.gitignore`（89MB → 9.3MB，关键是 `.build` 整目录忽略后再重新纳入脚本与 `mean/`）、README 重写为开源版。
- `scripts/auto-sync.sh` / `watch-sync.sh` / `guard-secrets.sh` / LaunchAgent plist。
- 敏感信息守卫挂在 `.git/hooks/pre-commit`，手动 commit 同样生效。

### 2.5 产品评估 + 修首页白屏

- 产出 `docs/产品评估-2026-10-13.md`（35KB）。
- **修掉致命 bug**：首页主按钮「开始写字」`data-go="learn"` 指向不存在的页面 → 点击后所有 screen 被移除 `on` 却无页面可显示 → **白屏**。已改为 `catalog`，并新增通用守卫断言（扫描全部 `data-go` 校验目标页存在）。

---

## 3. 文件清单

### 3.1 修改过的既有文件

| 路径 | 用途 / 本次改动 |
|---|---|
| `index.html` | 加「自动朗读」按钮、发音三档切换；修主 CTA `learn` → `catalog` |
| `js/app.js` | TTS 重构（`VOICE_DEF`/`pickVoice`/`speakSeq`）、`pickPinyin` 多音字选音、`wordBlock` 组词释义、`setPinyinLine`、IPA 显示；修目录页导航 unit bug |
| `js/store.js` | `settings` 增 `autoRead`、`voice` |
| `css/app.css` | `.btn-read` / `.cell-py` / `.wd` 词块 / `.pinyin.en` / `.dr-en` 等样式 |
| `data/curriculum.js` | 二上 17–20 课校正 + 第八单元 4 课（30KB） |
| `data/dict.js` | 新增 `wm`(释义) / `en`(英文) / `ipa`(音标) / `pw`(词音)；补全 30 字（412KB） |
| `data/strokes/2a.js` | 补 32 个字的字帖轮廓 |
| `sw.js` | Service Worker 版本 `hzpb-v1` → `hzpb-v2`（否则老设备拿不到新字帖） |
| `README.md` | 重写为面向开源的完整文档 |

### 3.2 本次会话新建的文件

| 路径 | 用途 |
|---|---|
| `.gitignore` | 7 节：依赖 / 构建产物 / 密钥 / 日志 / 编辑器临时 / 本地会话 / `.build` |
| `scripts/auto-sync.sh` | 暂存 → 安全校验 → 生成 Conventional Commits → 提交 → 推送（7 类失败诊断） |
| `scripts/guard-secrets.sh` | 提交前敏感信息守卫（文件名黑名单 17 条 + 正文特征 11 条） |
| `scripts/watch-sync.sh` | 轮询监听，静默 8s 后触发同步（mkdir 原子锁，macOS 无 flock） |
| `scripts/com.github.hanzi.autosync.plist` | LaunchAgent 模板，开机自启 |
| `docs/产品评估-2026-10-13.md` | 产品评估报告：数据底稿 / 竞品对标 / 8 项诊断 / P0-P2 方案 / 30 天路线图 |
| `.build/verify.js` | 本轮功能校验 48 项（课文 / 拼音 / 三档发音 / 多音字 / IPA） |
| `.build/regress.js` | 既有功能回归 38 项（导航 / 练字 / 判分 / 存档 / 各页面） |
| `.build/dom-mock.js` | jsdom 共享 mock（canvas / SVG / speechSynthesis / PointerEvent） |
| `.build/patch_2a.py` | 二上课表校正与第八单元补齐（改前断言逐字节相同） |
| `.build/extract_lessons.py` | 从教材原页按锚点切段提取课表（诊断用，只读） |
| `.build/extract_words.py` | 从教材写字表抽组词 |
| `.build/merge_words.py` | 组词合并进 `dict.js`（只追加，上限 3） |
| `.build/fill_missing.py` | 从 hwd 字库补缺失字帖与字典条目 |
| `.build/extract_pinyin.py` | 从教材原页提取「拼音+字+组词」注音 |
| `.build/fix_pinyin.py` | 生成 `pw` 词音表并纠正主读音 |
| `.build/gen_en.py` | 生成英文字段 `en`（含 100+ 人工覆盖） |
| `.build/gen_ipa.py` | cmudict ARPABET → 美式 IPA |
| `.build/mean/*.txt` | 12 册手写释义源（格式 `字:词=释义|词=释义`） |
| `.build/apply_mean.py` | 把 `mean/` 合并进 `dict.js` 的 `wm` |

### 3.3 备份（改数据前留的）

`.build/curriculum.js.bak`、`.build/dict.js.bak`、`.build/2a.js.bak`

---

## 4. 数据契约（改代码前必读）

```js
window.HZ_CURRICULUM  // { '1a'…'6b': { id, name, units:[ { name, lessons:[ {id, name, chars:[字]} ] } ] } }
window.HZ_DICT        // { 字: { p:[拼音], r:部首, s:笔画数, w:[组词], wm:{词:释义}, en:英文, ipa:音标, pw:{词:读音} } }
window.HZ_STROKES     // { '2a': { 字: { s:[轮廓path], m:[中心线] } } }
localStorage['hzpb.v1'] // 存档；settings = { sound, demoSpeed, autoRead, voice }
```

实测覆盖（2344 个课内字去重）：`p/r/s/w/wm` = 2344（100%）；`en/ipa` = 2340（99.8%，吗/吧/呀/呢 4 个语气助词故意留空，英语档退回读汉字）；`pw` = 281（多音字词音）。

**改数据的铁律**：先备份 → 脚本先断言「重新序列化与原文逐字节相同」再落笔 → 只追加不覆盖 → 改完跑 verify + regress。

---

## 5. 待办与已知问题

| # | 优先级 | 事项 | 说明 |
|---|---|---|---|
| T1 | **高** | **线上版本缺白屏修复** | 源 `index.html` 已改，`dist/index.html` 未同步。需 `cp` 同步后重新发布，否则线上点「开始写字」仍白屏 |
| T2 | — | ~~GitHub 推送搁置~~ | ✅ 已解决：`origin` 已配置并推送成功（`main` 已设上游跟踪），SSH 认证可用，无需 `gh` CLI |
| T3 | 低 | 提交身份用的是 noreply 邮箱 | 当前 `git config user.email` 为 `<用户名>@users.noreply.github.com`，不暴露真实邮箱；如需换成真实身份再改 |
| T4 | ~~中~~ | ~~`smoke-test.html` 无法在本机跑~~ | ✅ 已解决：新增 `.build/run-smoke.js`（CDP 驱动 headless Chrome），113 项 18 秒跑完，可随时自动执行 |
| T5 | 中 | P0 产品优化未实施 | 见 `docs/产品评估-2026-10-13.md`：年级册次设置(P0-2)、存档备份恢复(P0-3)、错字本(P0-4)、家长周报(P0-5) |
| T6 | 低 | 3–6 年级课文归属缺失 | 占字量 68.9% 的课名是「第 N 组」，「按课文学习」在高年级失效 |
| T7 | 低 | 激励天花板 | 金币唯一出口是喂宠物，200 金币（≈23 个三星字）即到顶，之后只进不出 |
| T8 | — | ~~LICENSE 未创建~~ | ✅ 已解决：按分离授权落地 —— `LICENSE`（MIT，代码）+ `DATA-LICENSE.md`（自建数据 CC BY-NC-SA 4.0 / 美术 CC BY-NC 4.0）+ `data/LICENSE-NOTICE.txt`（字形沿用 Arphic PL） |

---

## 6. 继续工作的第一件事

按优先级：

1. **同步 `dist/` 并重新发布**（T1）——线上白屏是真实用户可见的问题。
2. 若用户已能登录 GitHub，走 T2 完成首次推送。
3. 若用户点头做 P0，从 **P0-2 年级册次设置** 起步：改动集中在 `pickDailyChars` 的取字范围，需处理 34 个跨册重复字的归属。

---

## 7. 红线与约定

1. **绝不删除、移动、重命名、覆盖用户的文件**（本地与服务器文件一视同仁）。产出一律写到项目自己的目录。
2. **还原临时改动用 `git checkout HEAD -- <file>`**，不要用 `git checkout -- <file>`（后者会从被 `git add` 污染的索引恢复，等于没还原）。本会话曾因此把测试字符 `x` 提交进 `js/store.js`，靠 regress 才抓出来。
3. 派给子 agent 的任务要写明：**只允许在指定目录新建文件，禁止改写既有文件（含格式化）**。本会话 PM 格式化 README 时误删了一节。
4. 改数据前先备份；生成脚本落笔前先断言序列化一致。
5. 任何 `data-*` 驱动的跳转，都要有「目标是否存在」的静态守卫。

## 8. 踩坑清单（按复现概率排序）

1. **BSD grep 不支持 `-P`**，且**以 `-` 开头的模式会被当成选项**（`-----BEGIN PRIVATE KEY-----` 直接报 unrecognized option）→ 一律 `grep -e` 或 `grep -f 模式文件`。
2. **守卫性能**：逐文件 × 逐正则 grep = 1500 次子进程、60s+ 超时 → 改为 `grep -f` + 只扫 `git diff --cached -U0` 的新增行，降到 2.8s。
3. **守卫自指**：脚本正文写着 `aws_secret_access_key` 会被自己报出来 → 规则要求 `=` 后跟值，并豁免 `guard-secrets.sh`。
4. **中文路径**：`git diff --cached` 会把中文名转成八进制转义 → 必须 `git -c core.quotepath=false`。
5. **`git rev-parse --abbrev-ref HEAD` 在首次提交前失败** → 用 `git symbolic-ref --short HEAD`。
6. **jsdom 不能传 `url` 选项**，否则相对路径会解析到 `http://localhost/` 导致脚本加载失败。
7. **cmudict 转 IPA**：重音符号必须落在音节首辅音之前（CMU 标在元音上，照搬会得到 `[wˈʌn]`，正确是 `[ˈwʌn]`）。
8. **教材数据不能盲信**：原页把「长（长大）」标成 cháng，规范是 zhǎng → 人工表优先。
