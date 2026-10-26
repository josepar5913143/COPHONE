import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import worker from "./trabajador.mjs";

export class LocalD1 {
  constructor(){this.database=new DatabaseSync(":memory:");this.database.exec(fs.readFileSync(new URL("./esquema.sql",import.meta.url),"utf8"));}
  prepare(sql){
    const db=this.database;
    const statement={sql,values:[],bind(...values){this.values=values;return this;},first(){return db.prepare(sql).get(...this.values)||null;},all(){return {results:db.prepare(sql).all(...this.values),success:true};},run(){const result=db.prepare(sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes)}};}};
    return statement;
  }
  async batch(statements){this.database.exec("BEGIN");try{const results=statements.map(statement=>/^\s*SELECT/i.test(statement.sql)?statement.all():statement.run());this.database.exec("COMMIT");return results;}catch(error){this.database.exec("ROLLBACK");throw error;}}
}

export async function runTests(){
  const db=new LocalD1();
  const code=crypto.randomBytes(32).toString("hex");
  const config={passwordPepper:crypto.randomBytes(48).toString("hex"),adminEmail:"owner@example.invalid",adminSetupHash:crypto.createHash("sha256").update(code).digest("hex")};
  const env={DB:db,COPHONE_CONFIG:JSON.stringify(config),ASSETS:{fetch:()=>new Response("asset")}};
  const origin="https://cophone.test";
  const pass="Una-clave-de-prueba-12345!";
  let address=1;
  async function call(path,{method="GET",body,cookie,headers={},ip="127.0.0.1"}={}){
    const response=await worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,"X-Cophone-Request":"1","Content-Type":"application/json","CF-Connecting-IP":ip,...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:typeof body==="string"?body:JSON.stringify(body)})}),env);
    const data=await response.json();return {response,data,status:response.status,cookie:response.headers.get("Set-Cookie")?.split(";")[0]};
  }
  const guest=await call("/api/products");assert.equal(guest.status,200);assert.equal(guest.data.products.length,6);
  assert.equal((await call("/api/admin/users")).status,401);
  assert.equal((await call("/api/auth/register",{method:"POST",body:{},headers:{Origin:"https://evil.test"}})).status,403);
  assert.equal((await call("/api/auth/register",{method:"POST",body:{name:"Intruso",email:config.adminEmail,password:pass},ip:"reserved"})).status,403);
  let user=await call("/api/auth/register",{method:"POST",body:{name:"Usuario de prueba",email:"user@example.invalid",password:pass,role:"admin"}});
  assert.equal(user.status,201);assert.equal(user.data.user.role,"user");assert.ok(user.cookie);assert.ok(user.response.headers.get("Set-Cookie").includes("HttpOnly; Secure; SameSite=Strict"));
  const userId=user.data.user.id;
  assert.equal((await call("/api/admin/products",{cookie:user.cookie})).status,403);
  const stored=db.database.prepare("SELECT * FROM users WHERE id=?").get(userId);assert.notEqual(stored.password_hash,pass);assert.equal(stored.password_hash.length,64);
  assert.equal((await call("/api/auth/login",{method:"POST",body:{email:"user@example.invalid",password:"Contraseña-incorrecta-123"}})).status,401);
  assert.equal((await call("/api/auth/login",{method:"POST",body:{email:"user@example.invalid",password:pass}})).status,200);
  let admin=await call("/api/auth/register",{method:"POST",body:{name:"Propietario",email:config.adminEmail,password:pass,setupCode:code},ip:"owner"});
  assert.equal(admin.status,201);assert.equal(admin.data.user.role,"admin");
  assert.equal((await call("/api/admin/overview",{cookie:admin.cookie})).data.products,6);
  assert.equal((await call("/api/admin/users",{cookie:admin.cookie})).data.users.length,2);
  const updated=await call("/api/me",{method:"PATCH",cookie:user.cookie,body:{name:"Usuario actualizado",phone:"900000000",city:"Lima",address:"",role:"admin"}});assert.equal(updated.data.user.role,"user");assert.equal(updated.data.user.city,"Lima");
  assert.equal((await call("/api/me/state",{method:"PUT",cookie:user.cookie,body:{cart:[{id:"ultra",qty:2}],favorites:["air"]}})).status,200);
  assert.equal((await call("/api/me",{cookie:user.cookie})).data.state.cart[0].qty,2);
  assert.equal((await call("/api/me/state",{method:"PUT",cookie:user.cookie,body:{cart:[{id:"ultra",qty:-1}],favorites:[]}})).status,400);
  const orderBody={items:[{id:"ultra",qty:2}],idempotencyKey:crypto.randomUUID(),expectedTotalCents:939800,note:"Solicitud de prueba"};
  assert.equal((await call("/api/orders",{method:"POST",cookie:user.cookie,body:{...orderBody,expectedTotalCents:1}})).status,409);
  const order=await call("/api/orders",{method:"POST",cookie:user.cookie,body:orderBody});assert.equal(order.status,201);assert.equal(order.data.order.total,9398);assert.equal(order.data.order.paymentStatus,"proximamente");
  assert.equal((await call("/api/orders",{method:"POST",cookie:user.cookie,body:orderBody})).data.order.id,order.data.order.id);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM orders").get().count,1);
  assert.equal((await call("/api/orders",{method:"POST",cookie:user.cookie,body:{...orderBody,note:"otra"}})).status,409);
  assert.equal((await call("/api/me/orders",{cookie:admin.cookie})).data.orders.length,0);
  assert.equal((await call("/api/admin/orders",{cookie:user.cookie})).status,403);
  assert.equal((await call(`/api/admin/orders/${order.data.order.id}`,{method:"PATCH",cookie:admin.cookie,body:{status:"en_revision"}})).status,200);
  assert.equal((await call("/api/me/orders",{cookie:user.cookie})).data.orders[0].status,"en_revision");
  const model={id:"modelo-prueba",name:"Modelo de prueba",category:"value",tag:"Nuevo",price:123.45,storage:"128 GB",spec:"Una descripción",features:["Características"],color:"#123456",stock:3,active:true};
  assert.equal((await call("/api/admin/products",{method:"POST",cookie:user.cookie,body:model})).status,403);
  assert.equal((await call("/api/admin/products",{method:"POST",cookie:admin.cookie,body:model})).status,201);
  assert.equal((await call("/api/admin/products",{method:"POST",cookie:admin.cookie,body:model})).status,409);
  assert.equal((await call("/api/admin/products/modelo-prueba",{method:"PATCH",cookie:admin.cookie,body:{...model,color:"red;display:none"}})).status,400);
  assert.equal((await call("/api/admin/products/modelo-prueba",{method:"PATCH",cookie:admin.cookie,body:{...model,active:false}})).status,200);
  assert.equal((await call("/api/products")).data.products.some(p=>p.id===model.id),false);
  assert.equal((await call(`/api/admin/users/${admin.data.user.id}`,{method:"PATCH",cookie:admin.cookie,body:{disabled:true}})).status,400);
  assert.equal((await call(`/api/admin/users/${userId}`,{method:"PATCH",cookie:admin.cookie,body:{disabled:true}})).status,200);
  assert.equal((await call("/api/me/orders",{cookie:user.cookie})).status,401);
  assert.equal((await call(`/api/admin/users/${userId}`,{method:"PATCH",cookie:admin.cookie,body:{disabled:false}})).status,200);
  user=await call("/api/auth/login",{method:"POST",body:{email:"user@example.invalid",password:pass}});
  const oldCookie=user.cookie;
  const changed=await call("/api/me/password",{method:"POST",cookie:user.cookie,body:{currentPassword:pass,newPassword:pass+"Nueva"}});assert.equal(changed.status,200);assert.equal((await call("/api/me/orders",{cookie:oldCookie})).status,401);
  assert.equal((await call("/api/auth/logout",{method:"POST",cookie:changed.cookie,body:{}})).status,200);assert.equal((await call("/api/me/orders",{cookie:changed.cookie})).status,401);
  for(let attempt=0;attempt<13;attempt++){
    const result=await call("/api/auth/login",{method:"POST",body:{email:`nobody${attempt}@example.invalid`,password:pass},ip:"rate-test"});
    if(attempt===12)assert.equal(result.status,429);
  }
  assert.equal((await call("/api/auth/login",{method:"POST",body:"x"})).status,400);
  assert.equal((await call("/api/auth/register",{method:"POST",body:"x".repeat(33000),ip:"body-test"})).status,413);
  assert.equal(await (await worker.fetch(new Request(origin+"/"),env)).text(),"asset");
  console.log("OK: registro, sesión segura, permisos, activación privada, perfiles, selección, precios, solicitudes idempotentes, privacidad entre usuarios, administración, validación, suspensión, cambio de contraseña, cierre de sesiones, límites de intentos y tamaño de solicitudes.");
}
if(import.meta.url===new URL(process.argv[1],"file:///").href || process.argv[1]?.endsWith("pruebas.mjs"))await runTests();
