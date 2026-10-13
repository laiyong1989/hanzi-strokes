# -*- coding: utf-8 -*-
"""补齐因新增课文而缺失的数据（增量，只加不改既有条目）：
1) data/strokes/2a.js 补 32 个字的笔画轮廓与中线（源：.build/hwd/package/*.json）
2) data/dict.js      补 30 个字的拼音 / 部首 / 笔画数 / 组词（源：dictionary.txt + 教材组词）
"""
import json, os, re

HWD = '.build/hwd/package'
DICTSRC = '.build/dictionary.txt'


def read_js(path, anchor=None):
    """返回 (头部含变量名, JSON体, 尾部)。
    anchor 用于 strokes 文件：变量名后面还跟着 `||{}` 这种含花括号的内容，
    必须跳过它，否则会截到错误的起始花括号。"""
    raw = open(path, encoding='utf-8').read()
    i = raw.index(anchor) + len(anchor) if anchor else 0
    s = raw.index('{', i)
    return raw[:s], raw[s:raw.rindex('}') + 1], raw[raw.rindex('}') + 1:]


def main():
    # ---------- 找出缺失 ----------
    _, cbody, _ = read_js('data/curriculum.js')
    cur = json.loads(cbody)
    missing_stroke = {}          # sem -> [字]
    for sem in cur:
        _, sbody, _ = read_js('data/strokes/%s.js' % sem, 'window.HZ_STROKES["%s"]=' % sem)
        sk = json.loads(sbody)
        ms = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                for c in l['chars']:
                    if c not in sk:
                        ms.append(c)
        if ms:
            missing_stroke[sem] = sorted(set(ms))
    _, dbody, _ = read_js('data/dict.js')
    dct = json.loads(dbody)
    need_dict = []
    for sem in cur:
        for u in cur[sem]['units']:
            for l in u['lessons']:
                for c in l['chairs' if False else 'chars']:
                    if c not in dct:
                        need_dict.append(c)
    need_dict = sorted(set(need_dict))
    print('需补字帖:', {k: len(v) for k, v in missing_stroke.items()})
    print('需补字典:', len(need_dict), ''.join(need_dict))

    # ---------- 1) 补字帖 ----------
    for sem, chars in missing_stroke.items():
        head, body, tail = read_js('data/strokes/%s.js' % sem, 'window.HZ_STROKES["%s"]=' % sem)
        obj = json.loads(body)
        for c in chars:
            src = os.path.join(HWD, c + '.json')
            if not os.path.exists(src):
                print('  !! 字库无此字:', c)
                continue
            d = json.load(open(src, encoding='utf-8'))
            obj[c] = {'s': d['strokes'], 'm': d['medians']}
        out = head + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + tail
        open('data/strokes/%s.js' % sem, 'w', encoding='utf-8').write(out)
        print('  已补 %s: %d 字 -> %s' % (sem, len(chars), ''.join(chars)))

    # ---------- 2) 补字典 ----------
    words = json.load(open('.build/words_raw.json', encoding='utf-8'))
    info = {}
    for line in open(DICTSRC, encoding='utf-8'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        info[o['character']] = o
    head, body, tail = read_js('data/dict.js')
    dct = json.loads(body)
    added = []
    for c in need_dict:
        d = info.get(c)
        if not d:
            print('  !! 词典无此字:', c)
            continue
        pinyin = [p for p in d.get('pinyin', []) if p]
        # 该字所属册（取第一个出现的册），用于取教材组词
        sem_of = None
        for sem in cur:
            for u in cur[sem]['units']:
                for l in u['lessons']:
                    if c in l['chars']:
                        sem_of = sem
                        break
                if sem_of:
                    break
            if sem_of:
                break
        ws = (words.get(sem_of, {}).get(c) or [])[:3]
        nstroke = None
        for sem in cur:
            _, sb, _ = read_js('data/strokes/%s.js' % sem, 'window.HZ_STROKES["%s"]=' % sem)
            sk = json.loads(sb)
            if c in sk:
                nstroke = len(sk[c]['s'])
                break
        dct[c] = {
            'p': pinyin,
            'r': d.get('radical', ''),
            's': nstroke or 0,
            'w': ws,
            'e': ''
        }
        added.append(c)
    out = head + json.dumps(dct, ensure_ascii=False, separators=(',', ':')) + tail
    open('data/dict.js', 'w', encoding='utf-8').write(out)
    print('  已补字典 %d 字：%s' % (len(added), ''.join(added)))


if __name__ == '__main__':
    main()
