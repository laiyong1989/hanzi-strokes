#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pep-fetch-full.py — 按页区间下载某册教材的页面图

preview 元数据只列前 49 页，但转码图 1~N 页的 URL 可构造：
    <preview 第 1 页 URL 去掉末尾页码> + "<页码>.jpg"
用法:
    python3 pep-fetch-full.py 2b            # 下 1~10 页（目录区）
    python3 pep-fetch-full.py 2b 117 118    # 只下书页 117/118 对应的图（图页=书页+5）
    python3 pep-fetch-full.py 2b 1 140      # 下整个区间
命名与 pep-fetch.py 一致：p001.jpg（零填充 3 位）。
"""
import json, os, sys, urllib.request

BASE = 'https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_%s.json'
PARTS = ['100', '101', '102', '103']
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pep')
HDR = {'Referer': 'https://basic.smartedu.cn/', 'User-Agent': 'Mozilla/5.0'}
OFFSET = 5                      # 图页 = 书页 + 5


def load():
    data = []
    for p in PARTS:
        path = os.path.join('/tmp/pep', 'part_%s.json' % p)
        if not os.path.exists(path):
            req = urllib.request.Request(BASE % p, headers=HDR)
            with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
                f.write(r.read())
        data += json.load(open(path, encoding='utf-8'))
    return data


def find(data, sem):
    cn = {'1a': '一年级上册', '1b': '一年级下册', '2a': '二年级上册', '2b': '二年级下册',
          '3a': '三年级上册', '3b': '三年级下册', '4a': '四年级上册', '4b': '四年级下册',
          '5a': '五年级上册', '5b': '五年级下册', '6a': '六年级上册', '6b': '六年级下册'}[sem]
    grade, vol = cn[:-2], cn[-2:]
    cands = []
    for d in data:
        t = d.get('global_title', {}).get('zh-CN') or ''
        if '语文' not in t or grade not in t or vol not in t:
            continue
        if '五四学制' in t or '五•四' in t or '盲' in t or '特殊' in t:
            continue
        cands.append((('2022' in t), t, d))
    if not cands:
        return None
    cands.sort(key=lambda x: (not x[0], x[1]))
    return cands[0][2]


def main():
    sem = sys.argv[1]
    if len(sys.argv) >= 4:
        lo, hi = int(sys.argv[2]), int(sys.argv[3])
        pages = range(lo + OFFSET, hi + OFFSET + 1)      # 传书页，内部换算成图页
    else:
        pages = range(1, 11)                             # 默认只下目录区
    data = load()
    d = find(data, sem)
    if not d:
        print('%s: 未找到对应教材' % sem); return
    pv = (d.get('custom_properties') or {}).get('preview') or {}
    if not pv:
        print('%s: 无页面预览数据' % sem); return
    num = lambda k: int(''.join(c for c in k if c.isdigit()) or 0)
    first = pv[sorted(pv, key=lambda k: num(k))[0]]
    pre = first[:first.rindex('/') + 1]
    dd = os.path.join(OUT, sem)
    os.makedirs(dd, exist_ok=True)
    got = skip = 0
    for p in pages:
        fp = os.path.join(dd, 'p%03d.jpg' % p)
        if os.path.exists(fp) and os.path.getsize(fp) > 5000:
            skip += 1; continue
        try:
            req = urllib.request.Request(pre + '%d.jpg' % p, headers=HDR)
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
            if len(b) > 5000:
                open(fp, 'wb').write(b); got += 1
            else:
                print('  图页 %d 内容过小，停止' % p); break
        except Exception as e:
            print('  图页 %d 失败: %s' % (p, e)); break
    print('%s: %s  新下 %d 页 / 已有 %d 页 -> %s' % (sem, d['global_title']['zh-CN'][:40], got, skip, dd))


if __name__ == '__main__':
    main()
