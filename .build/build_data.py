# -*- coding: utf-8 -*-
"""构建《生字笔顺乐园》数据包：课程(逐课写字表) + 笔顺轮廓 + 字典(拼音/部首)。
数据来源：
  - 笔顺轮廓/笔顺坐标：Make Me a Hanzi / hanzi-writer-data (Arphic Public License)
  - 拼音/部首/笔画数：Make Me a Hanzi dictionary.txt
  - 写字表课程结构：统编版(部编版)小学语文教材《写字表》公开整理资料
"""
import bisect, json, os, re, html, glob, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(ROOT, '..'))
HWD = os.path.join(ROOT, 'hwd', 'package')

# ---------------------------------------------------------------- 一年级：逐课写字表
# 一年级上册（统编版）
G1A = [
    ("第一单元 识字", [
        ("识字2《金木水火土》", "一二三上"),
        ("识字3《口耳目》", "口目耳手"),
        ("识字4《日月水火》", "日田禾火"),
        ("识字5《对韵歌》", "虫云山"),
        ("语文园地一", "八十"),
    ]),
    ("第四单元 课文", [
        ("1《秋天》", "了子人大"),
        ("2《小小的船》", "月儿头里"),
        ("3《江南》", "可东西"),
        ("4《四季》", "天四是"),
        ("语文园地四", "女开"),
    ]),
    ("第五单元 识字", [
        ("6《画》", "水去来不"),
        ("7《大小多少》", "小少牛果鸟"),
        ("8《小书包》", "早书刀尺本"),
        ("9《日月明》", "木林土力心"),
        ("10《升国旗》", "中五立正"),
    ]),
    ("第六单元 课文", [
        ("5《影子》", "在后我好"),
        ("6《比尾巴》", "长比巴把"),
        ("7《青蛙写诗》", "下个雨们"),
        ("8《雨点儿》", "问有半从你"),
    ]),
    ("第七单元 课文", [
        ("9《明天要远足》", "才明同学"),
        ("10《大还是小》", "自己门衣"),
        ("11《项链》", "白的又和"),
    ]),
    ("第八单元 课文", [
        ("12《雪地里的小画家》", "竹牙马用几"),
        ("13《乌鸦喝水》", "只石多出见"),
        ("14《小蜗牛》", "对妈全回"),
        ("语文园地八", "工厂"),
    ]),
]

# 一年级下册（统编版）
G1B = [
    ("第一单元 识字", [
        ("识字1《春夏秋冬》", "春冬风雪花飞入"),
        ("识字2《姓氏歌》", "姓什么双国王方"),
        ("识字3《小青蛙》", "青清气晴情请生"),
        ("识字4《猜字谜》", "字左右红时动万"),
    ]),
    ("第二单元 课文", [
        ("1《吃水不忘挖井人》", "吃叫主江住没以"),
        ("2《我多想去看看》", "多会走北京广公"),
        ("3《一个接一个》", "过各种样伙伴这"),
        ("4《四个太阳》", "太阳校金秋因为"),
    ]),
    ("第三单元 课文", [
        ("5《小公鸡和小鸭子》", "他河说也地听哥"),
        ("6《树和喜鹊》", "单居招呼快乐"),
        ("7《怎么都快乐》", "玩很当音讲行许"),
    ]),
    ("第四单元 课文", [
        ("8《静夜思》", "思床前光低故乡"),
        ("9《夜色》", "色外看爸晚笑再"),
        ("10《端午粽》", "午节叶米真分豆"),
        ("11《彩虹》", "那着到高兴千成"),
    ]),
    ("第五单元 识字", [
        ("5《动物儿歌》", "间迷造运池欢网"),
        ("6《古对今》", "古凉细夕李语香"),
        ("7《操场上》", "打拍跑足声身体"),
        ("8《人之初》", "之相近习远玉义"),
    ]),
    ("第六单元 课文", [
        ("12《古诗二首》", "首采无树爱尖角"),
        ("13《荷叶圆圆》", "亮机台放鱼朵美"),
        ("14《要下雨了》", "直呀边呢吗吧加"),
    ]),
    ("第七单元 课文", [
        ("15《文具的家》", "文次找平办让包"),
        ("16《一分钟》", "钟元洗共已经坐"),
        ("17《动物王国开大会》", "要连百今还舌点"),
        ("18《小猴子下山》", "块非常往片瓜进"),
    ]),
    ("第八单元 课文", [
        ("19《棉花姑娘》", "空病她医别干奇七星"),
        ("20《咕咚》", "吓怕跟起家羊象都"),
        ("21《小壁虎借尾巴》", "捉条向爬姐您草房"),
    ]),
]

# ---------------------------------------------------------------- 二年级：课名 + (从文档解析的锚点字符)
G2A_NAMES = [
    ("第一单元 课文", [("1《小蝌蚪找妈妈》", 1), ("2《我是什么》", 2), ("3《植物妈妈有办法》", 3)]),
    ("第二单元 识字", [("1《场景歌》", 1), ("2《树之歌》", 2), ("3《拍手歌》", 3), ("4《田家四季歌》", 4)]),
    ("第三单元 课文", [("4《曹冲称象》", 4), ("5《玲玲的画》", 5), ("6《一封信》", 6), ("7《妈妈睡了》", 7)]),
    ("第四单元 课文", [("8《古诗二首》", 8), ("9《黄山奇石》", 9), ("10《日月潭》", 10), ("11《葡萄沟》", 11)]),
    ("第五单元 课文", [("12《坐井观天》", 12), ("13《寒号鸟》", 13), ("14《我要的是葫芦》", 14)]),
    ("第六单元 课文", [("15《大禹治水》", 15), ("16《朱德的扁担》", 16), ("17《难忘的泼水节》", 17)]),
    ("第七单元 课文", [("18《古诗二首》", 18), ("19《雾在哪里》", 19), ("20《雪孩子》", 20)]),
    ("第八单元 课文", [("21《狐假虎威》", 21), ("22《狐狸分奶酪》", 22), ("23《纸船和风筝》", 23), ("24《风娃娃》", 24)]),
]
G2B_NAMES = [
    ("第一单元 课文", [("1《古诗二首》", 1), ("2《找春天》", 2), ("3《开满鲜花的小路》", 3), ("4《邓小平爷爷植树》", 4)]),
    ("第二单元 课文", [("5《雷锋叔叔，你在哪里》", 5), ("6《千人糕》", 6), ("7《一匹出色的马》", 7)]),
    ("第三单元 识字", [("1《神州谣》", 1), ("2《传统节日》", 2), ("3《“贝”的故事》", 3), ("4《中国美食》", 4)]),
    ("第四单元 课文", [("8《彩色的梦》", 8), ("9《枫树上的喜鹊》", 9), ("10《沙滩上的童话》", 10), ("11《我是一只小虫子》", 11)]),
    ("第五单元 课文", [("12《寓言二则》", 12), ("13《画杨桃》", 13), ("14《小马过河》", 14)]),
    ("第六单元 课文", [("15《古诗二首》", 15), ("16《雷雨》", 16), ("17《要是你在野外迷了路》", 17), ("18《太空生活趣事多》", 18)]),
    ("第七单元 课文", [("19《大象的耳朵》", 19), ("20《蜘蛛开店》", 20), ("21《青蛙卖泥塘》", 21), ("22《小毛虫》", 22)]),
    ("第八单元 课文", [("23《祖先的摇篮》", 23), ("24《当世界年纪还小的时候》", 24), ("25《羿射九日》", 25)]),
]

# ---------------------------------------------------------------- 三年级～六年级：整册写字表（按册组织）
SEMESTER_LABEL = {
    "1a": "一年级上册", "1b": "一年级下册", "2a": "二年级上册", "2b": "二年级下册",
    "3a": "三年级上册", "3b": "三年级下册", "4a": "四年级上册", "4b": "四年级下册",
    "5a": "五年级上册", "5b": "五年级下册", "6a": "六年级上册", "6b": "六年级下册",
}
CNBLOGS_KEY = {
    "一上": "1a", "一下": "1b", "二上": "2a", "二下": "2b", "三上": "3a", "三下": "3b",
    "四上": "4a", "四下": "4b", "五上": "5a", "五下": "5b", "六上": "6a", "六下": "6b",
}
IDIOMS = set("指鹿为马 鹿死谁手 群雄逐鹿 滴水不漏 漏网之鱼 认贼作父 心宽体胖".split())
CHAR_FIX = {"掲": "揭", "麋": "麋"}


def text_of(fn):
    s = open(fn, encoding='utf-8', errors='ignore').read()
    s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    s = re.sub(r'<(br|/p|/div|/td|/tr|/h\d|/li)[^>]*>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(s)


def cnblogs_flat():
    """从 cnblogs 页面提取 12 册写字表（教材顺序）。"""
    t = text_of(os.path.join(ROOT, 'raw', 'cnblogs.html'))
    for cut in ['读评论', '刷新页面', '返回顶部', '公告']:
        i = t.find(cut)
        if i > 0:
            t = t[:i]
    res = {}
    marks = [(m.start(), m.end(), m.group(1) + m.group(2)) for m in
             re.finditer(r'([一二三四五六])\s*(上|下)\s*\(\s*\d+\s*\)', t)]
    for i, (pos, mend, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(t)
        body = t[mend:end]
        toks = [x for x in re.split(r'[\s\u3000,，、．.；;：:]+', body) if x]
        chars = []
        for tk in toks:
            if tk in CNBLOGS_KEY or re.match(r'^(u\d+|识字|课文)$', tk):
                continue
            if tk in IDIOMS:
                continue
            for ch in tk:
                ch = CHAR_FIX.get(ch, ch)
                if '\u4e00' <= ch <= '\u9fff' and ch not in chars:
                    chars.append(ch)
        res[CNBLOGS_KEY[key]] = chars
    return res


def yidocs_lessons(fn):
    """解析易档网《写字表》文档：返回 [(课名, 字符列表), ...]（保留顺序）。"""
    t = text_of(fn)
    parts = re.split(r'(?=《[^》]{1,20}》)|(?=[①-⑳])|(?=第[一二三四五六七八]单元)', t)
    out = []
    for p in parts:
        m = re.match(r'^(《[^》]{1,20}》|[①-⑳])([^\n]{0,12}?)', p)
        if not m:
            continue
        title = m.group(1)
        rest = p[m.end():]
        head = re.sub(r'[（(].*$', '', rest)[:6]
        chars = re.findall(r'([\u4e00-\u9fff])（', rest)
        if not chars or len(chars) > 24:
            continue
        out.append((title, head, chars))
    return out


def partition_smart(flat, anchors):
    """以逐课生字在教材字表中的首次出现位置为界切分（位置单调化，保证不漏字、不错序）。"""
    posmap = {}
    for i, c in enumerate(flat):
        posmap.setdefault(c, []).append(i)
    raws = []
    for name, cs in anchors:
        ps = [posmap[c][0] for c in cs if c in posmap]
        raws.append(min(ps) if ps else None)
    start = [0]
    for i in range(1, len(raws)):
        r = raws[i]
        start.append(r if r is not None and r >= start[-1] else start[-1] + 1)
    start = [min(v, len(flat) - 1) for v in start]
    out = []
    for i, (name, cs) in enumerate(anchors):
        end = start[i + 1] if i + 1 < len(start) else len(flat)
        out.append((name, flat[start[i]:end]))
    return out


def partition_seq(flat, anchors):
    """按文档逐课生字的出现位置，顺序切分教材字表。"""
    posmap = {}
    for i, c in enumerate(flat):
        posmap.setdefault(c, []).append(i)
    out, ptr = [], 0
    for name, cs in anchors:
        idxs = []
        for c in cs:
            lst = posmap.get(c)
            if not lst:
                continue
            j = bisect.bisect_left(lst, ptr)
            if j < len(lst):
                idxs.append(lst[j])
        if not idxs:
            out.append((name, []))
            continue
        end = max(idxs) + 1
        out.append((name, flat[ptr:end]))
        ptr = end
    if ptr < len(flat) and out:
        out[-1] = (out[-1][0], out[-1][1] + flat[ptr:])
    return out


def partition(flat, anchors):
    """按 anchors(逐课字符) 在 flat 中的位置做顺序切分，保证每字只出现一次。"""
    posmap = {}
    for i, c in enumerate(flat):
        posmap.setdefault(c, []).append(i)

    def first_at(c, start):
        lst = posmap.get(c)
        if not lst:
            return None
        j = bisect.bisect_left(lst, start)
        return lst[j] if j < len(lst) else None

    starts, ptr = [], 0
    for name, cs in anchors:
        s = None
        for c in cs:
            p = first_at(c, ptr)
            if p is not None:
                s = p if s is None else min(s, p)
        starts.append(s)
        if s is not None:
            ptr = s + 1

    bounds = [0]
    for i in range(1, len(starts)):
        bounds.append(starts[i] if starts[i] is not None else bounds[-1])
    bounds.append(len(flat))
    out = []
    for i, (name, cs) in enumerate(anchors):
        out.append((name, flat[bounds[i]:max(bounds[i], bounds[i + 1])]))
    # 合并空课
    return out


def build_curriculum():
    flat = cnblogs_flat()
    cur = {}

    def add(uid, label, units):
        cur[uid] = {"id": uid, "name": label, "units": [
            {"name": un, "lessons": [
                {"id": f"{uid}-{ui}-{li}", "name": ln, "chars": list(cs)}
                for li, (ln, cs) in enumerate(ls)]}
            for ui, (un, ls) in enumerate(units)]}

    add("1a", SEMESTER_LABEL["1a"], [(un, [(ln, ls) for ln, ls in ls]) for un, ls in G1A])
    add("1b", SEMESTER_LABEL["1b"], [(un, [(ln, ls) for ln, ls in ls]) for un, ls in G1B])

    # 二年级：直接采用《写字表》文档解析出的逐课生字（含 2A 末尾 21-24 课）
    TAIL_2A = [("21《狐假虎威》", "食物眼爷爪神活猪"), ("22《狐狸分奶酪》", "奶始吵仔急咬第公"),
               ("23《纸船和风筝》", "折纸张祝扎抓但哭"), ("24《风娃娃》", "车得秧苗汗场伤路")]
    for uid, fn, names in [("2a", 'y5611942714.html', G2A_NAMES), ("2b", 'y5c18634966.html', G2B_NAMES)]:
        parsed = yidocs_lessons(os.path.join(ROOT, 'raw', fn))
        target = 20 if uid == '2a' else 29
        used, lessons = set(), []
        for title, head, chars in parsed:
            keep = [c for c in chars if c not in used]
            if len(keep) < max(3, len(chars) * 0.6):   # 重复出现的版块，跳过
                continue
            used.update(keep)
            lessons.append((title, keep))
            if len(lessons) >= target:
                break
        if uid == '2a':
            for n, cs in TAIL_2A:
                if len(lessons) >= 24:
                    break
                lessons.append((n, [c for c in cs if c not in used]))
                used.update(cs)
        # 用教材顺序字表补齐文档中遗漏的字
        if uid == '2a':
            anchor_pos = None
        fl = flat[uid]
        fpos = {c: i for i, c in enumerate(fl)}
        anchor_pos = []
        for n, cs in lessons:
            ps = sorted(fpos[c] for c in cs if c in fpos)
            anchor_pos.append(ps[len(ps) // 2] if ps else None)
        if False:
            order = sorted(range(len(lessons)), key=lambda k: (anchor_pos[k] is None, anchor_pos[k] or 0))
            for q, c in enumerate(fl):
                if c in used:
                    continue
                k = order[0]
                for kk in order:
                    if anchor_pos[kk] is not None and anchor_pos[kk] <= q:
                        k = kk
                lessons[k] = (lessons[k][0], lessons[k][1] + [c])
                used.add(c)
        # 合并进单元
        units, k = [], 0
        for un, items in names:
            grp = []
            for ln, _ in items:
                if k < len(lessons):
                    grp.append((ln, lessons[k][1]))
                    k += 1
            units.append((un, grp))
        if k < len(lessons):  # 剩余内容追加到最后一个单元
            for j in range(k, len(lessons)):
                units[-1][1].append((lessons[j][0], lessons[j][1]))
        add(uid, SEMESTER_LABEL[uid], units)

    # 三～六年级：整册字表，每 12 字一组便于闯关
    for key in ["3a", "3b", "4a", "4b", "5a", "5b", "6a", "6b"]:
        chars = flat[key]
        groups = [chars[i:i + 12] for i in range(0, len(chars), 12)]
        units = [{"name": "整册字表", "lessons": [
            {"id": f"{key}-0-{i}", "name": f"第{i + 1}组", "chars": g} for i, g in enumerate(groups)]}]
        cur[key] = {"id": key, "name": SEMESTER_LABEL[key], "units": units}
    return cur


def load_dict():
    d = {}
    for line in open(os.path.join(ROOT, 'dictionary.txt'), encoding='utf-8'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        ch = o.get('character')
        if not ch or len(ch) != 1:
            continue
        d[ch] = {"p": o.get('pinyin') or [], "r": o.get('radical') or '', "d": o.get('definition', '')}
    return d


def load_words():
    """教材资料中提取的组词（词必须包含本字）。"""
    p = os.path.join(ROOT, 'words.json')
    if not os.path.exists(p):
        return {}
    try:
        return json.load(open(p, encoding='utf-8'))
    except Exception:
        return {}


def load_xinhua():
    """《汉语字典》中文释义、部首、笔画数。"""
    p = os.path.join(ROOT, 'word.json')
    if not os.path.exists(p):
        return {}
    try:
        raw = json.load(open(p, encoding='utf-8'))
    except Exception as e:
        print('  [warn] word.json 不可用，跳过中文释义:', e)
        return {}
    out = {}
    for o in raw:
        w = o.get('word', '')
        if len(w) != 1:
            continue
        exp = (o.get('explanation') or '').replace('\r', '')
        exp = re.sub(r'\n+', '\n', exp).strip()
        out[w] = {"r": o.get('radicals', ''), "s": o.get('strokes', ''),
                  "p": o.get('pinyin', ''), "e": exp}
    return out


def main():
    cur = build_curriculum()
    dic = load_dict()
    xh = load_xinhua()
    wd = load_words()
    all_chars, stats = [], {}
    for uid in SEMESTER_LABEL:
        cs = [c for u in cur[uid]['units'] for l in u['lessons'] for c in l['chars']]
        stats[uid] = len(cs)
        all_chars += cs
    uniq = []
    for c in all_chars:
        if c not in uniq:
            uniq.append(c)
    missing = [c for c in uniq if not os.path.exists(os.path.join(HWD, c + '.json'))]
    noxh = [c for c in uniq if c not in xh]
    print('各册字数:', stats)
    print('总字数:', len(all_chars), ' 去重:', len(uniq))
    print('缺笔顺数据:', ''.join(missing) or '无')
    print('缺中文字典:', ('%d 个（按需补充）' % len(noxh)) if noxh else '无')

    os.makedirs(os.path.join(OUT, 'data', 'strokes'), exist_ok=True)

    def short(exp):
        """抽取适合小学生阅读的简短释义。"""
        exp = re.sub(r'[〈（(].*?[〉）)]', '', exp)
        exp = re.sub(r'[\x00-\x1f]', ' ', exp)
        lines = [x.strip() for x in re.split(r'[\n。；;]', exp) if x.strip()]
        for ln in lines:
            if len(ln) >= 4:
                return ln[:40]
        return ''

    def strokes_of(c):
        fp = os.path.join(HWD, c + '.json')
        try:
            return len(json.load(open(fp, encoding='utf-8'))['strokes'])
        except Exception:
            return 0

    dict_out = {}
    for c in uniq:
        m = dic.get(c, {})
        x = xh.get(c, {})
        py = [p for p in (m.get('p') or [])]
        if not py and x.get('p'):
            py = [p.strip() for p in re.split(r'[,，]', x['p']) if p.strip()]
        rad = x.get('r') or m.get('r') or ''
        if len(rad) != 1:
            rad = m.get('r') or rad
        dict_out[c] = {"p": py[:3], "r": rad, "s": strokes_of(c),
                       "w": (wd.get(c) or [])[:3],
                       "e": short(x.get('e', ''))}
    with open(os.path.join(OUT, 'data', 'curriculum.js'), 'w', encoding='utf-8') as f:
        f.write('/* 统编版(部编版)小学语文《写字表》课程数据 | 笔顺：Make Me a Hanzi(Arphic Public License) */\n')
        f.write('window.HZ_CURRICULUM=' + json.dumps(cur, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(os.path.join(OUT, 'data', 'dict.js'), 'w', encoding='utf-8') as f:
        f.write('/* 生字字典：拼音/部首/笔画/释义（释义取自《汉语字典》公开数据，仅供学习参考） */\n')
        f.write('window.HZ_DICT=' + json.dumps(dict_out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('dict.js %dKB' % (os.path.getsize(os.path.join(OUT, 'data', 'dict.js')) // 1024))
    # 笔顺（按册拆分，按需加载）
    total_b = 0
    for uid in SEMESTER_LABEL:
        chars = []
        for u in cur[uid]['units']:
            for l in u['lessons']:
                for c in l['chars']:
                    if c not in chars:
                        chars.append(c)
        data = {}
        for c in chars:
            p = os.path.join(HWD, c + '.json')
            if not os.path.exists(p):
                continue
            o = json.load(open(p, encoding='utf-8'))
            med = [[[round(x, 1), round(y, 1)] for x, y in s] for s in o['medians']]
            data[c] = {"s": o['strokes'], "m": med}
        fp = os.path.join(OUT, 'data', 'strokes', uid + '.js')
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('window.HZ_STROKES=window.HZ_STROKES||{};window.HZ_STROKES[%s]=%s;\n'
                    % (json.dumps(uid), json.dumps(data, ensure_ascii=False, separators=(',', ':'))))
        total_b += os.path.getsize(fp)
        print(f'  {uid}.js {len(data)}字 {os.path.getsize(fp)//1024}KB')
    print('笔顺数据合计 %.1f MB' % (total_b / 1048576))
    # 许可说明
    with open(os.path.join(OUT, 'data', 'LICENSE-NOTICE.txt'), 'w', encoding='utf-8') as f:
        f.write('''本软件使用的第三方数据：

1) 汉字笔顺轮廓与笔顺中心线数据：Make Me a Hanzi (https://github.com/skishore/makemeahanzi)
   及 hanzi-writer-data。字形数据来自 Arphic Public License 授权的字体，可自由使用与再分发。
   许可证全文：https://github.com/skishore/makemeahanzi/blob/master/ARPHICPL.TXT
2) 拼音、部首、释义：Make Me a Hanzi dictionary.txt（同上，Arphic Public License / CC-BY-SA 4.0）。
3) 教材写字表课程结构：依据统编版（部编版）小学语文教材《写字表》公开整理资料编排，
   仅供学习参考；不同教材印次可能有少量差异，可在 data/curriculum.js 中自行调整。
''')


if __name__ == '__main__':
    main()
