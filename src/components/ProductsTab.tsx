
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
import { Pagination } from './Pagination';
import { ScanProgressModal } from './ScanProgressModal';
import { Product, Ingredient, IngredientLink } from '../types';
import { getAIAssistance, scanMenu, ScanMenuResult, compressImage } from '../utils/aiHelper';
import { motion, AnimatePresence } from 'motion/react';

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
    businessSettings 
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
  const [currentPage, setCurrentPage] = useState(1);
  const abortControllerRef = useRef<AbortController | null>(null);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.nameEN.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.translations && Object.values(p.translations).some(t => (t as string).toLowerCase().includes(searchQuery.toLowerCase())))
    );
  }, [products, searchQuery]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
    
    try {
      // Compress image before sending
      const compressed = await compressImage(selectedFile);
      setScanStatus('analyzing');

      // Setup AbortController and Timeout
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const timeoutId = setTimeout(() => {
        controller.abort();
        setScanStatus('timeout');
      }, 60000);

      const result = await scanMenu(compressed, controller.signal);
      clearTimeout(timeoutId);

      if (result && result.products.length > 0) {
        setScanStatus('success');
        setScanResults(result);
        setSelectedFile(null);
      } else if (scanStatus !== 'timeout') {
        setScanStatus('error');
        addToast("Could not extract menu items from image. Please try a clearer photo.", "error");
      }
    } catch (err) {
      if (scanStatus !== 'timeout') {
        setScanStatus('error');
        addToast("Scanning failed. Please try again.", "error");
      }
    } finally {
      abortControllerRef.current = null;
      if (scanStatus === 'success') {
        setTimeout(() => setIsScanning(false), 1000);
      }
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
    addToast(`${newProducts.length} menu items added successfully!`, 'success');
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
      preparedStockLinks: editItem.preparedStockLinks || []
    };

    if (editItem.id) {
      setProducts(products.map(p => p.id === editItem.id ? newProduct : p));
      addToast("Menu item updated!");
    } else {
      setProducts([...products, newProduct]);
      addToast("Menu item added!");
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
      addToast("Cannot delete category with menu items", "error");
      return;
    }
    setCategories(categories.filter(c => c !== cat));
    addToast("Category removed");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl sm:text-2xl font-bold font-serif">{t('products')}</h3>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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
            className="flex-1 sm:flex-none p-3 md:p-4 bg-bakery-accent text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
            title="Scan Menu from Image"
          >
            {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <span>{isScanning ? "Scanning..." : "Scan Menu"}</span>
          </button>
          <button 
            onClick={() => setShowCategoryModal(true)} 
            className="flex-1 sm:flex-none p-3 md:p-4 bg-bakery-beige text-bakery-brown rounded-xl hover:bg-bakery-brown hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Add New Category</span>
          </button>
          <button onClick={() => setEditItem({})} className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl font-bold active:scale-95 text-[10px] sm:text-xs md:text-sm whitespace-nowrap">
            <Plus size={18} />
            Add New Menu Item
          </button>
        </div>
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
        <Modal title="Preview Menu Image" onClose={() => setSelectedFile(null)}>
          <div className="space-y-6">
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-bakery-beige/20 border-2 border-bakery-beige">
              <img src={selectedFile} alt="Preview" className="w-full h-full object-contain" />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedFile(null)}
                className="flex-1 py-4 bg-bakery-beige text-bakery-brown rounded-2xl font-bold hover:bg-bakery-beige/80 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={startScan}
                className="flex-[2] py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                Scan Menu
              </button>
            </div>
          </div>
        </Modal>
      )}

      {scanResults && (
        <Modal title="Review Scanned Menu Items" onClose={() => setScanResults(null)}>
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-bakery-brown/60">We found {scanResults.products.length} items. Review them and their predicted ingredients.</p>
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
                      <label className="block text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Predicted Ingredients</label>
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
                          <Plus size={12} /> Add Ingredient
                        </button>
                      </div>

                      <div className="mt-4">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Predicted Prepped Stock</label>
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
                            <Plus size={10} /> Add Prepped Need
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
                Add {scanResults.products.length} Menu Items
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
                <th className="p-4">Emoji</th>
                <th className="p-4">Name (EN)</th>
                <th className="p-4">Category</th>
                <th className="p-4">Price</th>
                <th className="p-4">Ingredients</th>
                <th className="p-4">Active</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {paginatedProducts.map(p => (
                <tr key={p.id} className={`hover:bg-bakery-cream/30 transition-colors ${!p.active ? 'bg-rose-50/30' : ''}`}>
                  <td className="p-4 text-2xl">{p.emoji}</td>
                  <td className="p-4 font-bold whitespace-nowrap">{tp(p)}</td>
                  <td className="p-4 text-[10px] font-bold uppercase tracking-wider text-bakery-brown/60 whitespace-nowrap">{p.category}</td>
                  <td className="p-4 font-black whitespace-nowrap">{formatPrice(p.price)}</td>
                  <td className="p-4">
                    {(() => {
                      const totalLinks = (p.ingredientLinks?.length || 0) + (p.preparedStockLinks?.length || 0);
                      if (totalLinks === 0) {
                        return <span className="text-[10px] text-bakery-brown/30 italic">None</span>;
                      }
                      return (
                        <div className="relative">
                          <button 
                            onClick={() => setShowLinkedPopover(showLinkedPopover === p.id ? null : p.id)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-bakery-beige/50 text-bakery-brown rounded-full text-[10px] font-bold hover:bg-bakery-beige transition-colors whitespace-nowrap"
                          >
                            <Info size={10} />
                            {totalLinks} linked
                          </button>
                          
                          {showLinkedPopover === p.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowLinkedPopover(null)} />
                              <div className="absolute left-0 bottom-full mb-2 z-20 w-48 bg-white rounded-xl shadow-xl border border-bakery-beige p-3 animate-fade-in">
                                <p className="text-[8px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Linked Items</p>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                                  {p.ingredientLinks?.map(link => {
                                    const ing = ingredients.find(i => i.id === link.ingredientId);
                                    return (
                                      <div key={link.ingredientId} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold truncate mr-2">{ing?.name || 'Unknown'}</span>
                                        <span className="text-bakery-brown/50 shrink-0">{link.quantityUsed}{link.unit}</span>
                                      </div>
                                    );
                                  })}
                                  {p.preparedStockLinks?.map(link => {
                                    const prepped = preparedStock.find(ps => ps.id === link.preparedStockId);
                                    return (
                                      <div key={link.preparedStockId} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold truncate mr-2 text-bakery-caramel">{prepped?.name || 'Unknown'}</span>
                                        <span className="text-bakery-brown/50 shrink-0">{link.portionsPerSale} port.</span>
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

      {filteredProducts.length > itemsPerPage && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          t={t}
        />
      )}

      {editItem && (
        <Modal title={editItem.id ? t('edit') : t('addProd')} onClose={() => setEditItem(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold uppercase mb-1">Emoji</label>
                <input 
                  name="emoji" 
                  value={editItem.emoji || ''} 
                  onChange={e => setEditItem({ ...editItem, emoji: e.target.value })}
                  className="w-full p-3 border rounded-xl text-center text-xl" 
                  required 
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-bold uppercase mb-1">Product Name</label>
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
                AI is translating and suggesting emoji...
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Category</label>
                <select name="category" defaultValue={editItem.category || categories[0]} className="w-full p-3 border rounded-xl">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1">Price ({businessSettings?.currencySymbol || '€'})</label>
                <input name="price" type="number" step="0.01" defaultValue={editItem.price} className="w-full p-3 border rounded-xl" required />
              </div>
            </div>

            <div className="pt-4 border-t border-bakery-beige">
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-3">Prepped Stock Used</label>
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
                      <option value="">Select Prepped Item</option>
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
                    <span className="text-xs text-bakery-brown/40 w-12">portions</span>
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
                  <Plus size={16} /> Add Prepped Stock Link
                </button>
              </div>

              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-3">Ingredients Used</label>
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
                      <option value="">Select Ingredient</option>
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
                  <Plus size={16} /> Add Ingredient Link
                </button>
              </div>
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
          title="Delete Menu Item"
          message={`Are you sure you want to delete ${deleteConfirm.nameEN}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};