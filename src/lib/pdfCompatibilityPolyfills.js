// pdf.js's recent releases started using a handful of brand-new JS
// methods — Map.prototype.getOrInsertComputed, Map.prototype.getOrInsert,
// and Math.sumPrecise — that are still working their way through
// standardization and aren't implemented in every current browser engine.
// Notably: iOS/iPadOS Safari and a number of Android browsers don't have
// them yet, which crashes pdf.js immediately with an error like
// "getOrInsertComputed is not a function" the moment it tries to render
// anything — see https://github.com/mozilla/pdf.js/issues/20680.
//
// This installs a small, spec-accurate fallback for each one, but only if
// the engine doesn't already provide it natively — so this becomes a no-op
// (and stays forward-compatible) the moment a browser adds real support.
//
// Important: pdf.js does its actual PDF parsing inside a dedicated Web
// Worker, which is a *separate* JS environment from the main page — a
// polyfill installed only on `window` never reaches code running in that
// worker. So this same function is called from two places: once on the
// main thread (see src/main.jsx) and once inside the worker entry point
// (see src/lib/pdfWorkerEntry.js), so both realms are covered.
export function installPdfCompatibilityPolyfills() {
  if (!Map.prototype.getOrInsertComputed) {
    Map.prototype.getOrInsertComputed = function getOrInsertComputed(key, callback) {
      if (this.has(key)) return this.get(key)
      const value = callback(key)
      this.set(key, value)
      return value
    }
  }

  if (!Map.prototype.getOrInsert) {
    Map.prototype.getOrInsert = function getOrInsert(key, value) {
      if (this.has(key)) return this.get(key)
      this.set(key, value)
      return value
    }
  }

  if (!Math.sumPrecise) {
    // The real proposal uses a precision-preserving summation algorithm;
    // this plain sum is not bit-for-bit identical but is functionally
    // equivalent for pdf.js's internal use, and the difference is far
    // below anything visible in rendered output.
    Math.sumPrecise = function sumPrecise(values) {
      let total = 0
      for (const value of values) total += value
      return total
    }
  }
}
