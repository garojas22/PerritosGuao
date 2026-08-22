// Menú real del negocio. Este es el único archivo que se necesita
// tocar si cambian productos, precios o modificadores.

export const MENU_VERSION = 3;

export const MENU = {
  "Perros calientes": [
    {
      id: "pg",
      name: "Perro Guao",
      price: 3.00,
      desc: "Pan brioche, salchicha Plumrose, ensalada rallada, cebolla, papas, queso de año y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso de año", "salsas"],
    },
    {
      id: "pd",
      name: "Perro del día",
      price: 2.50,
      desc: "Pan brioche, salchicha de pavo, ensalada rallada, cebolla, papas, queso de año y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso de año", "salsas"],
    },
    {
      id: "ma",
      name: "Mr Amarillo",
      price: 4.00,
      desc: "Pan brioche, salchicha Plumrose, ensalada rallada, cebolla, papas, queso amarillo, pepinillos, maíz y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso amarillo", "pepinillos", "maíz", "salsas"],
    },
    {
      id: "mp",
      name: "Mr Polaco",
      price: 5.00,
      desc: "Pan brioche, salchicha polaca/chistorra Plumrose, ensalada rallada, cebolla, papas, queso amarillo, pepinillos, maíz y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso amarillo", "pepinillos", "maíz", "salsas"],
    },
  ],
  "Choripán": [
    {
      id: "cp",
      name: "Chori Pana",
      price: 3.00,
      desc: "Pan brioche, chorizo Montserratina, chimichurri y mostaza.",
      ingredients: ["chimichurri", "mostaza"],
    },
  ],
  "Hamburguesas": [
    {
      id: "ls",
      name: "La Soltera",
      price: 6.50,
      desc: "Pan de batata, 125g de carne, pepinillos, tomate, lechuga, cebolla, facilista, mermelada de tocineta, papas y salsas.",
      ingredients: ["pepinillos", "tomate", "lechuga", "cebolla", "papas", "mermelada de tocineta", "salsas"],
    },
    {
      id: "ld",
      name: "La Doble",
      price: 8.50,
      desc: "Pan de batata, 250g de carne, pepinillos, tomate, lechuga, cebolla, facilista, mermelada de tocineta, papas y salsas.",
      ingredients: ["pepinillos", "tomate", "lechuga", "cebolla", "papas", "mermelada de tocineta", "salsas"],
    },
  ],
  "Extras": [
    { id: "ex1", name: "Pepinillos", price: 0.50, desc: "Porción extra de pepinillos.", ingredients: [] },
    { id: "ex2", name: "Papas", price: 0.50, desc: "Porción extra de papas.", ingredients: [] },
    { id: "ex3", name: "Maíz", price: 0.50, desc: "Porción extra de maíz.", ingredients: [] },
    { id: "ex4", name: "Queso amarillo", price: 0.75, desc: "Porción extra de queso amarillo.", ingredients: [] },
    { id: "ex5", name: "Tocineta", price: 1.00, desc: "Porción extra de tocineta.", ingredients: [] },
    { id: "ex6", name: "Salchicha", price: 1.00, desc: "Salchicha adicional.", ingredients: [] },
  ],
  "Bebidas": [
    { id: "b1", name: "Malta", price: 0.80, desc: "", ingredients: [] },
    { id: "b2", name: "Lata", price: 1.25, desc: "", ingredients: [] },
    { id: "b3", name: "Gasificado pequeño", price: 1.25, desc: "", ingredients: [] },
    { id: "b4", name: "Refresco 1Lt", price: 1.75, desc: "", ingredients: [] },
    { id: "b5", name: "Refresco 1.25Lts", price: 2.25, desc: "", ingredients: [] },
    { id: "b6", name: "Refresco 1.5Lts", price: 2.50, desc: "", ingredients: [] },
    { id: "b7", name: "Refresco 2Lts", price: 3.50, desc: "", ingredients: [] },
    { id: "b8", name: "Nestea", price: 2.00, desc: "", ingredients: [] },
    { id: "b9", name: "Lipton", price: 2.50, desc: "", ingredients: [] },
  ],
};
// Nota: precios de Extras no venían en el menú original — son valores
// de referencia para el prototipo. Ajústalos con datos reales del negocio.
