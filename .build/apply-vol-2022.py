#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""apply-vol-2022.py — 把指定册次的课表替换为 2022 年课标修订版（官方教材页逐页读取）

用法: python3 apply-vol-2022.py 2b [3a ...]
数据: VOLS[sem] = (册名, 单元定义, 官方写字表标注总字数)
      单元定义 = [(单元名, [(课名, 生字字符串), ...]), ...]
做法：片段替换，只动目标册那一段，其余册次字节不变；写完复核其余册次与原文相等。
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(os.path.dirname(HERE), 'data', 'curriculum.js')

VOLS = {
    '2b': ('二年级下册', [
        ('第一单元 阅读', [
            ('1《古诗二首》', '诗碧妆绿丝剪童归'),
            ('2《找春天》', '冲寻眉吐闻柳荡桃'),
            ('3《开满鲜花的小路》', '鲜原叔通巧惊礼'),
            ('4《邓小平爷爷植树》', '邓植格引注满'),
            ('语文园地一', '剧场'),
        ]),
        ('第二单元 阅读', [
            ('5《雷锋叔叔，你在哪里》', '雷锋昨背洒汗温暖'),
            ('6《千人糕》', '桌尝买具甘汁甜菜劳应'),
            ('7《我不是最弱小的》', '弱周末母吸芬芳递勇敢'),
            ('语文园地二', '程术服务'),
            ('快乐读书吧', ''),
        ]),
        ('第三单元 识字', [
            ('1《神州谣》', '神州华各族情谊齐'),
            ('2《传统节日》', '传统贴街扫龙艾团围真'),
            ('3《“贝”的故事》', '甲骨觉品钱币与财'),
            ('4《中国美食》', '食茄烤鸭煮鸡蛋饭'),
            ('语文园地三', '辣乎'),
        ]),
        ('第四单元 阅读', [
            ('8《彩色的梦》', '梦硬铅笔盒森结苹精灵流'),
            ('9《一匹出色的马》', '匹妹波纹恋舍求奔'),
            ('10《枫树上的喜鹊》', '旁阿姨弟便教拼音'),
            ('语文园地四', '坦克'),
        ]),
        ('第五单元 阅读', [
            ('11《寓言二则》', '亡补牢劝丢助坏死'),
            ('12《画杨桃》', '室排而实候班哈举'),
            ('13《小马过河》', '愿意麦伯刻突然掉'),
            ('语文园地五', '商厦洞穴'),
        ]),
        ('第六单元 阅读', [
            ('14《古诗二首》', '窗含岭泊吴净莲映'),
            ('15《雷雨》', '乌黑沉压响新迎扑'),
            ('16《要是你在野外迷了路》', '指南针帮忠导永夜特积'),
            ('17《太空生活趣事多》', '航宇宙或浴桶'),
            ('语文园地六', '馆所'),
        ]),
        ('第七单元 阅读', [
            ('18《大象的耳朵》', '扇慢遇定病睡根痛'),
            ('19《蜘蛛开店》', '店决需付夫终期'),
            ('20《青蛙卖泥塘》', '蛙卖搬倒泉砍破咏'),
            ('21《小毛虫》', '仿佛并任何纺织迟'),
            ('语文园地七', '校内'),
        ]),
        ('第八单元 阅读', [
            ('22《羿射九日》', '射最始换值弓炎此'),
            ('23《黄帝的传说》', '忽件召众完却供'),
            ('24《大禹治水》', '治洪姓带必须仍继续业'),
            ('语文园地八', '灿烂'),
        ]),
    ], 250),
}

NEXT = {'1a': '1b', '1b': '2a', '2a': '2b', '2b': '3a', '3a': '3b', '3b': '4a', '4a': '4b',
        '4b': '5a', '5a': '5b', '5b': '6a', '6a': '6b', '6b': None}


def build(sem, name, units_def):
    units = []
    for ui, (uname, lessons) in enumerate(units_def):
        ls = []
        for li, (lname, chars) in enumerate(lessons):
            ls.append({'id': '%s-%d-%d' % (sem, ui, li), 'name': lname, 'chars': list(chars)})
        units.append({'name': uname, 'lessons': ls})
    return '"%s":' % sem + json.dumps({'id': sem, 'name': name, 'units': units},
                                      ensure_ascii=False, separators=(',', ':'))


def apply_one(raw, sem):
    name, units_def, expect = VOLS[sem]
    nxt = NEXT[sem]
    s = raw.index('"%s":' % sem)
    e = raw.index('"%s":' % nxt) if nxt else raw.rindex('}')
    return raw[:s] + build(sem, name, units_def) + ',' + raw[e:], expect


def main():
    raw = open(P, encoding='utf-8').read()
    head = raw[:raw.index('{', raw.index('window.HZ_CURRICULUM='))]
    assert head.rstrip().endswith('window.HZ_CURRICULUM='), head[-80:]
    body = raw[raw.index('{', raw.index('window.HZ_CURRICULUM=')):].rstrip().rstrip(';')
    C = json.loads(body)

    # 从后往前替换，避免索引位移
    sems = [s for s in sys.argv[1:] if s in VOLS]
    for sem in sorted(sems, key=lambda s: list(C).index(s), reverse=True):
        raw, _ = apply_one(raw, sem)

    chk = json.loads(raw[raw.index('{'):].rstrip().rstrip(';'))
    for k in C:
        if k not in sems:
            assert chk[k] == C[k], '其余册次发生变化：%s' % k

    bak = P + '.bak'
    if not os.path.exists(bak):
        shutil.copy(P, bak)
    open(P, 'w', encoding='utf-8').write(head + raw[raw.index('{'):].rstrip().rstrip(';') + ';')

    for sem in sems:
        name, units_def, expect = VOLS[sem]
        n = sum(len(u['lessons']) for u in chk[sem]['units'])
        chars = sum(len(l['chars']) for u in chk[sem]['units'] for l in u['lessons'])
        print('%s 已替换：%d 单元 %d 课 %d 字（官方写字表标注 %d 字）'
              % (sem, len(chk[sem]['units']), n, chars, expect))
        if chars != expect:
            print('⚠ 与官方标注差 %+d，需复查' % (chars - expect))


if __name__ == '__main__':
    main()
