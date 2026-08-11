import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import './AdminLayout.css';

const titles = {
  '/': 'Dashboard',
  '/orders': 'Orders',
  '/fulfillment': 'Fulfillment',
  '/promo-codes': 'Discounts',
  '/products': 'Products',
  '/products/add': 'Add Product',
  '/settings': 'Settings',
};

function resolveTitle(pathname) {
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith('/orders/')) return 'Order Details';
  if (pathname.startsWith('/products/edit/')) return 'Edit Product';
  return 'Tel-Aqua Admin';
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = resolveTitle(pathname);

  return (
    <div className="admin-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-layout__main">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
