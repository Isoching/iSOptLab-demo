import {predictModel,withinTrainingBounds} from './inference.js';
import {messages} from './i18n.js';

const app=document.getElementById('app');
let lang=localStorage.getItem('isoptlab-demo-language')||(navigator.language.startsWith('zh')?'zh':'en');
if(!messages[lang])lang='en';
let catalog,models,renderNumber=0;
const values={},histories={},comparisonSets={},comparisonResponses={},surfaceResponses={},surfaceCache=new Map();
const t=key=>messages[lang][key]||key;
const l=value=>typeof value==='object'?value[lang]||value.en:value;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v,d=6)=>!Number.isFinite(v)?'—':Math.abs(v)>0&&(Math.abs(v)<.0001||Math.abs(v)>=1e6)?v.toExponential(3):v.toLocaleString('en-GB',{maximumSignificantDigits:d});
const route=(c,view='overview',m='')=>`#/case/${c}/${view}${m?'/'+m:''}`;
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({archive:'<path d="M3 7h18v13H3zM2 3h20v4H2zM9 11h6"/>',overview:'<path d="M3 10l9-7 9 7v11H3zM9 21v-8h6v8"/>',models:'<path d="M4 4h16v16H4zM4 10h16M10 10v10"/>',compare:'<path d="M4 20V9h4v11M10 20V4h4v16M16 20v-7h4v7"/>',predict:'<path d="M3 20h18M5 17l5-9 5 5 5-10"/><circle cx="10" cy="8" r="1.5"/><circle cx="15" cy="13" r="1.5"/>',arrow:'<path d="M4 12h15M13 6l6 6-6 6"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 16v5h16v-5"/>',check:'<path d="M5 12l4 4L20 5"/>'})[name]||''}</svg>`;
const button=(label,action,primary=false,extra='')=>`<button class="btn ${primary?'primary':''}" data-action="${action}" ${extra}>${action.includes('download')?icon('download'):''}${esc(label)}</button>`;
const link=(label,url,primary=false)=>`<a class="btn ${primary?'primary':''}" href="${url}">${esc(label)}${icon('arrow')}</a>`;
const tag=(label,style='')=>`<span class="tag ${style}">${esc(label)}</span>`;
function current(){
  const parts=location.hash.replace(/^#\/?/,'').split('/');
  const c=parts[0]==='case'?catalog.cases.find(c=>c.id===parts[1]):null;
  const view=['overview','models','compare','predict'].includes(parts[2])?parts[2]:'overview';
  const model=c?(models.find(m=>m.id===parts[3]&&m.caseId===c.id)||models.find(m=>m.id===c.defaultModel)):null;
  return {c,view,model};
}
function sidebar(c,view,model){
  const item=(key,name,url)=>`<a class="nav-item ${c&&view===key?'active':''}" href="${url}">${icon(key)}${esc(name)}</a>`;
  return `<aside class="sidebar"><a class="brand" href="#archive"><img src="./favicon.svg" alt=""><b>iSOptLab</b></a><div class="brand-sub">${esc(t('gallery'))}</div><nav aria-label="${esc(t('workspace'))}"><div class="nav-label">${esc(t('workspace'))}</div><a class="nav-item ${c?'':'active'}" href="#archive">${icon('archive')}${esc(t('archive'))}</a>${c?`<div class="nav-case"><small>SELECTED CASE</small><strong>${esc(l(c.title))}</strong></div><div class="nav-label">${esc(t('design'))}</div>${item('overview',t('overview'),route(c.id,'overview',model.id))}<div class="nav-label">${esc(t('modelling'))}</div>${item('models',t('models'),route(c.id,'models',model.id))}${models.filter(m=>m.caseId===c.id).map(m=>`<a class="nav-model ${view==='models'&&m.id===model.id?'active':''}" href="${route(c.id,'models',m.id)}">${esc(m.label)} <span>· ${m.trainRows} ${lang==='zh'?'训练点':'train'}</span></a>`).join('')}${item('compare',t('compare'),route(c.id,'compare',model.id))}<div class="nav-label">${esc(t('analysis'))}</div>${item('predict',t('predict'),route(c.id,'predict',model.id))}`:''}</nav><div class="side-foot"><span class="dot"></span>${esc(t('local'))}<p>iSOptLab · ${catalog.release}<br>${esc(t('public'))}</p></div></aside>`;
}
function shell(body,c,view,model){
  return `<div class="shell">${sidebar(c,view,model)}<div class="content"><header class="topbar"><div class="breadcrumb"><a href="#archive">${esc(t('archive'))}</a>${c?`<span>/</span><span>${esc(l(c.title))}</span>`:''}</div><div class="top-actions"><span class="public"><i class="dot"></i>${esc(t('public'))}</span><button class="lang" data-action="language">${lang==='zh'?'EN':'中文'}</button><a class="source-link" href="https://github.com/Isoching/iSOptLab-demo" target="_blank" rel="noopener">GitHub ↗</a></div></header><main id="main">${body}</main><footer class="footer"><span>iSOptLab · ${esc(t('footer'))}</span><span>${esc(t('footerRight'))} · <a href="./data/validation.json" target="_blank" rel="noopener">${esc(t('evidence'))} ↗</a></span></footer></div></div>`;
}
function palette(value){
  const stops=[[229,241,237],[152,201,184],[64,126,131],[25,60,88]];
  const p=Math.max(0,Math.min(.999999,value))*3,i=Math.floor(p),f=p-i;
  return stops[i].map((v,j)=>Math.round(v+(stops[i+1][j]-v)*f));
}
function thumbnail(c,hero=false){
  const model=models.find(m=>m.id===c.defaultModel),nx=hero?29:24,ny=18;
  const values=[];
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)values.push(predictModel(model,[c.inputs[0].min+x/(nx-1)*(c.inputs[0].max-c.inputs[0].min),c.inputs[1].max-y/(ny-1)*(c.inputs[1].max-c.inputs[1].min)])[c.outputs[0].name]);
  const min=Math.min(...values),max=Math.max(...values);
  return `<svg viewBox="0 0 500 280" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(l(c.title))} · ${esc(t('surface'))}"><rect width="500" height="280" fill="#e9f0f1"/>${values.map((v,i)=>`<rect x="${(i%nx)*500/nx}" y="${Math.floor(i/nx)*280/ny}" width="${500/nx+.5}" height="${280/ny+.5}" fill="rgb(${palette((v-min)/(max-min||1)).join(',')})"/>`).join('')}<g fill="none" stroke="white" stroke-opacity=".3" stroke-width=".7">${[1,2,3,4].map(i=>`<path d="M0 ${i*56}H500M${i*100} 0V280"/>`).join('')}</g><circle cx="250" cy="140" r="5" fill="white" stroke="#173c50" stroke-width="2"/><path d="M250 118v44M228 140h44" stroke="white" stroke-width="1"/></svg>`;
}
function archive(){
  return `<section class="hero"><div><div class="eyebrow">iSOptLab / PUBLIC MODEL GALLERY</div><h1>${t('hero')}</h1><p>${esc(t('intro'))}</p><div class="hero-stats"><span><strong>02</strong>${esc(t('cases'))}</span><span><strong>07</strong>${esc(t('savedModels'))}</span><span><strong>100%</strong>${esc(t('local'))}</span></div></div><div class="hero-art">${thumbnail(catalog.cases[1],true)}<div class="art-caption">Peaks · GPR · ${esc(t('snapshot'))}</div></div></section><section><div class="section-title"><h2>${esc(t('chooseCase'))}</h2><small>${esc(t('chooseHelp'))}</small></div><div class="case-grid">${catalog.cases.map((c,index)=>`<article class="case-card"><div class="case-visual">${thumbnail(c)}<span class="case-number">CASE 0${index+1} / ${c.id==='cstr'?'PROCESS':'BENCHMARK'}</span></div><div class="case-card-body">${tag(l(c.category))}<h3>${esc(l(c.title))}</h3><p>${esc(l(c.subtitle))}</p><div class="case-meta"><span><b>${models.filter(m=>m.caseId===c.id).length}</b>${esc(t('modelCount'))}</span><span><b>${c.outputs.length}</b>${esc(t('responseCount'))}</span><span><b>${c.protocols.length}</b>${esc(t('protocols'))}</span></div><div class="actions">${link(t('openCase'),route(c.id),true)}${link(t('tryModel'),route(c.id,'predict'))}</div></div></article>`).join('')}</div></section><section class="archive-note">${[1,2,3].map(i=>`<div><strong>0${i} / ${esc(t('why'+i))}</strong><p>${esc(t('why'+i+'Text'))}</p></div>`).join('')}</section>`;
}
function heading(c,title,help){return `<div class="page-heading"><div><span class="eyebrow">${esc(l(c.title))}</span><h1>${esc(title)}</h1><p>${esc(help)}</p></div>${tag(t('snapshot'),'green')}</div>`;}
function caseStrip(c,model){
  const p=c.protocols.find(p=>p.id===model.protocol);
  return `<div class="case-strip"><span>${esc(t('protocol'))} <strong>${esc(l(p.label))}</strong></span><span>${esc(t('train'))} <strong>${p.counts[0]}</strong></span><span>${esc(t('validation'))} <strong>${p.counts[1]}</strong></span><span>${esc(t('test'))} <strong>${p.counts[2]}</strong></span>${tag(model.label)}</div>`;
}
function overview(c,model){
  return heading(c,t('overview'),l(c.subtitle))+caseStrip(c,model)+`<div class="grid2"><section class="panel"><div class="panel-head"><h2>${esc(t('caseData'))}</h2>${tag(c.id==='cstr'?'gPROMS':'Peaks')}</div><div class="panel-body"><p class="description">${esc(l(c.description))}</p><div class="protocol-row"><strong>${esc(t('source'))}</strong><small>${esc(t(c.id==='cstr'?'cstrSource':'peaksSource'))}</small></div><div class="steps">${['observe','fit','freeze','review'].map((key,i)=>`<div class="step"><span>0${i+1}</span>${esc(t(key))}</div>`).join('')}</div><div class="note">${esc(l(c.note))}</div><div class="actions">${link(t('tryModel'),route(c.id,'predict',model.id),true)}${button(t('downloadCase'),'download-case')}</div></div></section><section class="panel"><div class="panel-head"><h2>${esc(t('split'))}</h2><small>${c.protocols.length} ${esc(t('protocols'))}</small></div><div class="panel-body">${c.protocols.map(p=>`<div class="protocol-row" style="display:block"><strong>${esc(l(p.label))}</strong><div class="split">${p.counts.map(n=>`<i style="width:${n/p.counts.reduce((a,b)=>a+b,0)*100}%"></i>`).join('')}</div><div class="split-legend">${p.counts.map((n,i)=>`<span>${esc(t(['train','validation','test'][i]))} <b>${n}</b></span>`).join('')}</div></div>`).join('')}<p>${esc(t('protocolNote'))}</p></div></section></div><section class="panel mt"><div class="panel-head"><h2>${esc(t('inputs'))}</h2><small>${esc(t('scope'))}</small></div><div class="table-wrap"><table><thead><tr><th>${esc(t('inputs'))}</th><th>${esc(t('range'))}</th><th>${esc(t('unit'))}</th></tr></thead><tbody>${c.inputs.map(v=>`<tr><td><strong>${esc(l(v.label))}</strong><br><span class="subtle">${v.name}</span></td><td>${v.min} – ${v.max}</td><td>${esc(v.unit||'—')}</td></tr>`).join('')}</tbody></table></div></section><section class="panel mt"><div class="panel-head"><h2>${esc(t('outputs'))}</h2></div><div class="panel-body"><div class="result-grid ${c.outputs.length===1?'single':''}">${c.outputs.map(v=>`<div class="result-item"><small>${esc(l(v.label))}</small><strong>${v.unit==='K'?'T':v.unit==='kg/kg'?'w':'z'}</strong><span>${esc(v.unit||'—')}</span></div>`).join('')}</div><div class="actions">${link(t('readEvidence'),route(c.id,'compare',model.id))}</div></div></section>`;
}
function modelsPage(c,selected){
  const target=c.outputs[0].name;
  return heading(c,t('modelDirectory'),t('directoryHelp'))+c.protocols.map(p=>`<section class="panel mt"><div class="panel-head"><h2>${esc(l(p.label))}</h2><small>${esc(t('snapshot'))}</small></div><div class="table-wrap"><table><thead><tr><th>${esc(t('model'))}</th><th>${esc(t('rows'))}</th><th>${esc(t('cv'))} · ${esc(l(c.outputs[0].label))}</th><th></th></tr></thead><tbody>${models.filter(m=>m.caseId===c.id&&m.protocol===p.id).map(m=>`<tr class="model-row ${m.id===selected.id?'selected':''}"><td><a href="${route(c.id,'models',m.id)}"><strong>${esc(m.label)}</strong></a>${m.family==='p12'?' '+tag(t('boundary'),'amber'):''}</td><td>${m.trainRows}</td><td>${number(m.cv[target])}</td><td><a href="${route(c.id,'predict',m.id)}">${esc(t('tryModel'))} →</a></td></tr>`).join('')}</tbody></table></div></section>`).join('')+`<section class="panel mt" id="model-detail"><div class="panel-head"><h2>${esc(t('modelDetails'))}</h2>${tag(l(c.protocols.find(p=>p.id===selected.protocol).label))}</div><div class="panel-body"><div class="model-description"><div class="model-badge">${selected.family==='gpr'?'GP':selected.family==='ann'?'NN':selected.family==='p12'?'P¹²':'P⁵'}</div><div><h2>${esc(selected.label)}</h2><p>${esc(t('pointOnly'))}</p></div></div><div class="metrics"><div class="metric"><small>${esc(t('rows'))}</small><strong>${selected.trainRows}</strong><span>${esc(t('snapshot'))}</span></div><div class="metric"><small>${esc(t('cv'))}</small><strong>${number(selected.cv[target])}</strong><span>${esc(l(c.outputs[0].label))}</span></div><div class="metric"><small>${esc(t('outputs'))}</small><strong>${c.outputs.length}</strong><span>${esc(t('unitsOriginal'))}</span></div></div><p class="mt">${esc(t('modelHash'))}</p><div class="hash">SHA-256 ${selected.sourceSha256}</div><p>${esc(t('fileHashNote'))}</p><div class="actions">${link(t('goPredict'),route(c.id,'predict',selected.id),true)}${button(t('downloadModel'),'download-model')}</div></div></section>`;
}
function comparisonContext(c){
  const set=c.comparisonSets.find(s=>s.id===comparisonSets[c.id])||c.comparisonSets[0];
  const target=c.outputs.find(o=>o.name===comparisonResponses[c.id])||c.outputs[0];
  const rows=set.models.map(id=>models.find(m=>m.id===id));
  return {set,target,rows};
}
function comparePage(c,model){
  const {set,target,rows}=comparisonContext(c),errors=rows.map(m=>m.metrics[set.id][target.name].rmse),max=Math.max(...errors),min=Math.min(...errors),log=max/min>100;
  return heading(c,t('comparison'),t('comparisonHelp'))+`<div class="controls"><div class="field"><label for="comparison-set">${esc(t('assessmentSet'))}</label><select id="comparison-set">${c.comparisonSets.map(s=>`<option value="${s.id}" ${s.id===set.id?'selected':''}>${esc(l(s.label))}</option>`).join('')}</select></div><div class="field"><label for="comparison-response">${esc(t('response'))}</label><select id="comparison-response">${c.outputs.map(o=>`<option value="${o.name}" ${o.name===target.name?'selected':''}>${esc(l(o.label))} ${esc(o.unit)}</option>`).join('')}</select></div></div><section class="panel"><div class="panel-head"><h2>${esc(t('chartTitle'))}</h2><small>${esc(t('smaller'))}</small></div><div class="panel-body"><div class="chart-bars">${rows.map((m,i)=>`<div><div class="bar-label"><span>${esc(m.label)}${m.id.endsWith('refined')?' · '+esc(t('refined')):''}</span><strong>${number(errors[i])} ${esc(target.unit)}</strong></div><div class="bar-track"><div class="bar-fill ${m.id===c.defaultModel||m.family==='p5'?'selected':''}" style="width:${(log?(Math.log10(errors[i]/min)+1)/(Math.log10(max/min)+1):errors[i]/max)*100}%"></div></div></div>`).join('')}</div><div class="chart-caption">${esc(t(log?'log':'linear'))} · ${esc(l(set.label))}</div></div><div class="table-wrap"><table><thead><tr><th>${esc(t('model'))}</th><th>${esc(t('rows'))}</th><th>${esc(t('cv'))}</th><th>${esc(t('independentRMSE'))}</th><th>${esc(t('independentR2'))}</th>${c.id==='peaks'?`<th>${esc(t('noisyR2'))}</th>`:''}</tr></thead><tbody>${rows.map(m=>{const v=m.metrics[set.id][target.name];return `<tr><td><strong>${esc(m.label)}</strong>${m.id.endsWith('refined')?'<br>'+tag(t('refined'),'green'):''}</td><td>${m.trainRows}</td><td>${number(m.cv[target.name])}</td><td>${number(v.rmse)}</td><td>${number(v.r2,8)}</td>${c.id==='peaks'?`<td>${number(v.noisy_r2,8)}</td>`:''}</tr>`}).join('')}</tbody></table></div><div class="panel-body"><div class="note">${esc(t(set.id==='refined'?'differentTraining':'chosenBefore'))}</div><div class="actions">${button(t('downloadComparison'),'download-comparison')}${link(t('tryModel'),route(c.id,'predict',model.id),true)}</div></div></section>${c.id==='cstr'?solverEvidence():''}`;
}
function solverEvidence(){
  const labels={gekko_apopt:'GEKKO / APOPT',de_local:'DE + SLSQP',gekko_ipopt:'GEKKO / IPOPT',gekko_bpopt:'GEKKO / BPOPT'};
  return `<section class="panel mt"><div class="panel-head"><h2>${esc(t('solvers'))}</h2>${tag('60 s / run')}</div><div class="table-wrap"><table class="solver-table"><thead><tr><th>${esc(t('method'))}</th><th>${esc(t('median'))}</th><th>${esc(t('repetitions'))}</th></tr></thead><tbody>${Object.entries(catalog.solverComparison).map(([key,row])=>`<tr><td>${labels[key]}</td><td>${number(row.medianSeconds,4)}</td><td>${row.repetitions}</td></tr>`).join('')}</tbody></table></div><div class="panel-body"><p>${esc(t('solverNote'))}</p><div class="note"><strong>${esc(t('verifiedCount'))}</strong><br>${esc(t('nativeText'))}</div><div class="actions">${button(t('downloadVerification'),'download-verification')}</div></div></section>`;
}
function selectedValues(c){return values[c.id]||(values[c.id]=c.inputs.map(i=>i.initial));}
function predictionPage(c,model){
  const x=selectedValues(c),response=surfaceResponses[c.id]||c.outputs[0].name;
  return heading(c,t('predictionTitle'),t('predictionHelp'))+caseStrip(c,model)+`<div class="predict-layout"><div class="stack"><section class="panel"><div class="panel-head"><h2>${esc(t('adjust'))}</h2><small>01 / INPUTS</small></div><div class="panel-body"><div class="field"><label for="prediction-model">${esc(t('chooseModel'))}</label><select id="prediction-model">${models.filter(m=>m.caseId===c.id).map(m=>`<option value="${m.id}" ${m.id===model.id?'selected':''}>${esc(m.label)} · ${esc(l(c.protocols.find(p=>p.id===m.protocol).label))}</option>`).join('')}</select></div><div class="mt">${c.inputs.map((input,i)=>`<div class="parameter"><div class="param-head"><label for="input-${i}">${esc(l(input.label))}</label><div class="number-wrap"><input id="input-${i}" data-input-index="${i}" type="number" step="any" min="${input.min}" max="${input.max}" value="${x[i]}" aria-describedby="input-range-${i}"><small>${esc(input.unit)}</small></div></div><input type="range" id="slider-${i}" data-slider-index="${i}" min="${input.min}" max="${input.max}" step="${input.step}" value="${x[i]}" aria-label="${esc(l(input.label))}"><div class="range-label" id="input-range-${i}"><span>${input.min} ${esc(input.unit)}</span><span>${input.max} ${esc(input.unit)}</span></div></div>`).join('')}</div><div class="presets">${(c.id==='cstr'?['baseline','verifiedPoint']:['centre','valley','peak']).map((key,i)=>`<button class="preset" data-action="preset-${i}">${esc(t(key))}</button>`).join('')}</div><div id="input-error" class="note error mt" hidden></div></div></section><div class="note">${esc(t('pointOnly'))}</div></div><div class="stack"><section class="panel"><div class="panel-head"><h2>${esc(t('results'))}</h2><small>02 / RESPONSE</small></div><div class="panel-body"><div class="result-grid ${c.outputs.length===1?'single':''}">${c.outputs.map(o=>`<div class="result-item"><small>${esc(l(o.label))}</small><strong id="result-${o.name}">—</strong><span>${esc(o.unit||t('point'))}</span></div>`).join('')}</div><div class="support-line" id="support-message" role="status"></div>${c.id==='cstr'?`<div id="constraint-message" class="note mt"></div><p class="subtle">${esc(t('constraintRule'))}</p>`:''}<div class="actions">${button(t('addResult'),'add-result',true)}</div></div></section><section class="panel"><div class="panel-head surface-head"><h2>${esc(t('surface'))}</h2><select id="surface-response" aria-label="${esc(t('response'))}">${c.outputs.map(o=>`<option value="${o.name}" ${o.name===response?'selected':''}>${esc(l(o.label))}</option>`).join('')}</select></div><div class="panel-body"><div class="surface-container"><div class="axis-y">${esc(l(c.inputs[1].label))} · ${c.inputs[1].min}–${c.inputs[1].max} ${esc(c.inputs[1].unit)}</div><canvas id="surface" width="900" height="576" role="img" aria-label="${esc(l(c.title)+' · '+t('surface'))}"></canvas><div class="axis-x">${esc(l(c.inputs[0].label))} · ${c.inputs[0].min}–${c.inputs[0].max} ${esc(c.inputs[0].unit)}</div></div><div class="heat-legend"><span id="surface-min">—</span><i></i><span id="surface-max">—</span></div><p class="surface-help">${esc(t('clickSurface'))}</p></div></section></div></div><section class="panel mt"><div class="panel-head saved-title"><div><h2>${esc(t('savedPredictions'))}</h2><small id="history-count"></small></div><div class="actions">${button('CSV','download-csv')}${button('JSON','download-json')}${button(t('clear'),'clear-history')}</div></div><div id="prediction-history"></div></section>`;
}
function validInputs(c,x){return x.every((value,i)=>Number.isFinite(value)&&value>=c.inputs[i].min&&value<=c.inputs[i].max);}
function updatePrediction(){
  const {c,model,view}=current();if(!c||view!=='predict')return;
  const x=selectedValues(c),valid=validInputs(c,x),err=document.getElementById('input-error');
  err.hidden=valid;err.textContent=valid?'':t('boundsError');
  document.querySelector('[data-action="add-result"]').disabled=!valid;
  const result=valid?predictModel(model,x):null;
  for(const o of c.outputs)document.getElementById('result-'+o.name).textContent=result?number(result[o.name],9):'—';
  const support=document.getElementById('support-message');
  support.textContent=valid?t(withinTrainingBounds(model,x)?'supported':'extrapolation'):'';
  support.style.color=valid&&!withinTrainingBounds(model,x)?'var(--amber)':'var(--teal)';
  if(c.id==='cstr'){
    const node=document.getElementById('constraint-message');
    const feasible=result&&result.butadiene_mass_fraction>=.28&&result.reactor_temperature_K<=345;
    node.textContent=result?t(feasible?'constraintsPass':'constraintsFail'):'—';node.className='note mt'+(result&&!feasible?' amber':'');
  }
  paintMarker(c,model);
}
function showHistory(c){
  const rows=histories[c.id]||[];document.getElementById('history-count').textContent=`${rows.length} ${t('saved')}`;
  document.getElementById('prediction-history').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>${esc(t('model'))}</th>${c.inputs.map(i=>`<th>${esc(l(i.label))} ${esc(i.unit)}</th>`).join('')}${c.outputs.map(o=>`<th>${esc(l(o.label))} ${esc(o.unit)}</th>`).join('')}</tr></thead><tbody>${rows.slice().reverse().map((r,i)=>`<tr><td>${rows.length-i}</td><td>${esc(models.find(m=>m.id===r.modelId).label)}</td>${r.inputs.map(v=>`<td>${number(v,10)}</td>`).join('')}${c.outputs.map(o=>`<td>${number(r.predictions[o.name],10)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<div class="empty-table">${esc(t('empty'))}</div>`;
  for(const action of ['download-csv','download-json','clear-history'])document.querySelector(`[data-action="${action}"]`).disabled=!rows.length;
}
async function drawSurface(c,model,token){
  const name=surfaceResponses[c.id]||c.outputs[0].name,key=model.id+':'+name;
  const canvas=document.getElementById('surface');if(!canvas)return;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#edf4f3';ctx.fillRect(0,0,900,576);ctx.fillStyle='#647986';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText(t('loadingSurface'),450,288);
  if(!surfaceCache.has(key)){
    const nx=60,ny=42,points=[];
    for(let y=0;y<ny;y++){
      for(let x=0;x<nx;x++)points.push(predictModel(model,[c.inputs[0].min+x/(nx-1)*(c.inputs[0].max-c.inputs[0].min),c.inputs[1].max-y/(ny-1)*(c.inputs[1].max-c.inputs[1].min)])[name]);
      if(y%7===0){await new Promise(requestAnimationFrame);if(token!==renderNumber)return;}
    }
    const low=Math.min(...points),high=Math.max(...points),image=document.createElement('canvas');image.width=nx;image.height=ny;
    const ic=image.getContext('2d'),pixels=ic.createImageData(nx,ny);
    points.forEach((v,i)=>{const color=palette((v-low)/(high-low||1));pixels.data.set([...color,255],i*4);});ic.putImageData(pixels,0,0);
    surfaceCache.set(key,{image,low,high});
  }
  if(token!==renderNumber)return;
  document.getElementById('surface-min').textContent=number(surfaceCache.get(key).low,5);
  document.getElementById('surface-max').textContent=number(surfaceCache.get(key).high,5);
  paintMarker(c,model);
}
function paintMarker(c,model){
  const canvas=document.getElementById('surface'),key=model.id+':'+(surfaceResponses[c.id]||c.outputs[0].name),cached=surfaceCache.get(key);
  if(!canvas||!cached)return;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.drawImage(cached.image,0,0,canvas.width,canvas.height);
  const p=selectedValues(c);if(!validInputs(c,p))return;
  const x=(p[0]-c.inputs[0].min)/(c.inputs[0].max-c.inputs[0].min)*canvas.width;
  const y=(c.inputs[1].max-p[1])/(c.inputs[1].max-c.inputs[1].min)*canvas.height;
  ctx.setLineDash([6,6]);ctx.strokeStyle='#ffffffa0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='white';ctx.strokeStyle='#173c50';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,8,0,2*Math.PI);ctx.fill();ctx.stroke();
}
function download(filename,content,type='application/json'){
  const blob=new Blob([typeof content==='string'?content:JSON.stringify(content,null,2)],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast(t('downloaded'));
}
function csv(rows){return rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';}
function toast(message){document.querySelector('.toast')?.remove();const n=document.createElement('div');n.className='toast';n.role='status';n.textContent=message;document.body.append(n);setTimeout(()=>n.remove(),2200);}
function savePrediction(c,model){
  const x=selectedValues(c);if(!validInputs(c,x))return;
  histories[c.id]??=[];histories[c.id].push({modelId:model.id,protocol:model.protocol,sourceSha256:model.sourceSha256,inputs:[...x],predictions:predictModel(model,x),withinTrainingBounds:withinTrainingBounds(model,x),createdAt:new Date().toISOString(),kind:'surrogate_point_prediction'});
  showHistory(c);toast(t('added'));
}
function exportAction(action,c,model){
  if(action==='download-model')return download(`isoptlab-${model.id}.json`,{schemaVersion:1,scope:'Frozen browser point-prediction parameters; no new simulator observations',model,caseDefinition:c});
  if(action==='download-case')return download(`isoptlab-${c.id}-case.json`,c);
  if(action==='download-comparison'){
    const {set,target,rows}=comparisonContext(c);
    return download(`isoptlab-${c.id}-${set.id}-comparison.csv`,csv([['model','protocol','training_rows','response','unit','training_cv_rmse','new_point_rmse','new_point_r2','validation_batch'],...rows.map(m=>[m.label,m.protocol,m.trainRows,target.name,target.unit,m.cv[target.name],m.metrics[set.id][target.name].rmse,m.metrics[set.id][target.name].r2,set.id])]),'text/csv;charset=utf-8');
  }
  if(action==='download-verification'){
    const headers=['method','repeat',...c.inputs.map(i=>i.name),...c.outputs.flatMap(o=>[o.name+'_predicted',o.name+'_gproms'])];
    return download('isoptlab-cstr-real-gproms-checks.csv',csv([headers,...catalog.verification.map(r=>[r.method,r.repeat,...c.inputs.map(i=>r.inputs[i.name]),...c.outputs.flatMap(o=>[r.predicted[o.name],r.observed[o.name]])])]),'text/csv;charset=utf-8');
  }
  const rows=histories[c.id]||[];if(!rows.length)return toast(t('noHistory'));
  if(action==='download-json')return download(`isoptlab-${c.id}-predictions.json`,{schemaVersion:1,caseId:c.id,scope:'Browser-calculated surrogate point predictions; not new gPROMS observations',inputs:c.inputs,outputs:c.outputs,predictions:rows});
  return download(`isoptlab-${c.id}-predictions.csv`,csv([['model','protocol','created_at','source_sha256','within_training_bounds',...c.inputs.map(i=>i.name),...c.outputs.map(o=>o.name)],...rows.map(r=>[r.modelId,r.protocol,r.createdAt,r.sourceSha256,r.withinTrainingBounds,...r.inputs,...c.outputs.map(o=>r.predictions[o.name])])]),'text/csv;charset=utf-8');
}
function render(){
  if(!catalog)return;renderNumber++;
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  const {c,view,model}=current();
  const body=!c?archive():view==='models'?modelsPage(c,model):view==='compare'?comparePage(c,model):view==='predict'?predictionPage(c,model):overview(c,model);
  app.innerHTML=shell(body,c,view,model);
  document.title=`${c?l(c.title)+' · ':''}iSOptLab · ${t('public')}`;
  if(c&&view==='predict'){showHistory(c);updatePrediction();drawSurface(c,model,renderNumber);}
}
app.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='language'){lang=lang==='zh'?'en':'zh';localStorage.setItem('isoptlab-demo-language',lang);render();return;}
  const {c,model}=current();if(!c)return;
  if(action.startsWith('download-'))return exportAction(action,c,model);
  if(action==='add-result')return savePrediction(c,model);
  if(action==='clear-history'){histories[c.id]=[];showHistory(c);return;}
  if(action.startsWith('preset-')){
    const presets=c.id==='cstr'?[[300,100],[303.04413846,80]]:[[0,0],[.23,-1.63],[-.01,1.59]];
    values[c.id]=[...presets[Number(action.slice(7))]];
    c.inputs.forEach((_,i)=>{document.getElementById('input-'+i).value=values[c.id][i];document.getElementById('slider-'+i).value=values[c.id][i];});updatePrediction();
  }
});
app.addEventListener('input',event=>{
  const el=event.target,{c}=current();if(!c)return;
  if(el.dataset.inputIndex!==undefined||el.dataset.sliderIndex!==undefined){
    const index=Number(el.dataset.inputIndex??el.dataset.sliderIndex),value=el.value.trim()===''?NaN:Number(el.value);selectedValues(c)[index]=value;
    const other=document.getElementById((el.dataset.inputIndex!==undefined?'slider-':'input-')+index);if(Number.isFinite(value))other.value=value;
    updatePrediction();
  }
});
app.addEventListener('change',event=>{
  const {c,model}=current();if(!c)return;const el=event.target;
  if(el.id==='prediction-model')location.hash=route(c.id,'predict',el.value);
  if(el.id==='comparison-set'){comparisonSets[c.id]=el.value;render();}
  if(el.id==='comparison-response'){comparisonResponses[c.id]=el.value;render();}
  if(el.id==='surface-response'){surfaceResponses[c.id]=el.value;renderNumber++;drawSurface(c,model,renderNumber);}
});
app.addEventListener('pointerdown',event=>{
  if(event.target.id!=='surface')return;
  const {c}=current(),rect=event.target.getBoundingClientRect();
  values[c.id]=[c.inputs[0].min+(event.clientX-rect.left)/rect.width*(c.inputs[0].max-c.inputs[0].min),c.inputs[1].max-(event.clientY-rect.top)/rect.height*(c.inputs[1].max-c.inputs[1].min)];
  c.inputs.forEach((_,i)=>{document.getElementById('input-'+i).value=values[c.id][i];document.getElementById('slider-'+i).value=values[c.id][i];});updatePrediction();
});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});});
try{
  [catalog,models]=await Promise.all([fetch(new URL('./data/catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}),fetch(new URL('./data/models.json',import.meta.url)).then(r=>{if(!r.ok)throw Error(r.status);return r.json();})]);
  render();
}catch(error){app.innerHTML=`<div class="boot"><strong>iSOptLab</strong><span>${esc(t('loadError'))}</span></div>`;console.error(error);}
