/* Dependency-free preview of the built Vercel output and its clean URLs. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const contactHandler=require('../api/contact');
const root=path.resolve(__dirname,'../dist');
const port=Number(process.env.PORT||8000);
const pages=new Set(['about','services','solutions','portfolio','contact']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain','.xml':'application/xml'};
http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api/contact'){
    response.status=code=>{response.statusCode=code;return response;};
    response.json=body=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(body));};
    let body='';
    for await(const chunk of request){
      body+=chunk;
      if(Buffer.byteLength(body)>32768){response.status(413).json({success:false});return;}
    }
    request.body=body;
    await contactHandler(request,response);
    return;
  }
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{response.writeHead(400).end();return;}
  const clean=pathname==='/'?'/':pathname.replace(/\.html$|\/$/g,'');
  if(['/index','/home'].includes(clean)||pathname==='/index.html'){
    response.writeHead(308,{Location:'/'+url.search}).end();return;
  }
  if(pages.has(clean.slice(1))&&pathname!==clean){response.writeHead(308,{Location:clean+url.search}).end();return;}
  const file=pathname==='/'?'index.html':pages.has(clean.slice(1))?clean.slice(1)+'.html':pathname.slice(1);
  const target=path.resolve(root,file);
  if(!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(target,(error,bytes)=>{
    if(error){response.writeHead(404).end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});response.end(bytes);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Clarigence preview: http://localhost:${port}/`));
