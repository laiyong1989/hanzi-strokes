#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scripts/auto-sync.sh —— 一次跑完「暂存 → 安全校验 → 生成提交信息 → 提交 → 推送」
#
# 提交信息遵循 Conventional Commits：  <type>(<scope>): <subject>
#   type  : feat / fix / docs / style / refactor / perf / test / build / chore
#   scope : data / app / style / ui / docs / test / assets / pwa / chore / misc
#
# 用法：
#   scripts/auto-sync.sh                       # 自动生成提交信息并推送
#   scripts/auto-sync.sh -m "fix(app): 修目录页跳转"   # 指定提交信息并推送
#   scripts/auto-sync.sh -m "..." --no-push    # 只提交不推送
#   scripts/auto-sync.sh --dry                 # 演练：只打印将要做什么，不改仓库
#
# 退出码：0 = 成功（或无需同步）；1 = 被安全守卫拦下；2 = 用法/环境错误；3 = 推送失败
# ---------------------------------------------------------------------------
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLU=$'\033[34m'; DIM=$'\033[2m'; RST=$'\033[0m'

MSG=""
DO_PUSH=1
DRY=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --no-push)    DO_PUSH=0; shift ;;
    --dry)        DRY=1; shift ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)            echo "未知参数：$1（用 --help 看用法）" >&2; exit 2 ;;
  esac
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "${RED}✗ 当前目录不是 Git 仓库${RST}" >&2; exit 2; }

# ---------------------------------------------------------------------------
# 1. 暂存所有变更（新增 / 修改 / 删除）
# ---------------------------------------------------------------------------
if [ "$DRY" -eq 0 ]; then
  git add -A
  STAGED="$(git diff --cached --name-status)"
else
  echo "${DIM}[演练] git add -A${RST}"
  # 演练时不动索引，用「已暂存 + 未暂存 + 未跟踪」拼出 add -A 之后的等价清单
  STAGED="$(
    { git diff --cached --name-status
      git diff --name-status
      git ls-files --others --exclude-standard | sed 's/^/A\t/'
    } 2>/dev/null
  )"
fi

if [ -z "$(printf '%s' "$STAGED" | tr -d '[:space:]')" ]; then
  echo "  · 没有需要提交的变更"
  exit 0
fi

N_TOTAL="$(printf '%s\n' "$STAGED" | wc -l | tr -d ' ')"
if [ "$DRY" -eq 1 ]; then
  echo "${BLU}[演练] 将要提交 ${N_TOTAL} 项变更：${RST}"
  printf '%s\n' "$STAGED" | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# 2. 安全校验（敏感配置 / 密钥 / 临时文件）
# ---------------------------------------------------------------------------
echo "${BLU}▸ 安全校验${RST}"
if ! bash scripts/guard-secrets.sh; then
  echo ""
  echo "${RED}已停止提交。请按上面的建议处理后再运行本脚本。${RST}"
  exit 1
fi
echo ""

# ---------------------------------------------------------------------------
# 3. 生成提交信息
# ---------------------------------------------------------------------------
scope_of() {
  case "$1" in
    data/*)                                   echo data ;;
    js/*)                                     echo app ;;
    css/*)                                    echo style ;;
    index.html)                               echo ui ;;
    smoke-test.html)                          echo test ;;
    sw.js|manifest.webmanifest)               echo pwa ;;
    assets/*)                                 echo assets ;;
    README.md|*.md|docs/*)                    echo docs ;;
    scripts/*|.gitignore|.github/*)           echo chore ;;
    .build/*.py|.build/mean/*)                echo data ;;
    .build/verify.js|.build/regress.js|\
    .build/dom-mock.js)                       echo test ;;
    *)                                        echo misc ;;
  esac
}

gen_msg() {
  local added=0 modified=0 deleted=0 renamed=0
  local -a scopes=() paths=()
  local st p rest

  while IFS=$'\t' read -r st rest; do
    [ -z "${st:-}" ] && continue
    case "$st" in
      A*) added=$((added+1));   p="$rest" ;;
      M*) modified=$((modified+1)); p="$rest" ;;
      D*) deleted=$((deleted+1));   p="$rest" ;;
      R*) renamed=$((renamed+1));   p="$(printf '%s' "$rest" | awk -F'\t' '{print $NF}')" ;;
      *)  p="$rest" ;;
    esac
    paths+=("$p")
    scopes+=("$(scope_of "$p")")
  done < <(printf '%s\n' "$STAGED")

  # 主导 scope：出现次数最多的那个
  local scope
  scope="$(printf '%s\n' "${scopes[@]}" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')"
  [ -z "$scope" ] && scope=misc

  # type 推断：有新文件优先 feat；纯删除是 chore；其余（纯修改/混合）用 chore
  local type verb
  if   [ "$added" -gt 0 ] && [ "$modified" -eq 0 ] && [ "$deleted" -eq 0 ]; then type=feat;  verb=新增
  elif [ "$deleted" -gt 0 ] && [ "$added" -eq 0 ] && [ "$modified" -eq 0 ]; then type=chore; verb=删除
  elif [ "$added" -gt 0 ];                                                    then type=feat;  verb=更新
  elif [ "$modified" -gt 0 ] && [ "$deleted" -gt 0 ];                         then type=refactor; verb=整理
  else                                                                            type=chore; verb=更新
  fi

  # subject：单文件时点名，多文件时点名 1 个 + 计数
  local subject
  if [ "${#paths[@]}" -eq 1 ]; then
    subject="${verb} ${paths[0]}"
  else
    subject="${verb} ${paths[0]} 等 ${#paths[@]} 个文件"
  fi

  # body：完整清单 + 变更类型统计，保证"说明本次实际改动内容"
  local body
  body="$(printf '%s\n' "$STAGED" | awk -F'\t' '{
    s=$1;
    if (s ~ /^A/) t="新增";
    else if (s ~ /^M/) t="修改";
    else if (s ~ /^D/) t="删除";
    else if (s ~ /^R/) t="重命名";
    else t="变更";
    printf "- %s %s\n", t, $NF;
  }')"

  printf '%s(%s): %s\n\n%s\n' "$type" "$scope" "$subject" "$body"
}

if [ -z "$MSG" ]; then
  MSG="$(gen_msg)"
fi

echo "${BLU}▸ 提交信息${RST}"
printf '%s\n' "$MSG" | sed 's/^/  /'
echo ""

if [ "$DRY" -eq 1 ]; then
  echo "${YEL}[演练] 到此为止，未提交、未推送。${RST}"
  exit 0
fi

# ---------------------------------------------------------------------------
# 4. 提交
# ---------------------------------------------------------------------------
# 首次提交时 HEAD 还未出生，--abbrev-ref 会失败，故用 symbolic-ref
BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo main)"
if ! git commit -q -m "$MSG"; then
  echo "${RED}✗ 提交失败（见上方 git 输出）${RST}" >&2
  exit 1
fi
echo "${GRN}  ✓ 已提交到 ${BRANCH}${RST}  $(git rev-parse --short HEAD)"

if [ "$DO_PUSH" -eq 0 ]; then
  echo "${DIM}  · 按 --no-push 要求，跳过推送${RST}"
  exit 0
fi

# ---------------------------------------------------------------------------
# 5. 推送 + 失败原因诊断
# ---------------------------------------------------------------------------
diagnose() {
  local out="$1"
  echo ""
  echo "${RED}✗ 推送失败${RST}"
  echo ""

  if printf '%s' "$out" | grep -qE "Permission denied \(publickey\)|Could not read from remote repository"; then
    cat <<'E'
原因：SSH 公钥认证失败 —— GitHub 上没有你这台机器的公钥，或用的密钥不对。

处理：
  1) 确认公钥已添加到 GitHub： https://github.com/settings/keys
     cat ~/.ssh/id_ed25519_github.pub      # 复制整行去添加
  2) 本机验证连通性（应看到 "Hi <用户名>! You've successfully authenticated"）：
     ssh -T git@github.com
  3) 若有多把密钥，确认本仓库用的是指定那把：
     git config core.sshCommand
     应为： ssh -i ~/.ssh/id_ed25519_github -o IdentitiesOnly=yes
E

  elif printf '%s' "$out" | grep -qE "Authentication failed|could not read Username|Invalid username or password|403|returned error: 401"; then
    cat <<'E'
原因：认证失败或凭据权限不足 —— 令牌无效、已过期，或缺少 repo 权限。

处理：
  1) HTTPS 方式请重新登录钥匙串：
       git credential-osxkeychain erase   # 然后回车两次
       git push                            # 重新输入用户名 + Personal Access Token（不是账户密码）
  2) 令牌需要有 repo 权限： https://github.com/settings/tokens
  3) 建议改用 SSH（本仓库已生成专用密钥）：
       git remote set-url origin git@github.com:<用户名>/<仓库>.git
E

  elif printf '%s' "$out" | grep -qE "Repository not found|repository does not exist|Could not resolve to a Repository"; then
    cat <<'E'
原因：远端仓库不存在，或当前账号没有访问权限。

处理：
  1) 确认远端地址拼写正确： git remote -v
  2) 确认该仓库在 GitHub 上已创建： https://github.com/new
  3) 若是组织仓库，确认自己有写权限。
E

  elif printf '%s' "$out" | grep -qE "non-fast-forward|fetch first|rejected|failed to push some refs|Updates were rejected"; then
    cat <<'E'
原因：远端分支有你本地没有的新提交（分支冲突/落后）。

处理（按推荐顺序）：
  1) 变基后重推（最干净）：
       git pull --rebase origin <分支>
       git push
  2) 若确实要以本地为准（会覆盖远端他人提交，慎用）：
       git push --force-with-lease
  3) 冲突时：git status 看冲突文件，改完 git add -A && git rebase --continue
E

  elif printf '%s' "$out" | grep -qE "protected branch|denied to|pre-receive hook declined|GH006"; then
    cat <<'E'
原因：分支受保护，或服务端 pre-receive 钩子拒绝（无推送权限）。

处理：
  1) 改推到功能分支再提 PR：
       git switch -c feat/xxx  &&  git push -u origin feat/xxx
  2) 或让仓库管理员在 Settings → Branches 放开保护规则。
E

  elif printf '%s' "$out" | grep -qE "Could not resolve host|timed out|Connection refused|Network is unreachable|Failed to connect|Operation too slow|OpenSSL SSL_read"; then
    cat <<'E'
原因：网络异常 —— 无法连接 GitHub（DNS / 代理 / 断网 / 超时）。

处理：
  1) 检查连通性： ssh -T git@github.com   或   ping github.com
  2) 公司网络/代理环境需配置代理：
       git config http.proxy  http://127.0.0.1:7890
       git config https.proxy http://127.0.0.1:7890
  3) 提交已安全保存在本地，网络恢复后重跑本脚本即可，不会丢。
E

  elif printf '%s' "$out" | grep -qE "src refspec|does not match any|no upstream branch"; then
    cat <<'E'
原因：本地分支名与远端不一致，或尚无上游分支。

处理：
  1) 首次推送建立上游： git push -u origin <分支>
  2) 或指定： git push origin HEAD:<远端分支名>
E

  else
    echo "原因：未能归类，原始输出如下："
    echo ""
    printf '%s\n' "$out" | sed 's/^/  /'
    echo ""
    cat <<'E'
通用排查：
  git remote -v                 # 远端地址对不对
  git status                    # 分支是否落后
  git log --oneline -3          # 本地提交在不在
  ssh -T git@github.com         # SSH 通不通
提交已保存在本地，不会因为推送失败而丢失。
E
  fi
  exit 3
}

# 推送暂停开关：远端授权不可用期间，只做本地提交，不反复提示配 origin。
# 恢复推送：git config --local --unset hzpb.pushDisabled
if [ "$(git config --local --get hzpb.pushDisabled 2>/dev/null)" = "true" ]; then
  echo ""
  echo "${DIM}  · 推送已暂停（hzpb.pushDisabled=true），本次仅提交到本地仓库${RST}"
  echo "${DIM}    恢复推送：git config --local --unset hzpb.pushDisabled${RST}"
  exit 0
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$REMOTE_URL" ]; then
  echo ""
  echo "${YEL}! 未配置远端 origin，已提交到本地但无法推送${RST}"
  cat <<'E'
配置方式（SSH，本仓库已生成专用密钥 ~/.ssh/id_ed25519_github）：
  git remote add origin git@github.com:<用户名>/<仓库>.git
  git push -u origin main

还没有远端仓库？去 https://github.com/new 建一个空仓库（不要勾选 README/LICENSE），
建好后把地址填进上面的命令即可。
E
  exit 0
fi

echo "${BLU}▸ 推送到 ${REMOTE_URL}${RST}"
PUSH_OUT="$(git push -u origin "$BRANCH" 2>&1)"
PUSH_RC=$?

if [ "$PUSH_RC" -ne 0 ]; then
  diagnose "$PUSH_OUT"
fi

echo "${GRN}  ✓ 推送成功${RST}"
printf '%s\n' "$PUSH_OUT" | tail -3 | sed 's/^/  /'
exit 0
