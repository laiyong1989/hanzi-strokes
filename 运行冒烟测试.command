#!/bin/bash
# 生字笔顺乐园 · 冒烟测试运行器
# 用途：一键跑完 102 项浏览器端检查（布局、像素、动画、真实渲染）。
# 为什么必须用本地服务：直接双击 smoke-test.html 会以 file:// 打开，
# 浏览器把每个本地文件当作独立源，会拦截父页面访问 iframe 内的应用（origin "null"），
# 测试无法启动。本脚本起一个本地 HTTP 服务来避开这个限制。
# 只读取本文件夹内容，不修改或删除任何文件。

cd "$(dirname "$0")" || exit 1
PORT=8000
URL="http://127.0.0.1:$PORT/smoke-test.html"
STARTED_BY_US=0

if curl -s --noproxy '*' -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/index.html"; then
  echo "检测到 8000 端口已有服务在跑，直接复用。"
else
  echo "正在启动本地服务…"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER_PID=$!
  STARTED_BY_US=1
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 0.5
    if curl -s --noproxy '*' -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/index.html"; then
      break
    fi
  done
fi

if ! curl -s --noproxy '*' -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/index.html"; then
  echo ""
  echo "启动失败。若提示 python3 找不到，可改用：/usr/bin/python3 -m http.server $PORT"
  read -n 1 -s -r -p "按任意键退出…" && echo
  [ "$STARTED_BY_US" = "1" ] && kill "$SERVER_PID" 2>/dev/null
  exit 1
fi

echo ""
echo "  浏览器即将打开测试页，跑完约需十几秒。"
echo "  看最后两行：'===== 通过 N / 失败 M =====' 和 'SMOKE_DONE'"
echo "  重点：有没有 FAIL 行。有的话把失败行发给我。"
echo ""
open "$URL"
echo "  若浏览器没自动打开，请手动访问："
echo "    $URL"
echo ""

if [ "$STARTED_BY_US" = "1" ]; then
  read -n 1 -s -r -p "看完结果后，按任意键结束（会同时停止本次启动的服务）…"
  echo
  kill "$SERVER_PID" 2>/dev/null
else
  read -n 1 -s -r -p "看完结果后，按任意键结束（服务不是本次启动的，会保持运行）…"
  echo
fi