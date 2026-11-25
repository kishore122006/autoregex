/* AutoRegex Assistant: turns plain-English requests into a DFA/NFA and loads it into the simulator.
   Works offline (rule-based, no API). Load AFTER the main script:  <script src="chatbot.js"></script> */
(function(){
const EP=typeof EPS!=='undefined'?EPS:'\u03b5';
const P=String.raw`\s+(?:the\s+|a\s+)?(?:substring\s+|string\s+|pattern\s+)?['"“”]?([a-z0-9]+)['"“”]?`;
const R={
  not:new RegExp(String.raw`(?:(?:does\s*n['’]?t|do\s*n['’]?t|does\s+not|do\s+not|not)\s+contain|without)`+P),
  ends:new RegExp(String.raw`end(?:s|ing)?\s+(?:with|in)`+P),
  starts:new RegExp(String.raw`(?:start|begin)(?:s|ning)?\s+with`+P),
  has:new RegExp(String.raw`contain(?:s|ing)?`+P),
  len:/length\s+(?:is\s+)?(?:a\s+)?(?:divisible\s+by|multiples?\s+of)\s+(\d+)/,
  par:/(even|odd)\s+(?:number\s+of\s+|count\s+of\s+)?(?:the\s+)?['"“”]?([a-z0-9])['"“”]?/,
  mod:/(?:divisible\s+by|multiples?\s+of)\s+(\d+)/,
  exact:/(?:exactly\s+(\d+)\s+(?:symbols?|characters?|chars?|bits?|letters?)|length\s+(?:is\s+|of\s+|=\s*)?(\d+)\b)/
};
function clause(t){
  let m;
  if(m=t.match(R.not))return{k:'not',p:m[1]};
  if(m=t.match(R.ends))return{k:'ends',p:m[1]};
  if(m=t.match(R.starts))return{k:'starts',p:m[1]};
  if(m=t.match(R.has))return{k:'has',p:m[1]};
  if(m=t.match(R.len))return{k:'len',n:+m[1]};
  if(m=t.match(R.par))return{k:'par',even:m[1]==='even',c:m[2]};
  if(m=t.match(R.mod))return{k:'mod',n:+m[1]};
  if(m=t.match(R.exact))return{k:'exact',n:+(m[1]||m[2])};
  return null;
}
function alphabet(specs,text){
  if(specs.some(s=>s.k==='mod'))return['0','1'];
  const S=new Set();
  specs.forEach(s=>{for(const c of(s.p||s.c||''))S.add(c)});
  const m=text.match(/(?:alphabet|over|sigma|σ)\s*(?:=|is|of|:)?\s*\{?\s*([a-z0-9](?:\s*,\s*[a-z0-9])*)\s*\}?/);
  if(m)m[1].split(/\s*,\s*/).forEach(c=>S.add(c));
  const hasD=[...S].some(c=>/\d/.test(c)),hasL=[...S].some(c=>/[a-z]/.test(c)),bin=/binary|bit/.test(text);
  if(hasD||(!hasL&&bin)){S.add('0');S.add('1')}
  if(hasL||(!hasD&&!bin)){S.add('a');S.add('b')}
  const A=[...S].sort();
  if(A.length>8)throw Error('Too many different symbols (max 8).');
  return A;
}
function nextKmp(p,i,c){
  const s=p.slice(0,i)+c;
  for(let j=Math.min(p.length,s.length);j>0;j--)if(p.slice(0,j)===s.slice(s.length-j))return j;
  return 0;
}
function build(s,A){
  const k=s.p?s.p.length:0,mk=(n,f)=>({n,t:[...Array(n)].map(()=>({})),fin:new Set(f)});
  let d;
  if(s.p&&k>14)throw Error('Pattern is too long (max 14 symbols).');
  if(s.n!==undefined&&(s.n<(s.k==='len'?1:2)&&s.k!=='exact'||s.n>24))throw Error('Number must be between 2 and 24.');
  switch(s.k){
    case'ends':case'has':case'not':
      d=mk(k+1,s.k==='not'?[...Array(k).keys()]:[k]);
      for(let i=0;i<=k;i++)for(const c of A)d.t[i][c]=(s.k!=='ends'&&i===k)?k:nextKmp(s.p,i,c);
      break;
    case'starts':
      d=mk(k+2,[k]);
      for(let i=0;i<=k+1;i++)for(const c of A)d.t[i][c]=i===k?k:i===k+1?k+1:(s.p[i]===c?i+1:k+1);
      break;
    case'par':
      d=mk(2,[s.even?0:1]);
      for(let i=0;i<2;i++)for(const c of A)d.t[i][c]=c===s.c?1-i:i;
      break;
    case'mod':
      d=mk(s.n,[0]);
      for(let r=0;r<s.n;r++){d.t[r]['0']=(2*r)%s.n;d.t[r]['1']=(2*r+1)%s.n}
      break;
    case'len':
      d=mk(s.n,[0]);
      for(let i=0;i<s.n;i++)for(const c of A)d.t[i][c]=(i+1)%s.n;
      break;
    case'exact':
      d=mk(s.n+2,[s.n]);
      for(let i=0;i<s.n+2;i++)for(const c of A)d.t[i][c]=Math.min(i+1,s.n+1);
      break;
  }
  return d;
}
function product(a,b,op,A){
  const id=new Map([['0,0',0]]),q=[[0,0]],t=[];
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];t[i]={};
    for(const c of A){
      const nx=a.t[x][c],ny=b.t[y][c],key=nx+','+ny;
      if(!id.has(key)){id.set(key,q.length);q.push([nx,ny])}
      t[i][c]=id.get(key);
    }
  }
  const fin=new Set();
  q.forEach(([x,y],i)=>{if(op==='and'?(a.fin.has(x)&&b.fin.has(y)):(a.fin.has(x)||b.fin.has(y)))fin.add(i)});
  return{n:q.length,t,fin};
}
function dfaToM(d,A){
  const st=[...Array(d.n).keys()].map(i=>'q'+i),dd={};
  st.forEach((s,i)=>{dd[s]={};A.forEach(c=>{dd[s][c]=['q'+d.t[i][c]]})});
  return{mode:'DFA',alpha:A,states:st,start:'q0',finals:new Set([...d.fin].map(i=>'q'+i)),d:dd};
}
function nfaOf(s,A){
  const k=s.p.length,st=[...Array(k+1).keys()].map(i=>'q'+i),d={};
  st.forEach(x=>d[x]={});
  const add=(x,c,y)=>{(d['q'+x][c]=d['q'+x][c]||[]).push('q'+y)};
  if(s.k!=='starts')A.forEach(c=>add(0,c,0));
  for(let i=0;i<k;i++)add(i,s.p[i],i+1);
  if(s.k!=='ends')A.forEach(c=>add(k,c,k));
  return{mode:'NFA',alpha:A,states:st,start:'q0',finals:new Set(['q'+k]),d};
}
const dsc=s=>({ends:`ending with ${s.p}`,starts:`starting with ${s.p}`,has:`containing ${s.p}`,not:`not containing ${s.p}`,
  par:`${s.even?'even':'odd'} number of ${s.c}\u2019s`,mod:`binary numbers divisible by ${s.n}`,len:`length divisible by ${s.n}`,exact:`length exactly ${s.n}`}[s.k]);

/* returns {m, desc, fb} or null when the request is not understood */
function handle(raw){
  const text=raw.toLowerCase().trim();
  let rx=raw.match(/(?:regex|regexp|regular expression)\s*[:=]?\s*(\S+)/i);
  if(!rx&&/^[a-z0-9()|*+?]+$/i.test(raw.trim())&&/[|*+?()]/.test(raw))rx=[0,raw.trim()];
  if(rx){const m=regexToNFA(rx[1]);return{m,desc:'regex '+rx[1],fb:''}}
  let specs=null,op='and';
  const parts=text.split(/\s+(and|or)\s+/);
  if(parts.length===3){const a=clause(parts[0]),b=clause(parts[2]);if(a&&b){specs=[a,b];op=parts[1]}}
  if(!specs){const a=clause(text);if(a)specs=[a]}
  if(!specs)return null;
  const A=alphabet(specs,text),ds=specs.map(s=>build(s,A));
  const desc=specs.map(dsc).join(` ${op.toUpperCase()} `);
  const fb=specs[0].p||'';
  if(specs.length===1&&/\bnfa\b/.test(text)&&['ends','has','starts'].includes(specs[0].k))
    return{m:nfaOf(specs[0],A),desc,fb};
  const d=specs.length===2?product(ds[0],ds[1],op,A):ds[0];
  if(d.n>40)throw Error('That would need '+d.n+' states, too many to draw.');
  return{m:dfaToM(d,A),desc,fb};
}
if(typeof module!=='undefined')module.exports={handle};
if(typeof document==='undefined'||!document.getElementById||!document.getElementById('g'))return;

/* ---------- apply to simulator ---------- */
function samples(fb){
  const A=M.alpha,acc=[],rej=[];
  let cur=[''];
  while(cur.length&&cur.length<=6000&&!(acc.length>=4&&rej.length>=4)){
    for(const s of cur)(simulateWord(s).accepted?acc:rej).push(s);
    cur=cur.flatMap(s=>A.map(c=>s+c));
  }
  const pick=(a,n)=>[...new Set([a[0],a[a.length>>1],a[a.length-1]].slice(0,n).filter(x=>x!==undefined))];
  const tests=[...pick(acc.slice(0,6),3),...pick(rej.slice(-6),3)];
  if(!acc.length&&fb)tests.unshift(fb);
  return{tests,inp:acc[0]!==undefined?acc[0]:fb};
}
function apply(m,fb){
  M=m;POS={};LAYOUT=m.states.length>6?'lr':'circle';$('lay').value=LAYOUT;
  builtAutomaton=null;$('toc-out').innerHTML='';$('toc-err').textContent='';
  fullRender();
  const sm=samples(fb);
  testCases=sm.tests;$('inp').value=sm.inp;
  resetSim();runSuite();
}

/* ---------- chat widget ---------- */
const css=`#cbT{position:fixed;right:16px;bottom:16px;z-index:50;background:var(--ac);color:#fff;border:0;border-radius:999px;padding:11px 18px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer}
#cbP{position:fixed;right:16px;bottom:16px;z-index:51;width:min(370px,calc(100vw - 32px));height:min(520px,calc(100vh - 32px));display:flex;flex-direction:column;background:var(--card);border:1px solid var(--bd);border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.3);overflow:hidden}
#cbP[hidden]{display:none}
#cbP header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--ac);color:#fff;font-weight:700}
#cbP header button{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;padding:0 4px}
#cbM{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
#cbM div{max-width:88%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap}
#cbM .b{background:var(--st);align-self:flex-start;border-bottom-left-radius:3px}
#cbM .u{background:var(--ac);color:#fff;align-self:flex-end;border-bottom-right-radius:3px}
#cbC{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
#cbC button{font-size:12px;padding:4px 9px;border-radius:999px}
#cbF{display:flex;gap:6px;padding:10px;border-top:1px solid var(--bd)}
#cbF input{flex:1;min-width:0}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const root=document.createElement('div');
root.innerHTML=`<button id="cbT">💬 AI Builder</button>
<div id="cbP" hidden><header><span>AutoRegex Assistant</span><button id="cbX" aria-label="Close">✕</button></header>
<div id="cbM"></div><div id="cbC"></div>
<div id="cbF"><input type="text" id="cbI" placeholder="e.g. strings ending with 0000101" autocomplete="off"><button id="cbS" class="p">Send</button></div></div>`;
document.body.appendChild(root);
const $$=id=>document.getElementById(id);
const say=(t,c)=>{const d=document.createElement('div');d.className=c;d.textContent=t;$$('cbM').appendChild(d);$$('cbM').scrollTop=1e6};
const EX=['ends with 0000101','starts with 1 and ends with 0','contains 101 as NFA','binary divisible by 5','even number of a\u2019s and even number of b\u2019s','does not contain 11','regex (a|b)*abb'];
EX.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>send(t);$$('cbC').appendChild(b)});
say('Hi! Describe a language in plain English and I will build the DFA or NFA and draw it. Tap an example or type your own.','b');
function send(t){
  t=(t||$$('cbI').value).trim();if(!t)return;
  $$('cbI').value='';say(t,'u');
  try{
    const r=handle(t);
    if(!r){say('I did not understand that. I can build things like:\n• ends with / starts with / contains 0101\n• does not contain 11\n• even / odd number of a\u2019s\n• binary divisible by 3\n• length multiple of 4, or exactly 5 symbols\n• combine two with AND / OR\n• add "as NFA" for ends/starts/contains\n• regex (a|b)*abb','b');return}
    apply(r.m,r.fb);
    say(`Built a ${r.m.mode} with ${r.m.states.length} states for: ${r.desc}\nAlphabet \u03a3 = {${r.m.alpha.join(', ')}}. It is now in the graph, and I filled the test suite and string box. Press Next Step \u25b6 to trace it.`+(r.m.states.length>6?'\nTip: drag states to tidy the layout.':''),'b');
    $$('g').scrollIntoView({behavior:'smooth',block:'center'});
    if(innerWidth<700)setTimeout(()=>{$$('cbP').hidden=true;$$('cbT').hidden=false},900);
  }catch(e){say('Sorry: '+e.message,'b')}
}
$$('cbS').onclick=()=>send();
$$('cbI').onkeydown=e=>{if(e.key==='Enter')send()};
$$('cbT').onclick=()=>{$$('cbP').hidden=false;$$('cbT').hidden=true;$$('cbI').focus()};
$$('cbX').onclick=()=>{$$('cbP').hidden=true;$$('cbT').hidden=false};
})();
