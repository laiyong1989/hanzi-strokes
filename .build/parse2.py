import re,html,json
def flat(f):
    s=open('raw/'+f,encoding='utf-8',errors='ignore').read()
    s=re.sub(r'<script.*?</script>','',s,flags=re.S)
    s=re.sub(r'<(br|/p|/div|/td|/tr|/h\d)[^>]*>','\n',s)
    s=re.sub(r'<[^>]+>','',s); s=html.unescape(s)
    return s
CJK=r'[\u4e00-\u9fff]'
for f,label in [('y5611942714.html','2A'),('y5c18634966.html','2B')]:
    t=flat(f)
    # lesson markers: 《name》 or ①name  or 单元
    parts=re.split(r'(《[^》]+》|[①-⑳][\u4e00-\u9fff]{1,8}|第[一二三四五六七八]单元|识字\d|课文\d+)',t)
    out=[];cur=None
    for p in parts:
        if re.match(r'^《.*》$',p) or re.match(r'^[①-⑳]',p) or re.match(r'^第[一二三四五六七八]单元$',p):
            if cur: out.append(cur)
            cur={'name':p,'chars':[]}
        elif cur is not None:
            for ch in re.findall(CJK+r'(?=（)',p):
                if ch not in cur['chars']: cur['chars'].append(ch)
    if cur: out.append(cur)
    print('=====',label)
    tot=0
    for o in out:
        if o['chars']:
            tot+=len(o['chars'])
            print(f"{o['name']} ({len(o['chars'])}): {''.join(o['chars'])}")
    print('TOTAL',tot)
