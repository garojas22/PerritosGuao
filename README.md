# 🌭 PerritosGuao — Sistema de Pedidos (React + Vite)

Aplicación web de registros de comida rápida. Reescritura del prototipo vanilla a componentes funcionales de React con gestión de estado centralizada a través de custom hooks.

## 📚​ Características

- **Gestión de pedidos:** Carrito interactivo, cálculo de totales y generación de tickets imprimibles.
- **Tablero activo:** Seguimiento de pedidos en tiempo real con actualización de estados.
- **Arquitectura modular:** Separación clara entre lógica de negocio, datos del menú e interfaz.
- **Lógica desacoplada:** Manejo centralizado del estado (`useState`) preparado para integración con API/Backend.

## 🔌 Cómo correrlo

```
npm install
npm run dev
```

## 📓 Estructura

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
