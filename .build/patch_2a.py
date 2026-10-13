# -*- coding: utf-8 -*-
"""增量修补 data/curriculum.js：
1) 二年级上册 17-20 课生字错位（被填成了 21-24 课的字）→ 按教材原文改正
2) 二年级上册第八单元缺失 21-24 课 → 补齐
其余 11 册、其余课文一律不动。

教材原文出处：.build/raw/y5611942714.html（部编二年级语文上册"写字表"生字组词及笔顺）
"""
import json, re, io, sys

SRC = 'data/curriculum.js'

FIX = {
    '难忘的泼水节': list('忘泼度龙炮穿向令'),
    '古诗二首@7': list('危敢惊阴似野苍茫'),      # 第七单元 18 古诗二首（夜宿山寺 敕勒歌）
    '雾在哪里': list('于论岸屋切久散步'),
    '雪孩子': list('唱赶旺旁浑谁轻汽'),
}
ADD = [                                          # 第八单元
    ('21《狐假虎威》', list('食物眼爷爪神活猪')),
    ('22《狐狸分奶酪》', list('奶始吵仔急咬第公')),
    ('23《纸船和风筝》', list('折纸张祝扎抓但哭')),
    ('24《风娃娃》', list('车得秧苗汗场伤路')),
]


def main():
    raw = open(SRC, encoding='utf-8').read()
    head = raw[:raw.index('{')]                       # 注释 + window.HZ_CURRICULUM=
    body = raw[raw.index('{'): raw.rindex('}') + 1]
    tail = raw[raw.rindex('}') + 1:]
    assert head.rstrip().endswith('window.HZ_CURRICULUM='), '头部格式异常：%r' % head[-40:]
    cur = json.loads(body)

    # 先验证：原样序列化能与原文完全一致（保证只改动目标内容）
    again = json.dumps(cur, ensure_ascii=False, separators=(',', ':'))
    if again != body:
        print('!! 序列化与原文不一致，长度 %d vs %d，终止' % (len(again), len(body)))
        sys.exit(1)
    print('序列化一致性校验通过（%d 字节），可以安全增量修改' % len(body))

    b = cur['2a']
    changed = []

    # 1) 修正 17-20 课生字
    seen_gs2 = 0
    for u in b['units']:
        for l in u['lessons']:
            nm = l['name']
            key = None
            if nm.endswith('难忘的泼水节》') or nm.endswith('难忘的泼水节'):
                key = '难忘的泼水节'
            elif nm.endswith('古诗二首》'):
                seen_gs2 += 1
                if seen_gs2 == 2:
                    key = '古诗二首@7'
            elif nm.endswith('雾在哪里》'):
                key = '雾在哪里'
            elif nm.endswith('雪孩子》'):
                key = '雪孩子'
            if key and l['chars'] != FIX[key]:
                changed.append('修正 %s: %s -> %s' % (l['name'], ''.join(l['chars']), ''.join(FIX[key])))
                l['chars'] = FIX[key]

    # 2) 补第八单元
    u8 = b['units'][-1]
    print('第八单元现有课文数:', len(u8['lessons']), ' 单元名:', u8['name'])
    if not u8['lessons']:
        for i, (name, chars) in enumerate(ADD):
            u8['lessons'].append({
                'id': '2a-%d-%d' % (len(b['units']) - 1, i),
                'name': name, 'chars': chars
            })
            changed.append('新增 %s: %s' % (name, ''.join(chars)))

    out = head + json.dumps(cur, ensure_ascii=False, separators=(',', ':')) + tail
    open(SRC, 'w', encoding='utf-8').write(out)

    print('\n本次改动：')
    for c in changed:
        print('  ' + c)
    n = sum(len(u['lessons']) for u in b['units'])
    cnt = sum(len(l['chars']) for u in b['units'] for l in u['lessons'])
    print('\n二年级上册现有 %d 课 / %d 字' % (n, cnt))


if __name__ == '__main__':
    main()
