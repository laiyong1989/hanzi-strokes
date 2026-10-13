# -*- coding: utf-8 -*-
"""从教材原始页面提取「生字 -> 组词」，输出 .build/words_raw.json
两种括号写法都支持：
  A. 诗（古诗）（诗人）村（乡村）（村子）   —— 每词独立括号，最可靠
  B. 洪（洪水洪亮）                        —— 词连写，仅当 A 无结果时兜底（不拆分，整段丢弃）
同时统计各册覆盖率。只读解析，不改任何数据文件。
"""
import re, html, json, collections

FILES = {
    '1a': '.build/raw/y1a.html',
    '1b': '.build/raw/y1b.html',
    '2a': '.build/raw/y5611942714.html',
    '2b': '.build/raw/y5c18634966.html',
}

PAT_A = re.compile(r'([\u4e00-\u9fa5])((?:（[^）]{1,10}）){2,6})')
PAT_B = re.compile(r'([\u4e00-\u9fa5])（([^）]{2,12})）')


def text_of(path):
    s = open(path, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    return html.unescape(t)


def pick(words, ch):
    """过滤掉不含本字的词、过长过短的词，最多保留 4 个。"""
    out = []
    for wd in words:
        wd = wd.strip()
        if ch not in wd:
            continue
        if not (2 <= len(wd) <= 4):
            continue
        if wd in out:
            continue
        out.append(wd)
        if len(out) >= 4:
            break
    return out


def main():
    res = {}
    for sem, path in FILES.items():
        t = text_of(path)
        acc = collections.defaultdict(list)
        for m in PAT_A.finditer(t):
            ch, blob = m.group(1), m.group(2)
            ws = re.findall(r'（([^）]{1,10})）', blob)
            for wd in ws:
                if wd not in acc[ch]:
                    acc[ch].append(wd)
        # 兜底：模式 B 只在完全没有 A 结果时使用
        for m in PAT_B.finditer(t):
            ch = m.group(1)
            if acc[ch]:
                continue
            blob = m.group(2)
            # 连写的两字词：按 2 字切分（教材多为「洪水洪亮」式两词并列）
            if len(blob) % 2 == 0 and len(blob) >= 4:
                for i in range(0, len(blob), 2):
                    wd = blob[i:i + 2]
                    if wd not in acc[ch]:
                        acc[ch].append(wd)
        res[sem] = {ch: pick(ws, ch) for ch, ws in acc.items() if pick(ws, ch)}
        print('%s 提取到 %d 个字的组词' % (sem, len(res[sem])))
    json.dump(res, open('.build/words_raw.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)

    # 覆盖率
    raw = open('data/curriculum.js', encoding='utf-8').read()
    cur = json.loads(raw[raw.index('{'): raw.rindex('}') + 1])
    for sem in cur:
        need = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                need += l['chars']
        ws = res.get(sem, {})
        hit = [c for c in set(need) if ws.get(c)]
        print('  %s %s：需 %d 字，有组词 %d 字（%.0f%%）'
              % (sem, cur[sem]['name'], len(set(need)), len(hit),
                 100.0 * len(hit) / max(1, len(set(need)))))


if __name__ == '__main__':
    main()
