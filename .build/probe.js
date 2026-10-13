const fs=require('fs'),path=require('path');
global.window={};
const D='data/strokes';
let all={};
for(const f of fs.readdirSync(D)){
  if(!f.endsWith('.js'))continue;
  const code=fs.readFileSync(path.join(D,f),'utf8');
  const fn=new Function('window', code+'\n;return window.HZ_STROKES;');
  const o=fn(global.window);
  const sem=f.replace('.js','');
  all[sem]=o[sem];
}
fs.writeFileSync('.build/strokes.json', JSON.stringify(all));
let n=0; for(const s in all) n+=Object.keys(all[s]).length;
console.log('总字数', n, '册数', Object.keys(all).length);
const ch='上';
for(const s in all){ if(all[s][ch]){ 
  console.log('册',s,'笔画数',all[s][ch].m.length);
  all[s][ch].m.forEach((pts,i)=>console.log(' 第'+(i+1)+'笔 起',pts[0],'终',pts[pts.length-1]));
}}
