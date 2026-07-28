const C={r:'紅',y:'黃',b:'藍',w:'白',u:'紫',p:'粉',k:'岩',i:'冰'};
const KEY='pikmin-bloom-collection-v5';
let data=[],state,filter='all',query='',expanded=new Set();

const items=codes=>codes.map((code,index,arr)=>({id:`${code}-${index+1}`,label:arr.filter(x=>x===code).length>1?`${C[code]} ${arr.slice(0,index+1).filter(x=>x===code).length}`:C[code]}));
const slug=s=>Array.from(s).map(c=>c.codePointAt(0).toString(16)).join('-');

async function loadData(){
  const [setsResponse,decorResponse]=await Promise.all([fetch('data/sets.json'),fetch('data/decor.json')]);
  if(!setsResponse.ok||!decorResponse.ok)throw new Error('圖鑑資料載入失敗');
  const [sets,{categories}]=await Promise.all([setsResponse.json(),decorResponse.json()]);
  data=categories.map(category=>({
    ...category,
    series:category.series.map(series=>({
      ...series,
      rare:Boolean(series.rare),
      items:items(sets[series.set]||series.codes||[])
    }))
  }));
  data.forEach(c=>{c.id='c-'+slug(c.name);c.series.forEach((s,n)=>{s.id=`${c.id}-s${n+1}`})});
}

function blank(){const o={};data.forEach(c=>c.series.forEach(s=>s.items.forEach(i=>o[`${s.id}-${i.id}`]=false)));return o}
function load(){
  try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.checked)return v}catch(e){}
  const checked=blank();
  try{
    const old=JSON.parse(localStorage.getItem('pikmin-bloom-collection-v4'));
    if(old?.items){data.forEach(c=>{const ov=old.items[c.id];if(!ov)return;c.series.forEach((s,si)=>s.items.forEach(i=>{const color=i.id.split('-')[0],source=si===0?ov.types:ov.rareTypes;if(source&&source[color]!==undefined)checked[`${s.id}-${i.id}`]=Boolean(source[color])}))})}
  }catch(e){}
  return{checked,updatedAt:Date.now()}
}
function save(){state.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(state));renderDashboard();renderFilters();document.getElementById('updatedAt').textContent=new Date(state.updatedAt).toLocaleString('zh-TW');toast()}
const inLocationGroup=c=>c.group==='regular'||c.group==='weather';
const counts=predicate=>{let total=0,done=0;data.filter(c=>!predicate||predicate(c)).forEach(c=>c.series.forEach(s=>s.items.forEach(i=>{total++;if(state.checked[`${s.id}-${i.id}`])done++})));return{done,total,p:total?Math.round(done/total*100):0}};
const progressColor=p=>p<40?'var(--progress-low)':p<70?'var(--progress-mid)':'var(--progress-high)';
function renderDashboard(){
  const all=counts(),location=counts(inLocationGroup),limited=counts(c=>c.group==='limited');
  document.getElementById('dashboard').innerHTML=[['全部',all],['地點 Decor',location],['特殊 Decor',limited]].map(([name,x])=>`<article class="stat"><div class="stat-label">${name}</div><div class="stat-percent">${x.p}%</div><div class="bar"><div style="width:${x.p}%;background:${progressColor(x.p)}"></div></div></article>`).join('')
}
function doneOfSeries(s){return s.items.filter(i=>state.checked[`${s.id}-${i.id}`]).length}
function doneOfCategory(c){return c.series.reduce((n,s)=>n+doneOfSeries(s),0)}
function totalOfCategory(c){return c.series.reduce((n,s)=>n+s.items.length,0)}
function categoryComplete(c){return doneOfCategory(c)===totalOfCategory(c)}
function regularComplete(c){const normal=c.series.filter(s=>!s.rare);return normal.every(s=>doneOfSeries(s)===s.items.length)}
function match(c){
  const text=[c.name,...c.series.map(s=>s.name),...c.series.flatMap(s=>s.items.map(i=>i.label))].join(' ').toLowerCase();
  if(query&&!text.includes(query))return false;
  if(filter==='location'&&!inLocationGroup(c))return false;
  if(filter==='limited'&&c.group!=='limited')return false;
  if(filter==='rare'&&!c.series.some(s=>s.rare))return false;
  if(filter==='unfinished'&&categoryComplete(c))return false;
  if(filter==='done'&&!categoryComplete(c))return false;
  return true
}
function render(){
  const list=document.getElementById('list'),visible=data.filter(match);
  list.innerHTML=visible.map(c=>{
    const d=doneOfCategory(c),t=totalOfCategory(c),p=t?Math.round(d/t*100):0,rareSeries=c.series.filter(s=>s.rare),normalSeries=c.series.filter(s=>!s.rare),shownSeries=regularComplete(c)?[...rareSeries,...normalSeries]:normalSeries,meta=c.group==='limited'?'':c.group==='weather'?'<span>天氣</span>':`<span>${normalSeries.length}種飾品${rareSeries.length?'・<span class="rare-note">稀有飾品</span>':''}</span>`,isOpen=expanded.has(c.id),badge=d===t?`<span style="color:${progressColor(p)}">✔️</span>`:`<span style="color:${progressColor(p)}">${d}</span><span style="color:var(--text)"> / ${t}</span>`;
    return `<article class="category ${isOpen?'':'collapsed'}" data-category="${c.id}"><button class="category-toggle" type="button" data-toggle="${c.id}" aria-expanded="${isOpen}"><div class="category-main"><div class="category-title">${c.icon} ${c.name}</div>${meta?`<div class="category-meta">${meta}</div>`:''}</div><span class="badge">${badge}</span></button><div class="series-list">${shownSeries.map(s=>{const sd=doneOfSeries(s),st=s.items.length,hideSeriesLabel=c.group==='limited';return `<section class="series ${s.rare?'rare':''}"><div class="series-row">${hideSeriesLabel?'':`<div class="series-head"><div class="series-name">${s.name}</div><div class="series-count">${sd} / ${st}</div></div>`}<div class="pikmin-grid">${s.items.map(i=>{const key=`${s.id}-${i.id}`,color=i.id.split('-')[0];return `<div class="pick color-${color}"><input type="checkbox" id="${key}" data-key="${key}" ${state.checked[key]?'checked':''}><label for="${key}">${i.label}</label></div>`}).join('')}</div></div><div class="series-bar"><div style="width:${st?sd/st*100:0}%"></div></div></section>`}).join('')}</div></article>`
  }).join('')||'<div class="empty">找不到符合條件的裝飾系列。</div>';
  list.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.toggle;expanded.has(id)?expanded.delete(id):expanded.add(id);render()}));
  list.querySelectorAll('input[data-key]').forEach(el=>el.addEventListener('change',e=>{state.checked[e.target.dataset.key]=e.target.checked;save();render()}))
}
function filterCount(id){if(id==='all')return data.length;if(id==='unfinished')return data.filter(c=>!categoryComplete(c)).length;if(id==='done')return data.filter(categoryComplete).length;if(id==='location')return data.filter(inLocationGroup).length;if(id==='limited')return data.filter(c=>c.group==='limited').length;if(id==='rare')return data.filter(c=>c.series.some(s=>s.rare)).length;return 0}
function renderFilters(){const defs=[['all','全部'],['unfinished','未完成'],['done','已完成'],['location','地點 Decor'],['rare','稀有 Decor'],['limited','特殊 Decor']];document.getElementById('filters').innerHTML=defs.map(([id,label])=>`<button class="filter ${filter===id?'active':''}" data-filter="${id}">${label} (${filterCount(id)})</button>`).join('');document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderFilters();render()})}
function toast(){const t=document.getElementById('toast');t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),900)}
function showLoadError(error){console.error(error);document.getElementById('list').innerHTML='<div class="empty">圖鑑資料載入失敗，請重新整理頁面。</div>'}
async function init(){
  try{
    await loadData();state=load();
    document.getElementById('search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render()});
    document.getElementById('reset').onclick=()=>{if(confirm('確定要清除所有圖鑑進度？')){state={checked:blank(),updatedAt:Date.now()};save();render()}};
    renderDashboard();renderFilters();render();document.getElementById('updatedAt').textContent=new Date(state.updatedAt).toLocaleString('zh-TW');
  }catch(error){showLoadError(error)}
}
init();
