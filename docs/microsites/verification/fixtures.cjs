// Browser fixtures only. This module never contacts Supabase or Groq.
const old=require('../../translations/verification/fixtures.cjs');
const empty=()=>({template:'modern',about:'',phone:'',whatsapp:'',email:'',address:'',city:'',postal_code:'',maps_url:'',instagram:'',facebook:'',tiktok:'',website:'',hours:[],translations:[]});
function createState(){return {...old.createState(),micrositesEnabled:false,publicLanguages:null};}
function response(state,requestPath,method='GET',body={}){
 const u=new URL(requestPath,'http://fixture');const path=u.pathname;
 if(!state.micrositesEnabled){
  const result=old.response(state,path,method,body);
  if(path.startsWith('/api/public/menus/')&&result.status===200&&state.publicLanguages){result.data.languages=state.publicLanguages;for(const c of result.data.categories)for(const p of c.products)p.allergen_codes=['gluten'];}
  return result;
 }
 for(const b of state.businesses){b.public_slug ??= b.slug;b.public_profile={...empty(),...b.public_profile};b.cover_url ??= null;}
 if(path.startsWith('/api/public/sites/')){
  const slug=decodeURIComponent(path.split('/').at(-1));const b=state.businesses.find(b=>b.public_slug===slug);
  if(!b)return {status:404,data:{message:'Web no disponible'}};
  const menus=state.menus.filter(m=>m.business_id===b.id&&m.is_published&&state.themeRecord.published_at);
  const requested=u.searchParams.get('menu');const selected=requested?menus.find(m=>m.slug===requested):menus[0];
  if(requested&&!selected)return {status:404,data:{message:'Carta no disponible'}};
  const result=selected?response(state,`/api/public/menus/${b.id}/${selected.slug}`).data:null;
  return {status:200,data:{success:true,business:{...b,profile:b.public_profile},menus:menus.map(({name,slug})=>({name,slug})),currentMenu:result}};
 }
 if(path.endsWith('/cover')){const b=state.businesses.find(b=>b.id===path.split('/')[3]);b.cover_url=method==='DELETE'?null:'/mock-image.png';return {status:200,data:{business:b,success:true}};}
 const result=old.response(state,path,method,body);
 if(path==='/api/businesses'&&method==='GET')result.data.microsites_enabled=true;
 if(path.startsWith('/api/public/menus/')&&result.status===200&&state.publicLanguages){result.data.languages=state.publicLanguages;for(const c of result.data.categories)for(const p of c.products)p.allergen_codes=['gluten'];}
 if(path.startsWith('/api/menus/')&&result.data.menu){const b=state.businesses.find(b=>b.id===result.data.menu.business_id);result.data.menu.public_slug=b?.public_slug;}
 return result;
}
module.exports={...old,createState,response,empty};
