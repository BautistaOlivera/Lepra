import { Toaster } from 'react-hot-toast'
import { CartProvider } from '@/context/CartContext'
import { ConfirmProvider } from '@/context/ConfirmContext'
import { AppRoutes } from '@/routes'
import { DesktopOverlayScroll } from '@/components/DesktopOverlayScroll'

function App() {
  return (
    <ConfirmProvider>
      <CartProvider>
        <DesktopOverlayScroll />
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </CartProvider>
    </ConfirmProvider>
  )
}

export default App
