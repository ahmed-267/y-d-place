import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { AlertCircle, Plus, Edit2, Trash2, Search, CheckCircle2, Package, Trash } from 'lucide-react';
import { WasteReason } from '../types';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTablePagination, useTablePagination } from './DataTablePagination';
import { ErrorBoundary } from './ErrorBoundary';
import { toSearchValue } from '../utils/search';
import { SortableTh, useColumnSort, sortByColumn } from '../utils/tableSort';

type StockView = 'attention' | 'all' | 'waste';
type StockKind = 'ingredient' | 'prepped';

type AttentionItem = {
  id: number;
  name: string;
  type: StockKind;
  level: number;
  threshold: number;
  unitLabel: string;
  linked: boolean;
  status: 'out' | 'low';
};

const STOCK_VIEW_KEY = 'previsio_stock_view';

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
    ingredients = [],
    setIngredients,
    preparedStock = [],
    setPreparedStock,
    wasteLogs = [],
    setWasteLogs,
    user,
    t,
    tp,
    addToast,
    setActiveTab,
    formatPrice,
  } = useApp();

  const [view, setView] = useState<StockView>(() => {
    try {
      const stored = sessionStorage.getItem(STOCK_VIEW_KEY);
      if (stored === 'all' || stored === 'attention') {
        sessionStorage.removeItem(STOCK_VIEW_KEY);
        return stored;
      }
    } catch {
      /* ignore */
    }
    return 'attention';
  });

  const [restockItem, setRestockItem] = useState<{ id: number; name: string; type: StockKind } | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [restockUnitCost, setRestockUnitCost] = useState('');
  const [wasteItem, setWasteItem] = useState<{ id: number; name: string; type: StockKind; unit?: string; unitCost?: number } | null>(null);
  const [showWastePicker, setShowWastePicker] = useState(false);
  const [wasteAmount, setWasteAmount] = useState('');
  const [wasteReason, setWasteReason] = useState<WasteReason>('spoilage');
  const [wasteNote, setWasteNote] = useState('');
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showAddPrepped, setShowAddPrepped] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unit: 'kg',
    quantity: '',
    lowThreshold: '2',
  });
  const [newPrepped, setNewPrepped] = useState({
    name: '',
    portions: '',
    lowThreshold: '5',
  });
  const [preppedSearch, setPreppedSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [editStockItem, setEditStockItem] = useState<{
    id: number;
    name: string;
    type: StockKind;
    qty: number;
    threshold: number;
    unit?: string;
  } | null>(null);
  const [deleteStockConfirm, setDeleteStockConfirm] = useState<{
    id: number;
    name: string;
    type: StockKind;
  } | null>(null);

  const preppedLinkCount = useMemo(() => {
    const map: Record<number, number> = {};
    products.forEach(product => {
      (product.preparedStockLinks || []).forEach(link => {
        map[link.preparedStockId] = (map[link.preparedStockId] || 0) + 1;
      });
    });
    return map;
  }, [products]);

  const ingredientLinkCount = useMemo(() => {
    const map: Record<number, number> = {};
    products.forEach(product => {
      (product.ingredientLinks || []).forEach(link => {
        map[link.ingredientId] = (map[link.ingredientId] || 0) + 1;
      });
    });
    return map;
  }, [products]);

  const attentionItems = useMemo((): AttentionItem[] => {
    const prepped: AttentionItem[] = preparedStock
      .filter(p => p.portions <= p.lowThreshold)
      .map(p => ({
        id: p.id,
        name: p.name,
        type: 'prepped' as const,
        level: p.portions,
        threshold: p.lowThreshold,
        unitLabel: t('portionsAbbr') || 'portions',
        linked: (preppedLinkCount[p.id] || 0) > 0,
        status: p.portions <= 0 ? 'out' : 'low',
      }));
    const ings: AttentionItem[] = ingredients
      .filter(i => i.qty <= i.lowThreshold)
      .map(i => ({
        id: i.id,
        name: i.name,
        type: 'ingredient' as const,
        level: i.qty,
        threshold: i.lowThreshold,
        unitLabel: i.unit,
        linked: (ingredientLinkCount[i.id] || 0) > 0,
        status: i.qty <= 0 ? 'out' : 'low',
      }));
    return [...prepped, ...ings].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'out' ? -1 : 1;
      return a.level - b.level;
    });
  }, [preparedStock, ingredients, preppedLinkCount, ingredientLinkCount, t]);

  type StockSort = 'name' | 'onHand' | 'status';
  const { sortKey: preppedSortKey, sortDirection: preppedSortDir, toggleSort: togglePreppedSort } = useColumnSort<StockSort>('name');
  const { sortKey: ingSortKey, sortDirection: ingSortDir, toggleSort: toggleIngSort } = useColumnSort<StockSort>('name');

  const filteredPrepped = useMemo(() => {
    const query = preppedSearch.trim().toLowerCase();
    let list = preparedStock;
    if (query) list = preparedStock.filter(p => toSearchValue(p?.name).includes(query));
    return sortByColumn(list, preppedSortKey, preppedSortDir, (row: (typeof preparedStock)[number], key) => {
      if (key === 'name') return row.name;
      if (key === 'onHand') return row.portions;
      return row.portions <= 0 ? 0 : row.portions <= row.lowThreshold ? 1 : 2;
    });
  }, [preparedStock, preppedSearch, preppedSortKey, preppedSortDir]);

  const filteredIngredients = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    let list = ingredients;
    if (query) list = ingredients.filter(i => toSearchValue(i?.name).includes(query));
    return sortByColumn(list, ingSortKey, ingSortDir, (row: (typeof ingredients)[number], key) => {
      if (key === 'name') return row.name;
      if (key === 'onHand') return row.qty;
      return row.qty <= 0 ? 0 : row.qty <= row.lowThreshold ? 1 : 2;
    });
  }, [ingredients, ingredientSearch, ingSortKey, ingSortDir]);

  const preppedPaging = useTablePagination(filteredPrepped.length, 10, preppedSearch);
  const ingredientPaging = useTablePagination(filteredIngredients.length, 10, ingredientSearch);
  const paginatedPrepped = useMemo(
    () => preppedPaging.slice(filteredPrepped),
    [filteredPrepped, preppedPaging.page, preppedPaging.pageSize, preppedPaging.start]
  );
  const paginatedIngredients = useMemo(
    () => ingredientPaging.slice(filteredIngredients),
    [filteredIngredients, ingredientPaging.page, ingredientPaging.pageSize, ingredientPaging.start]
  );

  const hasAnyStock = preparedStock.length > 0 || ingredients.length > 0;

  const statusBadge = (level: number, threshold: number) => {
    if (level <= 0) {
      return (
        <span className="inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-500 text-white">
          {t('outOfStock')}
        </span>
      );
    }
    if (level <= threshold) {
      return (
        <span className="inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-orange-500 text-white">
          {t('lowStock')}
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500 text-white">
        {t('ok')}
      </span>
    );
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const ingredient = {
      id: Date.now(),
      name: newIngredient.name,
      unit: newIngredient.unit,
      qty: parseFloat(newIngredient.quantity) || 0,
      lowThreshold: parseFloat(newIngredient.lowThreshold) || 2,
    };
    if (!await setIngredients([...ingredients, ingredient])) return;
    addToast(t('ingredientAdded').replace('{name}', newIngredient.name));
    setShowAddIngredient(false);
    setNewIngredient({ name: '', unit: 'kg', quantity: '', lowThreshold: '2' });
  };

  const handleAddPrepped = async (e: React.FormEvent) => {
    e.preventDefault();
    const prepped = {
      id: Date.now(),
      name: newPrepped.name,
      portions: parseFloat(newPrepped.portions) || 0,
      lowThreshold: parseFloat(newPrepped.lowThreshold) || 5,
    };
    if (!await setPreparedStock([...preparedStock, prepped])) return;
    addToast(t('preppedAdded').replace('{name}', newPrepped.name));
    setShowAddPrepped(false);
    setNewPrepped({ name: '', portions: '', lowThreshold: '5' });
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const amount = parseFloat(restockAmount);
    if (isNaN(amount) || amount <= 0) return;
    const unitCostRaw = parseFloat(restockUnitCost);
    const unitCost = !isNaN(unitCostRaw) && unitCostRaw >= 0 ? unitCostRaw : undefined;

    if (restockItem.type === 'ingredient') {
      if (!await setIngredients(
        ingredients.map(i =>
          i.id === restockItem.id
            ? { ...i, qty: i.qty + amount, ...(unitCost != null ? { lastUnitCost: unitCost } : {}) }
            : i
        )
      )) return;
    } else {
      if (!await setPreparedStock(
        preparedStock.map(p =>
          p.id === restockItem.id
            ? { ...p, portions: p.portions + amount, ...(unitCost != null ? { lastUnitCost: unitCost } : {}) }
            : p
        )
      )) return;
    }

    addToast(t('stockReceived'));
    setRestockItem(null);
    setRestockAmount('');
    setRestockUnitCost('');
  };

  const handleWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItem || !user) return;
    const amount = parseFloat(wasteAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (wasteItem.type === 'ingredient') {
      const ing = ingredients.find(i => i.id === wasteItem.id);
      if (!ing || ing.qty < amount) {
        addToast(t('stockWasteInsufficient'), 'error');
        return;
      }
      if (!await setIngredients(ingredients.map(i => (i.id === wasteItem.id ? { ...i, qty: i.qty - amount } : i)))) return;
    } else {
      const prep = preparedStock.find(p => p.id === wasteItem.id);
      if (!prep || prep.portions < amount) {
        addToast(t('stockWasteInsufficient'), 'error');
        return;
      }
      if (!await setPreparedStock(preparedStock.map(p => (p.id === wasteItem.id ? { ...p, portions: p.portions - amount } : p)))) return;
    }

    const unitCost = wasteItem.unitCost ?? 0;
    setWasteLogs(prev => [
      {
        id: `W-${Date.now()}`,
        timestamp: Date.now(),
        kind: wasteItem.type,
        itemId: wasteItem.id,
        itemName: wasteItem.name,
        qty: amount,
        unit: wasteItem.unit,
        reason: wasteReason,
        note: wasteNote.trim() || undefined,
        unitCost: unitCost || undefined,
        costImpact: Math.round(amount * unitCost * 100) / 100,
        recordedByUsername: user.username,
      },
      ...prev,
    ].slice(0, 200));
    addToast(t('wasteLogged'), 'success');
    setWasteItem(null);
    setWasteAmount('');
    setWasteNote('');
    setWasteReason('spoilage');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStockItem) return;

    if (editStockItem.type === 'ingredient') {
      if (!await setIngredients(
        ingredients.map(i =>
          i.id === editStockItem.id
            ? {
                ...i,
                name: editStockItem.name,
                qty: editStockItem.qty,
                lowThreshold: editStockItem.threshold,
                unit: editStockItem.unit || i.unit,
              }
            : i
        )
      )) return;
    } else {
      if (!await setPreparedStock(
        preparedStock.map(p =>
          p.id === editStockItem.id
            ? {
                ...p,
                name: editStockItem.name,
                portions: editStockItem.qty,
                lowThreshold: editStockItem.threshold,
              }
            : p
        )
      )) return;
    }

    addToast(`${editStockItem.name} updated!`);
    setEditStockItem(null);
  };

  const handleDeleteStock = async () => {
    if (!deleteStockConfirm) return;
    if (deleteStockConfirm.type === 'ingredient') {
      if (!await setIngredients(ingredients.filter(i => i.id !== deleteStockConfirm.id))) return;
    } else {
      if (!await setPreparedStock(preparedStock.filter(p => p.id !== deleteStockConfirm.id))) return;
    }
    addToast(t('stockItemDeleted').replace('{name}', deleteStockConfirm.name), 'info');
    setDeleteStockConfirm(null);
  };

  const openRestock = (id: number, name: string, type: StockKind) => {
    setRestockItem({ id, name, type });
    setRestockAmount('');
    setRestockUnitCost('');
  };

  const openWaste = (id: number, name: string, type: StockKind) => {
    const ing = type === 'ingredient' ? ingredients.find(i => i.id === id) : undefined;
    const prep = type === 'prepped' ? preparedStock.find(p => p.id === id) : undefined;
    setWasteItem({
      id,
      name,
      type,
      unit: ing?.unit || (type === 'prepped' ? t('portions') : undefined),
      unitCost: ing?.lastUnitCost ?? prep?.lastUnitCost,
    });
    setWasteAmount('');
    setWasteNote('');
    setWasteReason('spoilage');
  };

  const wasteReasonLabel = (r: WasteReason) => {
    const map: Record<WasteReason, string> = {
      spoilage: t('wasteSpoilage'),
      breakage: t('wasteBreakage'),
      overproduction: t('wasteOverproduction'),
      staff_meal: t('wasteStaffMeal'),
      other: t('wasteOther'),
    };
    return map[r];
  };

  return (
    <div className="space-y-5 animate-fade-in pb-8 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-sm text-bakery-brown/50">{t('stockTabSubtitle')}</p>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowWastePicker(true)}
            disabled={!hasAnyStock}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-rose-200 text-rose-700 bg-white rounded-xl font-bold hover:bg-rose-50 transition-all active:scale-95 text-xs md:text-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash size={16} />
            {t('wasteStock')}
          </button>
          <button
            onClick={() => setShowAddPrepped(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-bakery-accent text-bakery-brown rounded-xl font-bold hover:bg-bakery-brown hover:text-white transition-all active:scale-95 text-xs md:text-sm"
          >
            <Plus size={16} />
            {t('addPrepped')}
          </button>
          <button
            onClick={() => setShowAddIngredient(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-xs md:text-sm"
          >
            <Plus size={16} />
            {t('addIngredient')}
          </button>
        </div>
      </div>

      <div className="inline-flex p-1 bg-bakery-beige/50 rounded-xl">
        <button
          type="button"
          onClick={() => setView('attention')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            view === 'attention' ? 'bg-white text-bakery-brown shadow-sm' : 'text-bakery-brown/50 hover:text-bakery-brown'
          }`}
        >
          {t('needsAttention')}
          {attentionItems.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {attentionItems.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            view === 'all' ? 'bg-white text-bakery-brown shadow-sm' : 'text-bakery-brown/50 hover:text-bakery-brown'
          }`}
        >
          {t('allStock')}
        </button>
        <button
          type="button"
          onClick={() => setView('waste')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            view === 'waste' ? 'bg-white text-bakery-brown shadow-sm' : 'text-bakery-brown/50 hover:text-bakery-brown'
          }`}
        >
          {t('wasteHistory')}
        </button>
      </div>

      {!hasAnyStock && (
        <div className="card-bakery p-8 sm:p-12 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown">
            <Package size={28} />
          </div>
          <h3 className="text-lg font-black font-serif text-bakery-brown mb-2">{t('stockEmptyTitle')}</h3>
          <p className="text-sm text-bakery-brown/50 mb-6 max-w-md mx-auto">{t('stockEmptySubtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => setShowAddPrepped(true)}
              className="px-5 py-3 bg-bakery-brown text-white rounded-xl font-bold text-sm"
            >
              {t('addPrepped')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="px-5 py-3 bg-bakery-beige text-bakery-brown rounded-xl font-bold text-sm"
            >
              {t('linkInMenu')}
            </button>
          </div>
        </div>
      )}

      {hasAnyStock && view === 'attention' && (
        <section className="space-y-4">
          {attentionItems.length === 0 ? (
            <div className="card-bakery p-6 sm:p-8 flex items-start gap-3 text-emerald-800 bg-emerald-50/80 border-emerald-100">
              <CheckCircle2 className="shrink-0 mt-0.5" size={22} />
              <div>
                <p className="font-bold text-sm">{t('stockLooksFine')}</p>
                <p className="text-xs text-emerald-800/70 mt-1">{t('stockLooksFineHint')}</p>
                <button
                  type="button"
                  onClick={() => setView('all')}
                  className="mt-3 text-xs font-bold uppercase tracking-wider text-bakery-brown/60 hover:text-bakery-brown"
                >
                  {t('allStock')} →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle size={18} />
                <p className="text-xs font-black uppercase tracking-widest">
                  {t('suggestedReceive')} · {attentionItems.length}
                </p>
              </div>
              <ul className="space-y-3">
                {attentionItems.map(item => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className={`card-bakery p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      item.status === 'out' ? 'border-rose-200 bg-rose-50/40' : 'border-orange-100 bg-orange-50/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-bakery-brown truncate">{item.name}</p>
                        {statusBadge(item.level, item.threshold)}
                        {!item.linked && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-bakery-brown/40 bg-bakery-beige px-2 py-0.5 rounded-full">
                            {t('unlinked')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-bakery-brown/60">
                        <span className="font-black text-bakery-brown">
                          {item.level} {item.unitLabel}
                        </span>
                        <span className="mx-1.5">·</span>
                        {t('threshold')}: {item.threshold}
                        <span className="mx-1.5">·</span>
                        {item.type === 'prepped' ? t('preppedItem') : t('ingredient')}
                      </p>
                      {!item.linked && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('products')}
                          className="mt-2 text-xs font-bold text-bakery-caramel hover:text-bakery-brown"
                        >
                          {t('linkInMenu')} →
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => openRestock(item.id, item.name, item.type)}
                        className="px-5 py-3 bg-bakery-brown text-white rounded-xl font-bold text-sm hover:bg-bakery-brown/90 active:scale-95 transition-all"
                      >
                        {t('receiveStock')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openWaste(item.id, item.name, item.type)}
                        className="px-4 py-3 border-2 border-rose-200 text-rose-700 rounded-xl font-bold text-sm hover:bg-rose-50 inline-flex items-center justify-center gap-1"
                      >
                        <Trash size={14} />
                        {t('wasteStock')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {hasAnyStock && view === 'all' && (
        <>
          <section>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-base font-bold font-serif text-bakery-brown">{t('preppedStock')}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mt-1">
                  {t('trackedFromMenu')}
                </p>
              </div>
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={14} />
                <input
                  type="text"
                  placeholder={t('search')}
                  value={preppedSearch}
                  onChange={e => setPreppedSearch(e.target.value)}
                  className="w-full p-2 pl-9 bg-white border border-bakery-beige rounded-xl outline-none text-xs"
                />
              </div>
            </div>
            <div className="card-bakery overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm min-w-[520px]">
                  <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                      <SortableTh label={t('name')} column="name" sortKey={preppedSortKey} sortDirection={preppedSortDir} onSort={togglePreppedSort} />
                      <SortableTh label={t('onHand')} column="onHand" sortKey={preppedSortKey} sortDirection={preppedSortDir} onSort={togglePreppedSort} />
                      <SortableTh label={t('status')} column="status" sortKey={preppedSortKey} sortDirection={preppedSortDir} onSort={togglePreppedSort} />
                      <th className="p-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bakery-beige">
                    {paginatedPrepped.map(p => {
                      const linked = (preppedLinkCount[p.id] || 0) > 0;
                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            p.portions <= 0
                              ? 'bg-rose-50/50'
                              : p.portions <= p.lowThreshold
                                ? 'bg-orange-50/50'
                                : 'hover:bg-bakery-cream/30'
                          }`}
                        >
                          <td className="p-4">
                            <p className="font-bold whitespace-nowrap">{p.name}</p>
                            <p className="text-[10px] text-bakery-brown/40 mt-0.5">
                              {linked ? (
                                <span>
                                  {products
                                    .filter(prod =>
                                      (prod.preparedStockLinks || []).some(link => link.preparedStockId === p.id)
                                    )
                                    .slice(0, 2)
                                    .map(prod => tp(prod))
                                    .join(', ')}
                                  {(preppedLinkCount[p.id] || 0) > 2 ? '…' : ''}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('products')}
                                  className="font-bold text-bakery-caramel hover:text-bakery-brown"
                                >
                                  {t('unlinked')} · {t('linkInMenu')}
                                </button>
                              )}
                            </p>
                          </td>
                          <td className="p-4 font-black whitespace-nowrap">
                            {p.portions}{' '}
                            <span className="font-bold text-bakery-brown/40 text-xs">{t('portionsAbbr')}</span>
                          </td>
                          <td className="p-4">{statusBadge(p.portions, p.lowThreshold)}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openRestock(p.id, p.name, 'prepped')}
                                className="px-3 py-2 text-xs font-bold bg-bakery-brown text-white rounded-lg hover:bg-bakery-brown/90 transition-all active:scale-95"
                              >
                                {t('receiveStock')}
                              </button>
                              <button
                                onClick={() => openWaste(p.id, p.name, 'prepped')}
                                className="px-3 py-2 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1"
                                title={t('wasteStock')}
                              >
                                <Trash size={14} />
                                {t('wasteStock')}
                              </button>
                              <button
                                onClick={() =>
                                  setEditStockItem({
                                    id: p.id,
                                    name: p.name,
                                    type: 'prepped',
                                    qty: p.portions,
                                    threshold: p.lowThreshold,
                                  })
                                }
                                className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                                title={t('edit')}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteStockConfirm({ id: p.id, name: p.name, type: 'prepped' })}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPrepped.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm text-bakery-brown/40">
                          {t('noPreppedYet') || 'No prepped items yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <DataTablePagination
              page={preppedPaging.page}
              pageSize={preppedPaging.pageSize}
              totalItems={filteredPrepped.length}
              onPageChange={preppedPaging.setPage}
              onPageSizeChange={preppedPaging.setPageSize}
            />
          </section>

          <section>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-base font-bold font-serif text-bakery-brown">{t('rawIngredients')}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mt-1">
                  {t('trackedFromMenu')}
                </p>
              </div>
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={14} />
                <input
                  type="text"
                  placeholder={t('search')}
                  value={ingredientSearch}
                  onChange={e => setIngredientSearch(e.target.value)}
                  className="w-full p-2 pl-9 bg-white border border-bakery-beige rounded-xl outline-none text-xs"
                />
              </div>
            </div>
            <div className="card-bakery overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm min-w-[520px]">
                  <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                      <SortableTh label={t('name')} column="name" sortKey={ingSortKey} sortDirection={ingSortDir} onSort={toggleIngSort} />
                      <SortableTh label={t('onHand')} column="onHand" sortKey={ingSortKey} sortDirection={ingSortDir} onSort={toggleIngSort} />
                      <SortableTh label={t('status')} column="status" sortKey={ingSortKey} sortDirection={ingSortDir} onSort={toggleIngSort} />
                      <th className="p-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bakery-beige">
                    {paginatedIngredients.map(i => {
                      const linked = (ingredientLinkCount[i.id] || 0) > 0;
                      return (
                        <tr
                          key={i.id}
                          className={`transition-colors ${
                            i.qty <= 0
                              ? 'bg-rose-50/50'
                              : i.qty <= i.lowThreshold
                                ? 'bg-orange-50/50'
                                : 'hover:bg-bakery-cream/30'
                          }`}
                        >
                          <td className="p-4">
                            <p className="font-bold whitespace-nowrap">{i.name}</p>
                            <p className="text-[10px] text-bakery-brown/40 mt-0.5">
                              {linked ? (
                                i.unit
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('products')}
                                  className="font-bold text-bakery-caramel hover:text-bakery-brown"
                                >
                                  {t('unlinked')} · {t('linkInMenu')}
                                </button>
                              )}
                            </p>
                          </td>
                          <td className="p-4 font-black whitespace-nowrap">
                            {i.qty} <span className="font-bold text-bakery-brown/40 text-xs">{i.unit}</span>
                          </td>
                          <td className="p-4">{statusBadge(i.qty, i.lowThreshold)}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openRestock(i.id, i.name, 'ingredient')}
                                className="px-3 py-2 text-xs font-bold bg-bakery-brown text-white rounded-lg hover:bg-bakery-brown/90 transition-all active:scale-95"
                              >
                                {t('receiveStock')}
                              </button>
                              <button
                                onClick={() => openWaste(i.id, i.name, 'ingredient')}
                                className="px-3 py-2 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1"
                                title={t('wasteStock')}
                              >
                                <Trash size={14} />
                                {t('wasteStock')}
                              </button>
                              <button
                                onClick={() =>
                                  setEditStockItem({
                                    id: i.id,
                                    name: i.name,
                                    type: 'ingredient',
                                    qty: i.qty,
                                    threshold: i.lowThreshold,
                                    unit: i.unit,
                                  })
                                }
                                className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-all active:scale-90"
                                title={t('edit')}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteStockConfirm({ id: i.id, name: i.name, type: 'ingredient' })
                                }
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredIngredients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm text-bakery-brown/40">
                          {t('noIngredientsYet') || 'No ingredients yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <DataTablePagination
              page={ingredientPaging.page}
              pageSize={ingredientPaging.pageSize}
              totalItems={filteredIngredients.length}
              onPageChange={ingredientPaging.setPage}
              onPageSizeChange={ingredientPaging.setPageSize}
            />
          </section>
        </>
      )}

      {hasAnyStock && view === 'waste' && (
        <section className="card-bakery overflow-hidden">
          <div className="p-4 border-b border-bakery-beige">
            <h3 className="text-base font-bold font-serif text-bakery-brown">{t('wasteHistory')}</h3>
            <p className="text-xs text-bakery-brown/50 mt-1">
              {t('wasteCostImpact')}:{' '}
              {formatPrice(wasteLogs.reduce((a, w) => a + (w.costImpact || 0), 0))}
            </p>
          </div>
          {wasteLogs.length === 0 ? (
            <p className="p-8 text-center text-sm text-bakery-brown/40">{t('wasteHistory')}</p>
          ) : (
            <ul className="divide-y divide-bakery-beige max-h-[480px] overflow-y-auto">
              {wasteLogs.map(w => (
                <li key={w.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-bakery-brown">{w.itemName}</p>
                    <p className="text-xs text-bakery-brown/50">
                      {w.qty} {w.unit || ''} · {wasteReasonLabel(w.reason)}
                      {w.note ? ` · ${w.note}` : ''}
                    </p>
                    <p className="text-[10px] text-bakery-brown/35 mt-0.5">
                      {new Date(w.timestamp).toLocaleString()} · {w.recordedByUsername}
                    </p>
                  </div>
                  <p className="text-sm font-black text-rose-700">{formatPrice(w.costImpact || 0)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editStockItem && (
        <Modal title={t('editStockItem')} onClose={() => setEditStockItem(null)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('name')}</label>
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
                  {editStockItem.type === 'ingredient' ? t('currentQuantity') : t('currentPortions')}
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
                <label className="block text-xs font-bold uppercase mb-1">{t('lowThreshold')}</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full p-3 border rounded-xl"
                  value={editStockItem.threshold}
                  onChange={e =>
                    setEditStockItem({ ...editStockItem, threshold: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
              </div>
            </div>
            {editStockItem.type === 'ingredient' && (
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('unit')}</label>
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
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMsg').replace('{name}', deleteStockConfirm.name)}
          onConfirm={handleDeleteStock}
          onClose={() => setDeleteStockConfirm(null)}
        />
      )}

      {restockItem && (
        <Modal title={`${t('receiveStock')}: ${restockItem.name}`} onClose={() => setRestockItem(null)}>
          <form onSubmit={handleRestock} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">{t('receiveQty')}</label>
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
            <div>
              <label className="block text-sm font-bold mb-2">{t('receiveCostOptional')}</label>
              <input
                type="number"
                step="0.01"
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={restockUnitCost}
                onChange={e => setRestockUnitCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
              {t('receiveStock')}
            </button>
          </form>
        </Modal>
      )}

      {showWastePicker && (
        <Modal title={t('wasteStock')} onClose={() => setShowWastePicker(false)}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {preparedStock.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('preppedStock')}</p>
                <ul className="space-y-1">
                  {preparedStock.map(p => (
                    <button
                      key={`wp-${p.id}`}
                      type="button"
                      className="w-full text-left px-3 py-3 rounded-xl border border-bakery-beige hover:border-rose-300 hover:bg-rose-50/50 font-bold text-sm text-bakery-brown"
                      onClick={() => {
                        setShowWastePicker(false);
                        openWaste(p.id, p.name, 'prepped');
                      }}
                    >
                      {p.name}
                      <span className="ml-2 font-normal text-bakery-brown/50">
                        {p.portions} {t('portionsAbbr')}
                      </span>
                    </button>
                  ))}
                </ul>
              </div>
            )}
            {ingredients.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('rawIngredients')}</p>
                <ul className="space-y-1">
                  {ingredients.map(i => (
                    <button
                      key={`wi-${i.id}`}
                      type="button"
                      className="w-full text-left px-3 py-3 rounded-xl border border-bakery-beige hover:border-rose-300 hover:bg-rose-50/50 font-bold text-sm text-bakery-brown"
                      onClick={() => {
                        setShowWastePicker(false);
                        openWaste(i.id, i.name, 'ingredient');
                      }}
                    >
                      {i.name}
                      <span className="ml-2 font-normal text-bakery-brown/50">
                        {i.qty} {i.unit}
                      </span>
                    </button>
                  ))}
                </ul>
              </div>
            )}
            {!hasAnyStock && (
              <p className="text-sm text-bakery-brown/50 text-center py-4">{t('stockEmptySubtitle')}</p>
            )}
          </div>
        </Modal>
      )}

      {wasteItem && (
        <Modal title={`${t('wasteStock')}: ${wasteItem.name}`} onClose={() => setWasteItem(null)}>
          <form onSubmit={handleWaste} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">{t('receiveQty')}</label>
              <input
                type="number"
                step="0.1"
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none"
                value={wasteAmount}
                onChange={e => setWasteAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('wasteReason')}</label>
              <select
                className="w-full p-3 border border-bakery-beige rounded-xl font-bold"
                value={wasteReason}
                onChange={e => setWasteReason(e.target.value as WasteReason)}
              >
                {(['spoilage', 'breakage', 'overproduction', 'staff_meal', 'other'] as WasteReason[]).map(r => (
                  <option key={r} value={r}>{wasteReasonLabel(r)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('customerNotes')}</label>
              <input
                type="text"
                className="w-full p-3 border border-bakery-beige rounded-xl"
                value={wasteNote}
                onChange={e => setWasteNote(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full p-4 rounded-2xl font-bold text-lg bg-rose-600 text-white">
              {t('wasteStock')}
            </button>
          </form>
        </Modal>
      )}

      {showAddPrepped && (
        <Modal title={t('addNewPreppedStock')} onClose={() => setShowAddPrepped(false)}>
          <form onSubmit={handleAddPrepped} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('itemName')}</label>
              <input
                type="text"
                className="w-full p-3 border rounded-xl"
                placeholder={t('exampleWaffleBatter')}
                value={newPrepped.name}
                onChange={e => setNewPrepped({ ...newPrepped, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('initialPortions')}</label>
                <input
                  type="number"
                  className="w-full p-3 border rounded-xl"
                  value={newPrepped.portions}
                  onChange={e => setNewPrepped({ ...newPrepped, portions: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('lowThreshold')}</label>
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
              {t('addPrepped')}
            </button>
          </form>
        </Modal>
      )}

      {showAddIngredient && (
        <Modal title={t('addNewIngredient')} onClose={() => setShowAddIngredient(false)}>
          <form onSubmit={handleAddIngredient} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('ingredientName')}</label>
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
                <label className="block text-xs font-bold uppercase mb-1">{t('unit')}</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-xl"
                  placeholder={t('exampleUnit')}
                  value={newIngredient.unit}
                  onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('currentQuantity')}</label>
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
              <label className="block text-xs font-bold uppercase mb-1">{t('lowStockThreshold')}</label>
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
              {t('addIngredient')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
