# -*- coding: utf-8 -*-
"""从教材原始页面提取「拼音 + 生字 + 组词」，用于纠正多音字读音。
只读 .build/raw/*.html，输出 .build/pinyin_raw.json（不改动任何现有文件）。
页面里的写法形如：<p>kàn看（看见）（看到）</p> —— 拼音紧跟在字前面，后面是本课的组词。"""
import re, json, os, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '.build/raw')
FILES = ['y1a.html', 'y1b.html', 'y5611942714.html', 'y5c18634966.html']

PY = r'[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿěǹ]+'
# 拼音 + 一个汉字 + 若干（组词）
PAT = re.compile(r'(' + PY + r')([\u4e00-\u9fff])((?:（[^）]*）)+)')


def main():
    found = collections.defaultdict(list)      # 字 -> [(拼音, [词...])]
    total = 0
    for fn in FILES:
        p = os.path.join(RAW, fn)
        if not os.path.exists(p):
            print('缺文件', fn)
            continue
        t = open(p, encoding='utf-8', errors='ignore').read()
        n = 0
        for m in PAT.finditer(t):
            py, ch, ws = m.group(1), m.group(2), m.group(3)
            words = re.findall(r'（([^）]*)）', ws)
            words = [w for w in words if 1 <= len(w) <= 4]
            if not words:
                continue
            found[ch].append((py, words))
            n += 1
        total += n
        print('%s：提取 %d 条' % (fn, n))

    print('合计 %d 条，涉及 %d 个字' % (total, len(found)))

    # 与现有字典比对：找出读音不一致的（多音字 / 源数据给错主音的）
    raw = open(os.path.join(ROOT, 'data/dict.js'), encoding='utf-8').read()
    i = raw.index('window.HZ_DICT=')
    D = json.loads(raw[raw.index('{', i):].rstrip().rstrip(';'))

    diff = {}
    for ch, items in found.items():
        pys = [p for p, _ in items]
        uniq = sorted(set(pys))
        cur = (D.get(ch) or {}).get('p') or []
        if len(uniq) > 1:
            diff[ch] = {'教材读音': uniq, '字典现有': cur, '词': items}
        elif uniq and cur and uniq[0] != cur[0]:
            diff[ch] = {'教材读音': uniq, '字典现有': cur, '词': items}

    print('\n需要纠正的字：%d' % len(diff))
    for ch in list(diff)[:40]:
        v = diff[ch]
        words = []
        for py, ws in v['词']:
            words.append(py + ':' + '/'.join(ws))
        print('  %s  教材=%s  字典=%s   %s' % (ch, v['教材读音'], v['字典现有'], ' | '.join(words)[:90]))

    out = {ch: [{'py': p, 'w': ws} for p, ws in items] for ch, items in found.items()}
    json.dump(out, open(os.path.join(ROOT, '.build/pinyin_raw.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('\n已写出 .build/pinyin_raw.json（%d 字）' % len(out))
    miss = [c for c in D if c not in found]
    print('课内字典里没有教材注音的字：%d' % len(miss))


if __name__ == '__main__':
    main()
