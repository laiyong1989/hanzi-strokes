#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scripts/guard-secrets.sh —— 提交前敏感信息守卫
#
# 两道检查：
#   1) 文件名：暂存区里有没有密钥、凭据、环境变量、日志、临时文件
#   2) 内容  ：本次实际新增/修改的行里有没有私钥、API Token、硬编码口令
#
# 发现疑似敏感内容时**以非零码退出**，阻止提交，并给出处理办法。
#
# 用法：
#   scripts/guard-secrets.sh                # 检查当前暂存区（git add 之后）
#   scripts/guard-secrets.sh <路径...>      # 只检查指定路径
#
# 退出码：0 = 通过；1 = 发现敏感内容，已阻止；2 = 环境错误
#
# 性能说明：早期版本是「每个文件 × 每条正则」逐次 grep，70 多个文件要跑
# 1500+ 个子进程、耗时一分钟以上。现在改为把规则写成模式文件，用 grep -f
# 批量匹配；内容检查直接读 git diff 的新增行，全程只有个位数子进程。
# ---------------------------------------------------------------------------
set -uo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "✗ 不在 Git 仓库中" >&2
  exit 2
}
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO" || exit 2

RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'

# core.quotepath=false：否则中文路径会被 git 转成 "\347\254..." 这种八进制转义
GITQ=(git -c core.quotepath=false)

TMPD="$(mktemp -d -t guard)" || exit 2
trap 'rm -rf "$TMPD"' EXIT

# ---------------------------------------------------------------------------
# 一、文件名规则
# ---------------------------------------------------------------------------
NAME_PAT_FILE="$TMPD/name.pat"
cat > "$NAME_PAT_FILE" <<'EOF'
(^|/)\.env$
(^|/)\.env\.[^/]+$
(^|/)\.envrc$
(^|/)\.netrc$
(^|/)\.npmrc$
(^|/)\.pypirc$
\.(key|pem|p12|pfx|p8|keystore|jks|ppk)$
(^|/)id_(rsa|dsa|ecdsa|ed25519)([^/]*)$
(^|/).*credentials.*\.(json|ya?ml|ini|conf)$
(^|/).*service[-_]?account.*\.(json|ya?ml)$
(^|/)secrets?\.(json|ya?ml|ini|conf)$
\.(log|tmp|temp|bak|swp|swo)$
(^|/)(Thumbs\.db|ehthumbs\.db)$
(^|/)(\.DS_Store|\.DS_Store\?)$
(^|/)\._
EOF

WHITE_FILE="$TMPD/white.pat"          # 模板/示例，明确放行
cat > "$WHITE_FILE" <<'EOF'
(^|/)\.env\.example$
(^|/)README
(^|/)\.gitignore$
(^|/)guard-secrets\.sh$
EOF

# 自检豁免：本脚本和忽略规则本身就写着这些特征词，扫自己必然误报
SELF_RE='(^|/)(guard-secrets\.sh|\.gitignore)$'

# 二进制：不参与内容检查
BIN_RE='\.(png|jpe?g|gif|bmp|ico|webp|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|bz2|7z|rar|mp3|mp4|wav|mov|avi|webm|exe|dll|so|dylib|class|pyc|wasm|db|sqlite3?|psd|ai|sketch)$'

# ---------------------------------------------------------------------------
# 二、内容特征（正文新增行里出现即高度疑似）
# ---------------------------------------------------------------------------
PAT_FILE="$TMPD/content.pat"
cat > "$PAT_FILE" <<'EOF'
-----BEGIN [A-Z ]*PRIVATE KEY-----
ssh-rsa AAAA[0-9A-Za-z+/=]{40,}
gh[pous]_[A-Za-z0-9]{20,}
github_pat_[A-Za-z0-9_]{20,}
AKIA[0-9A-Z]{16}
aws_secret_access_key[[:space:]]*[:=][[:space:]]*[^[:space:]"']{6,}
AIza[0-9A-Za-z_-]{35}
sk-[A-Za-z0-9]{24,}
xox[baprs]-[A-Za-z0-9-]{10,}
eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.
(password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|auth[_-]?token)[[:space:]]*[:=][[:space:]]*["'][^"']{8,}["']
EOF

# 命中占位符的行视为示例，不算敏感
PLACE_RE='(YOUR_|your_|XXX+|xxx+|PLACEHOLDER|placeholder|<[^>]+>|CHANGEME|changeme|EXAMPLE|example|REDACTED|redacted|\*+)'

# ---------------------------------------------------------------------------
# 收集待检查路径
# ---------------------------------------------------------------------------
PATHS_FILE="$TMPD/paths.txt"
if [ "$#" -gt 0 ]; then
  printf '%s\n' "$@" > "$PATHS_FILE"
else
  "${GITQ[@]}" diff --cached --name-only > "$PATHS_FILE" 2>/dev/null
fi
# 去空行
grep -v '^$' "$PATHS_FILE" > "$TMPD/p" 2>/dev/null && mv "$TMPD/p" "$PATHS_FILE"

N_FILES="$(wc -l < "$PATHS_FILE" | tr -d ' ')"
if [ "$N_FILES" -eq 0 ]; then
  echo "  ✓ 暂存区为空，无需检查"
  exit 0
fi

# ---------------------------------------------------------------------------
# 三、文件名检查（3 次 grep 搞定全部文件）
# ---------------------------------------------------------------------------
RAW_HITS="$TMPD/raw_hits.txt"
WHITE_HITS="$TMPD/white_hits.txt"
grep -Ef "$NAME_PAT_FILE" "$PATHS_FILE" 2>/dev/null > "$RAW_HITS" || :
grep -Ef "$WHITE_FILE"    "$PATHS_FILE" 2>/dev/null > "$WHITE_HITS" || :

hits_name=()
while IFS= read -r h; do
  [ -z "$h" ] && continue
  # 白名单里的不算
  if ! grep -Fqx -e "$h" "$WHITE_HITS" 2>/dev/null; then
    hits_name+=("$h")
  fi
done < "$RAW_HITS"

# ---------------------------------------------------------------------------
# 四、内容检查：只扫本次实际新增/修改的行
# ---------------------------------------------------------------------------
ADDED="$TMPD/added.txt"
if [ "$#" -gt 0 ]; then
  "${GITQ[@]}" diff --cached -U0 --diff-filter=ACM -- "${@}" > "$TMPD/raw.diff" 2>/dev/null
else
  "${GITQ[@]}" diff --cached -U0 --diff-filter=ACM > "$TMPD/raw.diff" 2>/dev/null
fi

# 抽取：每个 + 行前面标注它属于哪个文件（跳过二进制的 "Binary files differ"）
awk -v self='(^|/)(guard-secrets\\.sh|\\.gitignore)$' '
  /^\+\+\+ /    { f = $2; sub(/^b\//, "", f); if (f ~ self) f = "" ; next }
  /^\+/         { if (f != "") print f "\t" substr($0, 2) }
  /^diff --git/ { f = "" }
' "$TMPD/raw.diff" > "$ADDED" 2>/dev/null

hits_content=()
if [ -s "$ADDED" ]; then
  # 一次 grep 找出所有命中行（保留 "文件\t行内容"）
  grep -Ef "$PAT_FILE" "$ADDED" 2>/dev/null > "$TMPD/hit.txt" || :
  # 剔除占位符行
  grep -Ev -e "$PLACE_RE" "$TMPD/hit.txt" 2>/dev/null > "$TMPD/hit2.txt" || :
  while IFS=$'\t' read -r f line; do
    [ -z "${f:-}" ] && continue
    hits_content+=("$f -> $(printf '%s' "$line" | cut -c1-100)")
  done < "$TMPD/hit2.txt"
fi

# ---------------------------------------------------------------------------
# 五、报告
# ---------------------------------------------------------------------------
if [ "${#hits_name[@]}" -eq 0 ] && [ "${#hits_content[@]}" -eq 0 ]; then
  echo "  ✓ 敏感信息检查通过（${N_FILES} 个文件：无密钥、无凭据、无环境变量、无日志临时文件）"
  exit 0
fi

echo ""
echo "${RED}✗ 发现疑似敏感内容，已阻止提交${RST}"
echo ""

if [ "${#hits_name[@]}" -gt 0 ]; then
  echo "${YEL}[1] 文件名命中敏感规则${RST}"
  for h in "${hits_name[@]}"; do echo "    · $h"; done
  echo ""
fi

if [ "${#hits_content[@]}" -gt 0 ]; then
  echo "${YEL}[2] 文件正文疑似包含密钥 / 口令 / Token${RST}"
  for h in "${hits_content[@]}"; do echo "    · $h"; done
  echo ""
fi

cat <<'GUIDE'
怎么处理（选一条）：

  A. 它本来就不该进仓库 —— 加入 .gitignore 并从暂存区移除：
       echo "路径" >> .gitignore
       git rm --cached "路径"        # 只从索引移除，硬盘上的文件保留

  B. 它是模板/示例 —— 改名成 *.example，真值留在本地：
       git mv "config.json" "config.example.json"

  C. 它确实是密钥且已经提交过 —— 立刻去服务商吊销/轮换该密钥，
     再清历史（历史重写会影响所有协作者，务必先沟通）：
       git filter-repo --path "路径" --invert-paths
     只撤销"还没推送"的提交则用：
       git reset --soft HEAD~1 && git restore --staged .

  D. 误报 —— 确认那一行只是占位符（含 YOUR_ / <...> / example 等），
     或调整 scripts/guard-secrets.sh 里的规则文件。

想临时跳过（仅限你百分之百确认安全，不推荐）：
  git commit --no-verify
GUIDE
echo ""
exit 1
