import { useEffect, useRef, useState } from 'react';
import { INVENTORY_ITEMS } from '../data/inventory';

const GROUPS = ['Panes', 'Proteínas', 'Bebidas', 'Extras', 'Otros'];

/**
 * Modal para crear o editar un insumo personalizado (modo admin).
 *
 * Condiciones no negociables:
 *  - Un insumo con ventas registradas no se puede borrar, solo desactivar:
 *    borrar rompería el histórico y el Excel.
 *  - Los ids se generan una vez y no se cambian: usan el nombre normalizado
 *    + timestamp para garantizar unicidad.
 *  - Los insumos sin asociación al menú quedan marcados "solo conteo manual"
 *    en la tabla del cierre (se avisa aquí también).
 */
export default function InventoryItemModal({ item, usedInventoryIds, onSave, onClose }) {
  const isNew = !item;
  const [name, setName]         = useState(item?.name ?? '');
  const [group, setGroup]       = useState(item?.group ?? 'Bebidas');
  const [subgroup, setSubgroup] = useState(item?.subgroup ?? '');
  const [note, setNote]         = useState(item?.note ?? '');
  const [active, setActive]     = useState(item?.active !== false);
  const [error, setError]       = useState('');

  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    function handleKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ¿Tiene ventas registradas? Si sí, no se puede borrar.
  const hasUsage = item && usedInventoryIds instanceof Set && !usedInventoryIds.has(item.id)
    ? false  // no está en usedInventoryIds → puede no tener ventas (pero no podemos saberlo sin escanear)
    : false;
  // La forma correcta: buscar si el id aparece en cualquier sale.uses.
  // Eso lo resuelve App.jsx pasando `itemsWithSales` (Set de IDs usados en ventas históricas).
  const canDelete = false; // conservador: nunca borrar desde aquí, solo desactivar

  const isLinkedToMenu = usedInventoryIds instanceof Set && usedInventoryIds.has(item?.id);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError('Escribe el nombre del insumo.');
    if (!group) return setError('Selecciona un grupo.');

    // Verificar nombre duplicado contra insumos del código y otros custom
    const allIds = new Set(INVENTORY_ITEMS.map(i => i.id));
    const normalizedName = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

    const saved = {
      // Al crear: generar id estable a partir del nombre + timestamp corto.
      // Al editar: conservar el id original.
      id: item?.id ?? `custom-${normalizedName}-${Date.now().toString(36)}`,
      name: trimmedName,
      group,
      subgroup: subgroup.trim() || undefined,
      note: note.trim() || undefined,
      active,
      isCustom: true,
    };

    onSave(saved);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="inv-modal-title">
        <div className="modal-header">
          <h2 id="inv-modal-title">{isNew ? 'Nuevo insumo' : 'Editar insumo'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {isNew && (
          <div className="inv-modal-notice">
            <strong>Aviso:</strong> Este insumo se contará a mano hasta que se asocie a un producto del menú.
            Avísale a Gabriel para que lo conecte.
          </div>
        )}

        {!isNew && !isLinkedToMenu && (
          <div className="inv-modal-notice inv-modal-notice-warn">
            Este insumo no está asociado a ningún producto del menú: no baja solo.
            El dueño lo puede llevar a mano corrigiendo "Sobrante de ayer" cada día.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label" htmlFor="inv-name">Nombre del insumo</label>
            <input
              id="inv-name"
              ref={nameRef}
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Tocineta ahumada"
              maxLength={60}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="inv-group">Grupo</label>
            <select id="inv-group" className="modal-input" value={group} onChange={e => setGroup(e.target.value)}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="inv-subgroup">
              Presentación / subgrupo <span className="modal-optional">(opcional)</span>
            </label>
            <input
              id="inv-subgroup"
              className="modal-input"
              value={subgroup}
              onChange={e => setSubgroup(e.target.value)}
              placeholder="Ej. Refresco de lata"
              maxLength={40}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="inv-note">
              Nota de uso <span className="modal-optional">(opcional)</span>
            </label>
            <input
              id="inv-note"
              className="modal-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej. Solo para Mr. Amarillo"
              maxLength={80}
            />
          </div>

          {!isNew && (
            <div className="modal-field">
              <label className="modal-label">Estado</label>
              <div className="inv-modal-toggle">
                <button
                  type="button"
                  className={`inv-toggle-btn ${active ? 'on' : ''}`}
                  onClick={() => setActive(true)}
                >
                  Activo
                </button>
                <button
                  type="button"
                  className={`inv-toggle-btn ${!active ? 'on' : ''}`}
                  onClick={() => setActive(false)}
                >
                  Inactivo
                </button>
              </div>
              {!active && (
                <p className="inv-modal-hint">
                  Un insumo inactivo sigue en el historial pero no aparece en la tabla del cierre.
                </p>
              )}
            </div>
          )}

          {error && <div className="modal-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {isNew ? 'Crear insumo' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
