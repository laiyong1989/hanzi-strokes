#!/bin/bash
# 生字笔顺乐园 · 同步到发布目录
# 用途：把改动复制到 dist/，供发布线上版使用。
# 只读取本文件夹的运行文件、只写入 dist/，不会改动也不会删除任何其他文件。

cd "$(dirname "$0")" || exit 1

echo "=============================================="
echo "  正在同步到 dist/ …"
echo "=============================================="

mkdir -p dist
cp index.html sw.js manifest.webmanifest dist/
cp -R css js data assets dist/

echo
echo "已同步。dist/ 现在的大小与内容："
du -sh dist
ls dist
echo
echo "接下来告诉 WorkBuddy「发布更新」即可（线上链接不变）。"
echo "按回车键关闭本窗口。"
read -r _
