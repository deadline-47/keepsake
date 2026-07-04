import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { installPdfCompatibilityPolyfills } from './lib/pdfCompatibilityPolyfills.js'
import './index.css'

// Must run before pdf.js's main-thread code (imported inside the book page)
// has any chance to execute — see pdfCompatibilityPolyfills.js for why.
installPdfCompatibilityPolyfills()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
