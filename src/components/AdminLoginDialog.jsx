import { useEffect, useRef, useState } from 'react';
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH, isValidPinFormat, getLockRemainingMs } from '../utils/adminPin';

/**
 * Diálogo para entrar al modo administrador.
 * - Si todavía no hay PIN creado: pide crearlo (dos veces, para evitar errores de tecleo).
 * - Si ya existe: pide el PIN.
 */
export default function AdminLoginDialog({ hasPin, onUnlock, onSetup, onClose }) {
const [pin, setPin] = useState('');
const [confirmPin, setConfirmPin] = useState('');
const [error, setError] = useState('');
const [busy, setBusy] = useState(false);
const inputRef = useRef(null);
const isSetup = !hasPin;

// El foco se pone solo al abrir; efecto aparte para que no se repita si cambia onClose.
useEffect(() => {
inputRef.current?.focus();
}, []);

useEffect(() => {
function handleKey(event) {
    if (event.key === 'Escape') onClose();
}
window.addEventListener('keydown', handleKey);
return () => window.removeEventListener('keydown', handleKey);
}, [onClose]);

// Solo dígitos: así el campo nunca acepta letras ni espacios.
function digitsOnly(value) {
return value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);
}

async function handleSubmit(event) {
event.preventDefault();
if (busy) return;
setError('');

if (isSetup) {
    if (!isValidPinFormat(pin)) {
    setError(`El PIN debe tener entre ${PIN_MIN_LENGTH} y ${PIN_MAX_LENGTH} dígitos.`);
    return;
    }
    if (pin !== confirmPin) {
    setError('Los dos PIN no coinciden.');
    return;
    }
} else {
    const remaining = getLockRemainingMs();
    if (remaining > 0) {
    setError(`Demasiados intentos. Espera ${Math.ceil(remaining / 1000)} segundos.`);
    return;
    }
}

setBusy(true);
try {
    if (isSetup) {
    await onSetup(pin);
    onClose();
    return;
    }
    const result = await onUnlock(pin);
    if (result.ok) {
    onClose();
    return;
    }
    setPin('');
    if (result.lockedMs > 0) {
    setError(`Demasiados intentos. Espera ${Math.ceil(result.lockedMs / 1000)} segundos.`);
    } else {
    setError(`PIN incorrecto. Te quedan ${result.attemptsLeft} intentos.`);
    }
    inputRef.current?.focus();
} catch (err) {
    setError(err.message || 'No se pudo completar la acción.');
} finally {
    setBusy(false);
}
}

return (
<div className="confirm-backdrop" onClick={onClose}>
    <form
    className="confirm-dialog admin-dialog"
    role="dialog"
    aria-modal="true"
    onClick={event => event.stopPropagation()}
    onSubmit={handleSubmit}
    >
    <h3>{isSetup ? 'Crear PIN de administrador' : 'Modo administrador'}</h3>
    <p>
        {isSetup
        ? 'Este PIN protege la edición de productos, la eliminación de pedidos y el cierre de caja. Anótalo en un lugar seguro.'
        : 'Ingresa tu PIN para editar productos y ver el cierre de caja.'}
    </p>

    <div className="field">
        <label htmlFor="admin-pin">{isSetup ? 'Nuevo PIN' : 'PIN'}</label>
        <input
        id="admin-pin"
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_MAX_LENGTH}
        value={pin}
        onChange={e => setPin(digitsOnly(e.target.value))}
        placeholder={`${PIN_MIN_LENGTH} a ${PIN_MAX_LENGTH} dígitos`}
        />
    </div>

    {isSetup && (
        <div className="field">
        <label htmlFor="admin-pin-confirm">Repite el PIN</label>
        <input
            id="admin-pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_MAX_LENGTH}
            value={confirmPin}
            onChange={e => setConfirmPin(digitsOnly(e.target.value))}
            placeholder="Repite el PIN"
        />
        </div>
    )}

    {error && <div className="field-error">{error}</div>}

    <div className="confirm-actions admin-actions">
        <button type="button" className="confirm-btn-cancel" onClick={onClose}>
        Cancelar
        </button>
        <button type="submit" className="admin-btn-submit" disabled={busy}>
        {isSetup ? 'Crear y entrar' : 'Entrar'}
        </button>
    </div>
    </form>
</div>
);
}