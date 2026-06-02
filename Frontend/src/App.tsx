import { Toaster } from 'react-hot-toast'
import { CartProvider } from '@/context/CartContext'
import { AppRoutes } from '@/routes'
import { DesktopOverlayScroll } from '@/components/DesktopOverlayScroll'

function App() {
  return (
    <CartProvider>
      <DesktopOverlayScroll />
      <AppRoutes />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </CartProvider>
  )
}

export default App
