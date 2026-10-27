/**
 * Agregados por línea del pedido ("extras").
 *
 * El problema que resuelve: antes los extras se vendían como productos
 * sueltos. En un pedido de tres hamburguesas, una línea de "Pepinillos" no
 * decía a CUÁL hamburguesa iba, y la cocina tenía que adivinar.
 *
 * Ahora el extra vive dentro de la línea: "1x La Clásica + Carne extra".
 *
 * Reglas (ver EXTRAS en data/menu.js):
 *  - Solo se ofrece un extra cuyo ingrediente ya esté en la preparación.
 *  - La carne de hamburguesa es la excepción: va en cualquier hamburguesa.
 *  - Los combos y ofertas no admiten extras: son armados cerrados.
 *
 * Funciones puras. El precio y los insumos de la línea se RECALCULAN desde
 * `basePrice`/`baseUses` en cada cambio, nunca se van sumando: así quitar un
 * extra devuelve exactamente lo que había antes, sin arrastrar redondeos.
 */

import { EXTRAS, MEAT_ITEMS, EXTRA_MEAT_PRICE } from '../data/menu';
import { roundMoney } from './payment';

/** "Maíz" y "maiz" son el mismo ingrediente. */
export function normalizeIngredient(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * ¿Es una hamburguesa? Se detecta por la elección "carne", que solo arman
 * las hamburguesas (los perros usan "proteina"). Preferible a mirar la
 * categoría: el administrador puede renombrarla desde la app.
 */
export function isBurger(product) {
  return (product?.choices || []).some(choice => choice.id === 'carne');
}

/**
 * Precio de un extra para ESE producto.
 * La carne extra cuesta lo que el dueño ya cobra por la segunda carne de esa
 * misma hamburguesa (diferencia entre sus variantes). Si no tiene variantes,
 * se usa EXTRA_MEAT_PRICE.
 */
export function extraPrice(product, extra) {
  if (extra.scope !== 'burger') return Number(extra.price) || 0;

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const uno = variants.find(v => Number(v.units) === 1);
  const dos = variants.find(v => Number(v.units) === 2);
  if (uno && dos) {
    const diff = roundMoney(Number(dos.price) - Number(uno.price));
    if (diff > 0) return diff;
  }
  return EXTRA_MEAT_PRICE;
}

/** Extras que se le pueden ofrecer a este producto. */
export function getAvailableExtras(product) {
  // Un combo es un armado cerrado con su propio precio: no admite agregados.
  if (!product || product.isCombo) return [];

  const ingredientes = new Set((product.ingredients || []).map(normalizeIngredient));

  return EXTRAS.filter(extra => {
    if (extra.scope === 'burger') return isBurger(product);
    return ingredientes.has(normalizeIngredient(extra.requires));
  });
}

/**
 * Insumo que gasta un extra en esta línea.
 * La carne extra gasta la MISMA carne que se eligió (normal o promo): si no,
 * una hamburguesa de promoción descontaría carne normal del inventario.
 */
export function extraUses(line, extra) {
  if (extra.scope !== 'burger') {
    return extra.item ? [{ item: extra.item, qty: 1 }] : [];
  }
  const base = line?.baseUses ?? line?.uses ?? [];
  const carne = base.find(use => MEAT_ITEMS.includes(use.item));
  return [{ item: carne?.item ?? MEAT_ITEMS[0], qty: 1 }];
}

/** Suma insumos repetidos: 2 carnes del tamaño + 1 extra = 3, no dos renglones. */
function mergeUses(list) {
  const total = new Map();
  list.forEach(use => {
    total.set(use.item, (total.get(use.item) || 0) + (Number(use.qty) || 0));
  });
  return [...total.entries()].map(([item, qty]) => ({ item, qty }));
}

/**
 * Recalcula precio e insumos de la línea a partir de su base y sus extras.
 * Es la ÚNICA forma en que se tocan `price` y `uses` cuando hay extras.
 */
export function recalcLine(line) {
  const basePrice = Number(line.basePrice ?? line.price) || 0;
  const baseUses = line.baseUses ?? line.uses ?? [];
  const extras = line.extras || [];

  return {
    ...line,
    basePrice,
    baseUses,
    price: roundMoney(basePrice + extras.reduce((sum, e) => sum + (Number(e.price) || 0), 0)),
    uses: mergeUses([...baseUses, ...extras.flatMap(e => e.uses || [])]),
  };
}

/** Agrega o quita un extra de la línea (es un interruptor). */
export function toggleLineExtra(line, extra, product) {
  const current = line.extras || [];
  const already = current.some(e => e.id === extra.id);

  const next = already
    ? current.filter(e => e.id !== extra.id)
    : [...current, {
        id: extra.id,
        name: extra.name,
        price: extraPrice(product, extra),
        uses: extraUses(line, extra),
      }];

  return recalcLine({ ...line, extras: next });
}

/** "+ Carne extra, + Pepinillos" para el comprobante y el cierre. */
export function describeExtras(line) {
  return (line?.extras || []).map(extra => `+ ${extra.name}`).join(', ');
}

export function hasExtras(line) {
  return Array.isArray(line?.extras) && line.extras.length > 0;
}
