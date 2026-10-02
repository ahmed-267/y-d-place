
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Settings, 
  Camera, 
  Loader2, 
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink
} from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTablePagination, useTablePagination } from './DataTablePagination';
import { ScanProgressModal } from './ScanProgressModal';
import { Product, Ingredient, IngredientLink } from '../types';
import { getAIAssistance, scanMenu, ScanMenuResult, compressImage } from '../utils/aiHelper';
import { motion, AnimatePresence } from 'motion/react';
import { toSearchValue, priceMatchesQuery } from '../utils/search';
import { SortableTh, useColumnSort, sortByColumn } from '../utils/tableSort';
import { isAddonCategory, partitionProductsByAddonCategory } from '../utils/menuCategories';

export const ProductsTab = () => {
  const { 
    products, 
    setProducts, 
    ingredients, 
    setIngredients, 
    preparedStock,
    setPreparedStock,
    categories, 
    setCategories, 
    t, 
    tp, 
    addToast, 
    formatPrice, 
    businessSettings,
    tc
  } = useApp();
  const [editItem, setEditItem] = useState<Partial<Product> | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'uploading' | 'analyzing' | 'extracting' | 'finishing' | 'error' | 'success' | 'timeout'>('uploading');
  const [scanThumbnail, setScanThumbnail] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanMenuResult | null>(null);
  const [expandedScanItem, setExpandedScanItem] = useState<number | null>(null);
  const [showLinkedPopover, setShowLinkedPopover] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  type ProductSort = 'emoji' | 'name' | 'category' | 'price' | 'ingredients' | 'active';
  const { sortKey, sortDirection, toggleSort } = useColumnSort<ProductSort>('name');
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addonProducts } = useMemo(() => partitionProductsByAddonCategory(products), [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = products;
    if (query) {
      list = products.filter(p => {
        const nameMatch = toSearchValue(p?.nameEN).includes(query);
        const categoryMatch = toSearchValue(p?.category).includes(query);
        const priceMatch = priceMatchesQuery(p?.price, query) || toSearchValue(p?.price).includes(query);
        const translationMatch = p?.translations ? Object.values(p.translations).some(tr => toSearchValue(tr).includes(query)) : false;
        return nameMatch || categoryMatch || priceMatch || translationMatch;
      });
    }
    return sortByColumn(list, sortKey, sortDirection, (prod: Product, key) => {
      if (key === 'emoji') return prod.emoji || '';
      if (key === 'name') return tp(prod);
      if (key === 'category') return tc(prod.category);
      if (key === 'price') return prod.price;
      if (key === 'ingredients') return (prod.ingredientLinks?.length || 0) + (prod.preparedStockLinks?.length || 0);
      return prod.active ? 1 : 0;
    });
  }, [products, searchQuery, formatPrice, sortKey, sortDirection, tp, tc]);

  const productsPaging = useTablePagination(filteredProducts.length, 10, searchQuery);
  const paginatedProducts = useMemo(
    () => productsPaging.slice(filteredProducts),
    [filteredProducts, productsPaging.page, productsPaging.pageSize, productsPaging.start]
  );

  useEffect(() => {
    if (scanStatus === 'success') {
      const id = setTimeout(() => setIsScanning(false), 800);
      return () => clearTimeout(id);
    }
  }, [scanStatus]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFile(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startScan = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setScanStatus('uploading');
    setScanThumbnail(selectedFile);
    let stageTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const compressed = await compressImage(selectedFile, 768, 0.62);
      setScanStatus('analyzing');
      stageTimer = setTimeout(() => setScanStatus('extracting'), 1500);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => {
        controller.abort();
        setScanStatus('timeout');
      }, 45000);

      const result = await scanMenu(compressed, controller.signal);
      clearTimeout(timeoutId);
      if (stageTimer) clearTimeout(stageTimer);

      if (result && result.products.length > 0) {
        setScanStatus('finishing');
        setScanResults(result);
        setSelectedFile(null);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        addToast(t('scanMenuNoItems'), "error");
      }
    } catch (err) {
      if (stageTimer) clearTimeout(stageTimer);
      setScanStatus('error');
      addToast(t('scanMenuFailed'), "error");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsScanning(false);
    setScanStatus('uploading');
    setSelectedFile(null);
  };

  const saveScannedProducts = () => {
    if (!scanResults) return;
    
    const currentIngredients = [...ingredients];
    const currentPreparedStock = [...preparedStock];
    
    const newProducts: Product[] = scanResults.products.map(p => {
      const productId = Date.now() + Math.random();

      // Handle Prepared Stock
      const preppedLinks = (p.preparedStockNeeds || []).map(needName => {
        let prepped = currentPreparedStock.find(ps => ps.name.toLowerCase() === needName.toLowerCase());
        if (!prepped) {
          prepped = {
            id: Date.now() + Math.random(),
            name: needName,
            portions: 20,
            lowThreshold: 5
          };
          currentPreparedStock.push(prepped);
        }
        return {
          preparedStockId: prepped.id,
          portionsPerSale: 1
        };
      });

      const links: IngredientLink[] = p.ingredientLinks.map(link => {
        let ingredient = currentIngredients.find(i => i.name.toLowerCase() === link.ingredientName.toLowerCase());
        if (!ingredient) {
          ingredient = {
            id: Date.now() + Math.random(),
            name: link.ingredientName,
            unit: link.unit,
            qty: 50, // Default initial stock for 10+ orders
            lowThreshold: 2
          };
          currentIngredients.push(ingredient);
        }
        return {
          ingredientId: ingredient.id,
          quantityUsed: link.quantityUsed,
          unit: link.unit
        };
      });

      return {
        id: productId,
        nameEN: p.name,
        translations: p.translations,
        category: p.category,
        price: p.price,
        emoji: p.emoji,
        active: true,
        transKey: `p${Date.now()}_${Math.random()}`,
        ingredientLinks: links,
        preparedStockLinks: preppedLinks
      };
    });
    
    // Add missing categories
    const newCategories = [...new Set([...categories, ...scanResults.products.map(p => p.category)])];
    setCategories(newCategories);
    
    setIngredients(currentIngredients);
    setPreparedStock(currentPreparedStock);
    setProducts([...products, ...newProducts]);
    setScanResults(null);
    addToast(t('menuItemsAdded').replace('{count}', String(newProducts.length)), 'success');
  };

  const handleNameChange = async (name: string) => {
    if (!editItem) return;
    setEditItem({ ...editItem, nameEN: name });
    
    if (name.length > 2) {
      setIsAIProcessing(true);
      const result = await getAIAssistance(name);
      if (result) {
        setEditItem(prev => {
          if (prev && prev.nameEN === name) {
            return {
              ...prev,
              emoji: result.emoji,
              translations: result.translations
            };
          }
          return prev;
        });
      }
      setIsAIProcessing(false);
    }
  };
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const fd = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(fd);
    
    const newProduct: Product = {
      id: editItem.id || Date.now(),
      nameEN: data.nameEN as string,
      translations: editItem.translations || {},
      category: data.category as string,
      price: parseFloat(data.price as string),
      emoji: data.emoji as string,
      active: editItem.active ?? true,
      transKey: editItem.transKey || `p${Date.now()}`,
      ingredientLinks: editItem.ingredientLinks || [],
      preparedStockLinks: editItem.preparedStockLinks || [],
      extraIds: isAddonCategory((data.category as string) || editItem.category || '')
        ? []
        : (editItem.extraIds || []),
      isFavourite: !!editItem.isFavourite,
      posColor: editItem.posColor || undefined,
    };

    if (editItem.id) {
      setProducts(products.map(p => p.id === editItem.id ? newProduct : p));
      addToast(t('menuItemUpdated'));
    } else {
      setProducts([...products, newProduct]);
      addToast(t('menuItemAdded'));
    }
    setEditItem(null);
  };

  const toggleActive = (id: number) => {
    setProducts(products.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setProducts(products.filter(p => p.id !== deleteConfirm.id));
    addToast(t('menuItemDeleted').replace('{name}', deleteConfirm.nameEN), "info");
    setDeleteConfirm(null);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      addToast(t('categoryExists'), "error");
      return;
    }
    setCategories([...categories, newCategoryName.trim()]);
    setNewCategoryName('');
    addToast(t('categoryAdded'));
  };

  const removeCategory = (cat: string) => {
    if (products.some(p => p.category === cat)) {
      addToast(t('categoryInUse'), "error");
      return;
    }
    setCategories(categories.filter(c => c !== cat));
    addToast(t('categoryRemoved'));
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-wrap justify-end gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex-1 sm:flex-none p-2.5 md:px-4 md:py-2.5 bg-bakery-accent text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-xs whitespace-nowrap"
            title={t('scanMenuFromImage')}
          >
            {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <span>{isScanning ? t('scanning') : t('scanMenu')}</span>
          </button>
          <button 
            onClick={() => setShowCategoryModal(true)} 
            className="flex-1 sm:flex-none p-2.5 md:px-4 md:py-2.5 bg-bakery-beige text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-xs whitespace-nowrap"
          >
            <Plus size={16} />
            <span>{t('addCategory')}</span>
          </button>
          <button onClick={() => setEditItem({})} className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold active:scale-95 text-xs whitespace-nowrap">
            <Plus size={18} />
            {t('addMenuProduct')}
          </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={18} />
        <input 
          type="text"
          placeholder={t('search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full p-4 pl-12 bg-white border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all"
        />
      </div>

      <ScanProgressModal 
        isOpen={isScanning} 
        status={scanStatus} 
        imageThumbnail={scanThumbnail}
        onClose={() => { setIsScanning(false); setSelectedFile(null); }}
        onCancel={cancelScan}
        onRetry={() => { setIsScanning(false); startScan(); }}
      />

      {selectedFile && !isScanning && (
        <Modal title={t('previewMenuImage')} onClose={() => setSelectedFile(null)}>
          <div className="space-y-6">
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-bakery-beige/20 border-2 border-bakery-beige">
              <img src={selectedFile} alt={t('preview')} className="w-full h-full object-contain" />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedFile(null)}
                className="flex-1 py-4 bg-bakery-beige text-bakery-brown rounded-2xl font-bold hover:bg-bakery-beige/80 transition-all"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={startScan}
                className="flex-[2] py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                {t('scanMenu')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {scanResults && (
        <Modal title={t('reviewScannedMenu')} onClose={() => setScanResults(null)}>
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-bakery-brown/60">{t('scanReviewIntro').replace('{count}', String(scanResults.products.length))}</p>
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {scanResults.products.map((p, idx) => (
                <div key={idx} className="bg-bakery-beige/20 rounded-2xl overflow-hidden border border-bakery-beige/50">
                  <div className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                    <span className="text-xl sm:text-2xl shrink-0">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <input 
                        className="w-full bg-transparent font-bold text-bakery-brown border-b border-transparent focus:border-bakery-brown outline-none text-sm sm:text-base truncate"
                        value={p.name}
                        onChange={e => {
                          const newProducts = [...scanResults.products];
                          newProducts[idx].name = e.target.value;
                          setScanResults({ products: newProducts });
                        }}
                      />
                      <div className="flex flex-wrap gap-2 mt-1">
                        <input 
                          className="w-24 bg-transparent text-[10px] sm:text-xs text-bakery-brown/60 border-b border-transparent focus:border-bakery-brown outline-none"
                          value={p.category}
                          onChange={e => {
                            const newProducts = [...scanResults.products];
                            newProducts[idx].category = e.target.value;
                            setScanResults({ products: newProducts });
                          }}
                        />
                        <input 
                          type="number"
                          step="0.01"
                          className="w-16 bg-transparent text-[10px] sm:text-xs font-black text-bakery-brown border-b border-transparent focus:border-bakery-brown outline-none"
                          value={p.price}
                          onChange={e => {
                            const newProducts = [...scanResults.products];
                            newProducts[idx].price = parseFloat(e.target.value);
                            setScanResults({ products: newProducts });
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setExpandedScanItem(expandedScanItem === idx ? null : idx)}
                        className="p-2 text-bakery-brown/40 hover:text-bakery-brown transition-colors"
                      >
                        {expandedScanItem === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <button 
                        onClick={() => {
                          const newProducts = scanResults.products.filter((_, i) => i !== idx);
                          setScanResults({ products: newProducts });
                        }}
                        className="text-rose-500 p-2 hover:bg-rose-50 rounded-full transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {expandedScanItem === idx && (
                    <div className="px-4 pb-4 pt-2 bg-white/50 border-t border-bakery-beige/30 animate-fade-in">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('predictedIngredients')}</label>
                      <div className="space-y-2">
                        {p.ingredientLinks.map((link, lIdx) => (
                          <div key={lIdx} className="flex items-center gap-2">
                            <input 
                              className="flex-1 bg-transparent text-[10px] sm:text-xs font-bold text-bakery-brown border-b border-bakery-beige/30 focus:border-bakery-brown outline-none"
                              value={link.ingredientName}
                              onChange={e => {
                                const newProducts = [...scanResults.products];
                                newProducts[idx].ingredientLinks[lIdx].ingredientName = e.target.value;
                                setScanResults({ products: newProducts });
                              }}
                            />
                            <input 
                              type="number"
                              className="w-12 bg-transparent text-[10px] sm:text-xs font-black text-bakery-brown border-b border-bakery-beige/30 focus:border-bakery-brown outline-none"
                              value={link.quantityUsed}
                              onChange={e => {
                                const newProducts = [...scanResults.products];
                                newProducts[idx].ingredientLinks[lIdx].quantityUsed = parseFloat(e.target.value);
                                setScanResults({ products: newProducts });
                              }}
                            />
                            <input 
                              className="w-12 bg-transparent text-[10px] sm:text-xs text-bakery-brown/40 border-b border-bakery-beige/30 focus:border-bakery-brown outline-none"
                              value={link.unit}
                              onChange={e => {
                                const newProducts = [...scanResults.products];
                                newProducts[idx].ingredientLinks[lIdx].unit = e.target.value;
                                setScanResults({ products: newProducts });
                              }}
                            />
                            <button 
                              onClick={() => {
                                const newProducts = [...scanResults.products];
                                newProducts[idx].ingredientLinks = newProducts[idx].ingredientLinks.filter((_, i) => i !== lIdx);
                                setScanResults({ products: newProducts });
                              }}
                              className="text-rose-400 hover:text-rose-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newProducts = [...scanResults.products];
                            newProducts[idx].ingredientLinks.push({ ingredientName: '', quantityUsed: 0, unit: 'g' });
                            setScanResults({ products: newProducts });
                          }}
                          className="text-[10px] font-bold text-bakery-brown/60 hover:text-bakery-brown flex items-center gap-1 mt-2"
                        >
                          <Plus size={12} /> {t('addIngredient')}
                        </button>
                      </div>

                      <div className="mt-4">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('predictedPreppedStock')}</label>
                        <div className="flex flex-wrap gap-2">
                          {p.preparedStockNeeds.map((need, nIdx) => (
                            <div key={nIdx} className="flex items-center gap-1 bg-bakery-brown/5 px-2 py-1 rounded-lg">
                              <input 
                                className="bg-transparent text-[10px] font-bold text-bakery-brown outline-none min-w-[60px]"
                                value={need}
                                onChange={e => {
                                  const newProducts = [...scanResults.products];
                                  newProducts[idx].preparedStockNeeds[nIdx] = e.target.value;
                                  setScanResults({ products: newProducts });
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newProducts = [...scanResults.products];
                                  newProducts[idx].preparedStockNeeds = newProducts[idx].preparedStockNeeds.filter((_, i) => i !== nIdx);
                                  setScanResults({ products: newProducts });
                                }}
                                className="text-rose-400 hover:text-rose-600"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newProducts = [...scanResults.products];
                              newProducts[idx].preparedStockNeeds.push('');
                              setScanResults({ products: newProducts });
                            }}
                            className="text-[10px] font-bold text-bakery-brown/60 hover:text-bakery-brown flex items-center gap-1"
                          >
                            <Plus size={10} /> {t('addPreppedNeed')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-bakery-beige">
              <button 
                onClick={() => setScanResults(null)}
                className="flex-1 p-3 sm:p-4 bg-bakery-beige text-bakery-brown rounded-2xl font-bold hover:bg-bakery-beige/80 transition-all text-sm"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={saveScannedProducts}
                className="flex-[2] p-3 sm:p-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Check size={18} />
                {t('addMenuItems').replace('{count}', String(scanResults.products.length))}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="card-bakery overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <SortableTh label={t('emoji')} column="emoji" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('nameEN')} column="name" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('category')} column="category" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('price')} column="price" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('ingredients')} column="ingredients" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('active')} column="active" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <th className="p-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {paginatedProducts.map(p => (
                <tr key={p.id} className={`hover:bg-bakery-cream/30 transition-colors ${!p.active ? 'bg-rose-50/30' : ''}`}>
                  <td className="p-4 text-2xl">{p.emoji}</td>
                  <td className="p-4 font-bold whitespace-nowrap">{tp(p)}</td>
                  <td className="p-4 text-[10px] font-bold uppercase tracking-wider text-bakery-brown/60 whitespace-nowrap">{tc(p.category)}</td>
                  <td className="p-4 font-black whitespace-nowrap">{formatPrice(p.price)}</td>
                  <td className="p-4">
                    {(() => {
                      const totalLinks = (p.ingredientLinks?.length || 0) + (p.preparedStockLinks?.length || 0);
                      if (totalLinks === 0) {
                        return <span className="text-[10px] text-bakery-brown/30 italic">{t('none')}</span>;
                      }
                      return (
                        <div className="relative">
                          <button 
                            onClick={() => setShowLinkedPopover(showLinkedPopover === p.id ? null : p.id)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-bakery-beige/50 text-bakery-brown rounded-full text-[10px] font-bold hover:bg-bakery-beige transition-colors whitespace-nowrap"
                          >
                            <Info size={10} />
                            {t('linkedCount').replace('{count}', String(totalLinks))}
                          </button>
                          
                          {showLinkedPopover === p.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowLinkedPopover(null)} />
                              <div className="absolute left-0 bottom-full mb-2 z-20 w-48 bg-white rounded-xl shadow-xl border border-bakery-beige p-3 animate-fade-in">
                                <p className="text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('linkedItems')}</p>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                                  {p.ingredientLinks?.map(link => {
                                    const ing = ingredients.find(i => i.id === link.ingredientId);
                                    return (
                                      <div key={link.ingredientId} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold truncate mr-2">{ing?.name || t('unknown')}</span>
                                        <span className="text-bakery-brown/50 shrink-0">{link.quantityUsed}{link.unit}</span>
                                      </div>
                                    );
                                  })}
                                  {p.preparedStockLinks?.map(link => {
                                    const prepped = preparedStock.find(ps => ps.id === link.preparedStockId);
                                    return (
                                      <div key={link.preparedStockId} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold truncate mr-2 text-bakery-caramel">{prepped?.name || t('unknown')}</span>
                                        <span className="text-bakery-brown/50 shrink-0">{link.portionsPerSale} {t('portionsAbbr')}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleActive(p.id)} 
                      className={`transition-all p-2 active:scale-90 ${p.active ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                      {p.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <button onClick={() => setEditItem(p)} className="p-2 sm:p-3 text-bakery-brown hover:bg-bakery-beige rounded-xl transition-colors active:scale-90">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setDeleteConfirm(p)} className="p-2 sm:p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors active:scale-90">
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

      <DataTablePagination
        page={productsPaging.page}
        pageSize={productsPaging.pageSize}
        totalItems={filteredProducts.length}
        onPageChange={productsPaging.setPage}
        onPageSizeChange={productsPaging.setPageSize}
      />

      {editItem && (
        <Modal title={editItem.id ? t('editMenuItem') : t('addMenuProduct')} onClose={() => setEditItem(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold uppercase mb-1">{t('emoji')}</label>
                <input 
                  name="emoji" 
                  value={editItem.emoji || ''} 
                  onChange={e => setEditItem({ ...editItem, emoji: e.target.value })}
                  className="w-full p-3 border rounded-xl text-center text-xl" 
                  required 
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-bold uppercase mb-1">{t('productName')}</label>
                <input 
                  name="nameEN" 
                  value={editItem.nameEN || ''} 
                  onChange={e => handleNameChange(e.target.value)}
                  className="w-full p-3 border rounded-xl" 
                  required 
                />
              </div>
            </div>

            {isAIProcessing && (
              <div className="text-xs text-bakery-brown/40 italic flex items-center gap-2 px-2">
                <div className="w-2 h-2 bg-bakery-brown/40 rounded-full animate-bounce" />
                {t('aiTranslating')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('category')}</label>
                <select
                  name="category"
                  value={editItem.category || categories[0]}
                  onChange={e => setEditItem({ ...editItem, category: e.target.value })}
                  className="w-full p-3 border rounded-xl"
                >
                  {categories.map(c => <option key={c} value={c}>{tc(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">{t('price')} ({businessSettings?.currencySymbol || '€'})</label>
                <input name="price" type="number" step="0.01" defaultValue={editItem.price} className="w-full p-3 border rounded-xl" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-bakery-beige cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editItem.isFavourite}
                  onChange={e => setEditItem({ ...editItem, isFavourite: e.target.checked })}
                />
                <span className="text-sm font-bold">{t('markFavourite')}</span>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase">{t('posTileColor')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-12 rounded-lg border border-bakery-beige cursor-pointer"
                    value={editItem.posColor || '#D4A373'}
                    onChange={e => setEditItem({ ...editItem, posColor: e.target.value })}
                  />
                  <button
                    type="button"
                    className="text-xs font-bold text-bakery-brown/50"
                    onClick={() => setEditItem({ ...editItem, posColor: undefined })}
                  >
                    {t('resetTheme')}
                  </button>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-bakery-beige">
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-3">{t('preppedStockUsed')}</label>
              <div className="space-y-3 mb-6">
                {(editItem.preparedStockLinks || []).map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-fade-in">
                    <select 
                      className="flex-1 p-3 border rounded-xl text-sm"
                      value={link.preparedStockId}
                      onChange={e => {
                        const newLinks = [...(editItem.preparedStockLinks || [])];
                        newLinks[idx].preparedStockId = parseInt(e.target.value);
                        setEditItem({ ...editItem, preparedStockLinks: newLinks });
                      }}
                    >
                      <option value="">{t('selectPreppedItem')}</option>
                      {preparedStock.map(ps => (
                        <option key={ps.id} value={ps.id}>{ps.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      step="1"
                      className="w-20 p-3 border rounded-xl text-sm font-bold"
                      value={link.portionsPerSale}
                      onChange={e => {
                        const newLinks = [...(editItem.preparedStockLinks || [])];
                        newLinks[idx].portionsPerSale = parseFloat(e.target.value);
                        setEditItem({ ...editItem, preparedStockLinks: newLinks });
                      }}
                      placeholder="Portions"
                    />
                    <span className="text-xs text-bakery-brown/40 w-12">{t('portions')}</span>
                    <button 
                      type="button"
                      onClick={() => {
                        const newLinks = (editItem.preparedStockLinks || []).filter((_, i) => i !== idx);
                        setEditItem({ ...editItem, preparedStockLinks: newLinks });
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => {
                    const newLinks = [...(editItem.preparedStockLinks || []), { preparedStockId: 0, portionsPerSale: 1 }];
                    setEditItem({ ...editItem, preparedStockLinks: newLinks });
                  }}
                  className="w-full p-3 border-2 border-dashed border-bakery-beige rounded-xl text-bakery-brown/40 font-bold text-xs hover:border-bakery-brown/20 hover:text-bakery-brown/60 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> {t('addPreppedStockLink')}
                </button>
              </div>

              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-3">{t('ingredientsUsed')}</label>
              <div className="space-y-3">
                {(editItem.ingredientLinks || []).map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 animate-fade-in">
                    <select 
                      className="flex-1 p-3 border rounded-xl text-sm"
                      value={link.ingredientId}
                      onChange={e => {
                        const newLinks = [...(editItem.ingredientLinks || [])];
                        newLinks[idx].ingredientId = parseInt(e.target.value);
                        setEditItem({ ...editItem, ingredientLinks: newLinks });
                      }}
                    >
                      <option value="">{t('selectIngredient')}</option>
                      {ingredients.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      step="0.1"
                      className="w-20 p-3 border rounded-xl text-sm font-bold"
                      value={link.quantityUsed}
                      onChange={e => {
                        const newLinks = [...(editItem.ingredientLinks || [])];
                        newLinks[idx].quantityUsed = parseFloat(e.target.value);
                        setEditItem({ ...editItem, ingredientLinks: newLinks });
                      }}
                      placeholder="Qty"
                    />
                    <span className="text-xs text-bakery-brown/40 w-8">
                      {ingredients.find(i => i.id === link.ingredientId)?.unit || ''}
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        const newLinks = (editItem.ingredientLinks || []).filter((_, i) => i !== idx);
                        setEditItem({ ...editItem, ingredientLinks: newLinks });
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => {
                    const newLinks = [...(editItem.ingredientLinks || []), { ingredientId: 0, quantityUsed: 0, unit: '' }];
                    setEditItem({ ...editItem, ingredientLinks: newLinks });
                  }}
                  className="w-full p-3 border-2 border-dashed border-bakery-beige rounded-xl text-bakery-brown/40 font-bold text-xs hover:border-bakery-brown/20 hover:text-bakery-brown/60 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> {t('addIngredientLink')}
                </button>
              </div>
            </div>

            {!isAddonCategory(editItem.category || '') && addonProducts.length > 0 && (
              <div className="pt-4 border-t border-bakery-beige">
                <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('allowedExtras')}</label>
                <p className="text-[11px] text-bakery-brown/45 mb-3">
                  {(editItem.extraIds || []).length === 0 ? t('noExtrasLinked') : t('extrasForItem')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {addonProducts.map(extra => {
                    const selected = (editItem.extraIds || []).includes(extra.id);
                    return (
                      <label
                        key={extra.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                          selected ? 'border-bakery-brown bg-bakery-cream/40' : 'border-bakery-beige'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-bakery-beige"
                          checked={selected}
                          onChange={() => {
                            const current = editItem.extraIds || [];
                            const extraIds = selected
                              ? current.filter(id => id !== extra.id)
                              : [...current, extra.id];
                            setEditItem({ ...editItem, extraIds });
                          }}
                        />
                        <span className="text-sm">{extra.emoji}</span>
                        <span className="text-xs font-bold truncate">{tp(extra)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg mt-4">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {showCategoryModal && (
        <Modal title={t('manageCategories')} onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder={t('newCategoryName')}
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
                  <span className="font-bold">{tc(cat)}</span>
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
          isOpen={!!deleteConfirm}
          title={t('deleteMenuItem')}
          message={t('deleteMenuItemConfirm').replace('{name}', deleteConfirm.nameEN)}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};
