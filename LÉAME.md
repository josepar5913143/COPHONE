# COPHONE

Tienda personal con HTML, CSS y JavaScript puro. Publicada en https://cophone.pages.dev/ con Cloudflare Pages, una API de Pages Functions y una base SQL D1. Los modelos siguen siendo ilustrativos. Los pagos están marcados como **Próximamente**: no existe pasarela ni se realiza ningún cobro.

## Estructura

- `índice.html`: tienda, cuenta, perfil, solicitudes y panel de administración.
- `estilos.css`: estilos y diseño responsive.
- `cinematográfico.css`: animaciones, cristal y movimiento reducido.
- `script.js`: interactividad y cliente de la API.
- `activos/`: logotipos y recursos visuales locales.
- `backend/trabajador.mjs`: API para Pages Functions; se publica como `_worker.js`.
- `backend/esquema.sql`: tablas, índices y catálogo inicial; los INSERT OR IGNORE no sobrescriben productos ya editados.
- `backend/rutas.json`: activa Functions únicamente para `/api/*`.
- `backend/cabeceras.txt`: cabeceras de seguridad de los recursos estáticos.
- `backend/preparar.mjs`: prepara una carpeta de publicación mediante una lista explícita de archivos.
- `backend/pruebas.mjs`: pruebas de API, permisos y datos utilizando SQLite efímero.
- `backend/desarrollo.mjs`: servidor local opcional para desarrollo, con datos y secretos de prueba.

## Abrir la tienda

Para explorar el catálogo sin conexión, abre `índice.html` con doble clic. No requiere instalación ni comandos. El registro, las sesiones y la sincronización necesitan la versión publicada porque consultan el backend.

La portada del paquete de Cloudflare incluye una copia `index.html` para servir la raíz. El archivo original `índice.html` conserva su nombre en el proyecto y en el despliegue.

## Usuarios

- Registro con nombre, correo y contraseña de 12 a 128 caracteres.
- Inicio y cierre de sesión mediante una cookie HttpOnly, Secure y SameSite=Strict.
- Perfil con nombre y datos de contacto opcionales.
- Favoritos y carrito sincronizados con la cuenta, además del almacenamiento local separado por usuario.
- Solicitudes con historial, estado y precios calculados por el servidor.
- Cambio de contraseña que revoca las demás sesiones.

Las solicitudes no son pagos, no garantizan un envío y no reservan stock. No se solicitan tarjetas ni datos bancarios. La verificación y recuperación por correo y la autenticación de dos factores aún no están implementadas. Se muestran las limitaciones correspondientes en la interfaz.

## Administración

La cuenta propietaria utiliza el correo configurado de forma privada en Cloudflare. Registrarse como usuario normal nunca concede permisos de administración. Para activar la cuenta propietaria por primera vez se necesita el código privado de un solo uso entregado por separado.

Desde **Mi cuenta > Administración** se pueden crear y editar productos, cambiar precios y stock, ocultar o publicar modelos, revisar solicitudes, modificar sus estados y suspender o reactivar usuarios. El administrador no puede suspenderse a sí mismo ni suspender otra cuenta administradora desde el panel. Los roles enviados por el navegador nunca se aceptan como autorización.

Los correos de usuarios no están verificados automáticamente. El acceso administrativo se protege adicionalmente con el código privado y el correo reservado; el primer visitante de la tienda no se convierte en administrador.

## Cloudflare y plan gratuito

El proyecto utiliza una base D1 vinculada como `DB`. El secreto `COPHONE_CONFIG` contiene la configuración privada de contraseñas y activación. Nunca publiques ese secreto ni el código de activación en GitHub o en el paquete de la web.

D1 Free incluye 5 millones de filas leídas al día, 100 000 escritas al día y 5 GB totales. Las Functions tienen sus propias cuotas de Workers Free. Los archivos estáticos quedan fuera de las rutas de Functions. Se utilizan índices, consultas preparadas, paginación y límites de intentos; no se hace sondeo periódico del servidor.

El proyecto no convierte la cuenta a un plan de pago. Si se agotan las cuotas gratuitas, algunas funciones pueden dejar de responder hasta el reinicio de cuota; aumentar el plan sería una decisión posterior del propietario.

Documentación: https://developers.cloudflare.com/d1/platform/pricing/ y https://developers.cloudflare.com/pages/functions/pricing/

## Seguridad y mantenimiento

Las contraseñas se almacenan como PBKDF2-SHA256 con sal aleatoria, 100 000 iteraciones y un pepper secreto procesado mediante HMAC. Las sesiones se guardan como hashes de tokens aleatorios y caducan a los siete días. Se valida el origen y un encabezado propio en las mutaciones. Las entradas SQL usan parámetros y los datos mostrados se escapan como HTML.

Conserva el secreto de Cloudflare: cambiar el pepper invalida las contraseñas existentes. El código de administrador se consume una sola vez y no es una contraseña de acceso habitual. El propietario debe elegir su propia contraseña al activar su cuenta.

No hay eliminación permanente de usuarios o solicitudes desde la interfaz. El administrador puede suspender accesos. Para un uso comercial deberán completarse la verificación de correo, recuperación de cuentas, condiciones de venta y privacidad, la operativa de inventario y los pagos.

## Productos e imágenes

Agrega imágenes, iconos y fuentes a `activos/`. El catálogo publicado se gestiona desde la administración y se guarda en D1. El arreglo inicial de `script.js` es la alternativa sin conexión y la semilla de una base nueva; editarlo no reemplaza los productos existentes en D1.

## Desarrollo y despliegue (opcional)

Con Node.js 24, `node backend/pruebas.mjs` ejecuta las pruebas sin instalar dependencias. `node backend/desarrollo.mjs` abre el entorno de prueba local en el puerto 4173. Este entorno es efímero y utiliza únicamente credenciales de prueba; no copia cuentas de producción.

`node backend/preparar.mjs RUTA_DE_SALIDA` prepara los recursos estáticos, `_worker.js`, `_routes.json` y `_headers` en una carpeta separada. Publica esa carpeta como ZIP mediante Direct Upload en el proyecto existente de Pages, conservando su vínculo `DB` y su secreto. No subas la carpeta completa de Descargas: otros archivos ajenos a COPHONE no forman parte del despliegue.

El ZIP de Direct Upload no conecta automáticamente los cambios de GitHub. Las nuevas versiones se deben desplegar de nuevo.
