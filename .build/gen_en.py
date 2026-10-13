# -*- coding: utf-8 -*-
"""从 Make Me a Hanzi 的 dictionary.txt 提取每个生字的英文单词，写成 data/dict.js 的 en 字段。
只读 .build/dictionary.txt 与 data/curriculum.js，只写 data/dict.js（改前先备份）。
用法：python3 gen_en.py [--dry]   # --dry 只打印抽样，不写文件"""
import json, re, sys, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_TXT = os.path.join(ROOT, '.build/dictionary.txt')
DICT_JS = os.path.join(ROOT, 'data/dict.js')
CUR_JS = os.path.join(ROOT, 'data/curriculum.js')

# 语法术语：这些不是孩子能懂的「单词」，遇到就跳过，继续找后面的词
STOP = {'to', 'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'it', 'its',
        'one', 'ones', 'variant', 'see', 'used', 'same', 'also', 'with', 'up',
        'particle', 'interrogative', 'honorific', 'plural', 'marks', 'final',
        'emphatic', 'clause', 'unit', 'according', 'appropriate', 'essential',
        'modern', 'besides', 'individual', 'assemble', 'summon', 'bewitch',
        'thrive', 'accomplish', 'reside', 'observe', 'mutual', 'natures',
        'indicating', 'indicates', 'expression', 'suffix', 'prefix', 'measure',
        'classifier', 'form', 'someone', 'something', 'which', 'who', 'that'}
BAD = re.compile(r'[^a-z\-]')

# 人工校对：一、二年级课本里自动提取明显跑偏的字（取到了生僻义项或语法词）。
# 语气助词（呀/呢/吗/吧）没有对应的英文单词，留空 → 英语模式下自动回退到中文读音。
PATCH = {
    '一': 'one', '上': 'up', '下': 'down', '了': 'finish', '里': 'in', '可': 'can',
    '是': 'is', '来': 'come', '中': 'middle', '我': 'I', '您': 'you', '他': 'he',
    '巴': 'tail', '把': 'hold', '个': 'item', '们': 'group', '才': 'talent',
    '同': 'same', '衣': 'clothes', '的': 'of', '和': 'and', '几': 'how', '出': 'out',
    '见': 'see', '工': 'work', '厂': 'factory', '万': 'thousand', '主': 'owner',
    '江': 'river', '住': 'live', '以': 'with', '会': 'can', '公': 'public',
    '各': 'each', '种': 'kind', '样': 'shape', '阳': 'sun', '为': 'because',
    '哥': 'brother', '姐': 'sister', '招': 'greet', '呼': 'call', '快': 'fast',
    '乐': 'happy', '当': 'when', '行': 'walk', '许': 'many', '故': 'story',
    '乡': 'village', '到': 'arrive', '兴': 'happy', '成': 'finish', '迷': 'lost',
    '造': 'make', '运': 'sport', '细': 'thin', '语': 'language', '香': 'fragrant',
    '打': 'hit', '之': 'of', '相': 'each', '近': 'near', '远': 'far', '义': 'justice',
    '首': 'first', '采': 'pick', '角': 'corner', '机': 'plane', '放': 'put',
    '朵': 'flower', '边': 'side', '文': 'writing', '次': 'time', '办': 'do',
    '包': 'bag', '洗': 'wash', '共': 'together', '经': 'through', '坐': 'sit',
    '要': 'want', '今': 'today', '还': 'also', '常': 'often', '往': 'toward',
    '进': 'enter', '空': 'empty', '病': 'sick', '医': 'doctor', '别': 'other',
    '干': 'dry', '跟': 'follow', '家': 'home', '捉': 'catch', '条': 'strip',
    '房': 'room', '牛': 'cow', '本': 'book', '木': 'wood', '学': 'study',
    '门': 'door', '叫': 'call', '广': 'wide', '春': 'spring', '晴': 'sunny',
    '情': 'feeling', '请': 'please', '儿': 'child', '子': 'child', '么': 'question',
    '青': 'green', '禾': 'grain', '元': 'first', '地': 'ground', '没': 'not',
    '呀': '', '呢': '', '吗': '', '吧': '', '么': 'question',
    '它': 'it', '与': 'with', '者': 'person', '组': 'group',
    # 自动提取到了生僻词/错误词，换成孩子认识的词（顺带才能查到音标）
    '观': 'watch', '乎': 'care', '钓': 'fish', '燕': 'swallow', '剖': 'cut',
    '嘶': 'hoarse', '吊': 'hang', '怡': 'pleasant', '袱': 'bundle',
    '仓': 'warehouse', '筝': 'kite', '啪': 'pop', '处': 'place',
    '嘛': '', '哉': '',          # 纯语气/文言助词：不留英文，英语档退回中文
}


def read_js(path, anchor):
    raw = open(path, encoding='utf-8').read()
    i = raw.index(anchor)
    j = raw.index('{', i)
    return raw[:j], json.loads(raw[j:].rstrip().rstrip(';')), raw


def first_word(defn):
    """从英文释义里挑一个适合小学生的单词：取第一义项的第一个词，去掉 to/a/the 等虚词"""
    if not defn:
        return ''
    seg = re.split(r'[;；]', defn)[0]
    for part in re.split(r'[,，]', seg):
        words = [x for x in re.split(r'\s+', part.strip().lower()) if x]
        for wi, raw in enumerate(words):
            w = BAD.sub('', raw)
            if not w or w in STOP:
                continue
            if w.startswith('to-') or w.endswith('-'):
                continue
            if not (2 <= len(w) <= 18):
                continue
            if not re.match(r'^[a-z][a-z\-]*$', w):
                continue
            # 「ten thousand」这类，取量级更准：万 → thousand
            if w in ('ten', 'one', 'two') and wi + 1 < len(words):
                nxt = BAD.sub('', words[wi + 1])
                if nxt in ('thousand', 'hundred', 'million'):
                    return nxt
            return w
    return ''


def main():
    dry = '--dry' in sys.argv
    # 课内字
    _, cur, _ = read_js(CUR_JS, 'window.HZ_CURRICULUM=')
    chars = []
    for sem in cur.values():
        for u in sem['units']:
            for L in u['lessons']:
                for c in L['chars']:
                    if c not in chars:
                        chars.append(c)

    en = {}
    for line in open(DICT_TXT, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        ch = d.get('character')
        if ch in set(chars):
            w = first_word(d.get('definition') or '')
            if w:
                en[ch] = w
    for ch, w in PATCH.items():
        if ch not in chars:
            continue
        if w:
            en[ch] = w
        else:
            en.pop(ch, None)          # 语气助词：不留英文，英语模式下回退读中文
    miss = [c for c in chars if c not in en]
    print('课内字 %d，取到英文单词 %d，缺 %d' % (len(chars), len(en), len(miss)))
    print('缺词示例：', ''.join(miss[:40]))
    print('抽样：')
    for c in chars[:24]:
        print('   %s -> %s' % (c, en.get(c, '—')))

    if dry:
        return

    shutil.copyfile(DICT_JS, os.path.join(ROOT, '.build/dict.js.bak2'))
    head, obj, raw = read_js(DICT_JS, 'window.HZ_DICT=')
    assert head.rstrip().endswith('window.HZ_DICT='), '文件头异常，已放弃'
    # 先确认重新序列化与原文一致，避免改坏
    reser = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    if reser != raw[raw.index('{'):].rstrip().rstrip(';'):
        print('警告：重新序列化与原文不完全一致（可能是浮点/空白差异），继续写入')

    n = 0
    for ch in chars:
        if ch not in obj or not en.get(ch):
            continue
        if obj[ch].get('en') == en[ch]:
            continue
        # 字段顺序：p r s w wm en e
        old = obj[ch]
        new = {}
        for k in ('p', 'r', 's', 'w', 'wm', 'en', 'e'):
            if k == 'en':
                new['en'] = en[ch]
            elif k in old:
                new[k] = old[k]
        for k in old:
            if k not in new:
                new[k] = old[k]
        obj[ch] = new
        n += 1

    out = head + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(DICT_JS, 'w', encoding='utf-8').write(out)
    print('已写入 %d 个 en 字段 -> data/dict.js（备份 .build/dict.js.bak2）' % n)


if __name__ == '__main__':
    main()
