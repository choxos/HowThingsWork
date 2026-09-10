const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;

if (typeof measurementId === 'string' && /^G-[A-Z0-9]+$/.test(measurementId)) {
  const dataLayer: unknown[][] = [];
  Object.assign(window, {dataLayer});
  window.gtag = (...args) => { dataLayer.push(args); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}
