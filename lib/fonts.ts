import localFont from 'next/font/local'

/**
 * Brand voice. Fraunces — a modern serif with an OPTICAL SIZE axis, so the hero and the
 * small print are drawn differently rather than one being a scaled copy of the other.
 * That is the actual fix for the thin-hairline problem the previous Didone had.
 *
 * Both faces are subset to Latin + Latin-Ext-A + punctuation + U+2248 (≈) and served as
 * woff2: 820 KB of TTF became 242 KB.
 */
export const fraunces = localFont({
  src: '../public/fonts/Fraunces.woff2',
  variable: '--font-brand-src',
  display: 'swap',
  weight: '300 900',
  style: 'normal',
  // Latin coverage only; CJK endonyms in the wheels fall back to the system serif.
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

/** Product voice. Archivo — body, labels, forms, legal copy, tabular figures. */
export const archivo = localFont({
  src: '../public/fonts/Archivo.woff2',
  variable: '--font-product-src',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
})
