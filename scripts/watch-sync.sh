#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scripts/watch-sync.sh —— 文件落盘后自动同步
#
# 工作方式：轮询 `git status --porcelain` 检测新增/修改/删除，
# 变更连续静默 DEBOUNCE 秒后（避免写到一半就提交）调用 auto-sync.sh。
#
# 用法：
#   scripts/watch-sync.sh              # 前台常驻（Ctrl-C 停止）
#   scripts/watch-sync.sh --once       # 只检查一次，有变更就同步，然后退出
#   INTERVAL=3 DEBOUNCE=10 scripts/watch-sync.sh
#
# 环境变量：
#   INTERVAL   轮询间隔（秒，默认 5）
#   DEBOUNCE   静默等待（秒，默认 8）
#
# 后台常驻（关闭终端也不断）：见 README「自动同步 → 开机自启」
# ---------------------------------------------------------------------------
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

INTERVAL="${INTERVAL:-5}"
DEBOUNCE="${DEBOUNCE:-8}"
ONCE=0
[ "${1:-}" = "--once" ] && ONCE=1

DIM=$'\033[2m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RST=$'\033[0m'
LOCK="/tmp/hzpb-autosync.lock"        # macOS 没有 flock，用 mkdir 的原子性当锁

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }

# 变更指纹：把「状态+路径+大小+mtime」拼起来，内容抖动也能识别
fingerprint() {
  git status --porcelain 2>/dev/null | while IFS= read -r line; do
    p="${line:3}"
    # 路径可能带引号（中文/空格），去掉首尾引号
    p="${p%\"}"; p="${p#\"}"
    if [ -e "$p" ]; then
      printf '%s|%s|%s\n' "${line:0:2}" "$p" "$(stat -f '%z:%m' "$p" 2>/dev/null)"
    else
      printf '%s|%s|deleted\n' "${line:0:2}" "$p"
    fi
  done
}

sync_now() {
  # 单实例锁：避免上一次还没推完又触发一次
  if ! mkdir "$LOCK" 2>/dev/null; then
    log "${DIM}上一次同步仍在进行，跳过本次${RST}"
    return 0
  fi
  trap 'rm -rf "$LOCK"' RETURN

  log "${YEL}检测到变更，开始同步…${RST}"
  if bash scripts/auto-sync.sh; then
    log "${GRN}同步完成${RST}"
  else
    log "同步未成功（详见上方输出）"
  fi
}

if [ "$ONCE" -eq 1 ]; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then sync_now; else log "无变更"; fi
  exit 0
fi

log "开始监听（轮询 ${INTERVAL}s，静默 ${DEBOUNCE}s 后提交）…  Ctrl-C 停止"
LAST_FP=""
STABLE_SINCE=""

while true; do
  FP="$(fingerprint)"

  if [ -z "$FP" ]; then
    LAST_FP=""; STABLE_SINCE=""
  elif [ "$FP" != "$LAST_FP" ]; then
    LAST_FP="$FP"
    STABLE_SINCE="$(date +%s)"
  else
    NOW="$(date +%s)"
    if [ -n "$STABLE_SINCE" ] && [ $((NOW - STABLE_SINCE)) -ge "$DEBOUNCE" ]; then
      sync_now
      # 同步后重置，避免同一批变更被反复提交
      LAST_FP="$(fingerprint)"
      STABLE_SINCE=""
    fi
  fi

  sleep "$INTERVAL"
done
