# -*- coding: utf-8 -*-
"""rowcount.py — 数一页「写字表」里每一行写了几个字（不读字，只数字形个数）

原理：灰度 -> 二值化 -> 行墨量剖面切行带 -> 行带内列墨量剖面切字列。
用于和人工读数交叉校验（官方总字数是对外总闸）。
用法: python3 rowcount.py .build/pep/2b/p122.jpg [minx]
"""
import sys
from PIL import Image


def bands(im, thr=140, gap=18):
    g = im.convert('L')
    w, h = g.size
    px = g.load()
    prof = []
    for y in range(h):
        n = 0
        for x in range(0, w, 2):
            if px[x, y] < thr:
                n += 1
        prof.append(n)
    out, s = [], None
    for y, n in enumerate(prof):
        if n > 0 and s is None:
            s = y
        elif n == 0 and s is not None:
            out.append((s, y)); s = None
    if s is not None:
        out.append((s, h))
    # 合并间隔很近的带（同一行的字/拼音被细缝切开）
    merged = []
    for b in out:
        if merged and b[0] - merged[-1][1] < gap:
            merged[-1] = (merged[-1][0], b[1])
        else:
            merged.append(b)
    return [b for b in merged if b[1] - b[0] >= 26]


def glyphs(im, y0, y1, thr=140, mingap=9):
    g = im.convert('L')
    w, _ = g.size
    px = g.load()
    cols = []
    for x in range(w):
        n = 0
        for y in range(y0, y1):
            if px[x, y] < thr:
                n += 1
        cols.append(n)
    runs, s = [], None
    for x, n in enumerate(cols):
        if n > 0 and s is None:
            s = x
        elif n == 0 and s is not None:
            runs.append((s, x)); s = None
    if s is not None:
        runs.append((s, w))
    # 过滤墨点噪噪，合并间距 < mingap 的段
    runs = [r for r in runs if r[1] - r[0] >= 6]
    out = []
    for r in runs:
        if out and r[0] - out[-1][1] < mingap:
            out[-1] = (out[-1][0], r[1])
        else:
            out.append(r)
    return out


def main():
    path = sys.argv[1]
    minx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    im = Image.open(path)
    for (y0, y1) in bands(im):
        gs = [g for g in glyphs(im, y0, y1) if g[1] > minx]
        if not gs:
            continue
        print('y%4d-%4d h%3d  字数%2d  首字x%4d 末字x%4d' % (y0, y1, y1 - y0, len(gs), gs[0][0], gs[-1][1]))


if __name__ == '__main__':
    main()
