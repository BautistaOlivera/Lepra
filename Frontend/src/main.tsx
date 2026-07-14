import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { setupPwa } from './pwaRegister'
import { applyLegacyLayoutFlags } from './lib/legacyBrowser'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'overlayscrollbars/styles/overlayscrollbars.css'
import './index.css'
import './legacyFlexGap.css'
import './legacyTouch.css'

applyLegacyLayoutFlags()
void setupPwa()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
