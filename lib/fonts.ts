import localFont from 'next/font/local'

/** Brand voice. Bodoni Moda — a Didone, so it shares the mark's modulated stroke. */
export const bodoni = localFont({
  src: '../public/fonts/BodoniModa.ttf',
  variable: '--font-brand-src',
  display: 'swap',
  weight: '400 900',
  style: 'normal',
})

/** Product voice. Archivo — body, labels, forms, legal copy, tabular figures. */
export const archivo = localFont({
  src: '../public/fonts/Archivo.ttf',
  variable: '--font-product-src',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
})
