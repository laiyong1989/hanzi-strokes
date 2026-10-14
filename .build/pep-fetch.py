#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pep-fetch.py — 从国家中小学智慧教育平台抓取语文教材官方页面图
用法: python3 pep-fetch.py 1a [1a 2a ...]      # 下载各册全部页到 .build/pep/<sem>/
"""
import json, os, re, sys, urllib.request

BASE = 'https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_%s.json'
PARTS = ['100', '101', '102', '103']
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pep')
HDR = {'Referer': 'https://basic.smartedu.cn/', 'User-Agent': 'Mozilla/5.0'}


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
        # 优先 2022 课标修订版
        cands.append((('2022' in t), t, d))
    if not cands:
        return None
    cands.sort(key=lambda x: (not x[0], x[1]))
    return cands[0][2]


def main():
    data = load()
    for sem in sys.argv[1:]:
        d = find(data, sem)
        if not d:
            print('%s: 未找到对应教材' % sem); continue
        pv = (d.get('custom_properties') or {}).get('preview') or {}
        if not pv:
            print('%s: 无页面预览数据' % sem); continue
        num = lambda k: int(''.join(c for c in k if c.isdigit()) or 0)
        pages = sorted(pv.items(), key=lambda kv: num(kv[0]))
        dd = os.path.join(OUT, sem)
        os.makedirs(dd, exist_ok=True)
        ok = 0
        for k, url in pages:
            fp = os.path.join(dd, 'p%02d.jpg' % num(k))
            if os.path.exists(fp) and os.path.getsize(fp) > 5000:
                ok += 1; continue
            try:
                req = urllib.request.Request(url, headers=HDR)
                with urllib.request.urlopen(req, timeout=60) as r:
                    b = r.read()
                if len(b) > 5000:
                    open(fp, 'wb').write(b); ok += 1
            except Exception as e:
                print('  %s 失败: %s' % (k, e))
        print('%s: %s  共 %d 页，已就绪 %d 页 -> %s' % (
            sem, d['global_title']['zh-CN'][:40], len(pages), ok, dd))


if __name__ == '__main__':
    main()