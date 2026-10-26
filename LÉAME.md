# COPHONE

Tienda de demostración de celulares desarrollada con HTML, CSS y JavaScript puro. Incluye seis modelos ilustrativos, favoritos y carrito. Los precios se expresan en soles peruanos. No procesa pagos, pedidos ni envíos y no recoge datos de pago.

## Estructura principal

```text
COPHONE/
├── activos/
│   └── cophone.svg
├── LÉAME.md
├── cinematográfico.css
├── índice.html
├── script.js
└── estilos.css
```

- `índice.html`: estructura semántica, navegación, hero, promociones, catálogo, ayuda, carrito y modales. Carga las hojas de estilos y el script mediante `defer`.
- `estilos.css`: identidad visual, ilustraciones CSS, componentes y diseño responsive.
- `cinematográfico.css`: transiciones, efectos de entrada, microinteracciones y cristal transparente con alternativa sin desenfoque. Respeta `prefers-reduced-motion`.
- `script.js`: catálogo, búsqueda, filtros, favoritos, cantidades, totales, persistencia local, modales, notificaciones y menú móvil.
- `activos/`: imágenes, iconos, logotipos, fuentes y demás recursos locales. Incluye `cophone.svg`. No se necesitan recursos externos.

La entrada principal del proyecto es `índice.html`.

## Cómo abrir la página

Abre `índice.html` con doble clic en un navegador moderno (Edge, Chrome, Firefox o Safari). No necesitas instalar paquetes, iniciar un servidor ni ejecutar comandos. Conserva todos los archivos juntos y respeta tildes, mayúsculas y extensiones. Guarda los archivos como UTF-8.

## Funciones principales

- Menú móvil con cierre al navegar, al pulsar fuera y con Escape.
- Búsqueda por nombre, almacenamiento y características, sin distinguir tildes ni mayúsculas.
- Filtros combinables por categoría y favoritos; ordenación por precio o nombre.
- Detalles de producto en un modal.
- Favoritos y carrito persistentes cuando el navegador permite almacenamiento local. Los datos dañados y modelos desconocidos se descartan. Si falla el almacenamiento, la selección funciona durante la visita.
- Carrito lateral: incremento, reducción y eliminación; de 1 a 99 unidades por modelo. Reducir a cero elimina el artículo.
- Subtotal y total calculados desde los precios actuales del catálogo. El envío no aplica en esta demostración.
- Resumen de selección sin procesar un pedido ni borrar el carrito.
- Modales nativos con foco contenido, Escape, cierre al pulsar fuera y restauración del foco.
- Notificaciones visuales y anuncios para lectores de pantalla.
- Animaciones discretas, desactivadas cuando se solicita movimiento reducido.

## Agregar imágenes y productos

Guarda nuevas imágenes, iconos y fuentes dentro de `activos/`. Usa rutas relativas como `activos/equipo.webp` y texto alternativo descriptivo en las imágenes informativas.

Agrega productos al arreglo `products`, al inicio de `script.js`, con un `id` único y todos los campos presentes en los modelos actuales. Las categorías admitidas son `premium`, `fold` y `value`; los precios son números en soles. Las tarjetas, búsqueda, favoritos y carrito se generan desde ese arreglo.

Para utilizar fotografías en lugar de ilustraciones, adapta la función `art(product)` y los estilos de `.product-art`. Valida las rutas y el contenido de los productos; esta versión utiliza exclusivamente datos locales controlados.

Esta versión no incluye pasarela de pago, inventario comercial, backend ni condiciones de venta reales. Esos servicios deben implementarse antes de utilizarla como tienda comercial.

