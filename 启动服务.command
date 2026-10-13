#!/bin/bash
# 生字笔顺乐园 · 本地服务启动器
# 用途：在电脑上启动一个本地网页服务，让同一 Wi-Fi 下的平板/iPad 也能打开这个小游戏。
# 只读取本文件夹内容，不会修改或删除任何文件；按 Control+C 或者直接关掉本窗口即可停止。

cd "$(dirname "$0")" || exit 1
PORT=8000

IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en1 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en2 2>/dev/null)

echo "=============================================="
echo "  生字笔顺乐园 已启动"
echo "----------------------------------------------"
echo "  这台电脑打开：   http://127.0.0.1:$PORT/index.html"
if [ -n "$IP" ]; then
  echo "  平板 / iPad 打开：http://$IP:$PORT/index.html"
  echo "  （平板需与本机连接同一个 Wi-Fi）"
else
  echo "  未检测到局域网 IP，请在「系统设置 → 网络」里查看本机 IP，"
  echo "  然后在平板浏览器打开 http://本机IP:$PORT/index.html"
fi
echo "----------------------------------------------"
echo "  停止服务：在本窗口按 Control + C"
echo "=============================================="
echo

open "http://127.0.0.1:$PORT/index.html" 2>/dev/null
python3 -m http.server "$PORT"
