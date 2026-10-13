# -*- coding: utf-8 -*-
"""从原始教材页面提取「课名 -> 写字表生字」，与 data/curriculum.js 对比找差异。
只做只读解析，输出报告，不改动任何数据文件。"""
import re, html, json, io, sys

FILES = {
    '1a': '.build/raw/y1a.html',
    '1b': '.build/raw/y1b.html',
    '2a': '.build/raw/y5611942714.html',
    '2b': '.build/raw/y5c18634966.html',
}

CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'


def text_of(path):
    s = open(path, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '\n', t)
    t = html.unescape(t)
    return '\n'.join(l.strip() for l in t.split('\n') if l.strip())


def extract(path):
    """返回 [(课名, [生字...]), ...]，按文中出现顺序。
    关键：生字只在「本课名 -> 下一课名」之间取，避免跨课污染。"""
    t = text_of(path)
    anchors = []
    # 1) 书名号课名： 《找春天》
    for m in re.finditer(r'《([^》]{1,20})》', t):
        anchors.append((m.start(), m.end(), m.group(1)))
    # 2) 圈码/编号课名：⑮大禹治水 / ○21狐假虎威
    pat = r'(?:[' + CIRCLED + r']|○\s?\d+)\s*([^\s（(0-9]{2,12})'
    for m in re.finditer(pat, t):
        name = m.group(1).strip()
        if not re.match(r'^[一-龥]', name):
            continue
        anchors.append((m.start(), m.end(), name))
    anchors.sort(key=lambda x: x[0])
    # 去掉重复（同一课在文档里出现两次）
    uniq, last_end = [], -1
    for st, en, name in anchors:
        if st < last_end - 5:
            continue
        uniq.append((st, en, name))
        last_end = en
    res = []
    for i, (st, en, name) in enumerate(uniq):
        seg_end = uniq[i + 1][0] if i + 1 < len(uniq) else len(t)
        seg = t[en:seg_end]
        chars = re.findall(r'([\u4e00-\u9fa5])[（(]', seg)
        if len(chars) >= 3:
            res.append((name, chars[:12]))
    return res


def main():
    cur = {}
    js = open('data/curriculum.js', encoding='utf-8').read()
    body = js[js.index('{'): js.rindex('}') + 1]
    cur = json.loads(body)

    for sem in ['1a', '1b', '2a', '2b']:
        lessons = extract(FILES[sem])
        print('=' * 60)
        print(sem, cur[sem]['name'], ' 原文解析出', len(lessons), '课')
        have = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                have.append((l['name'], l['chars']))
        have_names = [re.sub(r'^.*?《([^》]*)》.*$', r'\1', n) for n, _ in have]
        src_names = [n for n, _ in lessons]
        missing = [n for n in src_names if n not in have_names]
        print(' 现有课程:', ' / '.join(have_names))
        print(' 原文课名:', ' / '.join(src_names))
        if missing:
            print(' >> 疑似缺失:', ' / '.join(missing))
        # 同名课的生字比对
        for name, chars in lessons:
            for i, hn in enumerate(have_names):
                if hn == name:
                    if have[i][1] != chars:
                        print(' >> 生字不符 [%s]\n    现有: %s\n    原文: %s'
                              % (name, ''.join(have[i][1]), ''.join(chars)))
                    break


if __name__ == '__main__':
    main()
