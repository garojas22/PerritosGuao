// Ancho de línea en caracteres para la impresora térmica.
// La mayoría de las POS-80 con "Generic / Text Only" imprimen 42-48
// caracteres por línea en fuente normal (80mm). Si el ticket real sale
// con saltos de línea raros (texto que se corta antes de tiempo),
// baja este número; si sobra mucho espacio en blanco a la derecha, súbelo.
const WIDTH = 42;

function center(text, width = WIDTH) {
  text = String(text);
  if (text.length >= width) return text;
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

function line(left, right, width = WIDTH) {
  left = String(left);
  right = String(right);
  const space = width - left.length - right.length;
  if (space < 1) {
    // Si no cabe en una línea, corta el right a como quepa
    return left.slice(0, width - right.length - 1) + ' ' + right;
  }
  return left + ' '.repeat(space) + right;
}

function dashes(width = WIDTH) {
  return '-'.repeat(width);
}

export function buildTicketText(order, totalBs) {
  const rows = [];

  rows.push(center('PUNTO PEDIDO'));
  rows.push(center(`Comanda de cocina #${order.num}`));
  rows.push(dashes());

  rows.push(line('Cliente:', order.customer));
  rows.push(line('Hora:', order.time));
  rows.push(`${order.type.toUpperCase()} / ${order.pay.toUpperCase()}`);
  rows.push(dashes());

  order.items.forEach((l) => {
    const left = `${l.qty}x ${l.name}`;
    const right = `$${(l.price * l.qty).toFixed(2)}`;
    rows.push(line(left, right));
    l.mods.forEach((m) => {
      rows.push(`  » ${m}`);
    });
  });

  if (order.stockWarnings && order.stockWarnings.length > 0) {
    rows.push(dashes());
    rows.push('*** INSUMOS AGOTADOS ***');
    rows.push(order.stockWarnings.map((i) => i.toUpperCase()).join(', '));
  }

  rows.push(dashes());
  rows.push(line('TOTAL USD', `$${order.total.toFixed(2)}`));
  if (totalBs !== null && totalBs !== undefined) {
    rows.push(
      line(
        'TOTAL BS',
        `Bs. ${totalBs.toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      )
    );
  }

  rows.push('');
  rows.push(center('¡Gracias por su pedido!'));
  rows.push('');
  rows.push('');

  return rows.join('\n');
}