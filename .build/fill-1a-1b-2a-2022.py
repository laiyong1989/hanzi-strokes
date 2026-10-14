# -*- coding: utf-8 -*-
"""补齐 2022 版课表新增生字的字帖与字典（只加不改既有条目）：
1) data/strokes/{1a,1b,2a}.js 补缺字的笔画轮廓与中线（源：.build/hwd/package/*.json，即 Make Me a Hanzi）
2) data/dict.js 补 6 个全新字（丁/卡/旦/沙/总/做）的拼音/部首/笔画/组词/释义/英文/音标
   - 拼音、部首：.build/dictionary.txt
   - 笔画数：字帖笔画条数
   - 组词：.build/words_raw.json（教材组词）+ 手工补充
   - 释义、英文：人工校订（语气助词无英文，英语档自动退回中文读音）
   - 音标：CMU  Pronouncing Dictionary -> 美式 IPA（与 gen_ipa.py 同一套转换表）
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HWD = os.path.join(HERE, 'hwd', 'package')
DICTSRC = os.path.join(HERE, 'dictionary.txt')
sys.path.insert(0, HERE)
from gen_ipa import to_ipa, lookup          # 复用音标转换，避免两套表漂移

P_CUR = os.path.join(ROOT, 'data', 'curriculum.js')
P_DICT = os.path.join(ROOT, 'data', 'dict.js')


def read_js(path, anchor=None):
    raw = open(path, encoding='utf-8').read()
    i = raw.index(anchor) + len(anchor) if anchor else 0
    s = raw.index('{', i)
    return raw[:s], raw[s:raw.rindex('}') + 1], raw[raw.rindex('}') + 1:]


def load_cur():
    _, body, _ = read_js(P_CUR)
    return json.loads(body)


# 人工校订：组词（w）、释义（wm）、英文（en）。拼音/部首取 dictionary.txt。
CURATED = {
    '丁': {'w': ['园丁', '补丁', '丁香'], 'wm': {'园丁': '照顾花草树木的人', '补丁': '缝在衣服破口上的小布块'}, 'en': 'nail'},
    '卡': {'w': ['卡片', '卡车', '卡通'], 'wm': {'卡片': '上面写字或画图的硬纸片', '卡车': '拉东西的大汽车'}, 'en': 'card'},
    '旦': {'w': ['元旦', '一旦'], 'wm': {'元旦': '一月一日，新年的第一天', '一旦': '要是有一天'}, 'en': 'dawn'},
    '沙': {'w': ['沙滩', '风沙', '沙子'], 'wm': {'沙滩': '海边一片沙沙的地', '风沙': '大风卷起的沙子'}, 'en': 'sand'},
    '总': {'w': ['总是', '总共', '总结'], 'wm': {'总是': '一直是这样', '总共': '合起来一共多少'}, 'en': 'gather'},
    '做': {'w': ['做事', '做工', '做人'], 'wm': {'做事': '干事情', '做工': '干活儿，也指做活的本领'}, 'en': 'work'},
}


def main():
    cur = load_cur()
    info = {}
    for line in open(DICTSRC, encoding='utf-8'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        info[o['character']] = o
    words = json.load(open(os.path.join(HERE, 'words_raw.json'), encoding='utf-8'))

    # ---------- 1) 字帖 ----------
    for sem in ('1a', '1b', '2a'):
        need = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                need += l['chars']
        head, body, tail = read_js(os.path.join(ROOT, 'data', 'strokes', '%s.js' % sem),
                                   'window.HZ_STROKES["%s"]=' % sem)
        sk = json.loads(body)
        miss = [c for c in sorted(set(need)) if c not in sk]
        no_src = []
        for c in miss:
            src = os.path.join(HWD, c + '.json')
            if not os.path.exists(src):
                no_src.append(c)
                continue
            d = json.load(open(src, encoding='utf-8'))
            sk[c] = {'s': d['strokes'], 'm': d['medians']}
        open(os.path.join(ROOT, 'data', 'strokes', '%s.js' % sem), 'w', encoding='utf-8').write(
            head + json.dumps(sk, ensure_ascii=False, separators=(',', ':')) + tail)
        print('strokes %s: 补 %d 字（字库缺 %d：%s），现有 %d 字'
              % (sem, len(miss) - len(no_src), len(no_src), ''.join(no_src), len(sk)))

    # ---------- 2) 字典 ----------
    need_dict = []
    for sem in ('1a', '1b', '2a'):
        for u in cur[sem]['units']:
            for l in u['lessons']:
                for c in l['chars']:
                    if c not in need_dict:
                        need_dict.append(c)
    head, body, tail = read_js(P_DICT)
    dct = json.loads(body)
    added = []
    for c in need_dict:
        if c in dct:
            continue
        if c not in CURATED:
            print('!! 无人工校订数据，跳过：', c)
            continue
        o = info.get(c)
        assert o, 'dictionary.txt 缺此字：' + c
        # 笔画数：该字在任何一册字帖里的笔画条数
        ns = 0
        for sem in ('1a', '1b', '2a'):
            _, sb, _ = read_js(os.path.join(ROOT, 'data', 'strokes', '%s.js' % sem),
                               'window.HZ_STROKES["%s"]=' % sem)
            if c in json.loads(sb):
                ns = len(json.loads(sb)[c]['s'])
                break
        cu = CURATED[c]
        entry = {
            'p': [p for p in o.get('pinyin', []) if p],
            'r': o.get('radical', ''),
            's': ns,
            'w': cu['w'],
            'wm': cu['wm'],
            'en': cu['en'],
            'e': '',
        }
        dct[c] = entry
        added.append(c)
    # 音标（用 cmudict，跑在本仓库的 python 环境里）
    try:
        import cmudict
        cmu = cmudict.dict()
        for c in added:
            w = dct[c].get('en')
            if not w:
                continue
            pron = lookup(cmu, w)
            if pron:
                dct[c]['ipa'] = to_ipa(pron)
            else:
                print('!! 音标没查到：', c, w)
    except ImportError:
        print('!! 环境缺 cmudict，音标未写（可稍后跑 .build/gen_ipa.py 补）')
    import shutil, time
    bak = P_DICT + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
    shutil.copyfile(P_DICT, bak)
    open(P_DICT, 'w', encoding='utf-8').write(
        head + json.dumps(dct, ensure_ascii=False, separators=(',', ':')) + tail)
    print('dict: 补 %d 字：%s（原文件备份 %s）' % (len(added), ''.join(added), bak))
    for c in added:
        print('   ', c, json.dumps(dct[c], ensure_ascii=False))


if __name__ == '__main__':
    main()
