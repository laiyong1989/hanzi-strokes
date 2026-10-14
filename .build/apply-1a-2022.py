#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把一年级上册课表替换为 2022 年课标修订版（依据国家中小学智慧教育平台官方教材页）
   依据：官方目录 p4/p5/p6（书页 8~101）+ 官方写字表 p113（书页 108，共 100 字）"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'data', 'curriculum.js')

UNITS = [
    ('我上学了', [
        ('1《我是中国人》', []),
        ('2《我爱我们的祖国》', []),
        ('3《我是小学生》', []),
        ('4《我爱学语文》', []),
    ]),
    ('第一单元 识字', [
        ('1《天地人》', []),
        ('2《金木水火土》', '一二三上'),
        ('3《口耳目手足》', '口耳目手'),
        ('4《日月山川》', '日火田禾'),
        ('语文园地一', '六七八十'),
        ('快乐读书吧', []),
    ]),
    ('第二单元 汉语拼音', [
        ('1《a o e》', []),
        ('2《i u ü》', []),
        ('3《b p m f》', []),
        ('4《d t n l》', []),
        ('语文园地二', '九王'),
    ]),
    ('第三单元 汉语拼音', [
        ('5《g k h》', []),
        ('6《j q x》', []),
        ('7《z c s》', []),
        ('8《zh ch sh r》', []),
        ('9《y w》', []),
        ('语文园地三', '午下'),
    ]),
    ('第四单元 汉语拼音', [
        ('10《ai ei ui》', []),
        ('11《ao ou iu》', []),
        ('12《ie üe er》', []),
        ('13《an en in un ün》', []),
        ('14《ang eng ing ong》', []),
        ('语文园地四', '个去'),
    ]),
    ('第五单元 阅读', [
        ('1《秋天》', '了子大人'),
        ('2《江南》', '可叶东西'),
        ('3《雪地里的小画家》', '竹马牙用几'),
        ('4《四季》', '四小鸟是天'),
        ('语文园地五', '女开关先'),
    ]),
    ('第六单元 识字', [
        ('5《对韵歌》', '云雨虫山水'),
        ('6《日月明》', '力男士木心'),
        ('7《小书包》', '尺本刀不少'),
        ('8《升国旗》', '中五风立正'),
        ('语文园地六', '工厂门卫'),
    ]),
    ('第七单元 阅读', [
        ('5《小小的船》', '月儿头里见'),
        ('6《影子》', '在我左右'),
        ('7《两件宝》', '和也又才'),
        ('语文园地七', '爸妈'),
    ]),
    ('第八单元 阅读', [
        ('8《比尾巴》', '比巴长公'),
        ('9《乌鸦喝水》', '只多办石出'),
        ('10《雨点儿》', '来半你有'),
        ('语文园地八', '牛羊瓜白'),
    ]),
]


def main():
    raw = open(P, encoding='utf-8').read()
    head = raw[:raw.index('{', raw.index('window.HZ_CURRICULUM='))]
    assert head.rstrip().endswith('window.HZ_CURRICULUM='), head[-80:]
    body = raw[raw.index('{', raw.index('window.HZ_CURRICULUM=')):].rstrip().rstrip(';')
    C = json.loads(body)
    old_ser = json.dumps(C, ensure_ascii=False, separators=(',', ':'))

    units = []
    for ui, (uname, lessons) in enumerate(UNITS):
        ls = []
        for li, (lname, chars) in enumerate(lessons):
            ls.append({'id': '1a-%d-%d' % (ui, li), 'name': lname, 'chars': list(chars)})
        units.append({'name': uname, 'lessons': ls})

    # 片段替换：只动 1a 那一段，其余字节原样保留
    new_1a = '"1a":' + json.dumps({'id': '1a', 'name': '一年级上册', 'units': units},
                                   ensure_ascii=False, separators=(',', ':'))
    s = raw.index('"1a":')
    e = raw.index('"1b":')
    new_raw = raw[:s] + new_1a + ',' + raw[e:]

    # 复核：其余 11 册解析结果必须与原文完全相等
    n2 = new_raw[new_raw.index('{'):].rstrip().rstrip(';')
    chk = json.loads(n2)
    old = dict(C)
    for k in old:
        if k != '1a':
            assert chk[k] == old[k], '其余册次发生变化：%s' % k

    bak = P + '.bak'
    if not os.path.exists(bak):
        shutil.copy(P, bak)
    open(P, 'w', encoding='utf-8').write(new_raw)

    n = sum(len(u['lessons']) for u in units)
    chars = sum(len(l['chars']) for u in units for l in u['lessons'])
    print('1a 已替换：%d 单元 %d 课 %d 字（官方写字表标注 100 字）' % (len(units), n, chars))
    if chars != 100:
        print('⚠ 字数与官方不符，需复查')


if __name__ == '__main__':
    main()