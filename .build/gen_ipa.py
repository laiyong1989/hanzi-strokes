# -*- coding: utf-8 -*-
"""给英文单词加国际音标（IPA）：data/dict.js 新增 ipa 字段，如 "spring" -> "[ˈsprɪŋ]"。

音标来源：CMU Pronouncing Dictionary（cmudict，ARPABET 音素）→ 转成 IPA。
统一用**美式**（General American），全文一致，方括号包裹（不写 / /，避免和"音位"混淆）。
用法：python3 gen_ipa.py [--dry]      需要 .build 环境里的 cmudict（已在 python/envs/default 装好）
"""
import json, os, shutil, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_JS = os.path.join(ROOT, 'data/dict.js')

# ARPABET -> IPA（美式）
VOW = {
    'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ',
    'EH': 'ɛ', 'ER': 'ɝ', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ',
    'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
}
CONS = {
    'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'ɡ', 'HH': 'h',
    'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p',
    'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w',
    'Y': 'j', 'Z': 'z', 'ZH': 'ʒ',
}
STRESS = {'1': 'ˈ', '2': 'ˌ'}

# cmudict 里查不到的少数词，手写美式音标兜底
MANUAL = {
    'mugwort': '[ˈmʌɡˌwɜrt]',
    'dragonfly': '[ˈdræɡənˌflaɪ]',
    'exclamatory': '[ɪkˈsklæməˌtɔri]',
}


def is_vowel(ph):
    return re.sub(r'\d', '', ph) in VOW


def to_ipa(phones):
    """ARPABET -> IPA（美式）。
    重音符号要落在**音节开头**（前面那串辅音之前）：CMU 把重音标在元音上，
    直接照搬会得到 [wˈʌn]，正确写法是 [ˈwʌn]。"""
    n = len(phones)
    # 先算出每个音节从哪里开始，重音记在该位置
    stress_at = {}
    start = 0
    for i, ph in enumerate(phones):
        base = re.sub(r'\d', '', ph)
        stress = ph[-1] if ph[-1].isdigit() else ''
        if base in VOW:
            if stress in STRESS:
                stress_at[start] = STRESS[stress]
            start = i + 1
    out = []
    for i, ph in enumerate(phones):
        if i in stress_at:
            out.append(stress_at[i])
        base = re.sub(r'\d', '', ph)
        stress = ph[-1] if ph[-1].isdigit() else ''
        if base in VOW:
            if base == 'AH' and stress in ('', '0'):
                out.append('ə')                    # 非重读的 AH -> 弱读 ə
            elif base == 'ER':
                out.append('ɚ' if stress in ('', '0') else 'ɝ')
            else:
                out.append(VOW[base])
        elif base == 'T':
            # 两个元音之间的 t：美式浊化（flapping），water -> ˈwɔɾɚ
            prev_v = i > 0 and is_vowel(phones[i - 1])
            next_v = i + 1 < n and is_vowel(phones[i + 1])
            out.append('ɾ' if (prev_v and next_v) else 't')
        elif base in CONS:
            out.append(CONS[base])
        else:
            out.append('')
    return '[' + ''.join(out) + ']'


def lookup(d, w):
    """查一个词的音素；复合词（rice-cake / dragonfly）拆开查再拼起来"""
    w = w.lower().strip()
    if not w:
        return None
    if w in d:
        return d[w][0]
    if '-' in w:
        parts = [p for p in re.split(r'[-\s]+', w) if p]
        seq = []
        for k, p in enumerate(parts):
            pp = d.get(p)
            if not pp:
                return None
            ph = list(pp[0])
            if k > 0:                                # 后面的成分降为次重音
                ph = [(x[:-1] + '2') if x.endswith('1') else x for x in ph]
            seq += ph
        return seq
    return None


def main():
    try:
        import cmudict
    except ImportError:
        print('需要 cmudict：pip install cmudict（装在 .workbuddy 的 python 环境里）')
        return
    d = cmudict.dict()

    head_raw = open(DICT_JS, encoding='utf-8').read()
    i = head_raw.index('window.HZ_DICT=')
    head = head_raw[:head_raw.index('{', i)]
    D = json.loads(head_raw[head_raw.index('{', i):].rstrip().rstrip(';'))
    assert head.rstrip().endswith('window.HZ_DICT='), '文件头异常，已放弃'

    n = 0
    miss = []
    samples = []
    for ch, v in D.items():
        w = v.get('en')
        if not w:
            continue
        pron = lookup(d, w)
        if not pron:
            if w.lower() in MANUAL:
                v['ipa'] = MANUAL[w.lower()]
                n += 1
            else:
                miss.append(w)
            continue
        ipa = to_ipa(pron)          # lookup 返回的已经是「第一条发音的音素列表」
        if v.get('ipa') != ipa:
            v['ipa'] = ipa
            n += 1
        if len(samples) < 12:
            samples.append('%s %s %s' % (ch, w, ipa))
    print('加音标 %d 个；没查到音标的词 %d 个：%s' % (n, len(miss), miss[:20]))
    print('示例：' + ' | '.join(samples))

    if '--dry' in sys.argv:
        return
    shutil.copyfile(DICT_JS, os.path.join(ROOT, '.build/dict.js.bak4'))
    open(DICT_JS, 'w', encoding='utf-8').write(
        head + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('已写入 data/dict.js（备份 .build/dict.js.bak4）')


if __name__ == '__main__':
    main()
