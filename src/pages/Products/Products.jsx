import { Link } from 'react-router-dom';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import '../../styles/shared.css';
import './Products.css';

/**
 * Products page — UI ready for future GET /api/products integration.
 * No backend calls and no hardcoded product data for now.
 */
export default function Products() {
  // Future: replace with data from GET /api/products
  const products = [];
  const hasProducts = products.length > 0;

  const columns = [
    {
      key: 'image',
      label: 'Image',
      render: (row) => (
        <img
          src={row.image}
          alt={row.name}
          className="products__thumb"
        />
      ),
    },
    { key: 'name', label: 'Product Name' },
    {
      key: 'price',
      label: 'Price',
      render: (row) => `₹${row.price}`,
    },
    { key: 'stock', label: 'Stock' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="products__actions">
          <Link to={`/products/edit/${row.id}`}>
            <Button size="sm" variant="outline-primary" disabled={!hasProducts}>
              Edit
            </Button>
          </Link>
          <Button size="sm" variant="danger" disabled={!hasProducts}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Products</h2>
          <p>Manage the Tel-Aqua product catalog</p>
        </div>
        <Link to="/products/add">
          <Button>Add Product</Button>
        </Link>
      </div>

      <section className="panel">
        {hasProducts ? (
          <DataTable
            columns={columns}
            data={products}
            emptyMessage="No products available."
          />
        ) : (
          <div className="products__empty">
            <p className="products__empty-title">No products available.</p>
            <p className="products__empty-subtitle">
              Products will appear here once they are added.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
