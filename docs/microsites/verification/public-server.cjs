const http=require('node:http');const f=require('./fixtures.cjs');const state=f.createState();
http.createServer((req,res)=>{
 if(req.url==='/__fixture'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{Object.assign(state,JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json'});res.end('{"success":true}');});return;}
 const r=f.response(state,req.url,req.method);res.writeHead(r.status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(r.data));
}).listen(5099,'127.0.0.1',()=>console.log('SSR fixture on 5099; no external service calls'));
