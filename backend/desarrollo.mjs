// Solo pruebas locales; utiliza una base efímera y secretos de prueba.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {LocalD1} from "./pruebas.mjs";
import worker from "./trabajador.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const db=new LocalD1();
const config={adminEmail:"owner@example.invalid",adminSetupHash:crypto.createHash("sha256").update("cophone-local-test-only").digest("hex"),passwordPepper:crypto.randomBytes(48).toString("hex")};
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};
const env={DB:db,COPHONE_CONFIG:JSON.stringify(config),ASSETS:{async fetch(request){
  const url=new URL(request.url);const route=decodeURIComponent(url.pathname)==="/"?"índice.html":decodeURIComponent(url.pathname).slice(1);
  const allowed=["índice.html","estilos.css","cinematográfico.css","script.js","activos/cophone.svg"];
  if(!allowed.includes(route))return new Response("Not found",{status:404});
  return new Response(fs.readFileSync(path.join(root,route)),{headers:{"Content-Type":mime[path.extname(route)]}});
}}};
http.createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const request=new Request(`http://localhost:4173${req.url}`,{method:req.method,headers:req.headers,...(["GET","HEAD"].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end("Local test server error");}
}).listen(4173,"127.0.0.1",()=>console.log("COPHONE local: http://localhost:4173 (base de pruebas efimera)"));
