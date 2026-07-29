import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProduct } from '../../services/api';
import { Button } from '../../components/Buttons';
import '../../styles/shared.css';
import './AddProduct.css';

const initialForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  image: '',
};

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    setSaving(true);
    try {
      const product = await createProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        image:
          form.image ||
          'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200&h=200&fit=crop',
      });
      navigate('/products', { replace: true, state: { created: product.id } });
    } catch {
      setError('Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Add Product</h2>
          <p>Create a new item in the Tel-Aqua catalog</p>
        </div>
        <Link to="/products">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>

      <section className="panel">
        <form className="panel__body" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="form-grid">
            <div className="form-group form-group--full">
              <label htmlFor="name">Product Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Tel-Aqua Alkaline 20L Jar"
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
                placeholder="Short product description"
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

            <div className="form-group form-group--full">
              <label htmlFor="image">Upload Image</label>
              <input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                onChange={handleImage}
              />
              <p className="form-hint">
                Optional for demo — a default image is used if none is uploaded.
              </p>
              {preview && (
                <img src={preview} alt="Preview" className="product-form__preview" />
              )}
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Product'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
