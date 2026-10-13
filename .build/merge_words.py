# -*- coding: utf-8 -*-
"""把教材原文提取到的组词并入 data/dict.js（增量：只补空、只追加，不删改既有词）。
并入后每字最多保留 3 个词（优先原有的、再补教材的）。
"""
import json


def read_js(path):
    raw = open(path, encoding='utf-8').read()
    s = raw.index('{')
    return raw[:s], raw[s:raw.rindex('}') + 1], raw[raw.rindex('}') + 1:]


def main():
    head, body, tail = read_js('data/dict.js')
    dct = json.loads(body)
    words = json.load(open('.build/words_raw.json', encoding='utf-8'))
    sem_of = {}
    _, cbody, _ = read_js('data/curriculum.js')
    cur = json.loads(cbody)
    for sem in cur:
        for u in cur[sem]['units']:
            for l in u['lessons']:
                for c in l['chars']:
                    sem_of.setdefault(c, sem)

    added = 0
    for sem, tab in words.items():
        for ch, ws in tab.items():
            d = dct.get(ch)
            if not d:
                continue
            cur_w = list(d.get('w') or [])
            for x in ws:
                if len(cur_w) >= 3:
                    break
                if x not in cur_w:
                    cur_w.append(x)
                    added += 1
            d['w'] = cur_w
    open('data/dict.js', 'w', encoding='utf-8').write(
        head + json.dumps(dct, ensure_ascii=False, separators=(',', ':')) + tail)
    print('并入教材组词 %d 条' % added)

    # 覆盖率报告
    for sem in cur:
        need = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                need += l['chars']
        need = sorted(set(need))
        n2 = [c for c in need if len(dct.get(c, {}).get('w') or []) >= 2]
        n0 = [c for c in need if not (dct.get(c, {}).get('w') or [])]
        print('  %s %s：%d 字，≥2词 %d，无词 %d' % (sem, cur[sem]['name'], len(need), len(n2), len(n0)))
    total = len(dct)
    w0 = [c for c in dct if not (dct[c].get('w') or [])]
    w2 = [c for c in dct if len(dct[c].get('w') or []) >= 2]
    print('  字典共 %d 字：≥2词 %d（%.0f%%），无词 %d' % (total, w2, 100.0 * w2 / total, len(w0)))


if __name__ == '__main__':
    main()
