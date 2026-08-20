import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bcv_rate_data';

export function useBcvRate() {
  const [rate, setRate] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    try {
      const cachedData = localStorage.getItem(STORAGE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (
          parsed &&
          parsed.date === today &&
          typeof parsed.rate === 'number' &&
          Number.isFinite(parsed.rate)
        ) {
          setRate(parsed.rate);
          return;
        }
      }
    } catch (error) {
      console.warn('No se pudo leer la tasa BCV guardada:', error);
    }

    let isCancelled = false;

    fetch('https://ve.dolarapi.com/v1/dolares/oficial')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;

        const fetchedRate = data?.promedio;
        if (typeof fetchedRate === 'number' && Number.isFinite(fetchedRate)) {
          setRate(fetchedRate);

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ rate: fetchedRate, date: today })
            );
          } catch (error) {
            console.warn('No se pudo guardar la tasa BCV:', error);
          }
        } else {
          setRate(null);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Error cargando tasa BCV:', error);
          setRate(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return rate;
}
