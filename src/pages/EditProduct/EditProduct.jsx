import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProductById, updateProduct } from '../../services/api';
import { Button } from '../../components/Buttons';
import '../../styles/shared.css';
import '../AddProduct/AddProduct.css';
import './EditProduct.css';

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const product = await getProductById(id);
        if (!active) return;
        if (!product) {
          navigate('/products', { replace: true });
          return;
        }
        setForm({
          name: product.name,
          description: product.description,
          price: String(product.price),
          stock: String(product.stock),
          status: product.status,
          image: product.image,
        });
        setPreview(product.image);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setPreview(result);
      setForm((prev) => ({ ...prev, image: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await updateProduct(id, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        status: form.status,
        image: form.image,
      });
      setMessage('Product updated successfully.');
    } catch {
      setError('Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <div className="loading-state">Loading product…</div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Edit Product</h2>
          <p>Update details for {form.name}</p>
        </div>
        <Link to="/products">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <section className="panel">
        <form className="panel__body" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}
          {message && <div className="alert alert--success">{message}</div>}

          <div className="form-grid">
            <div className="form-group form-group--full">
              <label htmlFor="name">Product Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group form-group--full">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Price (₹)</label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="stock">Stock</label>
              <input
                id="stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>

            <div className="form-group form-group--full">
              <label htmlFor="image">Upload Image</label>
              <input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                onChange={handleImage}
              />
              {preview && (
                <img src={preview} alt="Preview" className="product-form__preview" />
              )}
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
