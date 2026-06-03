import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'overlayscrollbars/styles/overlayscrollbars.css'
import './index.css'

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.warn('[PWA] Service worker registration failed:', error)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
