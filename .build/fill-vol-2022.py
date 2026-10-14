# -*- coding: utf-8 -*-
"""fill-vol-2022.py — 给升级后的册次补生字数据（只加不改既有条目）

1) data/strokes/<sem>.js 补缺字的笔画轮廓与中线（源：.build/hwd/package/*.json，即 Make Me a Hanzi）
2) data/dict.js 补缺字条目；拼音/部首取 .build/dictionary.txt，笔画数取字帖，
   组词/释义/英文用下面 CURATED 的人工校订表（语气助词不留英文，英语档自动退回中文读音）
   音标：CMU Pronouncing Dictionary -> 美式 IPA（与 gen_ipa.py 同一套转换表）

用法: python3 fill-vol-2022.py 2b [3a ...]        # 用仓库自带 python 环境跑（有 cmudict）
"""
import json, os, shutil, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HWD = os.path.join(HERE, 'hwd', 'package')
DICTSRC = os.path.join(HERE, 'dictionary.txt')
sys.path.insert(0, HERE)
from gen_ipa import to_ipa, lookup          # 复用音标转换，避免两套表漂移

P_CUR = os.path.join(ROOT, 'data', 'curriculum.js')

# 人工校订：组词 w、释义 wm、英文 en。拼音/部首取 dictionary.txt，笔画数字帖。
CURATED = {
    '丁': {'w': ['园丁', '补丁', '丁香'], 'wm': {'园丁': '照顾花草树木的人', '补丁': '缝在衣服破口上的小布块'}, 'en': 'nail'},
    '卡': {'w': ['卡片', '卡车', '卡通'], 'wm': {'卡片': '上面写字或画图的硬纸片', '卡车': '拉东西的大汽车'}, 'en': 'card'},
    '旦': {'w': ['元旦', '一旦'], 'wm': {'元旦': '一月一日，新年的第一天', '一旦': '要是有一天'}, 'en': 'dawn'},
    '沙': {'w': ['沙滩', '风沙', '沙子'], 'wm': {'沙滩': '海边一片沙沙的地', '风沙': '大风卷起的沙子'}, 'en': 'sand'},
    '总': {'w': ['总是', '总共', '总结'], 'wm': {'总是': '一直是这样', '总共': '合起来一共多少'}, 'en': 'gather'},
    '做': {'w': ['做事', '做工', '做人'], 'wm': {'做事': '干事情', '做工': '干活儿，也指做活的本领'}, 'en': 'work'},
    '通': {'w': ['通过', '交通', '通知'], 'wm': {'通过': '从这一头到那一头', '交通': '路上来来往往的车马行人'}, 'en': 'through'},
    '汁': {'w': ['果汁', '汁水', '豆汁'], 'wm': {'果汁': '水果榨出来的水', '汁水': '汤汁、水分'}, 'en': 'juice'},
    '传': {'w': ['传统', '传说', '流传'], 'wm': {'传统': '一代一代传下来的习惯', '传说': '人口里流传的故事'}, 'en': 'pass'},
    '厦': {'w': ['大厦', '商厦'], 'wm': {'大厦': '高高的大楼房', '商厦': '卖东西的大商场'}, 'en': 'building'},
    '桶': {'w': ['水桶', '木桶', '油桶'], 'wm': {'水桶': '提水用的圆桶', '木桶': '木头做的圆桶'}, 'en': 'bucket'},
    '咏': {'w': ['歌咏', '吟咏', '咏柳'], 'wm': {'歌咏': '用唱歌的调子诵念', '咏柳': '歌颂柳树的古诗'}, 'en': 'chant'},
    '忽': {'w': ['忽然', '忽视'], 'wm': {'忽然': '事情发生得又快又没想到', '忽视': '不注意，看在眼里却没理会'}, 'en': 'suddenly'},
    '厘': {'w': ['厘米', '毫厘', '厘清'], 'wm': {'厘米': '长度单位，比指甲盖略宽', '毫厘': '一毫一厘，形容差别很小'}, 'en': 'centimeter'},
    '妥': {'w': ['妥当', '妥善'], 'wm': {'妥当': '稳当合适', '妥善': '妥当完善'}, 'en': 'proper'},
    '宗': {'w': ['宗旨', '祖宗'], 'wm': {'宗旨': '主要的目的和意思', '祖宗': '一个家族的祖先'}, 'en': 'sect'},
    '恒': {'w': ['永恒', '恒心'], 'wm': {'永恒': '永远不变', '恒心': '长久不变的意志'}, 'en': 'constant'},
    '憨': {'w': ['憨笑', '憨厚'], 'wm': {'憨厚': '老实厚道', '憨笑': '朴实可爱的笑'}, 'en': 'silly'},
    '旨': {'w': ['宗旨', '旨意'], 'wm': {'宗旨': '主要的目的', '旨意': '上级的意思和命令'}, 'en': 'purpose'},
    '皆': {'w': ['皆大欢喜', '皆是'], 'wm': {'皆大欢喜': '人人都高兴满意', '皆是': '全都是'}, 'en': 'all'},
    '眶': {'w': ['眼眶', '热泪盈眶'], 'wm': {'眼眶': '眼睛周围的皮和骨头', '热泪盈眶': '眼睛里装满了泪水'}, 'en': 'socket'},
    '睬': {'w': ['理睬', '不理不睬'], 'wm': {'理睬': '理会、答理', '不理不睬': '不理会，当作没看见'}, 'en': 'heed'},
    '萌': {'w': ['萌芽', '萌发'], 'wm': {'萌芽': '种子刚长出的小芽', '萌发': '种子发芽，也比喻发生'}, 'en': 'sprout'},
    '螃': {'w': ['螃蟹', '捉螃蟹'], 'wm': {'螃蟹': '横着走路的水生动物，有两只大钳', '捉螃蟹': '抓螃蟹'}, 'en': 'crab'},
    '蟹': {'w': ['螃蟹', '海蟹'], 'wm': {'螃蟹': '横着走路的水生动物，有两只大钳', '海蟹': '海里的螃蟹'}, 'en': 'crab'},
    '轴': {'w': ['轴承', '车轴'], 'wm': {'轴承': '机器里会转动的零件', '车轴': '车轮中间穿过的横棍'}, 'en': 'axis'},
    '阁': {'w': ['楼阁', '阁楼'], 'wm': {'楼阁': '两成以上的楼房', '阁楼': '楼房上部的小间'}, 'en': 'pavilion'},
    '频': {'w': ['频繁', '频频'], 'wm': {'频繁': '次数很多', '频频': '一次又一次地'}, 'en': 'frequency'},
    '鲤': {'w': ['鲤鱼', '锦鲤'], 'wm': {'鲤鱼': '常见的淡水鱼，尾巴发红', '锦鲤': '花纹好看的观赏鲤鱼'}, 'en': 'carp'},
    '鲨': {'w': ['鲨鱼', '大白鲨'], 'wm': {'鲨鱼': '海里很凶的大鱼，牙很尖', '大白鲨': '很大的鲨鱼'}, 'en': 'shark'},
    '鲫': {'w': ['鲫鱼', '鲫鱼汤'], 'wm': {'鲫鱼': '身体扁平的淡水鱼', '鲫鱼汤': '鲫鱼煮的汤'}, 'en': 'carp'},
}


def read_js(path, anchor=None):
    raw = open(path, encoding='utf-8').read()
    i = raw.index(anchor) + len(anchor) if anchor else 0
    s = raw.index('{', i)
    return raw[:s], raw[s:raw.rindex('}') + 1], raw[raw.rindex('}') + 1:]


def strokes_path(sem):
    return os.path.join(ROOT, 'data', 'strokes', '%s.js' % sem)


def load_strokes(sem):
    _, body, _ = read_js(strokes_path(sem), 'window.HZ_STROKES["%s"]=' % sem)
    return json.loads(body)


def save_strokes(sem, sk):
    head, _, tail = read_js(strokes_path(sem), 'window.HZ_STROKES["%s"]=' % sem)
    open(strokes_path(sem), 'w', encoding='utf-8').write(
        head + json.dumps(sk, ensure_ascii=False, separators=(',', ':')) + tail)


def main():
    sems = sys.argv[1:]
    cur = json.loads(read_js(P_CUR)[1])
    info = {}
    for line in open(DICTSRC, encoding='utf-8'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        info[o['character']] = o

    # ---------- 1) 字帖 ----------
    for sem in sems:
        need = []
        for u in cur[sem]['units']:
            for l in u['lessons']:
                need += l['chars']
        sk = load_strokes(sem)
        miss = [c for c in sorted(set(need)) if c not in sk]
        no_src = []
        for c in miss:
            src = os.path.join(HWD, c + '.json')
            if not os.path.exists(src):
                no_src.append(c); continue
            d = json.load(open(src, encoding='utf-8'))
            sk[c] = {'s': d['strokes'], 'm': d['medians']}
        save_strokes(sem, sk)
        print('strokes %s: 补 %d 字（字库缺 %d：%s），现有 %d 字'
              % (sem, len(miss) - len(no_src), len(no_src), ''.join(no_src), len(sk)))

    # ---------- 2) 字典 ----------
    need_dict = []
    for sem in sems:
        for u in cur[sem]['units']:
            for l in u['lessons']:
                for c in l['chars']:
                    if c not in need_dict:
                        need_dict.append(c)
    head, body, tail = read_js(os.path.join(ROOT, 'data', 'dict.js'))
    dct = json.loads(body)
    todo = [c for c in need_dict if c not in dct]
    no_curated = [c for c in todo if c not in CURATED]
    if no_curated:
        print('!! 这些字缺字典条目且无人工校订数据，请先补 CURATED：%s' % ''.join(no_curated))
    added = []
    for c in todo:
        if c not in CURATED:
            continue
        o = info.get(c)
        assert o, 'dictionary.txt 缺此字：' + c
        ns = 0
        for sem in sems:
            sk = load_strokes(sem)
            if c in sk:
                ns = len(sk[c]['s']); break
        cu = CURATED[c]
        dct[c] = {
            'p': [p for p in o.get('pinyin', []) if p],
            'r': o.get('radical', ''),
            's': ns,
            'w': cu['w'],
            'wm': cu['wm'],
            'en': cu['en'],
            'e': '',
        }
        added.append(c)
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
    if added:
        bak = os.path.join(ROOT, 'data', 'dict.js') + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
        shutil.copyfile(os.path.join(ROOT, 'data', 'dict.js'), bak)
        shutil.move(bak, os.path.join(HERE, 'dict.js.bak-' + time.strftime('%Y%m%d-%H%M%S')))
        open(os.path.join(ROOT, 'data', 'dict.js'), 'w', encoding='utf-8').write(
            head + json.dumps(dct, ensure_ascii=False, separators=(',', ':')) + tail)
        print('dict: 补 %d 字：%s' % (len(added), ''.join(added)))


if __name__ == '__main__':
    main()
