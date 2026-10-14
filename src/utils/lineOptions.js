import { getInventoryName, getInventoryNote } from '../data/inventory';

/**
 * Variantes (tamaño) y elecciones (pan, carne...) de un producto del menú.
 * Ver el comentario de data/menu.js para el significado de cada campo.
 *
 * Todo lo que se decide aquí se guarda en la línea del pedido al agregarla,
 * así un cambio posterior del menú no altera ventas ya registradas.
 */

export function hasVariants(product) {
return Array.isArray(product?.variants) && product.variants.length > 0;
}

function getChoices(product) {
return Array.isArray(product?.choices) ? product.choices : [];
}

/** Elecciones que sí hay que preguntar: las que tienen más de una opción. */
export function askableChoices(product) {
return getChoices(product).filter(choice => choice.options.length > 1);
}

/** ¿Hay que abrir la ventana de opciones antes de agregar este producto? */
export function needsOptions(product) {
return (hasVariants(product) && product.variants.length > 1) || askableChoices(product).length > 0;
}

/** Precio "desde": el del tamaño más barato. */
export function getStartingPrice(product) {
if (!hasVariants(product)) return Number(product.price) || 0;
return Math.min(...product.variants.map(variant => Number(variant.price) || 0));
}

export function hasValidComboPrice(product) {
return product?.isCombo === true &&
    Array.isArray(product.parts) &&
    product.parts.length > 0 &&
    Number.isFinite(Number(product.price)) &&
    Number(product.price) > 0;
}

/** Selección inicial: primer tamaño y primera opción de cada elección. */
export function getDefaultSelection(product) {
return {
variantId: hasVariants(product) ? product.variants[0].id : null,
choices: Object.fromEntries(getChoices(product).map(choice => [choice.id, choice.options[0]])),
};
}

/**
 * Convierte una selección en los datos que lleva la línea del pedido:
 * - price: precio unitario del tamaño elegido
 * - variantLabel: "2 carnes" (vacío si el producto no tiene tamaños para elegir)
 * - optionLabels: nombres de lo elegido entre varias opciones ("Pan de batata")
 * - uses: insumos que gasta UNA unidad del producto [{ item, qty }]
 */
export function resolveSelection(product, selection) {
const variants = hasVariants(product) ? product.variants : [];
const variant = variants.find(v => v.id === selection?.variantId) ?? variants[0] ?? null;

const uses = [];
const optionLabels = [];

getChoices(product).forEach(choice => {
const chosen = choice.options.includes(selection?.choices?.[choice.id])
    ? selection.choices[choice.id]
    : choice.options[0];
const qty = choice.qty === 'variant' ? (variant?.units ?? 1) : (choice.qty ?? 1);

if (choice.trackInventory !== false) uses.push({ item: chosen, qty });
if (choice.options.length > 1 || choice.showSelected) optionLabels.push(getInventoryName(chosen));
});

return {
price: variant ? Number(variant.price) || 0 : Number(product.price) || 0,
variantLabel: variants.length > 1 && variant ? variant.label : '',
optionLabels,
uses,
};
}

/** Resuelve las partes configuradas de una oferta usando sus productos base. */
export function resolveComboParts(combo, productsById) {
return (combo.parts || []).map((part, index) => {
    const product = productsById[part.ref];
    if (!product) throw new Error(`No se encontró el producto "${part.ref}" de la oferta "${combo.name}".`);

    const resolved = resolveSelection(product, part.selection ?? getDefaultSelection(product));
    const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
    return {
        id: `${part.ref}-${index}`,
        name: product.name,
        label: part.label || product.name,
        productId: product.id,
        variantLabel: resolved.variantLabel,
        optionLabels: [...resolved.optionLabels],
        uses: resolved.uses.map(use => ({ ...use })),
        ingredients: [...ingredients],
        availMods: ingredients.map(ingredient => `Sin ${ingredient}`),
        mods: [],
    };
});
}

export function getProductNameKey(name = '') {
return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Partes del detalle de una línea, una por renglón: ["2 carnes", "Pan de batata"]. */
export function getLineParts(line) {
return [line.variantLabel, ...(line.optionLabels ?? [])].filter(Boolean);
}

/** Detalle de una línea en un solo texto: "2 carnes · Pan de batata". */
export function describeLine(line) {
if (line?.isCombo) {
    return (line.parts || []).map(part => {
        const detail = [part.variantLabel, ...(part.optionLabels ?? [])].filter(Boolean).join(' · ');
        return `${part.name}${detail ? ` (${detail})` : ''}`;
    }).join(', ');
}
return getLineParts(line).join(' · ');
}