import { useState, useEffect } from 'react';

export const getSelectedCurrencyCode = (): string => {
  return localStorage.getItem('stoneflow_currency') || 'gbp';
};

export const setSelectedCurrencyCode = (val: string): void => {
  localStorage.setItem('stoneflow_currency', val);
  window.dispatchEvent(new Event('stoneflow_currency_changed'));
};

export const getCurrencyInfo = () => {
  const code = getSelectedCurrencyCode();
  let symbol = '£';
  let rate = 1.0;
  switch (code) {
    case 'usd':
      symbol = '$';
      rate = 1.30;
      break;
    case 'eur':
      symbol = '€';
      rate = 1.18;
      break;
    case 'aud':
      symbol = 'A$';
      rate = 1.95;
      break;
    case 'gbp':
    default:
      symbol = '£';
      rate = 1.0;
      break;
  }
  return { code, symbol, rate };
};

export const formatCurrency = (valInGbp: number, isK = false): string => {
  const { symbol, rate } = getCurrencyInfo();
  const converted = valInGbp * rate;
  if (isK) {
    return `${symbol}${(converted / 1000).toFixed(0)}k`;
  }
  return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const useCurrency = () => {
  const [currency, setCurrency] = useState(getSelectedCurrencyCode);

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency(getSelectedCurrencyCode());
    };
    window.addEventListener('stoneflow_currency_changed', handleCurrencyChange);
    return () => window.removeEventListener('stoneflow_currency_changed', handleCurrencyChange);
  }, []);

  return {
    currency,
    setCurrency: setSelectedCurrencyCode,
    format: (val: number, isK = false) => formatCurrency(val, isK)
  };
};
