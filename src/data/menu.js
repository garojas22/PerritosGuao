// Menú real del negocio. Este es el único archivo que se necesita
// tocar si cambian productos, precios o modificadores.

export const MENU = {
  "Perros calientes": [
    { id: "pg", name: "Perro Guao", price: 3.00, desc: "Pan brioche, salchicha Plumrose, ensalada rallada, cebolla, papas, queso de año y salsas.", mods: ["Sin cebolla", "Sin queso", "Sin salsas", "Extra queso"] },
    { id: "ma", name: "Mr Amarillo", price: 4.00, desc: "Pan brioche, salchicha Plumrose, ensalada rallada, cebolla, papas, queso amarillo, pepinillos, maíz y salsas.", mods: ["Sin cebolla", "Sin queso", "Sin pepinillos", "Extra queso"] },
    { id: "mp", name: "Mr Polaco", price: 5.00, desc: "Pan brioche, salchicha polaca/chistorra Plumrose, ensalada rallada, cebolla, papas, queso amarillo, pepinillos, maíz y salsas.", mods: ["Sin cebolla", "Sin queso", "Sin pepinillos", "Extra queso"] },
  ],
  "Choripán": [
    { id: "cp", name: "Chori Pana", price: 3.00, desc: "Pan brioche, chorizo Montserratina, chimichurri y mostaza.", mods: ["Sin chimichurri", "Sin mostaza", "Extra chorizo"] },
  ],
  "Hamburguesas": [
    { id: "ls", name: "La Soltera", price: 6.50, desc: "Pan de batata, 125g de carne, pepinillos, tomate, lechuga, cebolla, facilista, mermelada de tocineta, papas y salsas.", mods: ["Sin cebolla", "Sin tomate", "Sin lechuga", "Extra queso", "Extra tocineta"] },
    { id: "ld", name: "La Doble", price: 8.50, desc: "Pan de batata, 250g de carne, pepinillos, tomate, lechuga, cebolla, facilista, mermelada de tocineta, papas y salsas.", mods: ["Sin cebolla", "Sin tomate", "Sin lechuga", "Extra queso", "Extra tocineta"] },
  ],
  "Extras": [
    { id: "ex1", name: "Pepinillos", price: 0.50, desc: "Porción extra de pepinillos.", mods: [] },
    { id: "ex2", name: "Papas", price: 0.50, desc: "Porción extra de papas.", mods: [] },
    { id: "ex3", name: "Maíz", price: 0.50, desc: "Porción extra de maíz.", mods: [] },
    { id: "ex4", name: "Queso amarillo", price: 0.75, desc: "Porción extra de queso amarillo.", mods: [] },
    { id: "ex5", name: "Tocineta", price: 1.00, desc: "Porción extra de tocineta.", mods: [] },
    { id: "ex6", name: "Salchicha", price: 1.00, desc: "Salchicha adicional.", mods: [] },
  ],
  "Bebidas": [
    { id: "b1", name: "Nestea (limón o durazno)", price: 1.50, desc: "Elige el sabor al tomar el pedido.", mods: ["Sabor limón", "Sabor durazno"] },
    { id: "b2", name: "Refresco de botella", price: 2.00, desc: "", mods: [] },
    { id: "b3", name: "Refresco de lata", price: 1.50, desc: "", mods: [] },
    { id: "b4", name: "Malta", price: 1.50, desc: "", mods: [] },
  ],
};
// Nota: precios de Extras y Bebidas no venían en el menú original — son valores
// de referencia para el prototipo. Ajústalos con datos reales del negocio.
