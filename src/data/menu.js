// Menú real del negocio. Este es el único archivo que se necesita
// tocar si cambian productos, precios o modificadores.
//
// Un producto puede tener, además de nombre y precio:
//  - variants: tamaños con precio propio (ej. "1 carne" / "2 carnes").
//    `units` es cuántas unidades de proteína lleva ese tamaño.
//  - choices: elecciones sin precio que consumen inventario (pan, tipo de
//    carne). `options` son ids de data/inventory.js. Si hay una sola opción
//    no se le pregunta a nadie, pero igual se descuenta del inventario.
//    `qty` es cuántas unidades gasta, o "variant" para tomar `units` del tamaño.
//
// Si cambias algo aquí, sube MENU_VERSION para que los equipos recarguen el menú.

export const MENU_VERSION = 4;

const BURGER_BREADS = ["pan-brioche", "pan-brioche-promo", "pan-batata", "pan-pretzel"];
const BURGER_MEATS = ["carne-normal", "carne-promo"];

/** Elecciones de una hamburguesa: pan y carne (la cantidad de carne depende del tamaño). */
const burgerChoices = (breads = BURGER_BREADS, meatQty = "variant") => [
  { id: "pan", label: "Pan", options: breads, qty: 1 },
  { id: "carne", label: "Carne", options: BURGER_MEATS, qty: meatQty },
];

/** Elecciones de un perro caliente: pan de perro y la salchicha que corresponda. */
const hotDogChoices = (sausages) => [
  { id: "pan", label: "Pan", options: ["pan-perro"], qty: 1 },
  { id: "proteina", label: "Salchicha", options: sausages, qty: 1 },
];

export const MENU = {
  "Perros calientes": [
    {
      id: "pg",
      name: "Perro Guao",
      price: 3.50,
      desc: "Pan brioche crustísimo, salchicha Plumrose, ensalada rallada, cebolla, papa, queso de año y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso de año", "salsas"],
      choices: hotDogChoices(["salchicha-winner", "salchicha-pavo"]),
    },
    {
      id: "ma",
      name: "Mr. Amarillo",
      price: 4.50,
      desc: "Pan brioche crustísimo, salchicha Plumrose, ensalada rallada, cebolla, papa, queso amarillo, pepinillos, tocineta, maíz y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso amarillo", "pepinillos", "tocineta", "maíz", "salsas"],
      choices: hotDogChoices(["salchicha-winner", "salchicha-pavo"]),
    },
    {
      id: "mp",
      name: "Mr. Polaco",
      price: 5.50,
      desc: "Pan brioche crustísimo, salchicha polaca Plumrose, ensalada rallada, cebolla, papa, queso amarillo, pepinillos, tocineta, maíz y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso amarillo", "pepinillos", "tocineta", "maíz", "salsas"],
      choices: hotDogChoices(["salchicha-polaca"]),
    },
    {
      id: "cp",
      name: "Choripana",
      price: 3.50,
      desc: "Pan brioche crustísimo, chorizo Montserratina, chimichurri y mostaza.",
      ingredients: ["chimichurri", "mostaza"],
      choices: hotDogChoices(["choripana"]),
    },
  ],
  "Hamburguesas": [
    {
      id: "hj",
      name: "La Junior",
      price: 5.50,
      desc: "Pan brioche, carne, facilista y ketchup.",
      ingredients: ["facilista", "ketchup"],
      choices: burgerChoices(["pan-brioche", "pan-brioche-promo"], 1),
    },
    {
      id: "hc",
      name: "La Clásica",
      price: 6.50, // precio del tamaño más barato; el real sale de `variants`
      desc: "Lechuga, tomate, pepinillos, ketchup Pampero, mayonesa Mavesa, mostaza French's y facilista.",
      ingredients: ["lechuga", "tomate", "pepinillos", "ketchup", "mayonesa", "mostaza", "facilista"],
      variants: [
        { id: "1", label: "1 carne", price: 6.50, units: 1 },
        { id: "2", label: "2 carnes", price: 7.99, units: 2 },
      ],
      choices: burgerChoices(),
    },
    {
      id: "hb",
      name: "La Cheese Bacon",
      price: 7.99,
      desc: "Lechuga, tomate, pepinillos y salsa BK. Con 1 carne lleva 2 facilista; con 2 carnes, 4.",
      ingredients: ["lechuga", "tomate", "pepinillos", "salsa bk"],
      variants: [
        { id: "1", label: "1 carne (2 facilista)", price: 7.99, units: 1 },
        { id: "2", label: "2 carnes (4 facilista)", price: 9.99, units: 2 },
      ],
      choices: burgerChoices(),
    },
    {
      id: "hd",
      name: "De la Casa",
      price: 7.50,
      desc: "Lechuga, tomate, mermelada de tocineta, ketchup Pampero, salsa X, mostaza French's y facilista.",
      ingredients: ["lechuga", "tomate", "mermelada de tocineta", "ketchup", "salsa x", "mostaza", "facilista"],
      variants: [
        { id: "1", label: "1 carne", price: 7.50, units: 1 },
        { id: "2", label: "2 carnes", price: 9.50, units: 2 },
      ],
      choices: burgerChoices(),
    },
  ],
  "Extras": [
    { id: "ex1", name: "Pepinillos", price: 0.50, desc: "Porción extra de pepinillos.", ingredients: [] },
    { id: "ex3", name: "Maíz", price: 0.50, desc: "Porción extra de maíz.", ingredients: [] },
    { id: "ex4", name: "Queso amarillo", price: 0.75, desc: "Porción extra de queso amarillo.", ingredients: [] },
    { id: "ex5", name: "Tocineta", price: 1.00, desc: "Porción extra de tocineta.", ingredients: [] },
    { id: "ex6", name: "Salchicha", price: 1.00, desc: "Salchicha adicional.", ingredients: [] },
  ],
  "Bebidas": [
    { id: "b1", name: "Malta retornable", price: 0.80, desc: "", ingredients: [] },
    { id: "b2", name: "Refresco de lata", price: 1.25, desc: "", ingredients: [] },
    { id: "b3", name: "Refresco de botella", price: 1.25, desc: "", ingredients: [] },
    { id: "b4", name: "Refresco de 1 Lt", price: 1.75, desc: "", ingredients: [] },
    { id: "b5", name: "Refresco de 1.25 Lt", price: 2.25, desc: "", ingredients: [] },
    { id: "b6", name: "Refresco de 1.5 Lt", price: 2.50, desc: "", ingredients: [] },
    { id: "b7", name: "Refresco de 2 Lt", price: 3.50, desc: "", ingredients: [] },
    { id: "b8", name: "Nestea (limón y durazno)", price: 2.00, desc: "", ingredients: [] },
  ],
};
// Nota: el menú impreso no trae precios de Extras ni de Bebidas; se conservaron
// los que ya tenía el sistema. "Agua mineral pequeña" está en el menú impreso
// pero no se agregó porque falta su precio: se agrega desde el modo admin.