<<<<<<< HEAD
# Sistema de Pedidos — Prototipo (React + Vite)

Misma interfaz y comportamiento que la versión vanilla, reescrita
como componentes de React, con el estado centralizado en un hook.

## Cómo correrlo

```
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente `http://localhost:5173`).

## Estructura

```
src/
  main.jsx              Punto de entrada, monta <App />
  App.jsx                Componente raíz: dueño del estado de vista y coordina todo
  data/
    menu.js               Menú del negocio (productos, precios, modificadores)
  hooks/
    useOrders.js          Toda la lógica: carrito, pedidos, tablero (custom hook)
  components/
    Header.jsx             Barra superior + navegación + reloj
    CategoryTabs.jsx       Pestañas de categoría del menú
    MenuGrid.jsx           Grilla de productos
    Cart.jsx                Pedido actual (incluye CartLine como subcomponente)
    Ticket.jsx              Comprobante imprimible
    Board.jsx               Tablero de pedidos activos (incluye OrderCard)
  styles.css              Mismo diseño visual que la versión vanilla
```

## Por qué está dividido así

- **`data/menu.js`** separado porque es lo único que cambia seguido
  (si agregan un producto nuevo, se toca solo este archivo).
- **`useOrders.js`** concentra toda la lógica de negocio (agregar al
  carrito, generar comprobante, avanzar estado) para que los
  componentes se ocupen solo de mostrar cosas, no de calcular nada.
- **Un componente por responsabilidad visual**, para que cada
  archivo se pueda leer y modificar sin tener que entender el resto.

## Qué es y qué no es esto

Este es el prototipo de interfaz, con los pedidos guardados en
memoria (`useState`) — se pierden al recargar. El siguiente paso
real es conectar `useOrders.js` a una API (por ejemplo FastAPI +
base de datos) en lugar de guardar todo en el estado de React.
=======
# PerritosGuao
aplicacion web de registros de comida rapida 
>>>>>>> 19f2544fa163218b5821f2eb11f9eeb69d7eca2d
