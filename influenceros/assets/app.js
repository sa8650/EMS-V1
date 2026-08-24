/* InfluencerOS — Agent & Influencer Management Platform. Powered by DoxTox. */
const $=s=>document.querySelector(s), app=$('#app');
let state=JSON.parse(localStorage.getItem('ios.session')||'null');

const api=async(path,opt={})=>{
  let r=await fetch('/api/ios/'+path,{...opt,headers:{'content-type':'application/json',...(state?.token?{authorization:'Bearer '+state.token}:{}),...(opt.headers||{})}});
  let x=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(x.error||'Request failed');
  return x;
};
const upload=async(path,formData)=>{
  let r=await fetch('/api/ios/'+path,{method:'POST',headers:{...(state?.token?{authorization:'Bearer '+state.token}:{})},body:formData});
  let x=await r.json().catch(()=>({}));if(!r.ok)throw Error(x.error||'Upload failed');return x;
};
const viewCache={};
const dropCache=()=>{for(const k in viewCache)delete viewCache[k]};
const mutate=async(path,opt={})=>{const r=await api(path,opt);dropCache();return r};
const warm=()=>['overview','partners','projects','allocations','payments','performance','contributions'].forEach(k=>{if(!(k in viewCache))api(k).then(d=>viewCache[k]=d).catch(()=>{})});
const typing=main=>main.contains(document.activeElement)&&/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const num=v=>Number(v)||0;
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
const pct=(a,b)=>b>0?Math.min(999,Math.round(a/b*100)):0;
const fmtDate=d=>String(d||'').slice(0,10);
const fmtDT=d=>{const x=new Date(d);return isNaN(x)?String(d||''):x.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})};
const fmtSize=b=>{const n=Number(b)||0;return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B'};
const openFile=async(id,name)=>{
  try{
    const r=await fetch('/api/ios/files/'+id,{headers:{...(state?.token?{authorization:'Bearer '+state.token}:{})}});
    if(!r.ok){const x=await r.json().catch(()=>({}));throw Error(x.error||'Could not open file')}
    const blob=await r.blob();const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.target='_blank';a.download=name||'file';a.rel='noopener';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){toast(e.message)}
};
function filesCell(files){
  if(!files||!files.length)return '—';
  return `<button class="btn small" data-files='${esc(JSON.stringify(files.map(f=>({id:f.id,n:f.file_name,s:f.file_size}))))}'>📁 ${files.length}</button>`;
}
function filesModal(files){
  modal(`<h2>Proof files (${files.length})</h2><p>Click a file to open it in a new tab.</p>
  ${files.map(f=>`<div class="target-row"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.n)}</b><span>${fmtSize(f.s)}</span><span></span><button class="btn small" data-open="${f.id}" data-name="${esc(f.n)}">Open</button></div>`).join('')}
  <div class="modal-actions"><button class="btn" data-close>Close</button></div>`).querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openFile(b.dataset.open,b.dataset.name));
}
function toast(m){let e=$('#toast');e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),3200)}

const TYPE_LABELS={youtuber:'YouTuber',facebook:'Facebook',tiktoker:'TikToker',instagram:'Instagram',marketing_agent:'Marketing Agent',agency:'Agency'};
const PARTNER_STATUS={disagree:['Disagree','red'],agree:['Agree','green'],not_response:['Not Response','yellow'],waiting:['Waiting','blue']};
const ALLOC_STATUS={on_target:['On Target','green'],active:['Active','blue'],behind:['Behind','red'],inactive:['Inactive','gray']};
const PAY_STATUS={scheduled:['Scheduled','blue'],paid:['Paid','green'],pending:['Pending','yellow']};
const CONTRIB_STATUS={pending:['Pending','yellow'],accepted:['Accepted','green'],rejected:['Rejected','red']};
const pill=(map,key)=>{const m=map[key]||[String(key),'gray'];return `<span class="pill ${m[1]}">${m[0]}</span>`};
const projPill=s=>s==='active'?'<span class="pill green">Active</span>':'<span class="pill gray">Inactive</span>';

function save(s){state=s;localStorage.setItem('ios.session',JSON.stringify(s))}
function logout(){localStorage.removeItem('ios.session');state=null;boot()}

/* ═══════════ MODAL SYSTEM ═══════════ */
function modal(html){
  const ov=document.createElement('div');ov.className='overlay';
  ov.innerHTML=`<div class="modal">${html}</div>`;
  document.body.append(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove()});
  ov.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>ov.remove());
  return ov;
}

/* ═══════════ LANDING PAGE ═══════════ */
function landing(){
  document.title='InfluencerOS | DoxTox';
  app.innerHTML=`
  <header class="land-head"><div class="in">
    <div class="logo" style="padding:0">Influence<span>OS</span><small>powered by DoxTox</small></div>
    <nav class="land-nav">
      <a href="#features">Features</a><a href="#workflow">Workflow</a><a href="#roles">Roles</a>
      <button class="btn dark" id="loginBtn">Login</button>
    </nav>
  </div></header>

  <section class="hero">
    <div>
      <span class="pill blue">Agent &amp; Influencer Management</span>
      <h1>Run every agent, project and payout in <span>one place</span></h1>
      <p class="lead">InfluencerOS brings your marketing agents, YouTubers, TikTokers and agencies together — allocate project targets, track acquired users, calculate commissions and pay partners with full balance control.</p>
      <div class="cta">
        <button class="btn dark big" id="heroLogin">Login to workspace</button>
        <a class="btn big" href="#features">See features</a>
      </div>
      <div class="stats">
        <div><b>Agents</b><span>Agents &amp; creators</span></div>
        <div><b>Projects</b><span>Targets &amp; budgets</span></div>
        <div><b>Allocations</b><span>Per-partner goals</span></div>
        <div><b>Payments</b><span>Balance-safe payouts</span></div>
      </div>
    </div>
    <div class="hero-card">
      <div class="detail-head"><div><h2 style="font-size:16px">Crypto Exchange Launch</h2><p>25,000 target users · 5 partners</p></div>${pill(ALLOC_STATUS,'on_target')}</div>
      <div class="meta"><span>Target users</span><b>25,000</b></div>
      <div class="progress-lg"><i style="width:74%"></i></div>
      <div class="meta"><span>74% achieved</span><span>$18,400 budget</span></div>
      <div class="target-row"><b>Arif Rahman</b><span>Target 7,000</span><span>Reached 5,420</span><span class="right"><b>77%</b></span></div>
      <div class="target-row"><b>Shakib Karim</b><span>Target 3,000</span><span>Reached 2,800</span><span class="right"><b>93%</b></span></div>
      <div class="target-row"><b>Trend Makers</b><span>Target 6,000</span><span>Reached 2,980</span><span class="right"><b>50%</b></span></div>
    </div>
  </section>

  <section class="land-section" id="features">
    <h2>Everything the workflow needs</h2>
    <p class="sub">A connected data structure — Agent → Allocation → Project → Payment. Nothing is entered twice.</p>
    <div class="feat-grid">
      <div class="feat"><div class="fi">◉</div><h3>Agents</h3><p>Agents, YouTubers, TikTokers, Facebook and Instagram creators and agencies — with 4-digit Agent IDs, social accounts and login access control.</p></div>
      <div class="feat"><div class="fi">◆</div><h3>Projects</h3><p>Set a budget and goal. Target users, acquired users and used budget are calculated automatically from allocations.</p></div>
      <div class="feat"><div class="fi">◌</div><h3>Allocations</h3><p>Assign per-partner targets and commissions. Only agents with status “Agree” can be allocated to a project.</p></div>
      <div class="feat"><div class="fi">$</div><h3>Payments</h3><p>Balance-safe payouts — a payment can never exceed the partner’s available balance. Paid totals update instantly.</p></div>
      <div class="feat"><div class="fi">◫</div><h3>Performance</h3><p>Achievement % and ranking are computed from acquired vs assigned users across every project.</p></div>
      <div class="feat"><div class="fi">◎</div><h3>Agent portal</h3><p>Agents log in with Agent ID or email and see only their own projects, payments and performance.</p></div>
    </div>
  </section>

  <section class="land-section" id="workflow" style="padding-top:10px">
    <h2>From partner to payout</h2>
    <p class="sub">The system keeps financial and performance figures in sync automatically.</p>
    <div class="card"><div class="target-row"><b>1 · Add agent</b><span>4-digit Agent ID generated</span><span>Social accounts saved</span><span class="right">Login ready</span></div>
    <div class="target-row"><b>2 · Create project</b><span>Set budget</span><span>Define the goal</span><span class="right">Activate</span></div>
    <div class="target-row"><b>3 · Allocate</b><span>Assign target users</span><span>Set commission</span><span class="right">Track progress</span></div>
    <div class="target-row"><b>4 · Pay</b><span>Available balance shown</span><span>Amount validated</span><span class="right">Mark as paid</span></div></div>
  </section>

  <section class="land-section" id="roles" style="padding-top:10px">
    <h2>Two roles, one platform</h2>
    <p class="sub">Administrators run the workspace. Agents get their own restricted dashboard.</p>
    <div class="two">
      <div class="card"><div class="fi" style="width:38px;height:38px;border-radius:9px;background:#f0f0f0;display:grid;place-items:center;font-size:18px;margin-bottom:12px">▦</div><h3 style="margin:0 0 8px;font-size:15px">Admin dashboard</h3><p style="margin:0;color:#777;font-size:12px;line-height:1.6">Overview KPIs, partner directory, project cards, allocation table, payment processing with balance validation and partner performance ranking.</p></div>
      <div class="card"><div class="fi" style="width:38px;height:38px;border-radius:9px;background:#f0f0f0;display:grid;place-items:center;font-size:18px;margin-bottom:12px">◎</div><h3 style="margin:0 0 8px;font-size:15px">Agent portal</h3><p style="margin:0;color:#777;font-size:12px;line-height:1.6">Profile with password self-service, allocated projects with progress, earnings KPIs, own payment history and personal performance with rank.</p></div>
    </div>
  </section>

  <footer class="land-foot"><div class="in">
    <div>© ${new Date().getFullYear()} <b>InfluencerOS</b> — Agent &amp; Influencer Management</div>
    <div class="powered">powered by <b>DoxTox</b></div>
  </div></footer>`;

  $('#loginBtn').onclick=loginModal;
  $('#heroLogin').onclick=loginModal;
}

/* ═══════════ LOGIN ═══════════ */
async function loginModal(){
  const ov=modal(`
    <h2>Login to InfluenceOS</h2>
    <p>Choose how you want to sign in.</p>
    <div style="display:grid;gap:10px">
      <button class="btn dark" id="mAdmin" style="padding:16px">▦ &nbsp;Admin login</button>
      <button class="btn" id="mAgent" style="padding:16px">◎ &nbsp;Agent login</button>
    </div>
    <p class="form-note" style="margin-top:14px">Agents can sign in with their 4-digit Agent ID or registered email.</p>`);
  ov.querySelector('#mAdmin').onclick=()=>{ov.remove();adminLoginModal()};
  ov.querySelector('#mAgent').onclick=()=>{ov.remove();agentLoginModal()};
}
async function adminLoginModal(){
  let hasAdmin=true;try{hasAdmin=(await api('auth/status')).hasAdmin}catch{}
  const register=!hasAdmin;
  const ov=modal(`
    <h2>${register?'Create administrator':'Admin login'}</h2>
    <p>${register?'No administrator exists yet — create the first account.':'Sign in with your administrator email and password.'}</p>
    ${register?'<div class="field"><label>Name</label><input id="aName" placeholder="Your name"></div>':''}
    <div class="field"><label>Email</label><input id="aEmail" type="email" placeholder="admin@company.com"></div>
    <div class="field"><label>Password</label><input id="aPass" type="password" placeholder="Minimum 6 characters"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="aGo">${register?'Create & sign in':'Sign in'}</button></div>`);
  ov.querySelector('#aGo').onclick=async()=>{
    try{
      const payload=register?{name:ov.querySelector('#aName').value,email:ov.querySelector('#aEmail').value,password:ov.querySelector('#aPass').value}
        :{email:ov.querySelector('#aEmail').value,password:ov.querySelector('#aPass').value};
      const r=await api(register?'auth/admin/register':'auth/admin/login',{method:'POST',body:JSON.stringify(payload)});
      save({token:r.token,role:'admin',user:r.user});ov.remove();boot();
    }catch(e){toast(e.message)}
  };
}
function agentLoginModal(){
  const ov=modal(`
    <h2>Agent login</h2>
    <p>Use your 4-digit Agent ID or registered email address.</p>
    <div class="field"><label>Agent ID or email</label><input id="pId" placeholder="4827 or you@email.com"></div>
    <div class="field"><label>Password</label><input id="pPass" type="password" placeholder="Your password"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="pGo">Sign in</button></div>`);
  ov.querySelector('#pGo').onclick=async()=>{
    try{
      const r=await api('auth/partner/login',{method:'POST',body:JSON.stringify({identifier:ov.querySelector('#pId').value,password:ov.querySelector('#pPass').value})});
      save({token:r.token,role:'partner',user:r.user});ov.remove();boot();
    }catch(e){toast(e.message)}
  };
}

/* ═══════════ ADMIN APP ═══════════ */
let aView='dashboard';
function adminApp(){
  document.title='InfluencerOS — Admin';
  const nav=[['dashboard','▦','Dashboard'],['partners','◉','Agents'],['projects','◆','Projects'],['contribute','⇧','Contribute'],['allocations','◌','Allocations'],['payments','$','Payments'],['performance','◫','Performance'],['vaultium','▣','Vaultium'],['helpdesk','✉','HelpDesk <span class="navbadge" id="hdBadge" style="display:none"></span>']];
  app.innerHTML=`<div class="app">
    <aside class="sidebar">
      <div class="logo">Influence<span>OS</span><small>powered by DoxTox</small></div>
      <div class="nav-label">Workspace</div>
      <div class="nav">${nav.map(([k,i,l])=>`<button data-v="${k}" class="${k===aView?'active':''}"><span class="icon">${i}</span> ${l}</button>`).join('')}</div>
      <div class="nav-label">System</div>
      <div class="nav"><button data-v="settings"><span class="icon">⚙</span> Settings</button></div>
      <div class="sidebottom"><button id="outBtn">⏻ Logout</button></div>
    </aside>
    <main class="main" id="main"><p class="muted">Loading…</p></main>
  </div>`;
  document.querySelectorAll('.nav button[data-v]').forEach(b=>b.onclick=()=>{aView=b.dataset.v;document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));renderAdmin()});
  $('#outBtn').onclick=logout;
  api('helpdesk').then(d=>updateHdBadge(d.totalUnread||0)).catch(()=>{});
  renderAdmin();
}
async function renderAdmin(){
  const main=$('#main');if(!main)return;
  clearInterval(phdPoll);
  try{
    if(aView==='dashboard')return await aDashboard(main);
    if(aView==='partners')return await aPartners(main);
    if(aView==='projects')return await aProjects(main);
    if(aView==='contribute')return await aContribute(main);
    if(aView==='vaultium')return await aVaultium(main);
    if(aView==='helpdesk')return await aHelpdesk(main);
    if(aView==='allocations')return await aAllocations(main);
    if(aView==='payments')return await aPayments(main);
    if(aView==='performance')return await aPerformance(main);
    if(aView==='settings')return aSettings(main);
  }catch(e){main.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}

/* ---------- ADMIN: DASHBOARD ---------- */
async function aDashboard(main){
  if(viewCache.overview)renderDashboard(main,viewCache.overview);else main.innerHTML='<p class="muted">Loading…</p>';
  const d=await api('overview');viewCache.overview=d;
  if(!typing(main))renderDashboard(main,d);
}
function renderDashboard(main,d){
  const k=d.kpis;
  const kpi=(l,v,c='')=>`<div class="card stat"><div><div class="label">${l}</div><div class="value">${v}</div>${c?`<div class="change">${c}</div>`:''}</div></div>`;
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Good ${new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, ${esc(state.user.name)}</h1><p>Marketing partner operations, project contribution and payouts.</p></div>
  <div class="actions"><button class="btn" id="seedBtn">Load demo data</button></div></div>
  <div class="kpi-grid">
    ${kpi('Total Agents',k.totalPartners)}
    ${kpi('Active Projects',k.activeProjects)}
    ${kpi('Total Allocated Targets',k.assignedTarget.toLocaleString())}
    ${kpi('Total Acquired Users',k.acquiredUsers.toLocaleString())}
  </div>
  <div class="kpi-grid" style="margin-top:15px">
    ${kpi('Total Income',money(k.totalIncome))}
    ${kpi('Total Paid Amount',money(k.totalPaid))}
    ${kpi('Remaining Balance',money(k.remainingBalance))}
    ${kpi('Overall Performance',k.overallPerformance+'%')}
  </div>
  <div class="section two">
    <div class="card table-card">
      <div class="table-top"><div><b>Project contribution</b><div style="font-size:11px;color:#999;margin-top:3px">Agent targets and acquired users</div></div></div>
      <div style="overflow:auto"><table class="table"><thead><tr><th>Agent</th><th>Project</th><th>Target</th><th>Acquired</th><th>Progress</th><th>Commission</th><th>Status</th></tr></thead>
      <tbody>${d.contributions.length?d.contributions.map(c=>`<tr>
        <td><div class="partner"><div class="avatar">${esc(initials(c.partner_name))}</div><div><b>${esc(c.partner_name)}</b><small>#${esc(c.partner_code)}</small></div></div></td>
        <td>${esc(c.project_name)}</td><td>${num(c.assigned_target).toLocaleString()}</td><td><b>${num(c.acquired_users).toLocaleString()}</b></td>
        <td style="min-width:130px"><div style="display:flex;justify-content:space-between;font-size:10px"><span>${pct(num(c.acquired_users),num(c.assigned_target))}%</span><span>${num(c.assigned_target).toLocaleString()} target</span></div><div class="progress"><i style="width:${pct(num(c.acquired_users),num(c.assigned_target))}%"></i></div></td>
        <td>${money(c.commission)}</td><td>${pill(ALLOC_STATUS,c.status)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No allocations yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card">
      <div class="section-head"><h2>Upcoming payouts</h2><span>Not yet paid</span></div>
      <div class="row" style="display:block">
        ${d.upcoming.length?d.upcoming.map(p=>`<div class="row" style="border-top:1px solid var(--border)"><div class="left"><div class="mini">${esc(initials(p.partner_name))}</div><div><b>${esc(p.partner_name)}</b><small>${esc(p.project_name)} · ${fmtDate(p.payment_date)}</small></div></div><div class="money"><b>${money(p.amount)}</b><small>${PAY_STATUS[p.status]?.[0]||p.status}</small></div></div>`).join(''):'<div class="empty">Nothing pending. 🎉</div>'}
      </div>
    </div>
  </div>`;
  warm();
  $('#seedBtn').onclick=async()=>{
    if(!confirm('Load demo data? This will REPLACE all existing partners, projects, allocations and payments in the InfluencerOS database.'))return;
    try{const r=await mutate('demo-seed',{method:'POST'});toast(`Demo data loaded — ${r.partners} agents, ${r.projects} projects. Agent password: ${r.partnerPassword}`);renderAdmin()}catch(e){toast(e.message)}
  };
}

/* ---------- ADMIN: PARTNERS ---------- */
let pFilter={q:'',type:'',status:''};
async function aPartners(main){
  if(viewCache.partners)renderPartnersView(main,viewCache.partners);else main.innerHTML='<p class="muted">Loading…</p>';
  const partners=await api('partners');viewCache.partners=partners;
  if(!typing(main))renderPartnersView(main,partners);
}
function renderPartnersView(main,partners){
  const list=partners.filter(p=>(!pFilter.type||p.type===pFilter.type)&&(!pFilter.status||p.status===pFilter.status)&&(!pFilter.q||(p.name+' '+p.email+' '+p.partner_code).toLowerCase().includes(pFilter.q.toLowerCase())));
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Agents</h1><p>Manage marketing agents, YouTubers, TikTokers and agencies.</p></div>
  <div class="actions"><button class="btn dark" id="addPartner">+ Add agent</button></div></div>
  <div class="section-box"><div class="toolbar"><h2>Agent directory</h2>
    <div class="filters">
      <input id="pq" placeholder="Search name, email or ID…" value="${esc(pFilter.q)}">
      <select id="ptype"><option value="">All types</option>${Object.entries(TYPE_LABELS).map(([k,v])=>`<option value="${k}" ${pFilter.type===k?'selected':''}>${v}</option>`).join('')}</select>
      <select id="pstatus"><option value="">All status</option>${Object.entries(PARTNER_STATUS).map(([k,v])=>`<option value="${k}" ${pFilter.status===k?'selected':''}>${v[0]}</option>`).join('')}</select>
    </div></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>ID</th><th>Agent</th><th>Type</th><th>Projects</th><th>Total Users</th><th>Total Income</th><th>Paid</th><th>Balance</th><th>Note</th><th>Status</th><th></th></tr></thead>
  <tbody>${list.length?list.map(p=>`<tr>
    <td><b>${esc(p.partner_code)}</b></td>
    <td><div class="partner"><div class="avatar">${esc(initials(p.name))}</div><div><b>${esc(p.name)}</b><small>${esc(p.email)}</small></div></div></td>
    <td>${TYPE_LABELS[p.type]||p.type}</td><td>${p.projects}</td><td>${num(p.acquired_users).toLocaleString()}</td>
    <td>${money(p.income)}</td><td>${money(p.paid)}</td><td><b>${money(p.balance)}</b></td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.note||'')}">${esc(p.note||'—')}</td>
    <td>${pill(PARTNER_STATUS,p.status)}</td>
    <td class="actions-cell"><button class="btn small" data-view="${p.id}">View</button><button class="btn small" data-edit="${p.id}">Edit</button><button class="btn small danger" data-del="${p.id}">×</button></td>
  </tr>`).join(''):'<tr><td colspan="11" class="empty">No partners found.</td></tr>'}</tbody></table></div></div>`;
  $('#addPartner').onclick=()=>partnerModal(null,partners);
  $('#pq').oninput=e=>{pFilter.q=e.target.value;renderPartnersView(main,partners)};
  $('#ptype').onchange=e=>{pFilter.type=e.target.value;renderPartnersView(main,partners)};
  $('#pstatus').onchange=e=>{pFilter.status=e.target.value;renderPartnersView(main,partners)};
  main.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>partnerViewModal(partners.find(x=>x.id===b.dataset.view)));
  main.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const p=partners.find(x=>x.id===b.dataset.edit);partnerModal(p,partners)});
  main.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this agent and all their allocations/payments?'))return;try{await mutate('partners/'+b.dataset.del,{method:'DELETE'});toast('Agent deleted.');renderAdmin()}catch(e){toast(e.message)}});
}
function partnerModal(p,all){
  const accounts=(p?.accounts&&p.accounts.length?p.accounts:[{label:'',url:''}]);
  const ov=modal(`
    <h2>${p?'Edit agent':'Add agent'}</h2>
    <p>${p?'Partner #'+esc(p.partner_code):'A unique 4-digit Agent ID will be generated automatically.'}</p>
    <div class="field-row">
      <div class="field"><label>Name</label><input id="fName" value="${esc(p?.name||'')}" placeholder="Full name / agency"></div>
      <div class="field"><label>Email</label><input id="fEmail" type="email" value="${esc(p?.email||'')}" placeholder="partner@email.com"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Phone number</label><input id="fPhone" value="${esc(p?.phone||'')}" placeholder="+880…"></div>
      <div class="field"><label>Agent type</label><select id="fType">${Object.entries(TYPE_LABELS).map(([k,v])=>`<option value="${k}" ${p?.type===k?'selected':''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Social / account information <small>(up to 5)</small></label><div id="acctBox"></div>
      <button class="btn small" id="addAcct" type="button">+ Add URL</button></div>
    <div class="field"><label>Password ${p?'<small>(leave blank to keep current)</small>':''}</label><input id="fPass" type="password" placeholder="Minimum 6 characters"></div>
    <div class="field-row">
      <div class="field"><label>Login access</label><select id="fAccess"><option value="yes" ${p?.login_access!==false?'selected':''}>Yes</option><option value="no" ${p?.login_access===false?'selected':''}>No</option></select></div>
      <div class="field"><label>Status</label><select id="fStatus">${Object.entries(PARTNER_STATUS).map(([k,v])=>`<option value="${k}" ${p?.status===k?'selected':''}>${v[0]}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Note</label><textarea id="fNote" rows="2" placeholder="Optional note…">${esc(p?.note||'')}</textarea></div>
    <div class="field"><label>Financial summary <small>(auto-calculated — read only)</small></label>
      <div class="kv"><span>Projects</span><b>${p?.projects??0}</b><span>Total acquired users</span><b>${num(p?.acquired_users).toLocaleString()}</b><span>Total income</span><b>${money(p?.income)}</b><span>Paid</span><b>${money(p?.paid)}</b><span>Remaining balance</span><b>${money(p?.balance)}</b></div></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="fSave">${p?'Save changes':'Add agent'}</button></div>`);
  const box=ov.querySelector('#acctBox');
  const addRow=(a={label:'',url:''})=>{
    if(box.children.length>=5){toast('Maximum 5 account URLs.');return}
    const r=document.createElement('div');r.className='acct-row';
    r.innerHTML=`<input placeholder="Label (YouTube…)" value="${esc(a.label)}"><input placeholder="https://…" value="${esc(a.url)}"><button class="btn small danger" type="button">×</button>`;
    r.querySelector('button').onclick=()=>r.remove();box.append(r);
  };
  accounts.forEach(addRow);
  ov.querySelector('#addAcct').onclick=()=>addRow();
  ov.querySelector('#fSave').onclick=async()=>{
    const accountsList=[...box.querySelectorAll('.acct-row')].map(r=>({label:r.children[0].value,url:r.children[1].value})).filter(a=>a.label.trim()||a.url.trim());
    const payload={name:ov.querySelector('#fName').value,email:ov.querySelector('#fEmail').value,phone:ov.querySelector('#fPhone').value,
      type:ov.querySelector('#fType').value,accounts:accountsList,password:ov.querySelector('#fPass').value||undefined,
      login_access:ov.querySelector('#fAccess').value==='yes',status:ov.querySelector('#fStatus').value,note:ov.querySelector('#fNote').value};
    try{
      if(p){await mutate('partners/'+p.id,{method:'PATCH',body:JSON.stringify(payload)});toast('Agent updated.')}
      else{const r=await mutate('partners',{method:'POST',body:JSON.stringify(payload)});ov.remove();modal(`<h2>Agent created</h2><p>Share these credentials with the agent.</p><div class="kv"><span>Agent ID</span><b style="font-size:20px">${esc(r.partner_code)}</b><span>Email</span><b>${esc(r.email)}</b><span>Login</span><b>Agent ID or email + password</b></div><div class="modal-actions"><button class="btn dark" data-close>Done</button></div>`);toast('Agent added — ID '+r.partner_code);renderAdmin();return}
      ov.remove();renderAdmin();
    }catch(e){toast(e.message)}
  };
}

/* ---------- ADMIN: PROJECTS ---------- */
async function aProjects(main){
  if(viewCache.projects)renderProjectsView(main,viewCache.projects);else main.innerHTML='<p class="muted">Loading…</p>';
  const projects=await api('projects');viewCache.projects=projects;
  if(!typing(main))renderProjectsView(main,projects);
}
function renderProjectsView(main,projects){
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Projects</h1><p>Track project targets, assigned partners, user acquisition and budget.</p></div>
  <div class="actions"><button class="btn dark" id="addProject">+ Add project</button></div></div>
  <div class="project-grid">${projects.length?projects.map(p=>`
    <div class="project-card"><div class="detail-head"><div><h3>${esc(p.name)}</h3><p>${esc(p.details||'')}</p></div>${projPill(p.status)}</div>
      <div class="meta"><span>Budget</span><b>${money(p.budget)}</b></div>
      <div class="meta"><span>Used budget <small>(auto)</small></span><b>${money(p.used_budget)}</b></div>
      <div class="meta"><span>Remaining budget</span><b>${money(p.remaining_budget)}</b></div>
      <div class="meta"><span>Target users <small>(auto)</small></span><b>${num(p.target_users).toLocaleString()}</b></div>
      <div class="meta"><span>Acquired users <small>(auto)</small></span><b>${num(p.acquired_users).toLocaleString()}</b></div>
      <div class="progress-lg"><i style="width:${pct(num(p.acquired_users),num(p.target_users))}%"></i></div>
      <div class="meta"><span>${pct(num(p.acquired_users),num(p.target_users))}% achieved</span><span>${p.partner_count} partners</span></div>
      <div style="margin-top:12px;display:flex;gap:6px"><button class="btn small" data-edit="${p.id}">Edit</button><button class="btn small danger" data-del="${p.id}">×</button></div>
    </div>`).join(''):'<div class="empty" style="grid-column:1/-1">No projects yet.</div>'}</div>`;
  $('#addProject').onclick=()=>projectModal(null);
  main.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>projectModal(projects.find(x=>x.id===b.dataset.edit)));
  main.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this project and its allocations/payments?'))return;try{await mutate('projects/'+b.dataset.del,{method:'DELETE'});toast('Project deleted.');renderAdmin()}catch(e){toast(e.message)}});
}
function projectModal(p){
  const ov=modal(`
    <h2>${p?'Edit project':'Add project'}</h2>
    <p>Target users, acquired users and used budget are calculated automatically from allocations.</p>
    <div class="field"><label>Project name</label><input id="jName" value="${esc(p?.name||'')}" placeholder="e.g. Crypto Exchange Launch"></div>
    <div class="field"><label>Details</label><textarea id="jDetails" rows="3" placeholder="What is this project about?">${esc(p?.details||'')}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Budget</label><input id="jBudget" type="number" min="0" step="50" value="${num(p?.budget)}"></div>
      <div class="field"><label>Status</label><select id="jStatus"><option value="active" ${p?.status!=='inactive'?'selected':''}>Active</option><option value="inactive" ${p?.status==='inactive'?'selected':''}>Inactive</option></select></div>
    </div>
    <div class="field"><label>Note</label><input id="jNote" value="${esc(p?.note||'')}"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="jSave">${p?'Save changes':'Add project'}</button></div>`);
  ov.querySelector('#jSave').onclick=async()=>{
    const payload={name:ov.querySelector('#jName').value,details:ov.querySelector('#jDetails').value,budget:num(ov.querySelector('#jBudget').value),status:ov.querySelector('#jStatus').value,note:ov.querySelector('#jNote').value};
    try{
      if(p)await mutate('projects/'+p.id,{method:'PATCH',body:JSON.stringify(payload)});
      else await mutate('projects',{method:'POST',body:JSON.stringify(payload)});
      ov.remove();toast(p?'Project updated.':'Project added.');renderAdmin();
    }catch(e){toast(e.message)}
  };
}

/* ---------- ADMIN: ALLOCATIONS ---------- */
let aFilterQ='';
async function aAllocations(main){
  const c=viewCache.allocations;
  if(c)renderAllocationsView(main,c.allocs,c.projects,c.partners);else main.innerHTML='<p class="muted">Loading…</p>';
  const bundle=await Promise.all([api('allocations'),api('projects'),api('partners')]);
  viewCache.allocations={allocs:bundle[0],projects:bundle[1],partners:bundle[2]};
  if(!typing(main))renderAllocationsView(main,bundle[0],bundle[1],bundle[2]);
}
function renderAllocationsView(main,allocs,projects,partners){
  const list=allocs.filter(a=>!aFilterQ||(a.partner_name+' '+a.project_name).toLowerCase().includes(aFilterQ.toLowerCase()));
  const agree=partners.filter(p=>p.status==='agree');
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Allocations</h1><p>Assign project targets to agents and track progress.</p></div>
  <div class="actions"><button class="btn dark" id="addAlloc">+ Add allocation</button></div></div>
  <div class="section-box"><div class="toolbar"><h2>Allocation table</h2><div class="filters"><input id="aq" placeholder="Search project or partner…" value="${esc(aFilterQ)}"></div></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>Project</th><th>Agent</th><th>Assigned target</th><th>Users acquired</th><th>Commission</th><th>Progress</th><th>Status</th><th></th></tr></thead>
  <tbody>${list.length?list.map(a=>`<tr>
    <td>${esc(a.project_name)}</td>
    <td><div class="partner"><div class="avatar">${esc(initials(a.partner_name))}</div><div><b>${esc(a.partner_name)}</b><small>#${esc(a.partner_code)}</small></div></div></td>
    <td>${num(a.assigned_target).toLocaleString()}</td><td><b>${num(a.acquired_users).toLocaleString()}</b></td><td>${money(a.commission)}</td>
    <td style="min-width:120px"><div style="font-size:10px;margin-bottom:4px">${pct(num(a.acquired_users),num(a.assigned_target))}%</div><div class="progress"><i style="width:${pct(num(a.acquired_users),num(a.assigned_target))}%"></i></div></td>
    <td>${pill(ALLOC_STATUS,a.status)}</td>
    <td class="actions-cell"><button class="btn small" data-edit="${a.id}">Edit</button><button class="btn small danger" data-del="${a.id}">×</button></td>
  </tr>`).join(''):'<tr><td colspan="8" class="empty">No allocations yet.</td></tr>'}</tbody></table></div></div>`;
  $('#addAlloc').onclick=()=>allocationModal(null,projects,agree,allocs);
  $('#aq').oninput=e=>{aFilterQ=e.target.value;renderAllocationsView(main,allocs,projects,partners)};
  main.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>allocationModal(allocs.find(x=>x.id===b.dataset.edit),projects,agree,allocs));
  main.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this allocation?'))return;try{await mutate('allocations/'+b.dataset.del,{method:'DELETE'});toast('Allocation deleted.');renderAdmin()}catch(e){toast(e.message)}});
}
function allocationModal(a,projects,agreePartners,existing){
  const editable=!!a;
  const ov=modal(`
    <h2>${editable?'Edit allocation':'Add allocation'}</h2>
    <p>${editable?'Update targets, progress, commission or status.':'Link an agreeing partner to a project with a target and commission.'}</p>
    <div class="field"><label>Project</label><select id="lProject" ${editable?'disabled':''}><option value="">Select project…</option>${projects.map(p=>`<option value="${p.id}" ${a?.project_id===p.id?'selected':''}>${esc(p.name)}${p.status!=='active'?' (inactive)':''}</option>`).join('')}</select></div>
    <div class="field"><label>Agent <small>${editable?'':'(only agents with status “Agree” are listed)'}</small></label><select id="lPartner" ${editable?'disabled':''}><option value="">Select agent…</option>${agreePartners.map(p=>`<option value="${p.id}" ${a?.partner_id===p.id?'selected':''}>${esc(p.name)} · #${esc(p.partner_code)}</option>`).join('')}</select></div>
    <div class="field-row">
      <div class="field"><label>Assigned target (users)</label><input id="lTarget" type="number" min="0" value="${num(a?.assigned_target)}"></div>
      <div class="field"><label>Acquired users</label><input id="lAcquired" type="number" min="0" value="${num(a?.acquired_users)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Commission ($)</label><input id="lCommission" type="number" min="0" step="10" value="${num(a?.commission)}"></div>
      <div class="field"><label>Status</label><select id="lStatus">${Object.entries(ALLOC_STATUS).map(([k,v])=>`<option value="${k}" ${a?.status===k?'selected':''}>${v[0]}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Note</label><input id="lNote" value="${esc(a?.note||'')}"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="lSave">${editable?'Save changes':'Add allocation'}</button></div>`);
  ov.querySelector('#lSave').onclick=async()=>{
    const projectId=ov.querySelector('#lProject').value,partnerId=ov.querySelector('#lPartner').value;
    const payload={assigned_target:Math.round(num(ov.querySelector('#lTarget').value)),acquired_users:Math.round(num(ov.querySelector('#lAcquired').value)),commission:num(ov.querySelector('#lCommission').value),status:ov.querySelector('#lStatus').value,note:ov.querySelector('#lNote').value};
    try{
      if(editable)await mutate('allocations/'+a.id,{method:'PATCH',body:JSON.stringify(payload)});
      else await mutate('allocations',{method:'POST',body:JSON.stringify({project_id:projectId,partner_id:partnerId,...payload})});
      ov.remove();toast(editable?'Allocation updated.':'Allocation added.');renderAdmin();
    }catch(e){toast(e.message)}
  };
}

/* ---------- ADMIN: PAYMENTS ---------- */
let payFilterQ='';
async function aPayments(main){
  const c=viewCache.payments;
  if(c)renderPaymentsView(main,c.payments,c.partners);else main.innerHTML='<p class="muted">Loading…</p>';
  const bundle=await Promise.all([api('payments'),api('partners')]);
  viewCache.payments={payments:bundle[0],partners:bundle[1]};
  if(!typing(main))renderPaymentsView(main,bundle[0],bundle[1]);
}
function renderPaymentsView(main,payments,partners){
  const list=payments.filter(p=>!payFilterQ||(p.partner_name+' '+p.project_name+String(p.transaction_id||'')).toLowerCase().includes(payFilterQ.toLowerCase()));
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Payments</h1><p>Agent payouts with automatic available-balance validation.</p></div>
  <div class="actions"><button class="btn dark" id="addPay">+ Add payment</button></div></div>
  <div class="section-box"><div class="toolbar"><h2>Payment table</h2><div class="filters"><input id="payq" placeholder="Search partner, project or txn…" value="${esc(payFilterQ)}"></div></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>Payment ID</th><th>Date</th><th>Agent</th><th>Project</th><th>Amount</th><th>Method</th><th>Transaction</th><th>Status</th><th></th></tr></thead>
  <tbody>${list.length?list.map(p=>`<tr>
    <td><b>${esc(String(p.id).slice(0,8).toUpperCase())}</b></td><td>${fmtDate(p.payment_date)}</td>
    <td><div class="partner"><div class="avatar">${esc(initials(p.partner_name))}</div><div><b>${esc(p.partner_name)}</b><small>#${esc(p.partner_code)}</small></div></div></td>
    <td>${esc(p.project_name)}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.method)}</td><td>${esc(p.transaction_id||'—')}</td>
    <td>${pill(PAY_STATUS,p.status)}</td>
    <td class="actions-cell">${p.status!=='paid'?`<button class="btn small" data-paid="${p.id}">Mark paid</button>`:''}<button class="btn small danger" data-del="${p.id}">×</button></td>
  </tr>`).join(''):'<tr><td colspan="9" class="empty">No payments yet.</td></tr>'}</tbody></table></div></div>`;
  $('#addPay').onclick=()=>paymentModal(null,partners);
  $('#payq').oninput=e=>{payFilterQ=e.target.value;renderPaymentsView(main,payments,partners)};
  main.querySelectorAll('[data-paid]').forEach(b=>b.onclick=async()=>{try{await mutate('payments/'+b.dataset.paid,{method:'PATCH',body:JSON.stringify({status:'paid'})});toast('Payment marked as paid.');renderAdmin()}catch(e){toast(e.message)}});
  main.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this payment?'))return;try{await mutate('payments/'+b.dataset.del,{method:'DELETE'});toast('Payment deleted.');renderAdmin()}catch(e){toast(e.message)}});
}
function paymentModal(pay,partners){
  const ov=modal(`
    <h2>Add payment</h2>
    <p>The agent list shows only agents allocated to the selected project.</p>
    <div class="field"><label>Select project</label><select id="yProject"><option value="">Select project…</option></select></div>
    <div class="field"><label>Select agent</label><select id="yPartner" disabled><option value="">Select a project first…</option></select></div>
    <div class="field"><label>Available balance <small>(read only)</small></label><input id="yBalance" readonly value="—"></div>
    <div class="field-row">
      <div class="field"><label>Payment date</label><input id="yDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="field"><label>Payment amount ($)</label><input id="yAmount" type="number" min="0" step="10" placeholder="0"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Payment method</label><select id="yMethod"><option>Bank transfer</option><option>bKash</option><option>Nagad</option><option>Cash</option><option>Other</option></select></div>
      <div class="field"><label>Status</label><select id="yStatus"><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="paid">Paid</option></select></div>
    </div>
    <div class="field"><label>Transaction ID</label><input id="yTxn" placeholder="Optional"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="ySave">Add payment</button></div>`);
  let allocations=[];
  const projSel=ov.querySelector('#yProject'),partnerSel=ov.querySelector('#yPartner'),bal=ov.querySelector('#yBalance');
  (async()=>{
    try{
      allocations=await api('allocations');
      const projIds=[...new Set(allocations.map(a=>a.project_id))];
      const projects=await api('projects');
      projSel.innerHTML='<option value="">Select project…</option>'+projects.filter(x=>projIds.includes(x.id)).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    }catch(e){toast(e.message)}
  })();
  projSel.onchange=()=>{
    const opts=allocations.filter(a=>a.project_id===projSel.value);
    partnerSel.disabled=!projSel.value;
    partnerSel.innerHTML='<option value="">Select agent…</option>'+opts.map(a=>`<option value="${a.partner_id}">${esc(a.partner_name)} · #${esc(a.partner_code)}</option>`).join('');
    bal.value='—';
  };
  partnerSel.onchange=()=>{
    const p=partners.find(x=>x.id===partnerSel.value);
    bal.value=p?money(p.balance):'—';
  };
  ov.querySelector('#ySave').onclick=async()=>{
    const amount=num(ov.querySelector('#yAmount').value);
    const p=partners.find(x=>x.id===partnerSel.value);
    if(!projSel.value||!partnerSel.value)return toast('Select a project and agent.');
    if(p&&amount>p.balance)return toast(`Payment amount cannot exceed available balance (${money(p.balance)}).`);
    try{
      await mutate('payments',{method:'POST',body:JSON.stringify({project_id:projSel.value,partner_id:partnerSel.value,payment_date:ov.querySelector('#yDate').value,amount,method:ov.querySelector('#yMethod').value,status:ov.querySelector('#yStatus').value,transaction_id:ov.querySelector('#yTxn').value})});
      ov.remove();toast('Payment added.');renderAdmin();
    }catch(e){toast(e.message)}
  };
}

/* ---------- ADMIN: CONTRIBUTE ---------- */
async function aContribute(main){
  if(viewCache.contributions)renderAContribute(main,viewCache.contributions);else main.innerHTML='<p class="muted">Loading…</p>';
  const rows=await api('contributions');viewCache.contributions=rows;
  if(!typing(main))renderAContribute(main,rows);
}
function renderAContribute(main,rows){
  const count=k=>rows.filter(r=>r.status===k).length;
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Contribute</h1><p>Agent contribution requests — accept to add acquired users automatically.</p></div></div>
  <div class="kpi-grid">
    <div class="card stat"><div><div class="label">Pending</div><div class="value">${count('pending')}</div></div></div>
    <div class="card stat"><div><div class="label">Accepted</div><div class="value">${count('accepted')}</div></div></div>
    <div class="card stat"><div><div class="label">Rejected</div><div class="value">${count('rejected')}</div></div></div>
  </div>
  <div class="section-box"><div class="toolbar"><h2>All contribution requests</h2><span class="muted">Every agent · newest first</span></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>ID</th><th>Date &amp; time</th><th>Agent</th><th>Project</th><th>Acquired</th><th>Proof</th><th>Note</th><th>Status</th><th>Review</th><th></th></tr></thead>
  <tbody>${rows.length?rows.map(c=>`<tr>
    <td><b>${esc(c.code||String(c.id).slice(0,6))}</b></td>
    <td>${fmtDT(c.created_at)}</td>
    <td><div class="partner"><div class="avatar">${esc(initials(c.partner_name))}</div><div><b>${esc(c.partner_name)}</b><small>#${esc(c.partner_code)}</small></div></div></td>
    <td>${esc(c.project_name)}</td><td><b>+${num(c.acquired).toLocaleString()}</b></td>
    <td>${filesCell(c.files)}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.note||'')}">${esc(c.note||'—')}</td>
    <td>${pill(CONTRIB_STATUS,c.status)}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.review_note||'')}">${c.reviewed_at?esc(c.review_note||'—'):'—'}</td>
    <td class="actions-cell">${c.status==='pending'?`<button class="btn small" data-accept="${c.id}" data-n="${num(c.acquired)}">Accept</button><button class="btn small danger" data-reject="${c.id}">Reject</button>`:''}</td>
  </tr>`).join(''):'<tr><td colspan="9" class="empty">No contribution requests yet.</td></tr>'}</tbody></table></div></div>`;
  main.querySelectorAll('[data-files]').forEach(b=>b.onclick=()=>filesModal(JSON.parse(b.dataset.files)));
  main.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{
    if(!confirm(`Accept this contribution? ${b.dataset.n} users will be added to the allocation's Users acquired automatically.`))return;
    try{await mutate('contributions/'+b.dataset.accept,{method:'PATCH',body:JSON.stringify({action:'accept'})});toast('Contribution accepted — acquired users updated.');renderAdmin()}catch(e){toast(e.message)}
  });
  main.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{
    const note=prompt('Optional reason for rejection:');if(note===null)return;
    try{await mutate('contributions/'+b.dataset.reject,{method:'PATCH',body:JSON.stringify({action:'reject',note})});toast('Contribution rejected.');renderAdmin()}catch(e){toast(e.message)}
  });
}

/* ---------- ADMIN: PARTNER VIEW MODAL (details + edit history) ---------- */
function partnerViewModal(p){
  const ov=modal(`<h2>${esc(p.name)}</h2><p>Agent #${esc(p.partner_code)} — profile details &amp; edit history</p>
    <div id="pvBody"><p class="muted">Loading…</p></div>
    <div class="modal-actions"><button class="btn" data-close>Close</button></div>`);
  api(`partners/${p.id}/logs`).then(d=>{
    const me=d.partner,accts=me.accounts||[];
    ov.querySelector('#pvBody').innerHTML=`
    <div class="kv">
      <span>Agent ID</span><b>#${esc(me.partner_code)}</b>
      <span>Name</span><b>${esc(me.name)}</b>
      <span>Email</span><b>${esc(me.email)}</b>
      <span>Phone</span><b>${esc(me.phone||'—')}</b>
      <span>Type</span><b>${TYPE_LABELS[me.type]||me.type}</b>
      <span>Status</span><b>${pill(PARTNER_STATUS,me.status)}</b>
      <span>Login access</span><b>${me.login_access?'Enabled':'Disabled'}</b>
      <span>Note</span><b>${esc(me.note||'—')}</b>
      <span>Joined</span><b>${fmtDate(me.created_at)}</b>
    </div>
    <div class="section-head" style="margin-top:16px"><h2>Social accounts</h2></div>
    ${accts.length?accts.map(a=>`<div class="target-row"><b>${esc(a.label||'Account')}</b><span style="grid-column:2/5"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a></span></div>`).join(''):'<p class="muted" style="font-size:12px">No social accounts.</p>'}
    <div class="section-head" style="margin-top:16px"><h2>Financial (auto)</h2></div>
    <div class="kv">
      <span>Projects</span><b>${p.projects??0}</b>
      <span>Total acquired users</span><b>${num(p.acquired_users).toLocaleString()}</b>
      <span>Total income</span><b>${money(p.income)}</b>
      <span>Paid</span><b>${money(p.paid)}</b>
      <span>Remaining balance</span><b>${money(p.balance)}</b>
    </div>
    <div class="section-head" style="margin-top:16px"><h2>Edit history</h2><span class="muted">Changes made by the partner</span></div>
    <div style="overflow:auto"><table class="view-table"><thead><tr><th>When</th><th>Field</th><th>Old</th><th>New</th></tr></thead>
    <tbody>${d.logs.length?d.logs.map(L=>`<tr><td>${fmtDT(L.created_at)}</td><td><b>${esc(L.field)}</b></td><td class="muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(L.old_value||'—')}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(L.new_value||'—')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No profile edits recorded yet.</td></tr>'}</tbody></table></div>`;
  }).catch(e=>{ov.querySelector('#pvBody').innerHTML=`<div class="empty">${esc(e.message)}</div>`});
}

/* ---------- ADMIN: VAULTIUM (contribution files) ---------- */
async function aVaultium(main){
  if(viewCache.vaultium)renderVaultium(main,viewCache.vaultium);else main.innerHTML='<p class="muted">Loading…</p>';
  const rows=await api('vaultium');viewCache.vaultium=rows;
  if(!typing(main))renderVaultium(main,rows);
}
function renderVaultium(main,rows){
  const totalBytes=rows.reduce((a,f)=>a+num(f.file_size),0);
  const month=new Date().toISOString().slice(0,7);
  const thisMonth=rows.filter(f=>String(f.created_at||'').startsWith(month)).length;
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Vaultium</h1><p>Every proof file from contribution requests — stored in the Vaultium R2 bucket.</p></div></div>
  <div class="kpi-grid">
    <div class="card stat"><div><div class="label">Total files</div><div class="value">${rows.length}</div></div></div>
    <div class="card stat"><div><div class="label">Storage used</div><div class="value">${fmtSize(totalBytes)}</div></div></div>
    <div class="card stat"><div><div class="label">Files this month</div><div class="value">${thisMonth}</div></div></div>
  </div>
  <div class="section-box"><div class="toolbar"><h2>All files</h2><span class="muted">Newest first</span></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>File name</th><th>Date &amp; time</th><th>Size</th><th>Type</th><th>Contribution</th><th>Agent</th><th>Project</th><th></th></tr></thead>
  <tbody>${rows.length?rows.map(f=>`<tr>
    <td><b>${esc(f.file_name)}</b></td>
    <td>${fmtDT(f.created_at)}</td>
    <td>${fmtSize(f.file_size)}</td>
    <td>${esc(f.file_type||'—')}</td>
    <td><b>${esc(f.contribution_code||'—')}</b></td>
    <td><div class="partner"><div class="avatar">${esc(initials(f.partner_name))}</div><div><b>${esc(f.partner_name)}</b><small>#${esc(f.partner_code)}</small></div></div></td>
    <td>${esc(f.project_name)}</td>
    <td class="actions-cell"><button class="btn small" data-vopen="${f.id}" data-vname="${esc(f.file_name)}">Open</button><button class="btn small danger" data-vdel="${f.id}">×</button></td>
  </tr>`).join(''):'<tr><td colspan="8" class="empty">No files stored yet.</td></tr>'}</tbody></table></div></div>`;
  main.querySelectorAll('[data-vopen]').forEach(b=>b.onclick=()=>openFile(b.dataset.vopen,b.dataset.vname));
  main.querySelectorAll('[data-vdel]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Delete this file from Vaultium storage?'))return;
    try{await mutate('files/'+b.dataset.vdel,{method:'DELETE'});toast('File deleted.');renderAdmin()}catch(e){toast(e.message)}
  });
}

/* ---------- ADMIN: HELPDESK ---------- */
let hdPoll=null;
async function aHelpdesk(main){
  main.innerHTML='<p class="muted">Loading…</p>';
  const render=async()=>{
    const d=await api('helpdesk');
    if(aView!=='helpdesk')return;
    updateHdBadge(d.totalUnread||0);
    renderHelpdeskThreads(main,d.threads);
  };
  await render();
  clearInterval(hdPoll);
  hdPoll=setInterval(()=>{if(aView==='helpdesk')render().catch(()=>{})},12000);
}
function renderHelpdeskThreads(main,threads){
  main.innerHTML=`
  <div class="top"><div class="title"><h1>HelpDesk</h1><p>One continuous conversation with every agent.</p></div></div>
  <div class="section-box">
    ${threads.length?threads.map(t=>`<div class="row" style="cursor:pointer" data-thread="${t.partner_id}">
      <div class="left"><div class="mini">${esc(initials(t.partner_name))}</div>
        <div><b>${esc(t.partner_name)} <small style="color:#888">#${esc(t.partner_code)}</small></b>
        <small>${esc((t.last||'').slice(0,80))} · ${fmtDT(t.last_at)} · ${t.total} message${t.total===1?'':'s'}</small></div></div>
      <div>${t.unread?`<span class="pill red">${t.unread} new</span>`:'<span class="pill gray">Read</span>'}</div>
    </div>`).join(''):'<div class="empty">No conversations yet. Agents can start one from their HelpDesk page.</div>'}
  </div>`;
  main.querySelectorAll('[data-thread]').forEach(r=>r.onclick=()=>helpdeskChatModal(r.dataset.thread));
}
function helpdeskChatModal(partnerId){
  const ov=modal(`<h2 id="hcTitle">Conversation</h2><p>Messages are continuous and never cleared.</p>
    <div class="chat" id="hcLog"><p class="muted">Loading…</p></div>
    <div class="chatbar"><input id="hcInput" placeholder="Write a reply…"><button class="btn dark" id="hcSend">Send</button></div>`);
  const log=ov.querySelector('#hcLog');
  const paint=(partner,messages)=>{
    ov.querySelector('#hcTitle').textContent='Conversation with '+partner.name;
    log.innerHTML=messages.length?messages.map(m=>`<div class="msg ${m.sender_type==='admin'?'me':''}"><p>${esc(m.body)}</p><time>${fmtDT(m.created_at)} · ${m.sender_type==='admin'?'You':partner.name}</time></div>`).join(''):'<p class="muted">No messages yet — say hello.</p>';
    log.scrollTop=log.scrollHeight;
  };
  const load=async()=>{const d=await api('helpdesk/'+partnerId);paint(d.partner,d.messages);return d};
  load().catch(e=>log.innerHTML=`<div class="empty">${esc(e.message)}</div>`);
  const send=async()=>{
    const input=ov.querySelector('#hcInput'),text=input.value.trim();
    if(!text)return;
    try{input.value='';await mutate('helpdesk/'+partnerId,{method:'POST',body:JSON.stringify({body:text})});await load()}catch(e){toast(e.message)}
  };
  ov.querySelector('#hcSend').onclick=send;
  ov.querySelector('#hcInput').onkeydown=e=>{if(e.key==='Enter')send()};
}
function updateHdBadge(n){
  const b=$('#hdBadge');
  if(!b)return;
  b.textContent=n>9?'9+':n;
  b.style.display=n?'inline-block':'none';
}

/* ---------- ADMIN: PERFORMANCE ---------- */

async function aPerformance(main){
  if(viewCache.performance)renderPerformanceView(main,viewCache.performance);else main.innerHTML='<p class="muted">Loading…</p>';
  const rows=await api('performance');viewCache.performance=rows;
  if(!typing(main))renderPerformanceView(main,rows);
}
function renderPerformanceView(main,rows){
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Performance</h1><p>Agent achievement against acquisition targets — ranked automatically.</p></div></div>
  <div class="section-box"><div style="overflow:auto"><table class="view-table"><thead><tr><th>Rank</th><th>Agent</th><th>Projects</th><th>Assigned users</th><th>Acquired users</th><th>Achievement</th></tr></thead>
  <tbody>${rows.length?rows.map(r=>`<tr>
    <td><b>#${r.rank}</b></td>
    <td><div class="partner"><div class="avatar">${esc(initials(r.name))}</div><div><b>${esc(r.name)}</b><small>#${esc(r.partner_code)} · ${TYPE_LABELS[r.type]||r.type}</small></div></div></td>
    <td>${r.projects}</td><td>${num(r.assigned).toLocaleString()}</td><td><b>${num(r.acquired).toLocaleString()}</b></td>
    <td style="min-width:140px"><div style="display:flex;justify-content:space-between;font-size:11px"><b>${r.pct}%</b></div><div class="progress"><i style="width:${Math.min(100,r.pct)}%"></i></div></td>
  </tr>`).join(''):'<tr><td colspan="6" class="empty">No performance data yet.</td></tr>'}</tbody></table></div></div>`;
}

/* ---------- ADMIN: SETTINGS ---------- */
function aSettings(main){
  main.innerHTML=`<div class="top"><div class="title"><h1>Settings</h1><p>Workspace settings.</p></div></div>
  <div class="section-box"><div class="empty" style="padding:60px">⚙<br><br><b>Future Development</b><br>Settings will arrive in an upcoming release.</div></div>`;
}

/* ═══════════ PARTNER (AGENT) APP ═══════════ */
let pView='profile';
function partnerApp(){
  document.title='InfluencerOS — Agent';
  const nav=[['profile','◉','Profile'],['contribute','⇧','Contribute'],['projects','◆','Projects'],['payments','$','Payments'],['performance','◫','Performance'],['helpdesk','✉','HelpDesk <span class="navbadge" id="hdBadge" style="display:none"></span>']];
  app.innerHTML=`<div class="app">
    <aside class="sidebar">
      <div class="logo">Influence<span>OS</span><small>agent portal · DoxTox</small></div>
      <div class="nav-label">My workspace</div>
      <div class="nav">${nav.map(([k,i,l])=>`<button data-v="${k}" class="${k===pView?'active':''}"><span class="icon">${i}</span> ${l}</button>`).join('')}</div>
      <div class="sidebottom"><button id="outBtn">⏻ Logout</button></div>
    </aside>
    <main class="main" id="main"><p class="muted">Loading…</p></main>
  </div>`;
  document.querySelectorAll('.nav button[data-v]').forEach(b=>b.onclick=()=>{pView=b.dataset.v;document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));renderPartner()});
  $('#outBtn').onclick=logout;
  api('helpdesk').then(d=>updateHdBadge(d.unread||0)).catch(()=>{});
  renderPartner();
}
async function renderPartner(){
  const main=$('#main');if(!main)return;
  try{
    if(pView==='profile')return await pProfile(main);
    clearInterval(hdPoll);
    if(pView==='contribute')return await pContribute(main);
    if(pView==='helpdesk')return await pHelpdesk(main);
    if(pView==='projects')return await pOverview(main,'projects');
    if(pView==='payments')return await pOverview(main,'payments');
    if(pView==='performance')return await pOverview(main,'performance');
  }catch(e){main.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
async function pProfile(main){
  if(viewCache['me/profile'])renderPProfile(main,viewCache['me/profile']);else main.innerHTML='<p class="muted">Loading…</p>';
  const me=await api('me/profile');viewCache['me/profile']=me;
  if(!typing(main))renderPProfile(main,me);
}
function renderPProfile(main,me){
  main.innerHTML=`
  <div class="top"><div class="title"><h1>My profile</h1><p>Your partner account information.</p></div>
  <div class="actions"><button class="btn dark" id="editProfile">Edit profile</button></div></div>
  <div class="section-box">
    <div class="detail-head"><div style="display:flex;gap:14px;align-items:center"><div class="avatar" style="width:52px;height:52px;font-size:16px">${esc(initials(me.name))}</div><div><h2>${esc(me.name)}</h2><p>Agent ID <b>#${esc(me.partner_code)}</b></p></div></div><span class="pill ${me.login_access?'green':'red'}">${me.login_access?'Login enabled':'Login disabled'}</span></div>
    <div class="kv" style="margin-top:14px">
      <span>Email</span><b>${esc(me.email)}</b>
      <span>Phone number</span><b>${esc(me.phone||'—')}</b>
      <span>Partner type</span><b>${TYPE_LABELS[me.type]||me.type}</b>
      <span>Password</span><b>••••••••</b>
    </div>
    <div class="section-head" style="margin-top:18px"><h2>Social accounts</h2></div>
    ${(me.accounts||[]).length?me.accounts.map(a=>`<div class="target-row"><b>${esc(a.label||'Account')}</b><span style="grid-column:2/5"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a></span></div>`).join(''):'<p class="muted" style="font-size:12px">No social accounts saved.</p>'}
  </div>`;
  $('#editProfile').onclick=()=>{
    const accounts=(me.accounts&&me.accounts.length?me.accounts:[{label:'',url:''}]);
    const ov=modal(`
    <h2>Edit profile</h2>
    <p>You can update your own details. Every change is logged for the administrator.</p>
    <div class="field-row">
      <div class="field"><label>Name</label><input id="sName" value="${esc(me.name)}"></div>
      <div class="field"><label>Email</label><input id="sEmail" type="email" value="${esc(me.email)}"></div>
    </div>
    <div class="field"><label>Phone number</label><input id="sPhone" value="${esc(me.phone||'')}"></div>
    <div class="field"><label>Social / account information <small>(up to 5)</small></label><div id="sAcctBox"></div>
      <button class="btn small" id="sAddAcct" type="button">+ Add URL</button></div>
    <div class="field"><label>Password <small>(leave blank to keep current)</small></label><input id="sPass" type="password" placeholder="Minimum 6 characters"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="sGo">Save changes</button></div>`);
    const box=ov.querySelector('#sAcctBox');
    const addRow=(a={label:'',url:''})=>{
      if(box.children.length>=5){toast('Maximum 5 account URLs.');return}
      const r=document.createElement('div');r.className='acct-row';
      r.innerHTML=`<input placeholder="Label (YouTube…)" value="${esc(a.label)}"><input placeholder="https://…" value="${esc(a.url)}"><button class="btn small danger" type="button">×</button>`;
      r.querySelector('button').onclick=()=>r.remove();box.append(r);
    };
    accounts.forEach(addRow);
    ov.querySelector('#sAddAcct').onclick=()=>addRow();
    ov.querySelector('#sGo').onclick=async()=>{
      const accountsList=[...box.querySelectorAll('.acct-row')].map(r=>({label:r.children[0].value,url:r.children[1].value})).filter(a=>a.label.trim()||a.url.trim());
      try{
        await mutate('me/profile',{method:'POST',body:JSON.stringify({name:ov.querySelector('#sName').value,email:ov.querySelector('#sEmail').value,phone:ov.querySelector('#sPhone').value,accounts:accountsList,password:ov.querySelector('#sPass').value||undefined})});
        ov.remove();toast('Profile updated.');renderPartner();
      }catch(e){toast(e.message)}
    };
  };
}
async function pOverview(main,view){
  const render=d=>{if(view==='projects')renderPProjects(main,d);else if(view==='payments')renderPPayments(main,d);else renderPPerformance(main,d)};
  if(viewCache['me/overview'])render(viewCache['me/overview']);
  const d=await api('me/overview');viewCache['me/overview']=d;
  if(!typing(main))render(d);
}
function renderPProjects(main,d){
    main.innerHTML=`<div class="top"><div class="title"><h1>My projects</h1><p>Projects allocated to your account.</p></div></div>
    <div class="project-grid">${d.projects.length?d.projects.map(x=>`
      <div class="project-card"><div class="detail-head"><div><h3>${esc(x.project?.name||'—')}</h3><p>${esc(x.project?.details||'')}</p></div>${projPill(x.project?.status||'active')}</div>
        <div class="meta"><span>My target</span><b>${num(x.assigned_target).toLocaleString()}</b></div>
        <div class="meta"><span>My acquired</span><b>${num(x.acquired_users).toLocaleString()}</b></div>
        <div class="progress-lg"><i style="width:${Math.min(100,x.pct)}%"></i></div>
        <div class="meta"><span>${x.pct}% achieved</span><span>${money(x.commission)} commission</span></div>
      </div>`).join(''):'<div class="empty" style="grid-column:1/-1">No projects allocated to you yet.</div>'}</div>`;
}
function renderPPayments(main,d){
    main.innerHTML=`<div class="top"><div class="title"><h1>My payments</h1><p>Earnings and payout history.</p></div></div>
    <div class="kpi-grid">
      <div class="card stat"><div><div class="label">Total Earnings</div><div class="value">${money(d.stats.income)}</div></div></div>
      <div class="card stat"><div><div class="label">Paid</div><div class="value">${money(d.stats.paid)}</div></div></div>
      <div class="card stat"><div><div class="label">Available Balance</div><div class="value">${money(d.stats.balance)}</div></div></div>
    </div>
    <div class="section-box"><div class="toolbar"><h2>Payout history</h2></div><div style="overflow:auto"><table class="view-table"><thead><tr><th>Payment ID</th><th>Date</th><th>Project</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
    <tbody>${d.payments.length?d.payments.map(p=>`<tr><td><b>${esc(String(p.id).slice(0,8).toUpperCase())}</b></td><td>${fmtDate(p.payment_date)}</td><td>${esc(p.project_name)}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.method)}</td><td>${pill(PAY_STATUS,p.status)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No payments yet.</td></tr>'}</tbody></table></div></div>`;
}
function renderPPerformance(main,d){
    main.innerHTML=`<div class="top"><div class="title"><h1>My performance</h1><p>Your achievement across all allocated projects.</p></div></div>
    <div class="kpi-grid">
      <div class="card stat"><div><div class="label">Total Projects</div><div class="value">${d.performance.projects}</div></div></div>
      <div class="card stat"><div><div class="label">Assigned Users</div><div class="value">${num(d.performance.assigned).toLocaleString()}</div></div></div>
      <div class="card stat"><div><div class="label">Acquired Users</div><div class="value">${num(d.performance.acquired).toLocaleString()}</div></div></div>
      <div class="card stat"><div><div class="label">Achievement</div><div class="value">${d.performance.pct}%</div><div class="change">Rank #${d.performance.rank||'—'} of ${d.performance.total}</div></div></div>
    </div>
    <div class="section-box"><div class="toolbar"><h2>Project-wise performance</h2></div><div style="overflow:auto"><table class="view-table"><thead><tr><th>Project</th><th>My target</th><th>My acquired</th><th>Achievement</th><th>Commission</th><th>Status</th></tr></thead>
    <tbody>${d.projects.length?d.projects.map(x=>`<tr><td><b>${esc(x.project?.name||'—')}</b></td><td>${num(x.assigned_target).toLocaleString()}</td><td>${num(x.acquired_users).toLocaleString()}</td><td>${x.pct}%</td><td>${money(x.commission)}</td><td>${pill(ALLOC_STATUS,x.status)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No allocations yet.</td></tr>'}</tbody></table></div></div>`;
}

/* ---------- PARTNER: CONTRIBUTE ---------- */
async function pContribute(main){
  if(viewCache['contributions/mine'])renderPContribute(main,viewCache['contributions/mine']);else main.innerHTML='<p class="muted">Loading…</p>';
  const [rows,ov]=await Promise.all([api('contributions/mine'),api('me/overview')]);
  viewCache['contributions/mine']=rows;viewCache['me/overview']=ov;
  if(!typing(main))renderPContribute(main,rows);
}
function renderPContribute(main,rows){
  main.innerHTML=`
  <div class="top"><div class="title"><h1>Contribute</h1><p>Submit the users you acquired today with proof — the admin reviews every request.</p></div>
  <div class="actions"><button class="btn dark" id="addContrib">+ Add contribution</button></div></div>
  <div class="section-box"><div class="toolbar"><h2>My contribution requests</h2><span class="muted">Newest first</span></div>
  <div style="overflow:auto"><table class="view-table"><thead><tr><th>ID</th><th>Date &amp; time</th><th>Project</th><th>Acquired</th><th>Proof</th><th>Note</th><th>Status</th><th>Admin review</th></tr></thead>
  <tbody>${rows.length?rows.map(c=>`<tr>
    <td><b>${esc(c.code||String(c.id).slice(0,6))}</b></td>
    <td>${fmtDT(c.created_at)}</td>
    <td>${esc(c.project_name)}</td>
    <td><b>+${num(c.acquired).toLocaleString()}</b></td>
    <td>${filesCell(c.files)}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.note||'')}">${esc(c.note||'—')}</td>
    <td>${pill(CONTRIB_STATUS,c.status)}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.review_note||'')}">${c.reviewed_at?esc(c.review_note||'Reviewed'):'Waiting for review'}</td>
  </tr>`).join(''):'<tr><td colspan="7" class="empty">No contribution requests yet. Click “+ Add contribution”.</td></tr>'}</tbody></table></div></div>`;
  main.querySelectorAll('[data-files]').forEach(b=>b.onclick=()=>filesModal(JSON.parse(b.dataset.files)));
  $('#addContrib').onclick=contributeModal;
}
function contributeModal(){
  const ov=viewCache['me/overview'],projects=(ov?.projects||[]).filter(x=>x.project);
  const m=modal(`
    <h2>Add contribution</h2>
    <p>Request credit for users you acquired today. The admin accepts or rejects each request after checking the proof.</p>
    <div class="field"><label>Project</label><select id="cProject"><option value="">Select project…</option>${projects.map(x=>`<option value="${x.project.id}">${esc(x.project.name)} · target ${num(x.assigned_target).toLocaleString()}</option>`).join('')}</select></div>
    <div class="field"><label>Today acquired (users)</label><input id="cAcquired" type="number" min="1" step="1" placeholder="e.g. 120"></div>
    <div class="field"><label>Proof of acquired <small>(up to 10 files · each max 10 MB)</small></label><input id="cFile" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"></div>
    <div class="field"><label>Note <small>(optional)</small></label><input id="cNote" placeholder="Anything the admin should know"></div>
    <div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn dark" id="cGo">Send request</button></div>`);
  m.querySelector('#cGo').onclick=async()=>{
    if(!m.querySelector('#cProject').value)return toast('Select a project.');
    const picked=[...m.querySelector('#cFile').files];
    if(!picked.length)return toast('Attach at least one proof file.');
    if(picked.length>10)return toast('Maximum 10 proof files per request.');
    if(picked.some(f=>f.size>10*1024*1024))return toast('Each proof file must be 10 MB or smaller.');
    const fd=new FormData();
    fd.append('project_id',m.querySelector('#cProject').value);
    fd.append('acquired',m.querySelector('#cAcquired').value);
    fd.append('note',m.querySelector('#cNote').value);
    picked.forEach(f=>fd.append('file',f));
    try{await upload('contributions',fd);dropCache();m.remove();toast('Contribution request sent for review.');renderPartner()}
    catch(e){toast(e.message)}
  };
}

/* ---------- AGENT: HELPDESK ---------- */
let phdPoll=null;
async function pHelpdesk(main){
  main.innerHTML='<p class="muted">Loading…</p>';
  const render=async()=>{
    const d=await api('helpdesk');
    if(pView!=='helpdesk')return;
    updateHdBadge(d.unread||0);
    main.innerHTML=`
    <div class="top"><div class="title"><h1>HelpDesk</h1><p>Your continuous conversation with the administrator.</p></div></div>
    <div class="section-box" style="padding:0;overflow:hidden">
      <div class="chat big" id="phLog"></div>
      <div class="chatbar"><input id="phInput" placeholder="Write a message…"><button class="btn dark" id="phSend">Send</button></div>
    </div>`;
    const log=$('#phLog');
    log.innerHTML=d.messages.length?d.messages.map(m=>`<div class="msg ${m.sender_type==='agent'?'me':''}"><p>${esc(m.body)}</p><time>${fmtDT(m.created_at)} · ${m.sender_type==='agent'?'You':'Admin'}</time></div>`).join(''):'<div class="empty">No messages yet — write to the administrator anytime.</div>';
    log.scrollTop=log.scrollHeight;
    $('#phSend').onclick=send;
    $('#phInput').onkeydown=e=>{if(e.key==='Enter')send()};
  };
  const send=async()=>{
    const input=$('#phInput'),text=input.value.trim();
    if(!text)return;
    try{input.value='';await mutate('helpdesk',{method:'POST',body:JSON.stringify({body:text})});await render()}catch(e){toast(e.message)}
  };
  await render();
  clearInterval(phdPoll);
  phdPoll=setInterval(()=>{if(pView==='helpdesk')render().catch(()=>{})},12000);
}

/* ═══════════ BOOT ═══════════ */

function boot(){
  if(state?.role==='admin')return adminApp();
  if(state?.role==='partner')return partnerApp();
  landing();
}
boot();

