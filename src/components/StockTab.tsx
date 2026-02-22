
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { AlertCircle, Plus } from 'lucide-react';
import { Modal } from './Modal';

export const StockTab = () => {
  const { products, setProducts, ingredients, setIngredients, t, addToast } = useApp();
  const [restockItem, setRestockItem] = useState<{ id: number; name: string; type: 'product' | 'ingredient' } | null>(null);
  const [restockAmount, setRestockAmount] = useState('');

  const lowStockProducts = products.filter(p => p.stock <= p.lowThreshold);
  const lowStockIngredients = ingredients.filter(i => i.qty <= i.lowThreshold);
  const totalAlerts = lowStockProducts.length + lowStockIngredients.length;

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const amount = parseFloat(restockAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (restockItem.type === 'product') {
      setProducts(products.map(p => p.id === restockItem.id ? { ...p, stock: p.stock + amount } : p));
    } else {
      setIngredients(ingredients.map(i => i.id === restockItem.id ? { ...i, qty: i.qty + amount } : i));
    }

    addToast(`${restockItem.name} restocked!`);
    setRestockItem(null);
    setRestockAmount('');
  };

  const updateThreshold = (id: number, type: 'product' | 'ingredient', val: string) => {
    const threshold = parseInt(val);
    if (isNaN(threshold)) return;
    if (type === 'product') {
      setProducts(products.map(p => p.id === id ? { ...p, lowThreshold: threshold } : p));
    } else {
      setIngredients(ingredients.map(i => i.id === id ? { ...i, lowThreshold: threshold } : i));
    }
  };

  const updateStock = (id: number, type: 'product' | 'ingredient', val: string) => {
    const amount = parseFloat(val);
    if (isNaN(amount)) return;
    if (type === 'product') {
      setProducts(products.map(p => p.id === id ? { ...p, stock: amount } : p));
    } else {
      setIngredients(ingredients.map(i => i.id === id ? { ...i, qty: amount } : i));
    }
  };

  const EditableCell = ({ value, onSave, type = 'number' }: { value: any, onSave: (val: string) => void, type?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value.toString());

    if (isEditing) {
      return (
        <input 
          type={type}
          className="w-20 p-2 border-2 border-bakery-caramel rounded-lg font-black text-center outline-none shadow-sm"
          value={tempValue}
          onChange={e => setTempValue(e.target.value)}
          onBlur={() => { setIsEditing(false); onSave(tempValue); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { setIsEditing(false); onSave(tempValue); }
            if (e.key === 'Escape') { setIsEditing(false); setTempValue(value.toString()); }
          }}
          autoFocus
        />
      );
    }

    return (
      <div 
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-bakery-beige/50 px-3 py-2 rounded-lg transition-colors font-black inline-block min-w-[40px] text-center"
      >
        {value}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-serif text-bakery-brown">{t('stock')}</h2>
      </div>

      {totalAlerts > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-sm mb-1 uppercase tracking-wider">{t('lowStock')} Alert</p>
            <p className="text-sm opacity-80">
              The following items need attention: {
                [...lowStockProducts.map(p => t(p.transKey || '')), ...lowStockIngredients.map(i => i.name)].join(', ')
              }
            </p>
          </div>
        </div>
      )}

      <section>
        <h3 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
          <span className="text-2xl">📦</span>
          {t('finishedProducts')}
        </h3>
        <div className="card-bakery overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Threshold</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-beige">
                {products.map(p => (
                  <tr key={p.id} className={`transition-colors ${p.stock <= 0 ? 'bg-rose-50/50' : p.stock <= p.lowThreshold ? 'bg-orange-50/50' : 'hover:bg-bakery-cream/30'}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.emoji}</span>
                        <span className="font-bold">{t(p.transKey || '')}</span>
                      </div>
                    </td>
                    <td className="p-4 text-bakery-brown/60 text-xs font-bold uppercase tracking-wider">{p.category}</td>
                    <td className="p-4">
                      <EditableCell value={p.stock} onSave={(val) => updateStock(p.id, 'product', val)} />
                    </td>
                    <td className="p-4">
                      <EditableCell value={p.lowThreshold} onSave={(val) => updateThreshold(p.id, 'product', val)} />
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        p.stock <= 0 ? 'bg-rose-500 text-white' : 
                        p.stock <= p.lowThreshold ? 'bg-orange-500 text-white' : 
                        'bg-emerald-500 text-white'
                      }`}>
                        {p.stock <= 0 ? t('outOfStock') : p.stock <= p.lowThreshold ? t('lowStock') : 'OK'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setRestockItem({ id: p.id, name: t(p.transKey || ''), type: 'product' })}
                        className="p-3 bg-bakery-beige text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-90"
                      >
                        <Plus size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
          <span className="text-2xl">🥣</span>
          {t('ingredients')}
        </h3>
        <div className="card-bakery overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="p-4">Ingredient</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Threshold</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-beige">
                {ingredients.map(i => (
                  <tr key={i.id} className={`transition-colors ${i.qty <= 0 ? 'bg-rose-50/50' : i.qty <= i.lowThreshold ? 'bg-orange-50/50' : 'hover:bg-bakery-cream/30'}`}>
                    <td className="p-4 font-bold">{i.name}</td>
                    <td className="p-4">
                      <EditableCell value={i.qty} onSave={(val) => updateStock(i.id, 'ingredient', val)} />
                    </td>
                    <td className="p-4 text-bakery-brown/40">{i.unit}</td>
                    <td className="p-4">
                      <EditableCell value={i.lowThreshold} onSave={(val) => updateThreshold(i.id, 'ingredient', val)} />
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        i.qty <= 0 ? 'bg-rose-500 text-white' : 
                        i.qty <= i.lowThreshold ? 'bg-orange-500 text-white' : 
                        'bg-emerald-500 text-white'
                      }`}>
                        {i.qty <= 0 ? t('outOfStock') : i.qty <= i.lowThreshold ? t('lowStock') : 'OK'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setRestockItem({ id: i.id, name: i.name, type: 'ingredient' })}
                        className="p-3 bg-bakery-beige text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-90"
                      >
                        <Plus size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {restockItem && (
        <Modal title={`${t('restock')}: ${restockItem.name}`} onClose={() => setRestockItem(null)}>
          <form onSubmit={handleRestock} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">Amount to add</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={restockAmount}
                onChange={e => setRestockAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
