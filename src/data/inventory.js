/**
 * Insumos que el negocio lleva en inventario (panes y proteínas).
 *
 * Sale de las listas que escribió el dueño. Cada producto del menú dice, en
 * menu.js, cuáles de estos insumos consume. Para agregar un insumo nuevo basta
 * con sumarlo aquí y usarlo en el menú.
 */
export const INVENTORY_ITEMS = [
{ id: 'pan-brioche', name: "Brioche Bertha's", group: 'Panes', note: 'Hamburguesas normales' },
{ id: 'pan-brioche-promo', name: 'Brioche Crustissimo', group: 'Panes', note: 'Solo promociones' },
{ id: 'pan-batata', name: 'Pan de batata', group: 'Panes' },
{ id: 'pan-pretzel', name: 'Pan de pretzel', group: 'Panes' },
{ id: 'pan-perro', name: 'Pan de perro', group: 'Panes' },
{ id: 'carne-normal', name: 'Carne normal 125 g', group: 'Proteínas' },
{ id: 'carne-promo', name: 'Carne promo', group: 'Proteínas', note: 'Promociones y La Junior' },
{ id: 'salchicha-winner', name: 'Salchicha Winner', group: 'Proteínas' },
{ id: 'salchicha-pavo', name: 'Salchicha de pavo', group: 'Proteínas', note: 'Perro del día' },
{ id: 'salchicha-polaca', name: 'Salchicha polaca', group: 'Proteínas' },
{ id: 'chorifrito', name: 'Chorifrito', group: 'Proteínas' },
{ id: 'choripana', name: 'Choripana', group: 'Proteínas' },
];

const BY_ID = new Map(INVENTORY_ITEMS.map(item => [item.id, item]));

/** Nombre legible de un insumo; si el id no existe se devuelve tal cual. */
export function getInventoryName(id) {
return BY_ID.get(id)?.name ?? id;
}

/** Nota de uso para aclarar insumos con una función específica en el negocio. */
export function getInventoryNote(id) {
return BY_ID.get(id)?.note ?? '';
}