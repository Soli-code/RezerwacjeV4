import React, { useState } from 'react';
import { Equipment, ProductFormProps } from '../../types/equipment';

export const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Equipment>({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    promotional_price: product?.promotional_price || 0,
    deposit: product?.deposit || 0,
    image: product?.image || '',
    categories: product?.categories || ['budowlany'],
    quantity: product?.quantity || 1,
    purchase_date: product?.purchase_date || '',
    purchase_price: product?.purchase_price || 0
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData({ ...formData, [name]: parseFloat(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nazwa</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cena za dzień (zł)</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cena promocyjna (zł)</label>
          <input
            type="number"
            name="promotional_price"
            value={formData.promotional_price || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Data zakupu</label>
          <input
            type="date"
            name="purchase_date"
            value={formData.purchase_date || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cena zakupu (zł)</label>
          <input
            type="number"
            name="purchase_price"
            value={formData.purchase_price || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Kaucja (zł)</label>
          <input
            type="number"
            name="deposit"
            value={formData.deposit}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">URL obrazu</label>
          <input
            type="text"
            name="image"
            value={formData.image}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Ilość</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
            min="1"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Opis</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange sm:text-sm"
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-solrent-orange"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-solrent-orange hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-solrent-orange"
        >
          Zapisz
        </button>
      </div>
    </form>
  );
}; 