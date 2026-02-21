import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CatalogLayout } from '@/layouts/CatalogLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthGuard } from '@/components/AuthGuard'
import { AdminGuard } from '@/components/AdminGuard'
import { Catalogo } from '@/views/Catalogo'
import { Carrito } from '@/views/Carrito'
import { ProductoDetalle } from '@/views/ProductoDetalle'
import { Login } from '@/views/Login'
import { Admin } from '@/views/Admin'
import { Clientes } from '@/views/Clientes'
import { Productos } from '@/views/Productos'
import { Pedidos } from '@/views/Pedidos'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CatalogLayout />}>
          <Route index element={<Catalogo />} />
          <Route path="producto/:id" element={<ProductoDetalle />} />
          <Route path="carrito" element={<Carrito />} />
          <Route path="login" element={<Login />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AuthGuard>
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            </AuthGuard>
          }
        >
          <Route index element={<Admin />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="productos" element={<Productos />} />
          <Route path="pedidos" element={<Pedidos />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
