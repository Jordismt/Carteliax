import { randomUUID } from 'node:crypto';
import { ids,memoryDb } from './audit-fixture.js';
export function auditTransport(state,{onMutation,storage}={}) {
 const db=memoryDb(state),history=[];
 const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
 async function fetchImpl(input,options={}){
  const url=new URL(typeof input==='string'?input:input.url??String(input));
  const headers=new Headers(options.headers??input.headers),method=options.method??input.method??'GET';
  if(url.hostname!=='fixture.invalid')throw Error('External service forbidden in QA');
  const token=headers.get('authorization')?.replace(/^Bearer /,'');
  const actor=token==='qa-a'?ids.a:token==='qa-b'?ids.b:null;
  history.push({path:url.pathname,method});
  if(url.pathname==='/auth/v1/user')return actor?json({id:actor,email:actor===ids.a?'a@example.invalid':'b@example.invalid',aud:'authenticated',role:'authenticated'}):json({message:'Invalid fixture token'},401);
  if(url.pathname.startsWith('/storage/v1/')) {
   if(!storage)throw Error('Storage not configured in this test');
   return storage({url,headers,method,body:options.body},json);
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1),args=JSON.parse(options.body??'{}');
   if(name==='set_product_allergens'){const p=state.products.find(p=>p.id===args.p_product_id);const b=state.businesses.find(b=>b.id===p?.business_id);if(!p||b?.owner_id!==actor)return json({code:'42501',message:'Denied'},403);state.product_allergens=state.product_allergens.filter(r=>r.product_id!==p.id);state.product_allergens.push(...args.p_allergen_ids.map(id=>({product_id:p.id,allergen_id:id})));return json(null)}
   throw Error('RPC not implemented by this transport; use PostgreSQL integration');
  }
  if(!url.pathname.startsWith('/rest/v1/'))throw Error('Unexpected QA transport');
  const table=url.pathname.split('/').at(-1);if(!Object.hasOwn(state,table))throw Error('Unexpected table');
  let q=db.from(table);const requested=url.searchParams.get('select')??'*';
  const nested=requested.includes('menu_themes(');
  for(const [k,v]of url.searchParams){if(['select','order','limit'].includes(k))continue;const dot=v.indexOf('.'),op=v.slice(0,dot),value=v.slice(dot+1);const val=value==='null'?null:value==='true'?true:value==='false'?false:value;
   if(op==='eq')q=q.eq(k,val);else if(op==='neq')q=q.neq(k,val);else if(op==='is')q=q.is(k,val);else if(op==='in')q=q.in(k,value.slice(1,-1).split(',').map(x=>x.replace(/^"|"$/g,'')));else throw Error('Unsupported QA filter '+op);
  }
  if(method==='POST') {let body=JSON.parse(options.body??'{}');if(!Array.isArray(body)&&!body.id&&!['subscriptions','category_products','product_allergens','menu_themes','stripe_webhook_events'].includes(table))body.id=randomUUID();q=headers.get('prefer')?.includes('resolution=merge-duplicates')?q.upsert(body):q.insert(body)}
  if(method==='PATCH')q=q.update(JSON.parse(options.body??'{}'));if(method==='DELETE')q=q.delete();
  q=q.select(nested?'*':requested,{count:'exact',head:method==='HEAD'});const result=await q;
  if(result.error)return json(result.error,409);
  let data=result.data;if(nested)data=data.map(r=>({...r,menu_themes:state.menu_themes.find(t=>t.menu_id===r.id)??null}));
  const fault=onMutation&&method!=='GET'&&method!=='HEAD'?await onMutation({table,method,url,result}):null;if(fault)return fault;
  const h={'Content-Range':`0-${Math.max(0,result.count-1)}/${result.count}`};
  if(method==='HEAD')return new Response(null,{headers:h});
  if(headers.get('accept')?.includes('vnd.pgrst.object')){if(data.length!==1)return json({code:'PGRST116',message:'No single result',details:'0 rows'},406);data=data[0]}
  return json(data,200,h);
 }
 return {fetch:fetchImpl,history,db};
}
