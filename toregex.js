/* Automaton -> Regular Expression (state elimination / GNFA method).
   Load AFTER the main script:  <script src="toregex.js"></script> */
(function(){
const EP=typeof EPS!=='undefined'?EPS:'\u03b5';
const E={s:'\u03b5',t:'e',star:true};
const wrap=x=>'('+x.s+')';
const atom=a=>a===EP?E:{s:a,t:'a'};
function cat(x,y){
  if(!x||!y)return null;
  if(x.t==='e')return y;
  if(y.t==='e')return x;
  return{s:(x.t==='u'?wrap(x):x.s)+(y.t==='u'?wrap(y):y.s),t:'c'};
}
function uni(x,y){
  if(!x)return y;
  if(!y)return x;
  if(x.s===y.s)return x;
  if(x.t==='e'||y.t==='e'){
    const o=x.t==='e'?y:x;
    if(o.star||o.opt)return o;
    return{s:(o.t==='a'?o.s:wrap(o))+'?',t:'a',opt:true};
  }
  return{s:x.s+'|'+y.s,t:'u'};
}
function star(x){
  if(!x||x.t==='e')return E;
  if(x.star)return x;
  return{s:(x.t==='a'&&!x.opt?x.s:wrap(x))+'*',t:'a',star:true};
}

/* m = {mode, alpha, states, start, finals:Set, d:{state:{symbol:[targets]}}} */
function toRegex(m){
  const syms=[...m.alpha,...(m.mode==='NFA'?[EP]:[])];
  const out={};
  m.states.forEach(s=>{
    out[s]=[];
    for(const a of syms)for(const t of(m.d[s]&&m.d[s][a])||[])if(m.states.includes(t))out[s].push([a,t]);
  });
  const fwd=new Set([m.start]),q=[m.start];
  for(let i=0;i<q.length;i++)for(const [,t] of out[q[i]])if(!fwd.has(t)){fwd.add(t);q.push(t)}
  const back=new Set([...m.finals].filter(f=>fwd.has(f))),b=[...back];
  for(let i=0;i<b.length;i++)for(const s of m.states)if(out[s].some(([,t])=>t===b[i])&&fwd.has(s)&&!back.has(s)){back.add(s);b.push(s)}
  const keep=m.states.filter(s=>fwd.has(s)&&back.has(s));
  if(!keep.includes(m.start))return{re:null,steps:[],kept:0,total:m.states.length};

  const S='\u00a7S',F='\u00a7F',R={};
  const get=p=>R[p]||(R[p]={});
  keep.forEach(s=>{
    get(s);
    for(const [a,t] of out[s])if(keep.includes(t))get(s)[t]=uni(get(s)[t],atom(a));
  });
  get(S)[m.start]=E;
  keep.filter(s=>m.finals.has(s)).forEach(f=>{get(f)[F]=uni(get(f)[F],E)});

  let live=[...keep];const steps=[];
  while(live.length){
    let best=null,bs=Infinity;
    for(const x of live){
      const ins=[S,...live].filter(p=>p!==x&&get(p)[x]).length,outs=[...live,F].filter(r=>r!==x&&get(x)[r]).length;
      if(ins*outs<bs){bs=ins*outs;best=x}
    }
    const x=best,loop=get(x)[x],ls=loop?star(loop):E;
    const ins=[S,...live].filter(p=>p!==x&&get(p)[x]),outs=[...live,F].filter(r=>r!==x&&get(x)[r]);
    for(const p of ins)for(const r of outs)get(p)[r]=uni(get(p)[r],cat(cat(get(p)[x],ls),get(x)[r]));
    for(const p of [S,...live])delete get(p)[x];
    delete R[x];
    live=live.filter(y=>y!==x);
    steps.push(`Eliminate ${x}: ${ins.length} in \u00d7 ${outs.length} out`+(loop?`, self-loop ${loop.s}`:''));
  }
  return{re:get(S)[F]||null,steps,kept:keep.length,total:m.states.length};
}
if(typeof module!=='undefined')module.exports={toRegex};
if(typeof document==='undefined'||!document.getElementById||!document.getElementById('mindfa'))return;

/* ---------- UI ---------- */
const row=$('mindfa').parentNode,btn=document.createElement('button');
btn.id='tore';btn.textContent='Automaton \u2192 Regex';row.appendChild(btn);
const box=document.createElement('div');box.id='rx-out';$('toc-out').after(box);
const clear=()=>{box.innerHTML=''};
new MutationObserver(clear).observe($('tbl'),{childList:true});
$('tbl').addEventListener('change',clear);

function verify(re){
  const A=M.alpha;
  if(!A.every(c=>/^[a-z0-9]$/i.test(c)))return'';
  const rx=new RegExp('^(?:'+(re?re.s.replace(/\u03b5/g,'(?:)'):'(?!)')+')$');
  let cur=[''],n=0,bad=0,len=0;
  while(cur.length&&n+cur.length<=4000){
    for(const w of cur){n++;if(simulateWord(w).accepted!==rx.test(w))bad++}
    len++;cur=cur.flatMap(w=>A.map(c=>w+c));
  }
  return bad?`\u26a0 ${bad} mismatch${bad===1?'':'es'} found out of ${n} strings checked.`:`\u2714 Verified against the automaton on all ${n} strings of length \u2264 ${len-1}.`;
}
btn.onclick=()=>{
  const r=toRegex(M),re=r.re,empty=!re,eps=re&&re.t==='e';
  const shown=empty?'\u2205  (no string is accepted)':re.s;
  box.innerHTML=`<div class="algo-out">
    <div class="algo-meta"><b>State Elimination:</b> ${r.kept} of ${r.total} state${r.total===1?'':'s'} used${r.kept<r.total?' (unreachable or dead states pruned)':''}.</div>
    <div id="rx-text" style="font:600 15px ui-monospace,Menlo,monospace;word-break:break-all;padding:10px;background:var(--st);border-radius:8px">${esc(shown)}</div>
    <p class="hint" id="rx-ver">${esc(verify(re))}</p>
    <div class="row" style="margin:8px 0 0">
      <button id="rx-copy">Copy</button>
      ${empty||eps?'':'<button id="rx-build" class="p">Build NFA from this regex</button>'}
    </div>
    <div class="part-box" style="max-height:150px;overflow:auto">${r.steps.map(s=>`<div>${esc(s)}</div>`).join('')}</div>
  </div>`;
  $('rx-copy').onclick=()=>{
    try{navigator.clipboard.writeText(shown).then(()=>{$('rx-copy').textContent='Copied!'})}catch(e){$('rx-copy').textContent='Select & copy manually'}
  };
  const bb=$('rx-build');
  if(bb)bb.onclick=()=>{$('re').value=re.s;$('rb').click()};
};
})();
