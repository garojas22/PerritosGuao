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

export const MENU_VERSION = 12;

// Precio confirmado por el dueño; mantenerlo aquí evita que el cajero pueda
// modificar el precio de la oferta al armar un pedido.
export const PRECIO_PROMO_2_HAMBURGUESAS = 10;

const BURGER_BREADS = ["pan-brioche", "pan-batata", "pan-pretzel"];
const BURGER_COMBO_BREADS = [...BURGER_BREADS, "pan-brioche-promo"];
const BURGER_COMBO_MEATS = ["carne-normal", "carne-promo"];
// Una sola carne: no se le pregunta a nadie, pero igual se descuenta del inventario.
const BURGER_MEATS = ["carne-normal"];

/** Carnes de hamburguesa. La "carne extra" reutiliza la que el cliente eligió. */
export const MEAT_ITEMS = ["carne-normal", "carne-promo"];

/**
 * Precio de una carne extra cuando la hamburguesa NO tiene variantes de
 * tamaño. Cuando sí las tiene, el precio sale de la diferencia entre
 * "2 carnes" y "1 carne" de ESA hamburguesa, que es lo que el dueño ya
 * decidió cobrar por la segunda carne. Así no hay dos precios distintos
 * para lo mismo.
 */
export const EXTRA_MEAT_PRICE = 2.00;

/**
 * Agregados que se le suman a UNA línea del pedido, no al pedido completo.
 *
 * La regla, decidida con el dueño: un extra solo se ofrece si ese ingrediente
 * YA forma parte de la preparación del producto (`ingredients`). Así nadie
 * inventa una hamburguesa nueva agregándole algo que esa receta no lleva.
 *
 * La única excepción es la carne de hamburguesa: se le puede agregar a
 * cualquier hamburguesa porque no cambia la receta, solo el tamaño. Al perro
 * caliente NO se le agrega salchicha ni chorizo: eso sería otro producto.
 *
 * `requires` se compara CONTRA EL TEXTO EXACTO de un ingrediente del producto
 * (sin tildes ni mayúsculas). "mermelada de tocineta" no habilita "Tocineta":
 * son cosas distintas. Si el dueño quiere habilitarlo, se agrega "tocineta"
 * a los `ingredients` de ese producto.
 */
export const EXTRAS = [
  { id: "x-carne",          name: "Carne extra",    scope: "burger" },
  { id: "x-pepinillos",     name: "Pepinillos",     price: 0.50, item: "extra-pepinillos",     requires: "pepinillos" },
  { id: "x-maiz",           name: "Maíz",           price: 0.50, item: "extra-maiz",           requires: "maíz" },
  { id: "x-queso-amarillo", name: "Queso amarillo", price: 0.75, item: "extra-queso-amarillo", requires: "queso amarillo" },
  { id: "x-tocineta",       name: "Tocineta",       price: 1.00, item: "extra-tocineta",       requires: "tocineta" },
];

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

/**
 * Elecciones de marca para refrescos con múltiples marcas.
 * Las options son IDs de insumos (data/inventory.js), así el inventario
 * descuenta la marca exacta que se vendió.
 */
const drinkBrands = (brandIds) => [
  { id: "marca", label: "Marca", options: brandIds, showSelected: true },
];

/**
 * Elecciones de sabor (Nestea). Los ids apuntan a insumos distintos porque
 * el dueño compra y cuenta Limón y Durazno por separado.
 */
const drinkFlavors = (flavorIds) => [
  { id: "sabor", label: "Sabor", options: flavorIds, showSelected: true },
];

/**
 * Hamburguesa de las promociones: es "La Clásica" (hc) con la elección forzada.
 * No se duplica el producto: la oferta reutiliza sus ingredientes y sus "Sin X"
 * y solo fija 1 carne + pan Crustissimo + carne promo. Como esas opciones viven
 * en la PARTE de la oferta (choiceOptions / variantIds) y no en `hc`, La Clásica
 * normal sigue sin ofrecer insumos de promo. Con una sola opción por elección
 * el cajero no ve nada que escoger y el inventario igual descuenta lo correcto.
 */
const promoBurgerPart = label => ({
  ref: "hc",
  label,
  variantIds: ["1"],
  choiceOptions: { pan: ["pan-brioche-promo"], carne: ["carne-promo"] },
});

export const MENU = {
  // La categoría "Extras" se eliminó: los agregados ya no son productos
  // sueltos sino parte de una línea del pedido (ver EXTRAS arriba y
  // utils/extras.js). Un renglón suelto de "Pepinillos" en un pedido de tres
  // hamburguesas no decía a cuál iba, y la cocina tenía que adivinar.
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
  "Bebidas": [
    {
      id: "b1", name: "Malta retornable", price: 0.80, desc: "", ingredients: [],
      // choice silencioso: no se pregunta (1 opción) pero descuenta del inventario
      choices: [{ id: "bebida", label: "Bebida", options: ["bebida-malta"], qty: 1 }],
    },
    {
      id: "b2", name: "Refresco de lata", price: 1.25, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-lata-frescolita", "refresco-lata-chinotto", "refresco-lata-fanta", "refresco-lata-cocacola"]),
    },
    {
      id: "b3", name: "Refresco de botella", price: 1.25, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-botella-cocacola", "refresco-botella-frescolita", "refresco-botella-chinotto", "refresco-botella-hit"]),
    },
    {
      // Producto nuevo: botella pequeña (Nevada, Chinotto). Precio a confirmar con el dueño.
      id: "b10", name: "Refresco de botellita", price: 1.00, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-botellita-nevada", "refresco-botellita-chinotto"]),
    },
    {
      // Todas las marcas disponibles en venta normal y en combo.
      id: "b4", name: "Refresco de 1 Lt", price: 1.75, desc: "", ingredients: [],
      choices: drinkBrands([
        "refresco-1lt-cocacola",
        "refresco-1lt-golden-manzanita",
        "refresco-1lt-golden-naranja",
        "refresco-1lt-golden-frescolita",
        "refresco-1lt-7up",
      ]),
    },
    {
      id: "b5", name: "Refresco de 1.25 Lt", price: 2.25, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-125lt-cocacola", "refresco-125lt-frescolita"]),
    },
    {
      id: "b6", name: "Refresco de 1.5 Lt", price: 2.50, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-15lt-fanta", "refresco-15lt-cocacola"]),
    },
    {
      id: "b7", name: "Refresco de 2 Lt", price: 3.50, desc: "", ingredients: [],
      choices: drinkBrands(["refresco-2lt-pepsi", "refresco-2lt-golden", "refresco-2lt-7up"]),
    },
    {
      id: "b8", name: "Nestea", price: 2.00, desc: "", ingredients: [],
      choices: drinkFlavors(["nestea-limon", "nestea-durazno"]),
    },
    {
      id: "b9", name: "Agua mineral pequeña", price: 1.00, desc: "", ingredients: [],
      choices: [{ id: "bebida", label: "Bebida", options: ["bebida-agua-mineral"], qty: 1 }],
    },
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
      id: "promo-2-hamburguesas",
      name: "2 Hamburguesas de promo",
      isCombo: true,
      price: PRECIO_PROMO_2_HAMBURGUESAS,
      parts: [
        promoBurgerPart("Hamburguesa 1"),
        promoBurgerPart("Hamburguesa 2"),
        {
          // b4 ya tiene todas las marcas en modo normal: no hace falta restricción
          ref: "b4",
          label: "Refresco de 1 Lt",
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
