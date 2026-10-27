/**
 * Insumos que el negocio lleva en inventario.
 *
 * Reglas para no romper el histórico:
 *  - NUNCA cambiar el `id` de un insumo existente: las ventas guardadas lo usan.
 *  - Para retirar un insumo del uso, desactivarlo desde el panel admin,
 *    no borrarlo de aquí.
 *  - El campo `subgroup` agrupa marcas de un mismo producto en la tabla del
 *    cierre: los ítems sin subgroup se muestran directamente bajo su grupo.
 *  - El inventario se lleva SIEMPRE en unidades, nunca en paquetes. Un insumo
 *    que llega empacado puede declarar `pack: N` (unidades por paquete): no
 *    cambia el conteo, solo muestra la equivalencia al cargar ("= 4 paq.").
 *    Si un insumo ya existente se contaba por paquete, NO se le cambia el
 *    significado: se crea uno nuevo con otro id y el viejo se deja morir, o el
 *    histórico de los días anteriores queda mintiendo.
 */
export const INVENTORY_ITEMS = [
  // ── Panes ────────────────────────────────────────────────────────────────
  { id: 'pan-brioche',       name: "Brioche Bertha's",    group: 'Panes', note: 'Hamburguesas normales' },
  { id: 'pan-brioche-promo', name: 'Brioche Crustissimo', group: 'Panes', note: 'Solo promociones' },
  { id: 'pan-batata',        name: 'Pan de batata',        group: 'Panes' },
  { id: 'pan-pretzel',       name: 'Pan de pretzel',       group: 'Panes' },
  { id: 'pan-perro',         name: 'Pan de perro',         group: 'Panes' },

  // ── Proteínas – tres subgrupos para no mostrar una lista plana larga ─────
  { id: 'carne-normal',     name: 'Carne normal 125 g', group: 'Proteínas', subgroup: 'Carnes' },
  { id: 'carne-promo',      name: 'Carne promo',         group: 'Proteínas', subgroup: 'Carnes', note: 'Promociones y La Junior' },

  { id: 'salchicha-winner', name: 'Salchicha Winner',   group: 'Proteínas', subgroup: 'Salchichas' },
  { id: 'salchicha-pavo',   name: 'Salchicha de pavo',  group: 'Proteínas', subgroup: 'Salchichas', note: 'Perro del día' },
  { id: 'salchicha-polaca', name: 'Salchicha polaca',   group: 'Proteínas', subgroup: 'Salchichas' },

  { id: 'chorifrito',       name: 'Chorifrito',          group: 'Proteínas', subgroup: 'Chorizos' },
  { id: 'choripana',        name: 'Choripana',            group: 'Proteínas', subgroup: 'Chorizos' },

  // ── Bebidas – sin marca: un insumo cada una, se muestran directo ─────────
  { id: 'bebida-malta',        name: 'Malta retornable', group: 'Bebidas' },
  { id: 'bebida-agua-mineral', name: 'Agua mineral',     group: 'Bebidas' },

  // ── Bebidas – con marca: subgroup = presentación ──────────────────────────
  { id: 'refresco-lata-frescolita', name: 'Frescolita', group: 'Bebidas', subgroup: 'Refresco de lata' },
  { id: 'refresco-lata-chinotto',   name: 'Chinotto',   group: 'Bebidas', subgroup: 'Refresco de lata' },
  { id: 'refresco-lata-fanta',      name: 'Fanta',      group: 'Bebidas', subgroup: 'Refresco de lata' },
  { id: 'refresco-lata-cocacola',   name: 'Coca-Cola',  group: 'Bebidas', subgroup: 'Refresco de lata' },

  // botella de vidrio (≈ 500 ml); Nevada se vende como botellita
  { id: 'refresco-botella-cocacola',   name: 'Coca-Cola',  group: 'Bebidas', subgroup: 'Refresco de botella' },
  { id: 'refresco-botella-frescolita', name: 'Frescolita', group: 'Bebidas', subgroup: 'Refresco de botella' },
  { id: 'refresco-botella-chinotto',   name: 'Chinotto',   group: 'Bebidas', subgroup: 'Refresco de botella' },
  { id: 'refresco-botella-hit',        name: 'Hit',        group: 'Bebidas', subgroup: 'Refresco de botella' },

  // botellita pequeña (Nevada 300 ml, Chinotto)
  { id: 'refresco-botellita-nevada',   name: 'Nevada',   group: 'Bebidas', subgroup: 'Refresco de botellita' },
  { id: 'refresco-botellita-chinotto', name: 'Chinotto', group: 'Bebidas', subgroup: 'Refresco de botellita' },

  { id: 'refresco-1lt-cocacola',          name: 'Coca-Cola',         group: 'Bebidas', subgroup: 'Refresco de 1 Lt' },
  { id: 'refresco-1lt-golden-manzanita',  name: 'Golden Manzanita',  group: 'Bebidas', subgroup: 'Refresco de 1 Lt' },
  { id: 'refresco-1lt-golden-naranja',    name: 'Golden Naranja',    group: 'Bebidas', subgroup: 'Refresco de 1 Lt' },
  { id: 'refresco-1lt-golden-frescolita', name: 'Golden Frescolita', group: 'Bebidas', subgroup: 'Refresco de 1 Lt' },
  { id: 'refresco-1lt-7up',               name: '7up',               group: 'Bebidas', subgroup: 'Refresco de 1 Lt' },

  { id: 'refresco-125lt-cocacola',   name: 'Coca-Cola',  group: 'Bebidas', subgroup: 'Refresco de 1.25 Lt' },
  { id: 'refresco-125lt-frescolita', name: 'Frescolita', group: 'Bebidas', subgroup: 'Refresco de 1.25 Lt' },

  { id: 'refresco-15lt-fanta',    name: 'Fanta',     group: 'Bebidas', subgroup: 'Refresco de 1.5 Lt' },
  { id: 'refresco-15lt-cocacola', name: 'Coca-Cola', group: 'Bebidas', subgroup: 'Refresco de 1.5 Lt' },

  { id: 'refresco-2lt-pepsi',  name: 'Pepsi',  group: 'Bebidas', subgroup: 'Refresco de 2 Lt' },
  { id: 'refresco-2lt-golden', name: 'Golden', group: 'Bebidas', subgroup: 'Refresco de 2 Lt' },
  { id: 'refresco-2lt-7up',    name: '7up',    group: 'Bebidas', subgroup: 'Refresco de 2 Lt' },

  { id: 'nestea-limon',   name: 'Nestea Limón',   group: 'Bebidas', subgroup: 'Nestea' },
  { id: 'nestea-durazno', name: 'Nestea Durazno', group: 'Bebidas', subgroup: 'Nestea' },

  // ── Extras – vendidos como productos sueltos; conteo por porción ─────────
  // La salchicha extra reutiliza `salchicha-winner` que ya existe en Proteínas.
  { id: 'extra-pepinillos',     name: 'Pepinillos (porciones)',     group: 'Extras' },
  { id: 'extra-maiz',           name: 'Maíz (porciones)',           group: 'Extras' },
  { id: 'extra-queso-amarillo', name: 'Queso amarillo (porciones)', group: 'Extras' },
  { id: 'extra-tocineta',       name: 'Tocineta (porciones)',       group: 'Extras' },
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
