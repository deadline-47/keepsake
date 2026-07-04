// This file *becomes* the pdf.js worker script (see how it's wired up in
// src/lib/pdfToImages.js). It runs inside the dedicated Worker thread pdf.js
// creates for itself — a separate JS environment from the main page, with
// its own Map/Math globals — which is why the compatibility polyfill has
// to be installed here too, not just on the main thread.
import { installPdfCompatibilityPolyfills } from './pdfCompatibilityPolyfills.js'

installPdfCompatibilityPolyfills()

// Now that the environment has what pdf.js expects, hand off to the real
// worker implementation.
import('pdfjs-dist/build/pdf.worker.min.mjs')
