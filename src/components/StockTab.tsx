
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { AlertCircle, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { ErrorBoundary } from './ErrorBoundary';

export const StockTab = () => {
  return (
    <ErrorBoundary>
      <StockTabContent />
    </ErrorBoundary>
  );
};

const StockTabContent = () => {
  const { 
    products = [], 
    setProducts, 
    ingredients = [], 
    setIngredients, 
    preparedStock = [],
    setPreparedStock,
    categories = [], 
    t, 
    tp, 
    addToast 
  } = useApp();
  const [restockItem, setRestockItem] = useState<{ id: number; name: string; type: 'ingredient' | 'prepped' } | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showAddPrepped, setShowAddPrepped] = useState(false);

  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unit: 'kg',
    quantity: '',
    lowThreshold: '2'
  });

  const [newPrepped, setNewPrepped] = useState({
    name: '',
    portions: '',
    lowThreshold: '5'
  });

  const [preppedSearch, setPreppedSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [preppedPage, setPreppedPage] = useState(1);
  const [ingredientPage, setIngredientPage] = useState(1);
  const [editStockItem, setEditStockItem] = useState<{ id: number; name: string; type: 'ingredient' | 'prepped'; qty: number; threshold: number; unit?: string } | null>(null);
  const [deleteStockConfirm, setDeleteStockConfirm] = useState<{ id: number; name: string; type: 'ingredient' | 'prepped' } | null>(null);
  const itemsPerPage = 10;

  const filteredPrepped = useMemo(() => {
    return preparedStock.filter(p => p.name.toLowerCase().includes(preppedSearch.toLowerCase()));
  }, [preparedStock, preppedSearch]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()));
  }, [ingredients, ingredientSearch]);

  const paginatedPrepped = useMemo(() => {
    const start = (preppedPage - 1) * itemsPerPage;
    return filteredPrepped.slice(start, start + itemsPerPage);
  }, [filteredPrepped, preppedPage]);

  const paginatedIngredients = useMemo(() => {
    const start = (ingredientPage - 1) * itemsPerPage;
    return filteredIngredients.slice(start, start + ingredientPage);
  }, [filteredIngredients, ingredientPage]);

  const totalPreppedPages = Math.ceil(filteredPrepped.length / itemsPerPage);
  const totalIngredientPages = Math.ceil(filteredIngredients.length / itemsPerPage);

  useEffect(() => setPreppedPage(1), [preppedSearch]);
  useEffect(() => setIngredientPage(1), [ingredientSearch]);

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const ingredient = {
      id: Date.now(),
      name: newIngredient.name,
      unit: newIngredient.unit,
      qty: parseFloat(newIngredient.quantity) || 0,
      lowThreshold: parseFloat(newIngredient.lowThreshold) || 2
    };
    setIngredients([...ingredients, ingredient]);
    addToast(`${newIngredient.name} added to ingredients!`);
    setShowAddIngredient(false);
    setNewIngredient({ name: '', unit: 'kg', quantity: '', lowThreshold: '2' });
  };

  const handleAddPrepped = (e: React.FormEvent) => {
    e.preventDefault();
    const prepped = {
      id: Date.now(),
      name: newPrepped.name,
      portions: parseFloat(newPrepped.portions) || 0,
      lowThreshold: parseFloat(newPrepped.lowThreshold) || 5
    };
    setPreparedStock([...preparedStock, prepped]);
    addToast(`${newPrepped.name} added to prepped stock!`);
    setShowAddPrepped(false);
    setNewPrepped({ name: '', portions: '', lowThreshold: '5' });
  };

  const lowStockIngredients = ingredients.filter(i => i.qty <= i.lowThreshold);
  const lowStockPrepped = preparedStock.filter(p => p.portions <= p.lowThreshold);
  const totalAlerts = lowStockIngredients.length + lowStockPrepped.length;

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const amount = parseFloat(restockAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (restockItem.type === 'ingredient') {
      setIngredients(ingredients.map(i => i.id === restockItem.id ? { ...i, qty: i.qty + amount } : i));
    } else {
      setPreparedStock(preparedStock.map(p => p.id === restockItem.id ? { ...p, portions: p.portions + amount } : p));
    }

    addToast(`${restockItem.name} restocked!`);
    setRestockItem(null);
    setRestockAmount('');
  };

  const updateThreshold = (id: number, type: 'ingredient' | 'prepped', val: string) => {
    const threshold = parseInt(val);
    if (isNaN(threshold)) return;
    if (type === 'ingredient') {
      setIngredients(ingredients.map(i => i.id === id ? { ...i, lowThreshold: threshold } : i));
    } else {
      setPreparedStock(preparedStock.map(p => p.id === id ? { ...p, lowThreshold: threshold } : p));
    }
  };

  const updateStock = (id: number, type: 'ingredient' | 'prepped', val: string) => {
    const amount = parseFloat(val);
    if (isNaN(amount)) return;
    if (type === 'ingredient') {
      setIngredients(ingredients.map(i => i.id === id ? { ...i, qty: amount } : i));
    } else {
      setPreparedStock(preparedStock.map(p => p.id === id ? { ...p, portions: amount } : p));
    }
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStockItem) return;
    
    if (editStockItem.type === 'ingredient') {
      setIngredients(ingredients.map(i => i.id === editStockItem.id ? { 
        ...i, 
        name: editStockItem.name,
        qty: editStockItem.qty,
        lowThreshold: editStockItem.threshold,
        unit: editStockItem.unit || i.unit
      } : i));
    } else {
      setPreparedStock(preparedStock.map(p => p.id === editStockItem.id ? { 
        ...p, 
        name: editStockItem.name,
        portions: editStockItem.qty,
        lowThreshold: editStockItem.threshold
      } : p));
    }
    
    addToast(`${editStockItem.name} updated!`);
    setEditStockItem(null);
  };

  const handleDeleteStock = () => {
    if (!deleteStockConfirm) return;
    if (deleteStockConfirm.type === 'ingredient') {
      setIngredients(ingredients.filter(i => i.id !== deleteStockConfirm.id));
    } else {
      setPreparedStock(preparedStock.filter(p => p.id !== deleteStockConfirm.id));
    }
    addToast(`${deleteStockConfirm.name} deleted`, "info");
    setDeleteStockConfirm(null);
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
    <div className="space-y-8 animate-fade-in pb-10 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black font-serif text-bakery-brown">{t('stock')}</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowAddPrepped(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-bakery-accent text-bakery-brown rounded-xl font-bold hover:bg-bakery-brown hover:text-white transition-all active:scale-95 text-xs md:text-sm"
          >
            <Plus size={18} />
            Add Prepped Item
          </button>
          <button 
            onClick={() => setShowAddIngredient(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-xs md:text-sm"
          >
            <Plus size={18} />
            Add Raw Ingredient
          </button>
        </div>
      </div>

      {totalAlerts > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-[10px] md:text-sm mb-1 uppercase tracking-wider">{t('lowStock')} Alert</p>
            <p className="text-xs md:text-sm opacity-80">
              The following items need attention: {
                [...lowStockPrepped.map(p => p.name), ...lowStockIngredients.map(i => i.name)].join(', ')
              }
            </p>
          </div>
        </div>
      )}

      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold font-serif flex items-center gap-2">
            <span className="text-2xl">📦</span>
            Prepped Stock
          </h3>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={14} />
              <input 
                type="text"
                placeholder={t('search')}
                value={preppedSearch}
                onChange={e => setPreppedSearch(e.target.value)}
                className="w-full sm:w-48 p-2 pl-9 bg-white border border-bakery-beige rounded-xl outline-none text-xs"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 whitespace-nowrap">Auto-deducted</span>
          </div>
        </div>
        <div className="card-bakery overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="p-4">Prepped Item</th>
                  <th className="p-4">Portions</th>
                  <th className="p-4">Threshold</th>
                  <th className="p-4">Linked Menu Items</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-beige">
                {paginatedPrepped.map(p => (
                  <tr key={p.id} className={`transition-colors ${p.portions <= 0 ? 'bg-rose-50/50' : p.portions <= p.lowThreshold ? 'bg-orange-50/50' : 'hover:bg-bakery-cream/30'}`}>
                    <td className="p-4 font-bold whitespace-nowrap">{p.name}</td>
                    <td className="p-4">
                      <EditableCell value={p.portions} onSave={(val) => updateStock(p.id, 'prepped', val)} />
                    </td>
                    <td className="p-4">
                      <EditableCell value={p.lowThreshold} onSave={(val) => updateThreshold(p.id, 'prepped', val)} />
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {products.filter(prod => 
                          (prod.preparedStockLinks || []).some(link => link.preparedStockId === p.id)
                        ).map(prod => (
                          <span key={prod.id} className="text-[10px] bg-bakery-beige/50 px-2 py-0.5 rounded-full font-bold whitespace-nowrap" title={tp(prod)}>
                            {prod.emoji} {tp(prod).substring(0, 10)}...
                          </span>
                        ))}
                        {products.filter(prod => 
                          (prod.preparedStockLinks || []).some(link => link.preparedStockId === p.id)
                        ).length === 0 && <span className="text-[10px] text-bakery-brown/30 italic">No links</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                        p.portions <= 0 ? 'bg-rose-500 text-white' : 
                        p.portions <= p.lowThreshold ? 'bg-orange-500 text-white' : 
                        'bg-emerald-500 text-white'
                      }`}>
                        {p.portions <= 0 ? t('outOfStock') : p.portions <= p.lowThreshold ? t('lowStock') : 'OK'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setRestockItem({ id: p.id, name: p.name, type: 'prepped' })}
                          className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                          title="Restock"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => setEditStockItem({ id: p.id, name: p.name, type: 'prepped', qty: p.portions, threshold: p.lowThreshold })}
                          className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteStockConfirm({ id: p.id, name: p.name, type: 'prepped' })}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {filteredPrepped.length > itemsPerPage && (
          <Pagination 
            currentPage={preppedPage}
            totalPages={totalPreppedPages}
            onPageChange={setPreppedPage}
            t={t}
          />
        )}
      </section>

      <section>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold font-serif flex items-center gap-2">
            <span className="text-2xl">🥣</span>
            Raw Ingredients
          </h3>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={14} />
              <input 
                type="text"
                placeholder={t('search')}
                value={ingredientSearch}
                onChange={e => setIngredientSearch(e.target.value)}
                className="w-full sm:w-48 p-2 pl-9 bg-white border border-bakery-beige rounded-xl outline-none text-xs"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 whitespace-nowrap">Manual Only</span>
          </div>
        </div>
        <div className="card-bakery overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
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
                {paginatedIngredients.map(i => (
                  <tr key={i.id} className={`transition-colors ${i.qty <= 0 ? 'bg-rose-50/50' : i.qty <= i.lowThreshold ? 'bg-orange-50/50' : 'hover:bg-bakery-cream/30'}`}>
                    <td className="p-4 font-bold whitespace-nowrap">{i.name}</td>
                    <td className="p-4">
                      <EditableCell value={i.qty} onSave={(val) => updateStock(i.id, 'ingredient', val)} />
                    </td>
                    <td className="p-4 text-bakery-brown/40 whitespace-nowrap">{i.unit}</td>
                    <td className="p-4">
                      <EditableCell value={i.lowThreshold} onSave={(val) => updateThreshold(i.id, 'ingredient', val)} />
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                        i.qty <= 0 ? 'bg-rose-500 text-white' : 
                        i.qty <= i.lowThreshold ? 'bg-orange-500 text-white' : 
                        'bg-emerald-500 text-white'
                      }`}>
                        {i.qty <= 0 ? t('outOfStock') : i.qty <= i.lowThreshold ? t('lowStock') : 'OK'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setRestockItem({ id: i.id, name: i.name, type: 'ingredient' })}
                          className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                          title="Restock"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => setEditStockItem({ id: i.id, name: i.name, type: 'ingredient', qty: i.qty, threshold: i.lowThreshold, unit: i.unit })}
                          className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteStockConfirm({ id: i.id, name: i.name, type: 'ingredient' })}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {filteredIngredients.length > itemsPerPage && (
          <Pagination 
            currentPage={ingredientPage}
            totalPages={totalIngredientPages}
            onPageChange={setIngredientPage}
            t={t}
          />
        )}
      </section>

      {editStockItem && (
        <Modal title={`Edit ${editStockItem.type === 'ingredient' ? 'Ingredient' : 'Prepped Item'}`} onClose={() => setEditStockItem(null)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Name</label>
              <input 
                type="text" 
                className="w-full p-3 border rounded-xl" 
                value={editStockItem.name}
                onChange={e => setEditStockItem({ ...editStockItem, name: e.target.value })}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  {editStockItem.type === 'ingredient' ? 'Quantity' : 'Portions'}
                </label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full p-3 border rounded-xl" 
                  value={editStockItem.qty}
                  onChange={e => setEditStockItem({ ...editStockItem, qty: parseFloat(e.target.value) || 0 })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Low Threshold</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full p-3 border rounded-xl" 
                  value={editStockItem.threshold}
                  onChange={e => setEditStockItem({ ...editStockItem, threshold: parseFloat(e.target.value) || 0 })}
                  required 
                />
              </div>
            </div>
            {editStockItem.type === 'ingredient' && (
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Unit</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-xl" 
                  value={editStockItem.unit}
                  onChange={e => setEditStockItem({ ...editStockItem, unit: e.target.value })}
                  required 
                />
              </div>
            )}
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {deleteStockConfirm && (
        <ConfirmDialog 
          isOpen={!!deleteStockConfirm}
          title={`Delete ${deleteStockConfirm.type === 'ingredient' ? 'Ingredient' : 'Prepped Item'}`}
          message={`Are you sure you want to delete ${deleteStockConfirm.name}? This action cannot be undone.`}
          onConfirm={handleDeleteStock}
          onClose={() => setDeleteStockConfirm(null)}
        />
      )}

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

      {showAddPrepped && (
        <Modal title="Add New Prepped Stock" onClose={() => setShowAddPrepped(false)}>
          <form onSubmit={handleAddPrepped} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Item Name</label>
              <input 
                type="text" 
                className="w-full p-3 border rounded-xl" 
                placeholder="e.g. Waffle Batter"
                value={newPrepped.name}
                onChange={e => setNewPrepped({ ...newPrepped, name: e.target.value })}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Initial Portions</label>
                <input 
                  type="number" 
                  className="w-full p-3 border rounded-xl" 
                  value={newPrepped.portions}
                  onChange={e => setNewPrepped({ ...newPrepped, portions: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Low Threshold</label>
                <input 
                  type="number" 
                  className="w-full p-3 border rounded-xl" 
                  value={newPrepped.lowThreshold}
                  onChange={e => setNewPrepped({ ...newPrepped, lowThreshold: e.target.value })}
                  required 
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold">
              Add Prepped Item
            </button>
          </form>
        </Modal>
      )}

      {showAddIngredient && (
        <Modal title="Add New Raw Ingredient" onClose={() => setShowAddIngredient(false)}>
          <form onSubmit={handleAddIngredient} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Ingredient Name</label>
              <input 
                type="text" 
                className="w-full p-3 border rounded-xl" 
                value={newIngredient.name}
                onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Unit</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-xl" 
                  placeholder="e.g. kg, l, pcs"
                  value={newIngredient.unit}
                  onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Current Quantity</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full p-3 border rounded-xl" 
                  value={newIngredient.quantity}
                  onChange={e => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                  required 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Low Stock Threshold</label>
              <input 
                type="number" 
                step="0.1"
                className="w-full p-3 border rounded-xl" 
                value={newIngredient.lowThreshold}
                onChange={e => setNewIngredient({ ...newIngredient, lowThreshold: e.target.value })}
                required 
              />
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold">
              Add Ingredient
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
