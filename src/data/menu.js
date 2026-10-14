// Menú real del negocio. Este es el único archivo que se necesita
// tocar si cambian productos, precios o modificadores.
//
// Un producto puede tener, además de nombre y precio:
//  - variants: tamaños con precio propio (ej. "1 carne" / "2 carnes").
//    `units` es cuántas unidades de proteína lleva ese tamaño.
//  - choices: elecciones sin precio (pan, carne, marca). `options` son ids
//    de data/inventory.js si consumen inventario; `trackInventory: false`
//    sirve para elecciones informativas. `qty` indica cuánto se descuenta.
//
// Si cambias algo aquí, sube MENU_VERSION para que los equipos recarguen el menú.

export const MENU_VERSION = 9;

// Precio confirmado por el dueño; mantenerlo aquí evita que el cajero pueda
// modificar el precio de la oferta al armar un pedido.
export const PRECIO_PROMO_2_HAMBURGUESAS = 10;

const BURGER_BREADS = ["pan-brioche", "pan-batata", "pan-pretzel"];
const BURGER_COMBO_BREADS = [...BURGER_BREADS, "pan-brioche-promo"];
const BURGER_COMBO_MEATS = ["carne-normal", "carne-promo"];
// Una sola carne: no se le pregunta a nadie, pero igual se descuenta del inventario.
const BURGER_MEATS = ["carne-normal"];

/** Elecciones de una hamburguesa: pan y carne (la cantidad de carne depende del tamaño). */
const burgerChoices = (breads = BURGER_BREADS, meatQty = "variant", meats = BURGER_MEATS) => [
  { id: "pan", label: "Pan", options: breads, qty: 1 },
  { id: "carne", label: "Carne", options: meats, qty: meatQty },
];

/** Elecciones de un perro caliente: pan de perro y la salchicha que corresponda. */
const hotDogChoices = (sausages) => [
  { id: "pan-perro", label: "Pan", options: ["pan-perro"], qty: 1 },
  { id: "proteina", label: "Salchicha", options: sausages, qty: 1 },
];
const drinkBrands = (brands) => [
  { id: "marca", label: "Marca", options: brands, trackInventory: false, showSelected: true },
];
const drinkFlavors = (flavors) => [
  { id: "sabor", label: "Sabor", options: flavors, trackInventory: false, showSelected: true },
];
const OFFER_LITER_DRINKS = ["Golden Manzanita", "Golden Naranja", "Golden Frescolita", "7up"];

export const MENU = {
  "Perros calientes": [
    {
      id: "pg",
      name: "Perro Guao",
      price: 3.50,
      desc: "Pan brioche crustísimo, salchicha Plumrose, ensalada rallada, cebolla, papa, queso de año y salsas.",
      ingredients: ["ensalada", "cebolla", "papas", "queso de año", "salsas"],
      choices: hotDogChoices(["salchicha-winner"]),
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
      choices: burgerChoices(["pan-brioche"], 1, ["carne-promo"]),
      comboChoiceOptions: { pan: BURGER_COMBO_BREADS, carne: BURGER_COMBO_MEATS },
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
      comboChoiceOptions: { pan: BURGER_COMBO_BREADS, carne: BURGER_COMBO_MEATS },
    },
    {
      id: "hb",
      name: "La Cheese Bacon",
      price: 7.99,
      desc: "Lechuga, tomate, pepinillos y salsa BK.",
      ingredients: ["lechuga", "tomate", "pepinillos", "salsa bk"],
      variants: [
        { id: "1", label: "1 carne", price: 7.99, units: 1 },
        { id: "2", label: "2 carnes", price: 9.99, units: 2 },
      ],
      choices: burgerChoices(),
      comboChoiceOptions: { pan: BURGER_COMBO_BREADS, carne: BURGER_COMBO_MEATS },
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
      comboChoiceOptions: { pan: BURGER_COMBO_BREADS, carne: BURGER_COMBO_MEATS },
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
    {
      id: "b2", name: "Refresco de lata", price: 1.25, desc: "", ingredients: [],
      choices: drinkBrands(["Frescolita", "Chinotto", "Fanta", "Coca-Cola"]),
    },
    {
      id: "b3", name: "Refresco de botella", price: 1.25, desc: "", ingredients: [],
      choices: drinkBrands(["Nevada", "Chinotto", "Coca-Cola", "Frescolita", "Hit"]),
    },
    {
      id: "b4", name: "Refresco de 1 Lt", price: 1.75, desc: "", ingredients: [],
      choices: drinkBrands(["Coca-Cola"]),
      comboChoiceOptions: { marca: OFFER_LITER_DRINKS },
      comboChoiceDefaults: { marca: OFFER_LITER_DRINKS },
    },
    {
      id: "b5", name: "Refresco de 1.25 Lt", price: 2.25, desc: "", ingredients: [],
      choices: drinkBrands(["Coca-Cola", "Frescolita"]),
    },
    {
      id: "b6", name: "Refresco de 1.5 Lt", price: 2.50, desc: "", ingredients: [],
      choices: drinkBrands(["Fanta", "Coca-Cola"]),
    },
    {
      id: "b7", name: "Refresco de 2 Lt", price: 3.50, desc: "", ingredients: [],
      choices: drinkBrands(["Pepsi", "Golden", "7up"]),
    },
    {
      id: "b8", name: "Nestea", price: 2.00, desc: "", ingredients: [],
      choices: drinkFlavors(["Limón", "Durazno"]),
    },
    { id: "b9", name: "Agua mineral pequeña", price: 1.00, desc: "", ingredients: [] },
  ],
  "Ofertas": [
    {
      id: "perro-dia",
      name: "Perro del día",
      price: 3.00,
      desc: "Perro Guao con salchicha de pavo.",
      ingredients: ["ensalada", "cebolla", "papas", "queso de año", "salsas"],
      choices: hotDogChoices(["salchicha-pavo"]),
    },
    {
      id: "hamburguesa-promo",
      name: "Hamburguesa de promo",
      price: 0,
      hidden: true,
      desc: "Hamburguesa de promoción.",
      ingredients: ["lechuga", "tomate", "pepinillos", "ketchup", "mayonesa", "mostaza", "facilista"],
      choices: burgerChoices(["pan-brioche-promo"], 1, ["carne-promo"]),
      comboChoiceOptions: { pan: BURGER_COMBO_BREADS, carne: BURGER_COMBO_MEATS },
    },
    {
      id: "promo-2-hamburguesas",
      name: "2 Hamburguesas de promo",
      isCombo: true,
      price: PRECIO_PROMO_2_HAMBURGUESAS,
      parts: [
        { ref: "hamburguesa-promo", label: "Hamburguesa 1" },
        { ref: "hamburguesa-promo", label: "Hamburguesa 2" },
        {
          ref: "b4",
          label: "Refresco de 1 Lt",
          choiceOptions: { marca: OFFER_LITER_DRINKS },
        },
      ],
    },
  ],
};

if (import.meta.env.DEV) {
  Object.entries(MENU).forEach(([category, products]) => {
    if (category === "Ofertas") return;
    products.forEach(product => {
      (product.choices || []).forEach(choice => {
        const allowedPromoIngredient = product.id === "hj" && choice.id === "carne";
        if (
          choice.options.includes("pan-brioche-promo") ||
          (choice.options.includes("carne-promo") && !allowedPromoIngredient)
        ) {
          console.warn(`El producto normal "${product.name}" ofrece un insumo exclusivo de promoción.`);
        }
      });
    });
  });
}
// Nota: el menú impreso no trae precios de Extras ni de Bebidas; se conservaron
// los que ya tenía el sistema.