/* Cloudflare Pages Function: InfluencerOS API (partner & influencer management).
   Separate database from EMS — uses IOS_SUPABASE_URL / IOS_SUPABASE_SERVICE_ROLE_KEY,
   and IOS_SESSION_SECRET for sessions. Mounted at /api/ios/* . */
const enc = new TextEncoder(), dec = new TextDecoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail=(message,status=400)=>json({error:message},status);
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function hmac(v,key){return crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(v));}
async function token(payload,key){let h=b64u(enc.encode(JSON.stringify({alg:'HS256',typ:'JWT'}))),p=b64u(enc.encode(JSON.stringify(payload)));return h+'.'+p+'.'+b64u(await hmac(h+'.'+p,key));}
async function session(req,key){let x=req.headers.get('authorization')?.replace('Bearer ','');if(!x)return null;let [h,p,s]=x.split('.');if(!h||!p||!s||b64u(await hmac(h+'.'+p,key))!==s)return null;let d=JSON.parse(dec.decode(unb64(p)));return d.exp>Date.now()/1000?d:null;}
const PBKDF2_ITERATIONS=100000;
async function hash(password,salt=b64u(crypto.getRandomValues(new Uint8Array(16)))){let bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']),256);return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${b64u(bits)}`;}
async function check(password,stored){let [,i,s,v]=stored.split('$'),iterations=+i;if(!iterations||iterations>PBKDF2_ITERATIONS)return false;let bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']),256);return b64u(bits)===v;}
function db(env,path,opt={}){return fetch(env.IOS_SUPABASE_URL+'/rest/v1/'+path,{...opt,headers:{apikey:env.IOS_SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.IOS_SUPABASE_SERVICE_ROLE_KEY,Prefer:'return=representation',...(opt.headers||{})}}).then(async r=>{let x=await r.json().catch(()=>null);if(!r.ok)throw Error(x?.message||'Database request failed');return x;});}
async function body(req){try{return await req.json()}catch{return {}}}
const num=x=>Number(x)||0;
const PARTNER_TYPES=['youtuber','facebook','tiktoker','instagram','marketing_agent','agency'];
const PARTNER_STATUSES=['disagree','agree','not_response','waiting'];
const ALLOCATION_STATUSES=['on_target','active','behind','inactive'];
const PAYMENT_STATUSES=['scheduled','paid','pending'];
const cleanAccounts=list=>(Array.isArray(list)?list:[]).filter(a=>a&&(String(a.label||'').trim()||String(a.url||'').trim())).slice(0,5).map(a=>({label:String(a.label||'').trim().slice(0,60),url:String(a.url||'').trim().slice(0,300)}));
const publicPartner=p=>{delete p.password_hash;return p};

async function partnerStats(env,ids){
  const want=ids&&ids.length?ids:null;
  let allocs=await db(env,'allocations?select=partner_id,project_id,assigned_target,acquired_users,commission');
  let pays=await db(env,'payments?select=partner_id,amount,status');
  const map={};
  const slot=id=>map[id]??={projects:0,acquired:0,income:0,paid:0};
  for(const a of allocs){if(want&&!want.includes(a.partner_id))continue;const s=slot(a.partner_id);s.projects++;s.acquired+=num(a.acquired_users);s.income+=num(a.commission);}
  for(const p of pays){if(p.status!=='paid'||(want&&!want.includes(p.partner_id)))continue;slot(p.partner_id).paid+=num(p.amount);}
  for(const k in map){map[k].income=Math.round(map[k].income*100)/100;map[k].paid=Math.round(map[k].paid*100)/100;map[k].balance=Math.round((map[k].income-map[k].paid)*100)/100;}
  return {stats:map,allocs,pays};
}
function allocToRow(a,projectMap,partnerMap){
  const p=partnerMap[a.partner_id]||{},pr=projectMap[a.project_id]||{};
  return {...a,partner_name:p.name||'—',partner_code:p.partner_code||'',project_name:pr.name||'—'};
}
function payToRow(p,projectMap,partnerMap){
  const pr=partnerMap[p.partner_id]||{},pg=projectMap[p.project_id]||{};
  return {...p,partner_name:pr.name||'—',partner_code:pr.partner_code||'',project_name:pg.name||'—'};
}

export async function onRequest(context){
  const {request,env,params}=context, path=(params.path||[]).join('/'), method=request.method;
  try{
    {let missing=['IOS_SUPABASE_URL','IOS_SUPABASE_SERVICE_ROLE_KEY','IOS_SESSION_SECRET'].filter(k=>!env[k]);if(missing.length)return fail('InfluencerOS server configuration is incomplete: missing '+missing.join(', ')+'.',500);}

    /* ---------- AUTH ---------- */
    if(path==='auth/status'&&method==='GET'){
      let admins=await db(env,'admins?select=id&limit=1');
      return json({hasAdmin:admins.length>0});
    }
    if(path==='auth/admin/register'&&method==='POST'){
      let b=await body(request),email=String(b.email||'').trim().toLowerCase();
      let admins=await db(env,'admins?select=id&limit=1');
      if(admins.length)return fail('An administrator already exists. Please sign in.',409);
      if(!b.name||!email||!b.password||String(b.password).length<6)return fail('Name, email and a 6-character password are required.');
      let hashP=await hash(String(b.password));
      let [admin]=await db(env,'admins',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:String(b.name).slice(0,120),email,password_hash:hashP})});
      return json({token:await token({id:admin.id,role:'admin',exp:Math.floor(Date.now()/1000)+28800},env.IOS_SESSION_SECRET),user:{id:admin.id,name:admin.name,email:admin.email}});
    }
    if(path==='auth/admin/login'&&method==='POST'){
      let b=await body(request),email=String(b.email||'').trim().toLowerCase();
      let [admin]=await db(env,`admins?email=eq.${encodeURIComponent(email)}&select=*`);
      if(!admin||!await check(String(b.password||''),admin.password_hash))return fail('Invalid email or password.',401);
      return json({token:await token({id:admin.id,role:'admin',exp:Math.floor(Date.now()/1000)+28800},env.IOS_SESSION_SECRET),user:{id:admin.id,name:admin.name,email:admin.email}});
    }
    if(path==='auth/partner/login'&&method==='POST'){
      let b=await body(request),id=String(b.identifier||'').trim().toLowerCase();
      if(!id||!b.password)return fail('Partner ID / email and password are required.');
      const byCode=/^\d{4}$/.test(id)?`partners?partner_code=eq.${id}&select=*`:`partners?email=eq.${encodeURIComponent(id)}&select=*`;
      let [p]=(await db(env,byCode)).filter(x=>x.email===id||String(b.identifier).trim()===x.partner_code);
      if(!p||!await check(String(b.password),p.password_hash))return fail('Invalid Partner ID / email or password.',401);
      if(!p.login_access)return fail('Login access is disabled for this partner account.',403);
      return json({token:await token({id:p.id,role:'partner',exp:Math.floor(Date.now()/1000)+28800},env.IOS_SESSION_SECRET),user:publicPartner(p)});
    }

    /* ---------- everything below requires a session ---------- */
    let s=await session(request,env.IOS_SESSION_SECRET);
    if(!s)return fail('Please sign in.',401);
    const adminOnly=()=>fail('Administrator access required.',403);
    if(s.role!=='admin'&&s.role!=='partner')return fail('Invalid session.',403);
    // partner sessions stay valid only while the account exists & keeps access
    if(s.role==='partner'){
      let [me]=await db(env,`partners?id=eq.${s.id}&select=id,login_access`);
      if(!me)return fail('This partner account no longer exists.',403);
      if(!me.login_access)return fail('Login access is disabled for this partner account.',403);
    }

    /* ---------- PARTNER (agent) SELF-SERVICE ---------- */
    if(s.role==='partner'){
      if(path==='me/profile'&&method==='GET'){
        let [me]=await db(env,`partners?id=eq.${s.id}&select=*`);
        return json(publicPartner(me));
      }
      if(path==='me/password'&&method==='POST'){
        let b=await body(request);
        if(!b.password||String(b.password).length<6)return fail('New password must be at least 6 characters.');
        await db(env,`partners?id=eq.${s.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({password_hash:await hash(String(b.password)),updated_at:new Date().toISOString()})});
        return json({ok:true});
      }
      if(path==='me/overview'&&method==='GET'){
        let {stats}=await partnerStats(env,[s.id]);
        let allocs=await db(env,`allocations?partner_id=eq.${s.id}&select=*&order=created_at.desc`);
        let projects=allocs.length?await db(env,'projects?select=*'):[];

        let pays=await db(env,`payments?partner_id=eq.${s.id}&select=*&order=payment_date.desc,created_at.desc`);
        const projectMap=Object.fromEntries(projects.map(x=>[x.id,x]));
        const assigned=allocs.reduce((a,x)=>a+num(x.assigned_target),0),acquired=allocs.reduce((a,x)=>a+num(x.acquired_users),0);
        let allAllocs=await db(env,'allocations?select=partner_id,assigned_target,acquired_users');
        const byPartner={};
        for(const a of allAllocs){byPartner[a.partner_id]??={assigned:0,acquired:0};byPartner[a.partner_id].assigned+=num(a.assigned_target);byPartner[a.partner_id].acquired+=num(a.acquired_users);}
        const ranked=Object.entries(byPartner).map(([pid,v])=>({id:pid,...v,pct:v.assigned>0?Math.round(v.acquired/v.assigned*100):0})).sort((a,b)=>b.pct-a.pct||b.acquired-a.acquired);
        const rank=ranked.findIndex(x=>x.id===s.id)+1;
        return json({
          profile:null,
          stats:stats[s.id]||{projects:0,acquired:0,income:0,paid:0,balance:0},
          projects:allocs.map(a=>({id:a.id,project:projectMap[a.project_id]||null,assigned_target:a.assigned_target,acquired_users:a.acquired_users,commission:a.commission,status:a.status,note:a.note,pct:num(a.assigned_target)>0?Math.round(num(a.acquired_users)/num(a.assigned_target)*100):0})),
          payments:pays.map(p=>payToRow(p,projectMap,{[s.id]:{name:'',partner_code:''}})),
          performance:{projects:allocs.length,assigned,acquired,pct:assigned>0?Math.round(acquired/assigned*100):0,rank:rank||null,total:ranked.length}
        });
      }
      return fail('Not found.',404);
    }

    /* ---------- ADMIN API ---------- */
    if(path==='overview'&&method==='GET'){
      let [partners,projects,allocs,pays]=await Promise.all([
        db(env,'partners?select=id,name,partner_code,status,type&order=created_at.desc'),
        db(env,'projects?select=*&order=created_at.desc'),
        db(env,'allocations?select=*&order=created_at.desc'),
        db(env,'payments?select=*&order=payment_date.desc,created_at.desc&limit=500')
      ]);
      const projectMap=Object.fromEntries(projects.map(x=>[x.id,x])),partnerMap=Object.fromEntries(partners.map(x=>[x.id,x]));
      let income=0,assigned=0,acquired=0;
      for(const a of allocs){income+=num(a.commission);assigned+=num(a.assigned_target);acquired+=num(a.acquired_users);}
      let paid=pays.filter(p=>p.status==='paid').reduce((a,p)=>a+num(p.amount),0);
      return json({
        kpis:{
          totalPartners:partners.length,
          activeProjects:projects.filter(p=>p.status==='active').length,
          assignedTarget:assigned,
          acquiredUsers:acquired,
          totalIncome:Math.round(income*100)/100,
          totalPaid:Math.round(paid*100)/100,
          remainingBalance:Math.round((income-paid)*100)/100,
          overallPerformance:assigned>0?Math.round(acquired/assigned*100):0
        },
        contributions:allocs.map(a=>allocToRow(a,projectMap,partnerMap)),
        projects:projects.map(p=>({id:p.id,name:p.name,status:p.status,target:allocs.filter(a=>a.project_id===p.id).reduce((x,a)=>x+num(a.assigned_target),0),acquired:allocs.filter(a=>a.project_id===p.id).reduce((x,a)=>x+num(a.acquired_users),0),partners:new Set(allocs.filter(a=>a.project_id===p.id).map(a=>a.partner_id)).size})),
        upcoming:pays.filter(p=>p.status!=='paid').slice(0,6).map(p=>payToRow(p,projectMap,partnerMap))
      });
    }

    if(path==='partners'&&method==='GET'){
      let partners=await db(env,'partners?select=*&order=created_at.desc');
      let projects=await db(env,'projects?select=id,name');
      let allocs=await db(env,'allocations?select=partner_id,project_id,assigned_target,acquired_users,commission');
      let pays=await db(env,'payments?select=partner_id,amount,status');
      const projectMap=Object.fromEntries(projects.map(x=>[x.id,x.name]));
      return json(partners.map(p=>{
        const rows=allocs.filter(a=>a.partner_id===p.id);
        const income=rows.reduce((a,x)=>a+num(x.commission),0);
        const paid=pays.filter(x=>x.partner_id===p.id&&x.status==='paid').reduce((a,x)=>a+num(x.amount),0);
        return {...publicPartner(p),projects:rows.length,project_names:[...new Set(rows.map(r=>projectMap[r.project_id]))].filter(Boolean),
          acquired_users:rows.reduce((a,x)=>a+num(x.acquired_users),0),
          income:Math.round(income*100)/100,paid:Math.round(paid*100)/100,balance:Math.round((income-paid)*100)/100};
      }));
    }
    if(path==='partners'&&method==='POST'){
      let b=await body(request),email=String(b.email||'').trim().toLowerCase();
      if(!b.name||!email||!b.phone)return fail('Name, email and phone are required.');
      if(!String(b.password||'')||String(b.password).length<6)return fail('Password must be at least 6 characters.');
      if(!PARTNER_TYPES.includes(b.type))return fail('Invalid partner type.');
      if(!PARTNER_STATUSES.includes(b.status))return fail('Invalid partner status.');
      let exists=await db(env,`partners?email=eq.${encodeURIComponent(email)}&select=id`);
      if(exists.length)return fail('A partner with this email already exists.',409);
      let partnerCode=null;
      for(let i=0;i<15;i++){let code=String(crypto.getRandomValues(new Uint32Array(1))[0]%9000+1000);let used=await db(env,`partners?partner_code=eq.${code}&select=id`);if(!used.length){partnerCode=code;break}}
      if(!partnerCode)throw Error('Could not allocate a 4-digit Partner ID. Please retry.');
      let [out]=await db(env,'partners',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({partner_code:partnerCode,name:String(b.name).slice(0,120),email,phone:String(b.phone).slice(0,40),type:b.type,accounts:cleanAccounts(b.accounts),password_hash:await hash(String(b.password)),login_access:b.login_access!==false,status:b.status,note:b.note?String(b.note).slice(0,500):null})});
      return json(publicPartner(out),201);
    }
    if(path.startsWith('partners/')&&method==='PATCH'){
      let id=path.split('/')[1],[existing]=await db(env,`partners?id=eq.${id}&select=*`);
      if(!existing)return fail('Partner not found.',404);
      let b=await body(request),patch={updated_at:new Date().toISOString()};
      for(const k of ['name','phone','note'])if(b[k]!==undefined)patch[k]=String(b[k]).slice(0,500);
      if(b.email!==undefined){let email=String(b.email).trim().toLowerCase();if(!email)return fail('Email cannot be empty.');let dup=await db(env,`partners?email=eq.${encodeURIComponent(email)}&select=id`);if(dup.length&&dup[0].id!==id)return fail('A partner with this email already exists.',409);patch.email=email;}
      if(b.type!==undefined){if(!PARTNER_TYPES.includes(b.type))return fail('Invalid partner type.');patch.type=b.type}
      if(b.status!==undefined){if(!PARTNER_STATUSES.includes(b.status))return fail('Invalid partner status.');patch.status=b.status}
      if(b.login_access!==undefined)patch.login_access=!!b.login_access;
      if(b.accounts!==undefined)patch.accounts=cleanAccounts(b.accounts);
      if(b.password)patch.password_hash=await hash(String(b.password));
      let [out]=await db(env,`partners?id=eq.${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});
      return json(publicPartner(out));
    }
    if(path.startsWith('partners/')&&method==='DELETE'){
      let id=path.split('/')[1];
      await db(env,`partners?id=eq.${id}`,{method:'DELETE'});
      return json({ok:true});
    }

    if(path==='projects'&&method==='GET'){
      let projects=await db(env,'projects?select=*&order=created_at.desc');
      let allocs=await db(env,'allocations?select=project_id,partner_id,assigned_target,acquired_users,commission');
      return json(projects.map(p=>{
        const rows=allocs.filter(a=>a.project_id===p.id);
        const used=rows.reduce((a,x)=>a+num(x.commission),0);
        return {...p,target_users:rows.reduce((a,x)=>a+num(x.assigned_target),0),acquired_users:rows.reduce((a,x)=>a+num(x.acquired_users),0),used_budget:Math.round(used*100)/100,remaining_budget:Math.round((num(p.budget)-used)*100)/100,partner_count:new Set(rows.map(r=>r.partner_id)).size};
      }));
    }
    if(path==='projects'&&method==='POST'){
      let b=await body(request);
      if(!b.name)return fail('Project name is required.');
      if(num(b.budget)<0)return fail('Budget cannot be negative.');
      let [out]=await db(env,'projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:String(b.name).slice(0,120),details:b.details?String(b.details).slice(0,1000):null,budget:num(b.budget),note:b.note?String(b.note).slice(0,500):null,status:b.status==='inactive'?'inactive':'active'})});
      return json(out,201);
    }
    if(path.startsWith('projects/')&&(method==='PATCH'||method==='DELETE')){
      let id=path.split('/')[1];
      if(method==='DELETE'){await db(env,`projects?id=eq.${id}`,{method:'DELETE'});return json({ok:true})}
      let b=await body(request),patch={updated_at:new Date().toISOString()};
      for(const k of ['name','details','note'])if(b[k]!==undefined)patch[k]=String(b[k]).slice(0,1000);
      if(b.budget!==undefined)patch.budget=num(b.budget);
      if(b.status!==undefined)patch.status=b.status==='inactive'?'inactive':'active';
      let [out]=await db(env,`projects?id=eq.${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});
      return json(out);
    }

    if(path==='allocations'&&method==='GET'){
      let [allocs,projects,partners]=await Promise.all([db(env,'allocations?select=*&order=created_at.desc'),db(env,'projects?select=id,name'),db(env,'partners?select=id,name,partner_code')]);
      const pm=Object.fromEntries(projects.map(x=>[x.id,x])),sm=Object.fromEntries(partners.map(x=>[x.id,x]));
      return json(allocs.map(a=>allocToRow(a,pm,sm)));
    }
    if(path==='allocations'&&method==='POST'){
      let b=await body(request);
      if(!b.project_id||!b.partner_id)return fail('Project and partner are required.');
      if(!ALLOCATION_STATUSES.includes(b.status))return fail('Invalid allocation status.');
      let [project]=await db(env,`projects?id=eq.${b.project_id}&select=id`);
      let [partner]=await db(env,`partners?id=eq.${b.partner_id}&select=id,status`);
      if(!project)return fail('Project not found.',404);
      if(!partner)return fail('Partner not found.',404);
      if(partner.status!=='agree')return fail('Only partners with status “Agree” can be allocated to a project.',400);
      let dup=await db(env,`allocations?project_id=eq.${b.project_id}&partner_id=eq.${b.partner_id}&select=id`);
      if(dup.length)return fail('This partner already has an allocation for the project.',409);
      let [out]=await db(env,'allocations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project_id:b.project_id,partner_id:b.partner_id,assigned_target:Math.max(0,Math.round(num(b.assigned_target))),acquired_users:Math.max(0,Math.round(num(b.acquired_users))),commission:num(b.commission),note:b.note?String(b.note).slice(0,500):null,status:b.status})});
      return json(out,201);
    }
    if(path.startsWith('allocations/')&&(method==='PATCH'||method==='DELETE')){
      let id=path.split('/')[1];
      if(method==='DELETE'){await db(env,`allocations?id=eq.${id}`,{method:'DELETE'});return json({ok:true})}
      let b=await body(request),patch={updated_at:new Date().toISOString()};
      if(b.assigned_target!==undefined)patch.assigned_target=Math.max(0,Math.round(num(b.assigned_target)));
      if(b.acquired_users!==undefined)patch.acquired_users=Math.max(0,Math.round(num(b.acquired_users)));
      if(b.commission!==undefined)patch.commission=num(b.commission);
      if(b.note!==undefined)patch.note=String(b.note).slice(0,500);
      if(b.status!==undefined){if(!ALLOCATION_STATUSES.includes(b.status))return fail('Invalid allocation status.');patch.status=b.status}
      let [out]=await db(env,`allocations?id=eq.${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});
      return json(out);
    }

    if(path==='payments'&&method==='GET'){
      let [pays,projects,partners]=await Promise.all([db(env,'payments?select=*&order=payment_date.desc,created_at.desc&limit=1000'),db(env,'projects?select=id,name'),db(env,'partners?select=id,name,partner_code')]);
      const pm=Object.fromEntries(projects.map(x=>[x.id,x])),sm=Object.fromEntries(partners.map(x=>[x.id,x]));
      return json(pays.map(p=>payToRow(p,pm,sm)));
    }
    if(path==='payments'&&method==='POST'){
      let b=await body(request);
      if(!b.project_id||!b.partner_id)return fail('Project and partner are required.');
      if(!PAYMENT_STATUSES.includes(b.status))return fail('Invalid payment status.');
      let amount=num(b.amount);
      if(amount<=0)return fail('Payment amount must be greater than zero.');
      let alloc=await db(env,`allocations?project_id=eq.${b.project_id}&partner_id=eq.${b.partner_id}&select=id`);
      if(!alloc.length)return fail('This partner has no allocation for the selected project.',400);
      let {stats}=await partnerStats(env,[b.partner_id]);
      const balance=stats[b.partner_id]?.balance??0;
      if(amount>balance)return fail(`Payment amount cannot exceed the partner's available balance (${balance.toFixed(2)}).`,400);
      let [out]=await db(env,'payments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({partner_id:b.partner_id,project_id:b.project_id,payment_date:b.payment_date||new Date().toISOString().slice(0,10),amount:Math.round(amount*100)/100,method:String(b.method||'bank').slice(0,40),transaction_id:b.transaction_id?String(b.transaction_id).slice(0,100):null,status:b.status,note:b.note?String(b.note).slice(0,500):null})});
      return json(out,201);
    }
    if(path.startsWith('payments/')&&(method==='PATCH'||method==='DELETE')){
      let id=path.split('/')[1];
      let [existing]=await db(env,`payments?id=eq.${id}&select=*`);
      if(!existing)return fail('Payment not found.',404);
      if(method==='DELETE'){await db(env,`payments?id=eq.${id}`,{method:'DELETE'});return json({ok:true})}
      let b=await body(request),patch={updated_at:new Date().toISOString()};
      if(b.status!==undefined){
        if(!PAYMENT_STATUSES.includes(b.status))return fail('Invalid payment status.');
        if(b.status!=='paid'&&existing.status==='paid')return fail('A paid payment cannot be reverted. Delete it instead.',400);
        patch.status=b.status;
      }
      if(b.transaction_id!==undefined)patch.transaction_id=String(b.transaction_id).slice(0,100);
      if(b.payment_date!==undefined)patch.payment_date=b.payment_date;
      if(b.note!==undefined)patch.note=String(b.note).slice(0,500);
      let [out]=await db(env,`payments?id=eq.${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});
      return json(out);
    }

    if(path==='performance'&&method==='GET'){
      let allocs=await db(env,'allocations?select=partner_id,assigned_target,acquired_users,project_id');
      let partners=await db(env,'partners?select=id,name,partner_code,type');
      const map={};
      for(const a of allocs){map[a.partner_id]??={projects:new Set(),assigned:0,acquired:0};map[a.partner_id].projects.add(a.project_id);map[a.partner_id].assigned+=num(a.assigned_target);map[a.partner_id].acquired+=num(a.acquired_users);}
      const rows=partners.map(p=>({id:p.id,name:p.name,partner_code:p.partner_code,type:p.type,projects:(map[p.id]?.projects.size)||0,assigned:(map[p.id]?.assigned)||0,acquired:(map[p.id]?.acquired)||0,pct:(map[p.id]&&map[p.id].assigned>0)?Math.round(map[p.id].acquired/map[p.id].assigned*100):0})).sort((a,b)=>b.pct-a.pct||b.acquired-a.acquired);
      return json(rows.map((r,i)=>({...r,rank:i+1})));
    }

    if(path==='demo-seed'&&method==='POST'){
      const PWD=await hash('demo123');
      const mkPartner=(code,name,email,phone,type,status,note)=>({partner_code:code,name,email,phone,type,status,note,password_hash:PWD,login_access:true,accounts:[]});
      let partners=[mkPartner('1201','Arif Rahman','arif@demo.ios','+8801710000001','youtuber','agree','Tech reviewer with a large audience.'),
        mkPartner('1202','Nadia Sultana','nadia@demo.ios','+8801710000002','tiktoker','agree','Summer campaign creator.'),
        mkPartner('1203','Digital Media BD','hello@digitalmedia.bd','+8801710000003','agency','agree','Agency with 18 creators.'),
        mkPartner('1204','Shakib Karim','shakib@demo.ios','+8801710000004','facebook','agree','Facebook group admin.'),
        mkPartner('1205','Trend Makers','team@trendmakers.io','+8801710000005','marketing_agent','waiting','Negotiating terms.'),
        mkPartner('1206','Mim Akter','mim@demo.ios','+8801710000006','instagram','agree','Lifestyle creator.')];
      let projects=[{name:'Crypto Exchange Launch',details:'Launch campaign focused on registrations, deposits and social awareness.',budget:18400,note:null,status:'active'},
        {name:'Summer Creator Campaign',details:'TikTok, Facebook and YouTube creator campaign for summer product adoption.',budget:11250,note:null,status:'active'},
        {name:'Brand Awareness — Asia',details:'Multi-country awareness campaign with agents and creator agencies.',budget:24800,note:null,status:'active'},
        {name:'Bangladesh Referral Push',details:'Referral-focused creator project with commission per verified user.',budget:9800,note:null,status:'active'}];
      for(const t of ['payments','allocations','projects','partners'])await db(env,t,{method:'DELETE',headers:{'Prefer':'return=minimal'}});
      let savedP=[],savedPr=[];
      for(const p of partners){let [r]=await db(env,'partners',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});savedP.push(r)}
      for(const p of projects){let [r]=await db(env,'projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});savedPr.push(r)}
      const P=i=>savedP[i].id,Pr=i=>savedPr[i].id;
      let allocs=[
        {project_id:Pr(0),partner_id:P(0),assigned_target:7000,acquired_users:5420,commission:4200,status:'on_target',note:null},
        {project_id:Pr(2),partner_id:P(0),assigned_target:5000,acquired_users:3000,commission:1800,status:'active',note:null},
        {project_id:Pr(1),partner_id:P(1),assigned_target:5000,acquired_users:3650,commission:2200,status:'on_target',note:null},
        {project_id:Pr(2),partner_id:P(2),assigned_target:8000,acquired_users:5100,commission:4200,status:'active',note:null},
        {project_id:Pr(0),partner_id:P(3),assigned_target:3000,acquired_users:2800,commission:1800,status:'on_target',note:null},
        {project_id:Pr(3),partner_id:P(5),assigned_target:3500,acquired_users:2710,commission:1600,status:'on_target',note:null}];
      let savedA=[];
      for(const a of allocs){let [r]=await db(env,'allocations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(a)});savedA.push(r)}
      let pays=[{partner_id:P(0),project_id:Pr(0),amount:1500,method:'Bank transfer',transaction_id:'TX-1001',status:'scheduled',payment_date:'2026-08-25'},
        {partner_id:P(1),project_id:Pr(1),amount:1500,method:'bKash',transaction_id:'TX-1002',status:'paid',payment_date:'2026-08-20'},
        {partner_id:P(3),project_id:Pr(0),amount:1800,method:'Bank transfer',transaction_id:'TX-1003',status:'paid',payment_date:'2026-08-18'},
        {partner_id:P(2),project_id:Pr(2),amount:1000,method:'Nagad',transaction_id:'TX-1004',status:'pending',payment_date:'2026-08-27'}];
      for(const p of pays)await db(env,'payments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)});
      return json({ok:true,partners:partners.length,projects:projects.length,allocations:allocs.length,payments:pays.length,partnerPassword:'demo123'});
    }

    return fail('Not found.',404);
  }catch(e){return fail(e.message||'Unexpected server error.',500)}
}
