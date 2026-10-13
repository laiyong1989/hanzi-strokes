# 生字笔顺乐园 · 小学语文写字小游戏

面向小学阶段（以统编版／人教版教材为准）的**汉字笔顺学习小游戏**：在平板或电脑上用手指／触控笔照着楷体笔锋写字，实时判断笔顺对错，写对得星星和金币，攒金币养宠物、每天打卡孵蛋。

- **纯静态、无构建**：一个 `index.html` 加几个 `js/css/data` 文件，没有打包器、没有依赖安装。
- **完全离线**：无网络请求、无第三方统计、无广告、无内购、不收集任何个人信息。学习进度只存在本机浏览器里。
- **大小写真实**：字帖是带笔锋的楷体轮廓（起笔尖、收笔粗），不是等宽线条描出来的。

在线体验：<https://hanzi-strokes.app.workbuddy.host/>（iPad/iPhone 用 Safari「分享 → 添加到主屏幕」可当 App 用）

---

## 一、核心功能

| 页面 | 说明 |
|---|---|
| **首页** | 宠物状态、金币 / 星星；六个入口：打卡、按课文学习、查字典、闯关、宠物、家长须知 |
| **按课文学习** | 选册 → 选单元 → 选课 → 本课字表 → 点字进入练字（1–2 年级逐课；3–6 年级按册分组） |
| **练字页** | 米字格 + 楷体笔锋字帖；「描红」跟着写 /「自己写」独立写；自动演示笔顺（慢 / 正常 / 快三档，自动记住）、擦一笔、看提示、整课连写 |
| **查字典** | 拼音查字（可省略声调，如 `chun`、`ch`）与部首查字，结果可直接点进去练字 |
| **闯关模式** | 每一课一关，按册浏览，通关给星星（1–3 星），记录历史最好成绩 |
| **宠物养成** | 宠物蛋 → 打卡孵化 → 幼生期 / 成长期 / 进化期；用金币喂食推进进化 |
| **每日打卡** | 每天最多 5 分钟（倒计时），系统自动挑 5 个「还没写好」的字；推进孵蛋进度、累计连续天数 |
| **家长须知** | 安全说明、内容来源、导出学习记录、一键清除记录 |

### 朗读发音（国语 / 粤语 / English）

练字页「自动朗读」旁有**发音三档**，切到生字时按当前档位读一次（同一个字同一种发音不会重复读）：

| 档位 | 读什么 | 界面显示 |
|---|---|---|
| **国语**（默认） | 汉字，普通话语音（`zh-CN`）；多音字先读词再读字 | 生字下显示拼音（按本课组词选正确读音） |
| **粤语** | 汉字，粤语语音（`zh-HK` / `yue`）；多音字同样先读词 | 生字下显示拼音 |
| **English** | 这个字的英文单词（春 → spring、猫 → cat） | 大字位置改成「英文单词 + 国际音标」，拼音收进右侧信息区 |

三档各有自己的语音对象，**互不串用**——不会出现「选了粤语却读国语」。早期版本取「语音列表里第一个中文语音」，而 macOS 列表里粤语常排在普通话前面，听起来就成了粤语；现在按 `lang` 精确匹配并显式排除。

### 多音字按上下文选音

字典记两样东西：`p`（这个字会用到的读音）和 `pw`（哪个词里读哪个音）。练字页有组词，于是可以像老师那样判断：

- 「长」：`长短` 里读 **cháng**，`长大` 里读 **zhǎng**
- 「处」：`处理` 里读 **chǔ**，`处所` 里读 **chù**
- 「地」：`大地` 读 **dì**，`慢慢地跑` 读 **de**

朗读时多音字**先读词再读单字**（「长短——长」），因为语音引擎拿到孤零零的「处」一律念 chù，放进词里才准。

### 儿童友好的反馈规则

- 写对了：轻快提示音 + 该笔画在字帖上「亮」起来 + 进度圆点变绿。
- 笔顺错了：柔和提示音 + 红笔圈出这一笔 + **自动演示正确的那一笔**，不扣分。
- 写歪了：提示「再试一次」，不扣分、不清空已写对的笔画。
- 每字 1–3 星：错误 ≥3 次或用了提示才降星。

---

## 二、技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 页面 | 原生 HTML + CSS + ES5 兼容的 JavaScript | 不用框架、不用打包器，双击 `index.html` 就能跑 |
| 渲染 | SVG（字帖轮廓）+ Canvas 2D（手写笔迹） | 轮廓走 SVG 保证缩放不失真；笔迹走 Canvas 保证书写流畅 |
| 存储 | `localStorage`（键名 `hzpb.v1`） | 进度、金币、宠物、设置全在本机 |
| 离线 | Service Worker（`sw.js`） | 装到主屏幕后断网也能练字 |
| 语音 | Web Speech API（`speechSynthesis`） | 用系统自带语音，不下载任何音频文件 |
| 测试 | 浏览器内自测页 + jsdom 命令行脚本 | 见「七、测试」 |
| 数据构建 | Python 3 + Node.js（仅开发期，运行游戏不需要） | 见 `.build/` |

**没有后端、没有数据库、没有账号体系**——这是刻意的设计：孩子用不上，也就没有隐私风险。

---

## 三、环境要求

运行游戏（任一即可）：

- 现代浏览器：Chrome / Edge 90+、Safari 14+、Firefox 90+
- 推荐 iPad 或安卓平板（支持手写笔与防手掌误触）
- **不需要** Node.js、Python、网络或服务器

参与开发（可选）：

| 用途 | 要求 |
|---|---|
| 本地起服务 | Python 3.8+（只用于 `python3 -m http.server`） |
| 命令行校验 | Node.js 18+ 与 `jsdom`（`npm i jsdom`） |
| 重建数据 | Python 3.10+（`.build/*.py`）；音标生成额外需要 `cmudict`（`pip install cmudict`） |
| 版本管理 | Git 2.30+ |
| 推送到 GitHub | SSH 密钥（见「六、配置说明」） |

---

## 四、安装与启动

### 方式 1：直接打开（零依赖）

```bash
git clone git@github.com:<你的用户名>/<仓库名>.git
cd <仓库名>
open index.html          # macOS；Windows 用 start，Linux 用 xdg-open
```

双击 `index.html` 也可以，`file://` 协议下所有功能都能用（Service Worker 除外，那个需要 http）。

### 方式 2：本地服务（推荐，Service Worker 才能生效）

```bash
python3 -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000/index.html
```

macOS 也可以双击 `启动服务.command`，它会额外打印局域网地址，方便用平板连同一个 Wi-Fi 访问。

### 方式 3：装到平板主屏幕

用 Safari（iPadOS/iOS）或 Chrome（Android）打开上面的地址 → 「分享 → 添加到主屏幕」。之后从桌面图标进入，全屏无地址栏，且首次访问后离线可用。

---

## 五、配置说明

**本项目运行时不需要任何密钥或环境变量**——没有后端、没有第三方 API、没有遥测。仓库里也没有 `.env` 文件。

需要配置的只有「版本管理」这一侧：

```bash
# 1. 提交身份（本仓库已设过，换成你自己的）
git config user.name  "Your Name"
git config user.email "you@example.com"
# 不想暴露真实邮箱，可用 GitHub 的 noreply 地址：
#   <用户名>@users.noreply.github.com

# 2. 推送用的 SSH 私钥（macOS/Linux）
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519_github -o IdentitiesOnly=yes"

# 3. 远端地址
git remote add origin git@github.com:<用户名>/<仓库名>.git
```

> **如果将来要接后端**：请把密钥放进 `.env`，把 `.env` 写进 `.gitignore`，并只提交 `.env.example`（里面全是占位符）。
> 本仓库的 `scripts/guard-secrets.sh` 会在每次提交前扫描暂存区，密钥、凭据、`.env`、日志、临时文件一律拦下——详见「九、安全校验」。

---

## 六、项目结构

```
.
├── index.html              入口页面。所有界面（首页/目录/生字/练字/字典/闯关/宠物/打卡/家长须知）
│                           都以 section 形式写在这里，靠 hidden 属性切换，无路由库。
├── css/
│   └── app.css             全部样式。可爱风 + 亮色 + 平板优先；米字格、笔画动画、词卡等样式都在内。
├── js/
│   ├── hanzi.js            字形引擎：楷体轮廓解析与缩放、笔顺中心线重采样、笔顺动画、
│   │                       手写轨迹判定（位置/方向/长度相似度），以及笔迹绘制。
│   ├── app.js              业务层：各页面渲染与交互、闯关、宠物、打卡、字典检索、
│   │                       朗读调度（TTS）、多音字选音。
│   └── store.js            本地存档：读写 localStorage（键 hzpb.v1），进度/金币/宠物/设置。
├── data/
│   ├── curriculum.js       window.HZ_CURRICULUM：12 册课程表（册 → 单元 → 课 → 生字数组）。
│   ├── dict.js             window.HZ_DICT：生字字典。每字 p(读音) / pw(词→音) / r(部首) /
│   │                       s(笔画数) / w(组词) / wm(词→释义) / en(英文单词) / ipa(国际音标)。
│   ├── strokes/            笔顺轮廓数据，按册拆成 12 个文件（1a.js … 6b.js），进入某册时才加载。
│   └── LICENSE-NOTICE.txt  字形数据的上游许可证声明（Arphic Public License）。
├── assets/
│   ├── pets/               宠物形象 PNG（原创设计）。
│   └── icon-*.png          应用图标（添加到主屏幕 / PWA 清单用）。
├── manifest.webmanifest     PWA 清单：名称、图标、全屏显示。
├── sw.js                    Service Worker：离线缓存。改了数据记得升 VER（当前 hzpb-v2），
│                            否则老设备会一直吃旧缓存。
├── smoke-test.html          浏览器内自测页，打开即跑约 102 项检查（渲染/布局/像素/交互）。
├── 启动服务.command          macOS 双击启动本地静态服务。
├── 同步到发布目录.command    把可发布文件复制进 dist/（线上发布的源目录）。
├── 笔顺排查报告.md           笔顺数据核查报告（开发记录）。
│
├── scripts/                 【自动化】
│   ├── auto-sync.sh         一次跑完「暂存 → 安全校验 → 生成 Conventional Commits 信息 → 提交 → 推送」；
│   │                        推送失败会分类报出原因并给出处理命令。
│   ├── guard-secrets.sh     提交前敏感信息守卫：文件名 + 正文双重检查，命中即终止提交。
│   └── watch-sync.sh        常驻监听：文件落盘并静默数秒后自动调用 auto-sync.sh。
│
├── .gitignore               忽略依赖、构建产物、密钥、日志、编辑器临时文件（见文件内分节注释）。
├── dist/                    发布副本，由「同步到发布目录.command」生成。**不要直接改这里**，
│                            也已在 .gitignore 中排除。
└── .build/                  【开发期，运行游戏不需要】数据构建脚本与中间产物：
    ├── *.py                 构建/修复脚本：build_data.py（重建 data/）、extract_lessons.py（按教材
    │                        核对课文）、extract_pinyin.py（提取教材注音）、fix_pinyin.py（多音字
    │                        纠正）、gen_en.py（生成英文单词）、gen_ipa.py（生成国际音标）、
    │                        apply_mean.py / merge_words.py（组词释义）、fill_missing.py（补字形）。
    ├── mean/*.txt           手写的组词释义源（字:词=释义|词=释义），共 5038 条。
    ├── dom-mock.js          jsdom 用的 DOM/语音 mock，供下面两个脚本复用。
    ├── verify.js            命令行校验：48 项，覆盖课文/拼音/多音字/三种发音/IPA/组词释义。
    ├── regress.js           命令行回归：36 项，覆盖导航/练字/判分/字典/闯关/宠物/打卡/存档。
    ├── raw/ hwd/ word.json  上游原始数据（教材页面、字形包、字典），体积大且版权敏感，
    │                        已在 .gitignore 中排除，不进仓库。
    └── *.bak *.log *.png    构建期备份、日志与诊断截图，同样不进仓库。
```

> 说明：`.build/` 里既有可复现的脚本也有体积很大的上游原始数据。`.gitignore` 的做法是
> 先整目录忽略，再把 `*.py`、`*.js` 和 `mean/`（手写释义源）重新纳入版本控制。

---

## 七、基本使用

### 改一个字的组词

直接编辑 `data/dict.js`（纯 JS，结构一目了然）：

```js
"春": { p:["chūn"], r:"日", s:9,
        w:["春天","春风","春雨"],
        wm:{ "春天":"一年四季中的第一个季节", "春风":"春天的风" },
        en:"spring", ipa:"[ˈsprɪŋ]" }
```

### 加一课

编辑 `data/curriculum.js`：

```js
window.HZ_CURRICULUM = {
  "1a": { id:"1a", name:"一年级上册", units:[
    { name:"第一单元 识字", lessons:[
      { id:"1a-0-0", name:"识字2《金木水火土》", chars:["一","二","三","上"] }
    ]}
  ]}
}
```

新增的字如果不在 `data/strokes/` 里，需要补字形数据（见 `.build/fill_missing.py`）。

### 跑测试

浏览器打开 `smoke-test.html` 会自动跑约 **102 项**检查并逐条列出结果，覆盖数据完整性、笔顺引擎、
真实 pointer 事件的手写链路、canvas 像素、四种视口零横向溢出、按钮尺寸、图标结构等。

只想快速确认「数据和交互没被改坏」，跑命令行脚本（jsdom 模拟，不需要浏览器）：

```bash
npm i jsdom
node .build/verify.js     # 48 项：课文/拼音/多音字/三种发音/IPA/组词释义
node .build/regress.js    # 36 项：导航/练字/存档/各页面等既有功能
```

两者退出码 0 表示全部通过，脚本自带临时静态服务，不依赖外部进程。
（若 `jsdom` 装在别处，用 `NODE_PATH=<node_modules 路径> node .build/verify.js`。）

### 发布上线

```bash
./同步到发布目录.command     # 把改动复制进 dist/
```

`dist/` 是发布用的副本，内容由根目录同步而来，**不要直接编辑**。

---

## 八、自动同步机制

文件落盘后自动完成「暂存 → 生成提交信息 → 提交 → 推送」，无需手工敲 git 命令。

### 手动触发一次

```bash
scripts/auto-sync.sh                            # 自动生成提交信息并推送
scripts/auto-sync.sh -m "fix(app): 修目录页跳转"  # 指定信息（更推荐，语义更准）
scripts/auto-sync.sh -m "..." --no-push          # 只提交，不推送
scripts/auto-sync.sh --dry                       # 演练，打印将要做什么但不改仓库
```

### 常驻监听

```bash
scripts/watch-sync.sh                 # 前台常驻，Ctrl-C 停止
scripts/watch-sync.sh --once          # 只检查一次
INTERVAL=3 DEBOUNCE=10 scripts/watch-sync.sh
```

每 `INTERVAL`（默认 5）秒轮询一次工作区，变更连续静默 `DEBOUNCE`（默认 8）秒后触发同步，
避免「文件刚写一半就提交」。

开机自启（macOS，关闭终端也不断）：

```bash
cp scripts/com.github.hanzi.autosync.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.github.hanzi.autosync.plist
```

（plist 模板见 `scripts/`；也可直接 `nohup scripts/watch-sync.sh > /tmp/autosync.log 2>&1 &`）

### 提交信息怎么来的

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`<type>(<scope>): <subject>`

- `type`：`feat`（有新增文件）/ `refactor`（改动+删除）/ `chore`（纯修改或纯删除）
- `scope`：按路径推断 —— `data` / `app` / `style` / `ui` / `docs` / `test` / `assets` / `pwa` / `chore`
- `subject` + `body`：列出**实际改动的文件清单**（新增 / 修改 / 删除 / 重命名），例如：

```
feat(data): 新增 data/dict.js 等 3 个文件

- 新增 data/dict.js
- 修改 js/app.js
- 删除 smoke-test.html.bak
```

> 自动推断只能描述「改了哪些文件」，说不出「为什么改」。想让提交历史可读，**建议用 `-m` 手写**。

### 推送失败时会告诉你什么

脚本捕获 `git push` 的输出并归类，直接给出可复制的处理命令：

| 归类 | 典型信号 | 给出的建议 |
|---|---|---|
| SSH 公钥问题 | `Permission denied (publickey)` | 去 <https://github.com/settings/keys> 添加公钥；`ssh -T git@github.com` 验证 |
| 认证失败 / 权限不足 | `Authentication failed`、`403` | 重做钥匙串凭据；确认令牌有 `repo` 权限；或改用 SSH |
| 仓库不存在 | `Repository not found` | 核对 `git remote -v`；去 <https://github.com/new> 建仓库 |
| 远端有冲突 | `non-fast-forward`、`rejected` | `git pull --rebase` 后重推；慎用 `--force-with-lease` |
| 分支受保护 | `protected branch`、`GH006` | 改推功能分支再提 PR |
| 网络异常 | `Could not resolve host`、`timed out` | 检查连通性 / 配代理；**提交已在本机，不会丢** |
| 分支名不匹配 | `src refspec`、`no upstream` | `git push -u origin <分支>` |

未配置 `origin` 时不算失败，会提示你怎么加远端。
**无论哪种失败，提交都已安全保存在本地**，网络或权限恢复后重跑脚本即可。

---

## 九、安全校验

`scripts/guard-secrets.sh` 在**每次提交前**检查暂存区（已挂到 `.git/hooks/pre-commit`，手动 `git commit` 同样生效）：

**1) 文件名检查** —— 命中即拒绝：

- 环境变量：`.env`、`.env.*`、`.envrc`、`.netrc`、`.npmrc`、`.pypirc`
- 私钥与证书：`*.key` `*.pem` `*.p12` `*.pfx` `*.p8` `*.keystore` `*.jks`，`id_rsa*` `id_ed25519*` …
- 服务账号：`*credentials*.json`、`*service-account*.json`
- 日志与临时文件：`*.log` `*.tmp` `*.bak` `*.swp` `Thumbs.db` `.DS_Store`

**2) 正文检查** —— 只扫本次实际新增/修改的行（读 `git diff --cached -U0`），避免扫存量代码：

- PEM 私钥头、SSH 公钥
- GitHub token（`ghp_` / `gho_` / `github_pat_`）、AWS Key、Google API Key、Slack token、JWT
- `sk-` 开头的 OpenAI 风格密钥
- 硬编码口令：`password` / `secret` / `api_key` / `token` 等字段后跟引号包裹的值

含占位符的行（`YOUR_`、`xxx`、`<...>`、`example`、`REDACTED`）视为示例，不算敏感，避免误报。

**发现问题时直接终止提交**，并给出四条处理路径：加进 `.gitignore` 并从索引移除 / 改名成 `*.example` /
吊销并轮换密钥后清历史 / 确认是误报就调规则。确需绕过用 `git commit --no-verify`（不推荐）。

> 已经把密钥推上去了怎么办？**第一步永远是去服务商吊销并轮换该密钥**——删文件不会让它失效。

---

## 十、数据与内容来源

| 内容 | 来源 |
|---|---|
| 笔顺轮廓与笔顺中心线 | Make Me a Hanzi / hanzi-writer-data，字形来自 Arphic Public License 授权字体 → `data/LICENSE-NOTICE.txt` |
| 拼音、部首 | Make Me a Hanzi `dictionary.txt`（每字只给一个主读音，故多音字不准，已用教材注音 + 人工词音表重做） |
| 多音字词音 | 教材《写字表》原页自带注音（一上/一下）＋ 人工校对，共 **289** 字带词→音对照 |
| 组词 | 教材《写字表》配套资料提取（要求词中必须含本字），并为 3–6 年级逐字补齐 |
| 组词释义 | 手写，共 5038 条，存于 `data/dict.js` 的 `wm` 字段（源在 `.build/mean/*.txt`） |
| 英文单词 | 字库自带英文释义抽取 + 人工校正，覆盖 2477 字 |
| 国际音标 | CMU Pronouncing Dictionary（ARPABET → 美式 IPA），2477 个单词 **100% 有音标** |
| 笔画数 | 由所用笔顺轮廓逐字统计，与演示动画完全一致 |
| 课程结构 | 依据统编版（部编版）小学语文教材《写字表》公开整理资料编排 |

当前规模：**12 册 / 256 课 / 2481 个不重复生字**，组词与释义覆盖 100%。

---

## 十一、如何贡献

欢迎提 Issue 和 PR。流程：

```bash
git switch -c feat/你的改动
# 改代码
node .build/verify.js && node .build/regress.js    # 命令行校验必须通过
scripts/auto-sync.sh -m "feat(data): 补三年级上册组词"
# 然后去 GitHub 提 Pull Request
```

**提交前请确认：**

1. `node .build/verify.js` 与 `node .build/regress.js` 都是 0 退出码（改了数据尤其要跑）。
2. 改了 `data/` 或 `sw.js` 记得升 `sw.js` 里的 `VER`，否则老设备拿不到新数据。
3. 改了 `dist/` 是无效的——它会被 `同步到发布目录.command` 覆盖。
4. 提交信息用 Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `test` / `chore`。
5. 不要提交密钥、`.env`、日志、临时文件（守卫会自动拦，但别试探它）。

**改数据时请特别小心：** `data/*.js` 是纯 JSON 派生的 JS 字面量，脚本写入前会断言「重新序列化与原文逐字节一致」，
建议改之前先备份（参考 `.build/*.py` 里的做法）。

**报告问题请附上**：浏览器与版本、所在页面、复现步骤、控制台报错。数据类错误请注明是哪个字、哪一册哪一课。

### 行为准则（精简版）

- 这是给孩子用的东西：功能与文案都要适合儿童，不引入广告、追踪、外链或任何收集行为。
- 对事不对人，批评针对代码。
- 提交的数据改动请说明来源（教材哪一页 / 哪个公开数据集），方便他人复核。

---

## 十二、开源许可证建议

**当前仓库还没有放 LICENSE 文件**——这一步需要你决定，因为本项目是「代码」与「数据」两种性质内容的混合体，单一许可证盖不住。

建议采用**分离授权**：

| 部分 | 建议 | 理由 |
|---|---|---|
| 代码（`index.html`、`css/`、`js/`、`scripts/`、`smoke-test.html`） | **MIT** | 最宽松、兼容性最好，适合教育类小工具，方便他人随意复用改造 |
| 字形数据（`data/strokes/`） | 沿用上游 **Arphic Public License** | 已是上游的授权条件，见 `data/LICENSE-NOTICE.txt`，不可自行改成 MIT |
| 自建数据（`data/curriculum.js` 的课程结构、`data/dict.js` 的组词与释义） | **CC BY-NC-SA 4.0** | 课文结构派生自教材，NC 避免商业滥用，SA 保证衍生数据同样开放 |
| 美术（`assets/pets/`、`assets/icon-*.png`） | **CC BY-NC 4.0** 或随代码一并 MIT | 原创设计，若希望被自由用于教学材料，MIT 更省事 |

落地方式（以 MIT 为例）：

```bash
# 1. 生成 MIT 文本：去 https://choosealicense.com/licenses/mit/ 复制，
#    把 <year> <copyright holders> 换成你的，保存为 LICENSE
# 2. 数据部分的授权单独写在 DATA-LICENSE.md
# 3. README 顶部补一行：
#    Code: MIT · Data: CC BY-NC-SA 4.0 · Glyphs: Arphic Public License
```

如果你希望「别人怎么用都行」，全部 MIT 也可以，但请注意 `data/strokes/` 受上游 Arphic 许可证约束，**不能改成 MIT**。

---

## 十三、儿童使用安全

- 完全离线：没有网络请求、没有第三方统计、没有广告与内购。
- 没有任何外部链接，不会跳转离开本应用。
- 学习记录只存在本机浏览器；家长可在「家长须知」里导出或一键清除。
- 每次使用建议 10–15 分钟；「每日打卡」本身限制在 5 分钟内。
- 写错不惩罚、不倒计时施压，只做提示与演示。

## 十四、已知限制

- 3–6 年级按册分组（每组 12 字、命名「第 N 组」），不是逐课——公开资料只到「册」，欢迎补数据。
- 笔顺判定采用轨迹相似度，**明显错序会拦住，潦草但方向正确会放过**，这是为儿童手感刻意放宽的。
- 粤语与英语发音依赖系统安装了对应语音；没装时会提示去哪里下载，不会拿其他语音顶替。
- 语气助词（呀 / 呢 / 吗 / 吧）没有对应英文，英语档下自动退回用国语读汉字。
- iOS 上 `speechSynthesis` 必须在用户手势内首次触发，页面已做处理；个别浏览器可能仍需在页面里点一下才有声。
