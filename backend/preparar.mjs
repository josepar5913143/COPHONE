// Genera el paquete de despliegue sin tocar archivos ajenos a COPHONE.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const output=process.argv[2];
if(!output)throw new Error("Indica una carpeta de salida fuera de la raíz del proyecto.");
const destination=path.resolve(output);
if(destination===root)throw new Error("La salida debe ser una carpeta separada.");
fs.mkdirSync(destination,{recursive:true});
const frontend=fs.readFileSync(path.join(root,"script.js"),"utf8");
const products=vm.runInNewContext(frontend.slice(0,frontend.indexOf("const $"))+"\nproducts;");
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const seed=products.map((p,index)=>`INSERT OR IGNORE INTO products (id,name,category,tag,price_cents,storage,spec,features_json,color,stock,active,sort_order,updated_at) VALUES (${[p.id,p.name,p.category,p.tag,Math.round(p.price*100),p.storage,p.spec,JSON.stringify(p.features),p.device,20,1,index,Math.floor(Date.now()/1000)].map(v=>typeof v==="number"?v:quote(v)).join(",")});`).join("\n");
const schema=fs.readFileSync(path.join(root,"backend","esquema.sql"),"utf8").split("-- CATÁLOGO INICIAL")[0].trimEnd();
fs.writeFileSync(path.join(root,"backend","esquema.sql"),schema+"\n\n-- CATÁLOGO INICIAL\n"+seed+"\n");
const files=["índice.html","estilos.css","cinematográfico.css","script.js","activos/cophone.svg"];
for(const file of files){const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
fs.copyFileSync(path.join(root,"índice.html"),path.join(destination,"index.html"));
fs.copyFileSync(path.join(root,"backend","trabajador.mjs"),path.join(destination,"_worker.js"));
fs.copyFileSync(path.join(root,"backend","rutas.json"),path.join(destination,"_routes.json"));
fs.copyFileSync(path.join(root,"backend","cabeceras.txt"),path.join(destination,"_headers"));
console.log(JSON.stringify({destination,files:files.length+4,products:products.length}));

// Los secretos se generan por separado y nunca entran en el ZIP ni en GitHub.
if(process.env.COPHONE_ADMIN_EMAIL){
  const privateDirectory=path.join(path.dirname(destination),"cophone-privado");
  fs.mkdirSync(privateDirectory,{recursive:true});
  const configPath=path.join(privateDirectory,"configuracion.json");
  if(!fs.existsSync(configPath)){
    const code=crypto.randomBytes(32).toString("hex");
    const config={passwordPepper:crypto.randomBytes(48).toString("hex"),adminEmail:process.env.COPHONE_ADMIN_EMAIL.toLowerCase(),adminSetupHash:crypto.createHash("sha256").update(code).digest("hex")};
    fs.writeFileSync(configPath,JSON.stringify(config));
    fs.writeFileSync(path.join(privateDirectory,"Activar-administrador.txt"),`COPHONE: activación privada de un solo uso\n\n1. Abre https://cophone.pages.dev/\n2. Mi cuenta > Crear cuenta.\n3. Usa el correo ${config.adminEmail}.\n4. Elige tu propia contraseña de al menos 12 caracteres.\n5. Abre "Tengo un código de activación de administrador".\n6. Introduce este código:\n\n${code}\n\nNo compartas el código ni lo subas a GitHub. Después de activar la cuenta, no vuelve a utilizarse.\n`);
    console.log("Secretos privados preparados fuera del proyecto. No se han mostrado sus valores.");
  }
}
