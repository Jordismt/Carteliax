const b1='11111111-1111-4111-8111-111111111111', b2='22222222-2222-4222-8222-222222222222';
const m1='33333333-3333-4333-8333-333333333333', m2='44444444-4444-4444-8444-444444444444';
const c1='55555555-5555-4555-8555-555555555555', c2='66666666-6666-4666-8666-666666666666';
const p1='77777777-7777-4777-8777-777777777777', p2='88888888-8888-4888-8888-888888888888';
const theme={template:'modern',colors:{primary:'#047857',secondary:'#ecfdf5',background:'#ffffff',surface:'#f8fafc',text:'#0f172a',muted:'#64748b'},typography:{heading:'Inter',body:'Inter'},layout:{productStyle:'cards',borderRadius:16,showImages:true,showDescriptions:true,showAllergens:true},branding:{coverUrl:null,welcomeText:'Bienvenidos a nuestra mesa'}};
const stamp='2026-10-01T12:00:00Z';
const business=(id,name)=>({id,name,slug:name.toLowerCase().replaceAll(' ','-'),description:'Cocina casera y productos frescos',logo_url:null,is_active:true,primary_color:'#047857',default_language:'es',created_at:stamp});
const menu=(id,name)=>({id,business_id:b1,name,slug:name.toLowerCase().replaceAll(' ','-'),description:'Nuestra selección para cada día',is_published:id===m1,sort_order:id===m1?0:1,created_at:stamp});
const category=(id,name)=>({id,menu_id:m1,name,description:null,is_visible:true,sort_order:id===c1?0:1,created_at:stamp});
const product=(id,name,price)=>({id,business_id:b1,name,description:'Ingredientes frescos preparados al momento',price,image_url:null,is_available:true,allergenIds:[1],sort_order:0});
function createState(){return {businesses:[business(b1,'La Plaza'),business(b2,'Café Central')],menus:[menu(m1,'Carta principal'),menu(m2,'Menú del día')],categories:[category(c1,'Hamburguesas'),category(c2,'Bebidas')],products:[product(p1,'Cheeseburger',9.5),product(p2,'Coca-Cola',2.5)],links:{[c1]:[p1],[c2]:[p2]},subscriptionStatus:'active',fail:null,delay:0,requests:[],themeRecord:{menu_id:m1,draft_config:structuredClone(theme),published_config:structuredClone(theme),updated_at:stamp,published_at:stamp}};}
function subscription(status='active'){return {status,stripe_customer_id:'cus_mock',stripe_subscription_id:'sub_mock',trial_ends_at:'2026-10-13T12:00:00Z',trial_used_at:stamp,current_period_end:'2026-11-06T12:00:00Z',cancel_at_period_end:false,checkout_expires_at:'2099-01-01T00:00:00Z'};}
function response(s,path,method='GET',body={}){
 s.requests.push({path,method,body});
 if(s.fail && path.includes(s.fail.path)) return {status:s.fail.status||500,data:s.fail.data||{message:'No se pudo guardar. Inténtalo de nuevo.'}};
 const parts=path.split('/').filter(Boolean); const id=parts[2]; const collection={businesses:s.businesses,menus:s.menus,categories:s.categories,products:s.products}[parts[1]];
 let data={success:true};
 if(path.startsWith('/api/public/menus/')){const m=s.menus.find(m=>m.business_id===parts[3]&&m.slug===parts[4]);if(!m||!m.is_published||!s.themeRecord.published_at)return {status:404,data:{message:'Carta no disponible'}};data={...data,business:s.businesses.find(b=>b.id===m.business_id),menu:m,theme:s.themeRecord.published_config,categories:s.categories.filter(c=>c.menu_id===m.id&&c.is_visible).map(c=>({...c,products:s.products.filter(p=>(s.links[c.id]||[]).includes(p.id)&&p.is_available).map(p=>({...p,allergens:['Gluten']}))}))};}
 else if(parts[1]==='subscriptions'){
  if(parts[2]==='checkout'||parts[2]==='portal'){data.url='http://127.0.0.1:3000/mock-'+parts[2];if(parts[3]==='cancel'){s.subscriptionStatus=null;delete data.url;}}
  else data.subscription=s.subscriptionStatus?subscription(s.subscriptionStatus):null;
 }
 else if(parts[1]==='allergens')data.allergens=[{id:1,code:'gluten',name_es:'Gluten'},{id:2,code:'milk',name_es:'Leche'}];
 else if(parts[1]==='products'&&parts[3]==='allergens'){
  const p=s.products.find(p=>p.id===id);if(method==='PUT')p.allergenIds=body.allergenIds;data.allergenIds=p?.allergenIds||[];
 }
 else if(parts[1]==='products'&&parts[3]==='image'){const p=s.products.find(p=>p.id===id);p.image_url=method==='DELETE'?null:'/mock-image.png';data.product=p;}
 else if(parts[1]==='menus'&&parts[3]==='theme'){
  if(method==='PUT')s.themeRecord.draft_config=body;
  if(parts[4]==='publish'){s.themeRecord.published_config=structuredClone(s.themeRecord.draft_config);s.themeRecord.published_at=stamp;}
  if(parts[4]==='reset')s.themeRecord.draft_config=structuredClone(theme);
  data.theme=s.themeRecord;
 }
 else if(parts[1]==='categories'&&parts[3]==='products'){
  if(method==='POST'){s.links[id]=[...new Set([...(s.links[id]||[]),body.productId])];}
  if(method==='DELETE'){s.links[id]=(s.links[id]||[]).filter(p=>p!==parts[4]);}
  data.products=(s.links[id]||[]).map(id=>s.products.find(p=>p.id===id)).filter(Boolean);
 }
 else if(parts[1]==='menus'&&parts[3]==='categories'){
  if(parts[4]==='order'){body.categoryIds.forEach((id,i)=>s.categories.find(c=>c.id===id).sort_order=i);}
  else if(method==='POST'){const c={...category(crypto.randomUUID(),body.name),...body,menu_id:id};s.categories.push(c);s.links[c.id]=[];data.category=c;}
  else data.categories=s.categories.filter(c=>c.menu_id===id);
 }
 else if(parts[1]==='businesses'&&(parts[3]==='menus'||parts[3]==='products')){
  const key=parts[3], singular=key==='menus'?'menu':'product';
  if(method==='POST'){const item={...(key==='menus'?menu(crypto.randomUUID(),body.name):product(crypto.randomUUID(),body.name,body.price)),...body,business_id:id};s[key].push(item);data[singular]=item;}
  else data[key]=s[key].filter(x=>x.business_id===id);
 }
 else if(collection){
  const singular={businesses:'business',menus:'menu',categories:'category',products:'product'}[parts[1]];
  let item=collection.find(x=>x.id===id);
  if(parts[3]==='duplicate'){item={...item,id:crypto.randomUUID(),name:item.name+' (copia)',is_published:false};collection.push(item);}
  else if(parts[3]==='logo'){item.logo_url=method==='DELETE'?null:'/mock-image.png';}
  else if(method==='PATCH'){Object.assign(item,body);}
  else if(method==='DELETE'){
   if(parts[1]==='products'&&Object.values(s.links).some(ids=>ids.includes(id)))return {status:409,data:{message:'El producto está asociado a categorías. Desvincúlalo antes de eliminarlo.'}};
   if(parts[1]==='categories'&&(s.links[id]||[]).length)return {status:409,data:{message:'La categoría contiene productos. Desvincúlalos antes de eliminarla.'}};
   collection.splice(collection.indexOf(item),1);
  }
  else if(method==='POST'&&!id){item={...business(crypto.randomUUID(),body.name),...body};collection.push(item);s.subscriptionStatus=null;}
  if(id||method==='POST')data[singular]=item;else data[parts[1]]=collection;
 }else return {status:404,data:{message:'Unhandled fixture: '+method+' '+path}};
 return {status:200,data};
}
module.exports={createState,response,theme,b1,b2,m1,m2,c1,c2,p1,p2,subscription};
