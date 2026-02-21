import { Toaster } from 'react-hot-toast'
import { CartProvider } from '@/context/CartContext'
import { AppRoutes } from '@/routes'

function App() {
  return (
    <CartProvider>
      <AppRoutes />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </CartProvider>
  )
}

export default App
