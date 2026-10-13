# -*- coding: utf-8 -*-
"""把 .build/mean/<册>.txt 里的「字:词=释义|词=释义」并入 data/dict.js
增量规则：
  - w（组词）只做补充：原有词保留，本文件里的词补到前面缺的位置
  - wm（词 -> 释义）新增字段，只写不删
"""
import json, os, glob


def read_js(path):
    raw = open(path, encoding='utf-8').read()
    s = raw.index('{')
    return raw[:s], raw[s:raw.rindex('}') + 1], raw[raw.rindex('}') + 1:]


def main():
    head, body, tail = read_js('data/dict.js')
    dct = json.loads(body)
    nchar = nword = 0
    for f in sorted(glob.glob('.build/mean/*.txt')):
        sem = os.path.basename(f)[:-4]
        c1 = w1 = 0
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line or ':' not in line:
                continue
            ch, rest = line.split(':', 1)
            pairs = []
            for seg in rest.split('|'):
                if '=' not in seg:
                    continue
                wd, mn = seg.split('=', 1)
                wd = wd.strip(); mn = mn.strip()
                if wd and mn:
                    pairs.append((wd, mn))
            if not pairs:
                continue
            d = dct.setdefault(ch, {'p': [], 'r': '', 's': 0, 'w': [], 'e': ''})
            cur = list(d.get('w') or [])
            for wd, _ in pairs:
                if wd not in cur:
                    cur.append(wd)
            d['w'] = cur[:3]
            wm = d.get('wm') or {}
            for wd, mn in pairs:
                if wd not in wm:
                    wm[wd] = mn
            d['wm'] = wm
            c1 += 1; w1 += len(pairs)
        nchar += c1; nword += w1
        print('  %s：%d 字 / %d 条释义' % (sem, c1, w1))
    open('data/dict.js', 'w', encoding='utf-8').write(
        head + json.dumps(dct, ensure_ascii=False, separators=(',', ':')) + tail)
    print('合计 %d 字 / %d 条释义' % (nchar, nword))
    have_m = [c for c in dct if (dct[c].get('wm') or {})]
    print('字典共 %d 字，已有释义 %d 字（%.0f%%）'
          % (len(dct), len(have_m), 100.0 * len(have_m) / len(dct)))


if __name__ == '__main__':
    main()
