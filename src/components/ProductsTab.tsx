
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Product } from '../types';

export const ProductsTab = () => {
  const { products, setProducts, categories, setCategories, t, addToast } = useApp();
  const [editItem, setEditItem] = useState<Partial<Product> | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const fd = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(fd);
    
    const newProduct: Product = {
      id: editItem.id || Date.now(),
      nameEN: data.nameEN as string,
      nameFR: data.nameFR as string,
      nameNL: data.nameNL as string,
      nameFL: data.nameFL as string,
      category: data.category as string,
      price: parseFloat(data.price as string),
      stock: parseInt(data.stock as string),
      lowThreshold: parseInt(data.lowThreshold as string),
      emoji: data.emoji as string,
      active: editItem.active ?? true,
      transKey: editItem.transKey || `p${Date.now()}`
    };

    if (editItem.id) {
      setProducts(products.map(p => p.id === editItem.id ? newProduct : p));
      addToast("Product updated!");
    } else {
      setProducts([...products, newProduct]);
      addToast("Product added!");
    }
    setEditItem(null);
  };

  const toggleActive = (id: number) => {
    setProducts(products.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setProducts(products.filter(p => p.id !== deleteConfirm.id));
    addToast(`${deleteConfirm.nameEN} deleted`, "info");
    setDeleteConfirm(null);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      addToast("Category already exists", "error");
      return;
    }
    setCategories([...categories, newCategoryName.trim()]);
    setNewCategoryName('');
    addToast("Category added!");
  };

  const removeCategory = (cat: string) => {
    if (products.some(p => p.category === cat)) {
      addToast("Cannot delete category with products", "error");
      return;
    }
    setCategories(categories.filter(c => c !== cat));
    addToast("Category removed");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold font-serif">{t('products')}</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="p-4 bg-bakery-beige text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-95">
            <Settings size={20} />
          </button>
          <button onClick={() => setEditItem({})} className="btn-primary flex items-center gap-2 px-6 py-4 rounded-xl font-bold active:scale-95">
            <Plus size={20} />
            {t('addProduct')}
          </button>
        </div>
      </div>

      <div className="card-bakery overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-4">Emoji</th>
                <th className="p-4">Name (EN)</th>
                <th className="p-4">Category</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Active</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {products.map(p => (
                <tr key={p.id} className={`hover:bg-bakery-cream/30 transition-colors ${!p.active ? 'opacity-50 grayscale' : ''}`}>
                  <td className="p-4 text-2xl">{p.emoji}</td>
                  <td className="p-4 font-bold">{p.nameEN}</td>
                  <td className="p-4 text-xs font-bold uppercase tracking-wider text-bakery-brown/60">{p.category}</td>
                  <td className="p-4 font-black">€{p.price.toFixed(2)}</td>
                  <td className="p-4">{p.stock}</td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(p.id)} className="text-bakery-brown transition-colors hover:text-bakery-caramel p-2 active:scale-90">
                      {p.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditItem(p)} className="p-3 text-bakery-brown hover:bg-bakery-beige rounded-xl transition-colors active:scale-90">
                        <Edit2 size={20} />
                      </button>
                      <button onClick={() => setDeleteConfirm(p)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors active:scale-90">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editItem && (
        <Modal title={editItem.id ? t('edit') : t('addProd')} onClose={() => setEditItem(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold uppercase mb-1">Emoji</label>
                <input name="emoji" defaultValue={editItem.emoji} className="w-full p-3 border rounded-xl text-center text-xl" required />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-bold uppercase mb-1">Name (EN)</label>
                <input name="nameEN" defaultValue={editItem.nameEN} className="w-full p-3 border rounded-xl" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Name (FR)</label>
                <input name="nameFR" defaultValue={editItem.nameFR} className="w-full p-3 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Name (NL)</label>
                <input name="nameNL" defaultValue={editItem.nameNL} className="w-full p-3 border rounded-xl" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Name (FL)</label>
              <input name="nameFL" defaultValue={editItem.nameFL} className="w-full p-3 border rounded-xl" required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Category</label>
                <select name="category" defaultValue={editItem.category || categories[0]} className="w-full p-3 border rounded-xl">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Price €</label>
                <input name="price" type="number" step="0.01" defaultValue={editItem.price} className="w-full p-3 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Stock</label>
                <input name="stock" type="number" defaultValue={editItem.stock} className="w-full p-3 border rounded-xl" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Low Stock Threshold</label>
              <input name="lowThreshold" type="number" defaultValue={editItem.lowThreshold || 5} className="w-full p-3 border rounded-xl" required />
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg mt-4">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {showCategoryModal && (
        <Modal title="Manage Categories" onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="New Category Name"
                className="flex-1 p-3 border rounded-xl"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
              <button onClick={addCategory} className="p-3 bg-bakery-brown text-white rounded-xl">
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center p-3 bg-bakery-beige/20 rounded-xl">
                  <span className="font-bold">{cat}</span>
                  <button 
                    onClick={() => removeCategory(cat)}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog 
          title="Delete Product"
          message={`Are you sure you want to delete ${deleteConfirm.nameEN}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};
