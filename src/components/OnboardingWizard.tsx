
import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { 
  Layout, 
  Plus, 
  Trash2, 
  Package, 
  Users, 
  ChevronRight, 
  CheckCircle2, 
  ArrowRight,
  UtensilsCrossed,
  Boxes,
  Loader2,
  Camera,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Role, IngredientLink, Product } from '../types';
import { getAIAssistance, scanMenu, ScanMenuResult, compressImage } from '../utils/aiHelper';
import { Modal } from './Modal';
import { ScanProgressModal } from './ScanProgressModal';

export const OnboardingWizard = () => {
  const { 
    businessSettings, 
    categories = [], 
    setCategories, 
    products = [], 
    setProducts, 
    ingredients = [], 
    setIngredients, 
    preparedStock = [],
    setPreparedStock,
    users = [], 
    setUsers, 
    completeOnboarding,
    t,
    formatPrice,
    addToast
  } = useApp();

  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Step 2: Categories
  const [newCategory, setNewCategory] = useState('');
  const addCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setNewCategory('');
    }
  };

  // Step 3: Products
  const [productForm, setProductForm] = useState({ name: '', category: categories[0] || 'General', price: '', emoji: '📦', translations: {} as Record<string, string> });
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const addProduct = () => {
    if (productForm.name && productForm.price) {
      const newProduct: Product = {
        id: Date.now(),
        nameEN: productForm.name,
        translations: productForm.translations,
        category: productForm.category,
        price: parseFloat(productForm.price),
        emoji: productForm.emoji,
        active: true,
        transKey: '',
        ingredientLinks: []
      };
      setProducts([...products, newProduct]);
      setProductForm({ name: '', category: categories[0] || 'General', price: '', emoji: '📦', translations: {} });
    }
  };

  const handleProductNameChange = async (name: string) => {
    setProductForm(prev => ({ ...prev, name }));
    
    if (name.length > 2) {
      setIsAIProcessing(true);
      const result = await getAIAssistance(name);
      if (result) {
        setProductForm(prev => {
          if (prev.name === name) {
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

  // Step 4: Ingredients
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: 'kg', quantity: '' });
  const [preppedForm, setPreppedForm] = useState({ name: '', portions: '' });

  const addIngredient = () => {
    if (ingredientForm.name && ingredientForm.quantity) {
      const newIngredient = {
        id: Date.now(),
        name: ingredientForm.name,
        unit: ingredientForm.unit,
        qty: parseFloat(ingredientForm.quantity),
        lowThreshold: 2
      };
      setIngredients([...ingredients, newIngredient]);
      setIngredientForm({ name: '', unit: 'kg', quantity: '' });
    }
  };

  const addPreppedStock = () => {
    if (preppedForm.name && preppedForm.portions) {
      const newPrepped = {
        id: Date.now(),
        name: preppedForm.name,
        portions: parseFloat(preppedForm.portions),
        lowThreshold: 5,
        linkedMenuItems: []
      };
      setPreparedStock([...preparedStock, newPrepped]);
      setPreppedForm({ name: '', portions: '' });
    }
  };

  // Step 5: Team
  const [staffForm, setStaffForm] = useState({ fullName: '', username: '', password: '', role: 'staff' as Role });
  const addStaff = () => {
    if (staffForm.fullName && staffForm.username && staffForm.password) {
      const newStaff = {
        id: Date.now(),
        username: staffForm.username,
        fullName: staffForm.fullName,
        password: staffForm.password,
        role: staffForm.role
      };
      setUsers([...users, newStaff]);
      setStaffForm({ fullName: '', username: '', password: '', role: 'staff' });
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'uploading' | 'analyzing' | 'extracting' | 'finishing' | 'error' | 'success' | 'timeout'>('uploading');
  const [scanThumbnail, setScanThumbnail] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanMenuResult | null>(null);
  const [expandedScanItem, setExpandedScanItem] = useState<number | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    
    try {
      const compressed = await compressImage(selectedFile);
      setScanStatus('analyzing');

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
    
    const newCategories = [...new Set([...categories, ...scanResults.products.map(p => p.category)])];
    setCategories(newCategories);
    setIngredients(currentIngredients);
    setPreparedStock(currentPreparedStock);
    setProducts([...products, ...newProducts]);
    setScanResults(null);
    addToast(`${newProducts.length} menu items added successfully!`, 'success');
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const ProgressIndicator = () => (
    <div className="flex justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div 
          key={i} 
          className={`h-2 rounded-full transition-all duration-300 ${
            step === i + 1 ? 'w-8 bg-bakery-brown' : 'w-2 bg-bakery-brown/20'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-bakery-cream flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="max-w-2xl w-full bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-bakery-brown/10 p-4 sm:p-8 md:p-12 animate-fade-in relative overflow-hidden flex flex-col max-h-[95vh]">
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-bakery-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-bakery-caramel/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="shrink-0">
            <ProgressIndicator />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
            {step === 1 && (
              <div className="text-center animate-fade-in py-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-bakery-brown rounded-3xl flex items-center justify-center text-white mx-auto mb-6 sm:mb-8 shadow-xl shadow-bakery-brown/20">
                  <Layout size={32} className="sm:w-10 sm:h-10" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-black font-serif text-bakery-brown mb-4 sm:mb-6">
                  Welcome, {businessSettings?.name}!
                </h2>
                <p className="text-bakery-brown/60 text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed">
                  We're excited to help you grow your business. Y&D Place is your all-in-one platform for managing sales, inventory, and your team. Let's get your shop ready in just a few steps.
                </p>
                <button 
                  onClick={nextStep}
                  className="w-full py-4 sm:py-5 bg-bakery-brown text-white rounded-2xl font-bold text-lg sm:text-xl hover:bg-bakery-brown/90 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Let's get started
                  <ArrowRight size={24} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Users size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">Add your team</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">Add staff members to help you run the shop.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <input 
                      type="text" 
                      placeholder="Full Name"
                      className="sm:col-span-2 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                      value={staffForm.fullName}
                      onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="Username"
                      className="p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                      value={staffForm.username}
                      onChange={e => setStaffForm({ ...staffForm, username: e.target.value })}
                    />
                    <input 
                      type="password" 
                      placeholder="Password"
                      className="p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                      value={staffForm.password}
                      onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                    <select 
                      className="sm:col-span-2 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base bg-white"
                      value={staffForm.role}
                      onChange={e => setStaffForm({ ...staffForm, role: e.target.value as Role })}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <button 
                    onClick={addStaff}
                    className="w-full py-3 border-2 border-dashed border-bakery-brown/20 text-bakery-brown/60 rounded-2xl font-bold hover:border-bakery-brown/40 hover:text-bakery-brown transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus size={18} />
                    Add Staff Member
                  </button>

                  <div className="max-h-32 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {users.filter(u => u.role !== 'owner').map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-bakery-beige/30 rounded-xl text-xs sm:text-sm">
                        <span className="font-bold truncate max-w-[150px] sm:max-w-none">{u.fullName}</span>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-bakery-brown/60 uppercase text-[10px] font-black tracking-widest">{u.role}</span>
                          <button onClick={() => setUsers(users.filter(user => user.id !== u.id))} className="text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button onClick={nextStep} className="flex-1 py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-sm sm:text-base">
                      Continue
                    </button>
                    <button onClick={nextStep} className="px-4 sm:px-8 py-4 text-bakery-brown/50 font-bold hover:text-bakery-brown transition-colors text-sm sm:text-base">
                      Skip
                    </button>
                  </div>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Camera size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">Scan your menu</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">Quickly add all your menu items by taking a photo of your menu.</p>
                  </div>
                </div>

                <div className="bg-bakery-beige/20 border-2 border-dashed border-bakery-brown/10 rounded-[2rem] p-8 sm:p-12 text-center mb-8">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-bakery-brown shadow-lg">
                      {isScanning ? <Loader2 size={32} className="animate-spin" /> : <Camera size={32} />}
                    </div>
                    <div>
                      <p className="font-bold text-bakery-brown mb-1">Take a photo or upload</p>
                      <p className="text-xs text-bakery-brown/40">AI will extract names, prices, and predict ingredients</p>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                      className="mt-4 px-8 py-3 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all disabled:opacity-50"
                    >
                      {isScanning ? "Processing..." : "Select Image"}
                    </button>
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="mb-8 animate-fade-in">
                    <h3 className="text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-3">Scanned Items ({products.length})</h3>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {products.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-white border border-bakery-beige rounded-xl text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{p.emoji}</span>
                            <span className="font-bold truncate max-w-[150px]">{p.nameEN}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-bakery-brown/60 text-[10px]">{p.category}</span>
                            <span className="font-black">{formatPrice(p.price)}</span>
                            <button onClick={() => setProducts(products.filter(prod => prod.id !== p.id))} className="text-rose-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      <p className="text-xs sm:text-sm text-bakery-brown/60">We found {scanResults.products.length} items. Review them and their predicted ingredients. New ingredients will start with 20 units in stock.</p>
                      <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
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

                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button onClick={nextStep} className="flex-1 py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-sm sm:text-base">
                      Continue
                    </button>
                    <button onClick={nextStep} className="px-4 sm:px-8 py-4 text-bakery-brown/50 font-bold hover:text-bakery-brown transition-colors text-sm sm:text-base">
                      Skip
                    </button>
                  </div>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <UtensilsCrossed size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">Categories</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">
                      {categories.length > 0 
                        ? `We found ${categories.length} categories from your scan. Add more if needed.`
                        : "Categories help organize your menu for faster service."}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. Starters, Mains, Drinks..."
                      className="flex-1 p-3 sm:p-4 bg-bakery-cream border-2 border-transparent focus:border-bakery-brown rounded-2xl outline-none font-bold transition-all text-sm sm:text-base"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addCategory()}
                    />
                    <button 
                      onClick={addCategory}
                      className="p-3 sm:p-4 bg-bakery-brown text-white rounded-2xl hover:bg-bakery-brown/90 transition-all active:scale-95"
                    >
                      <Plus size={24} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <div key={cat} className="px-3 sm:px-4 py-2 bg-bakery-beige text-bakery-brown rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 group">
                        {cat}
                        <button 
                          onClick={() => setCategories(categories.filter(c => c !== cat))}
                          className="text-bakery-brown/30 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button onClick={nextStep} className="flex-1 py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-sm sm:text-base">
                      Continue
                    </button>
                    <button onClick={nextStep} className="px-4 sm:px-8 py-4 text-bakery-brown/50 font-bold hover:text-bakery-brown transition-colors text-sm sm:text-base">
                      Skip
                    </button>
                  </div>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Package size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">Manual Menu Items</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">Add any items that weren't in your scan.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-10">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 sm:gap-4">
                    <div className="sm:col-span-1">
                      <input 
                        type="text" 
                        placeholder="Emoji"
                        className="w-full p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-center text-xl"
                        value={productForm.emoji}
                        onChange={e => setProductForm({ ...productForm, emoji: e.target.value })}
                      />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Item Name"
                      className="sm:col-span-5 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                      value={productForm.name}
                      onChange={e => handleProductNameChange(e.target.value)}
                    />
                    
                    {isAIProcessing && (
                      <div className="sm:col-span-6 text-[10px] sm:text-xs text-bakery-brown/40 italic flex items-center gap-2 px-2">
                        <div className="w-2 h-2 bg-bakery-brown/40 rounded-full animate-bounce" />
                        AI is translating and suggesting emoji...
                      </div>
                    )}
                    <select 
                      className="sm:col-span-3 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base bg-white"
                      value={productForm.category}
                      onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    >
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Price"
                      className="sm:col-span-3 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={addProduct}
                    className="w-full py-3 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus size={18} />
                    {t('addProduct')}
                  </button>

                  <div className="max-h-32 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {products.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-bakery-beige/30 rounded-xl text-xs sm:text-sm">
                        <span className="font-bold truncate max-w-[120px] sm:max-w-none">{p.nameEN}</span>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <span className="text-bakery-brown/60 text-[10px] sm:text-xs hidden sm:inline">{p.category}</span>
                          <span className="font-black">{formatPrice(p.price)}</span>
                          <button onClick={() => setProducts(products.filter(prod => prod.id !== p.id))} className="text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button onClick={nextStep} className="flex-1 py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-sm sm:text-base">
                      Continue
                    </button>
                    <button onClick={nextStep} className="px-4 sm:px-8 py-4 text-bakery-brown/50 font-bold hover:text-bakery-brown transition-colors text-sm sm:text-base">
                      Skip
                    </button>
                  </div>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Boxes size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">Stock Management</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">Set up your prepped items and raw ingredients.</p>
                  </div>
                </div>

                <div className="space-y-8 mb-10">
                  {/* Prepped Stock Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-bakery-brown/40">Prepped Stock (Auto-deducted)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <input 
                        type="text" 
                        placeholder="e.g. Waffle Batter"
                        className="sm:col-span-2 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                        value={preppedForm.name}
                        onChange={e => setPreppedForm({ ...preppedForm, name: e.target.value })}
                      />
                      <input 
                        type="number" 
                        placeholder="Portions"
                        className="p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                        value={preppedForm.portions}
                        onChange={e => setPreppedForm({ ...preppedForm, portions: e.target.value })}
                      />
                    </div>
                    <button 
                      onClick={addPreppedStock}
                      className="w-full py-3 bg-bakery-brown/5 text-bakery-brown rounded-2xl font-bold hover:bg-bakery-brown/10 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus size={18} />
                      Add Prepped Item
                    </button>

                    <div className="max-h-24 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {preparedStock.map(ps => (
                        <div key={ps.id} className="flex justify-between items-center p-3 bg-bakery-beige/30 rounded-xl text-xs sm:text-sm">
                          <span className="font-bold truncate">{ps.name}</span>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="font-black">{ps.portions} portions</span>
                            <button onClick={() => setPreparedStock(preparedStock.filter(p => p.id !== ps.id))} className="text-rose-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raw Ingredients Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-bakery-brown/40">Raw Ingredients (Manual)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <input 
                        type="text" 
                        placeholder="e.g. Flour"
                        className="sm:col-span-3 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                        value={ingredientForm.name}
                        onChange={e => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                      />
                      <input 
                        type="text" 
                        placeholder="Unit (kg, l, pcs)"
                        className="p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                        value={ingredientForm.unit}
                        onChange={e => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                      />
                      <input 
                        type="number" 
                        placeholder="Quantity"
                        className="sm:col-span-2 p-3 sm:p-4 bg-bakery-cream rounded-2xl outline-none font-bold text-sm sm:text-base"
                        value={ingredientForm.quantity}
                        onChange={e => setIngredientForm({ ...ingredientForm, quantity: e.target.value })}
                      />
                    </div>
                    <button 
                      onClick={addIngredient}
                      className="w-full py-3 border-2 border-dashed border-bakery-brown/20 text-bakery-brown/60 rounded-2xl font-bold hover:border-bakery-brown/40 hover:text-bakery-brown transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus size={18} />
                      Add Raw Ingredient
                    </button>

                    <div className="max-h-24 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {ingredients.map(ing => (
                        <div key={ing.id} className="flex justify-between items-center p-3 bg-bakery-beige/30 rounded-xl text-xs sm:text-sm">
                          <span className="font-bold truncate">{ing.name}</span>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="font-black">{ing.quantity} {ing.unit}</span>
                            <button onClick={() => setIngredients(ingredients.filter(i => i.id !== ing.id))} className="text-rose-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button onClick={nextStep} className="flex-1 py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 text-sm sm:text-base">
                      Continue
                    </button>
                    <button onClick={nextStep} className="px-4 sm:px-8 py-4 text-bakery-brown/50 font-bold hover:text-bakery-brown transition-colors text-sm sm:text-base">
                      Skip
                    </button>
                  </div>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="text-center animate-fade-in py-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 sm:mb-8 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 size={32} className="sm:w-10 sm:h-10" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-black font-serif text-bakery-brown mb-4 sm:mb-6">
                  All set!
                </h2>
                <p className="text-bakery-brown/60 text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed">
                  Congratulations! Your business is now ready to go. Here's a summary of what we've set up:
                </p>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-12">
                  <div className="p-3 sm:p-4 bg-bakery-beige/30 rounded-2xl">
                    <p className="text-xl sm:text-2xl font-black text-bakery-brown">{categories.length}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bakery-brown/40">Categories</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-bakery-beige/30 rounded-2xl">
                    <p className="text-xl sm:text-2xl font-black text-bakery-brown">{products.length}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bakery-brown/40">Menu Items</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-bakery-beige/30 rounded-2xl">
                    <p className="text-xl sm:text-2xl font-black text-bakery-brown">{ingredients.length}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bakery-brown/40">Raw Ingredients</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-bakery-beige/30 rounded-2xl">
                    <p className="text-xl sm:text-2xl font-black text-bakery-brown">{preparedStock.length}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bakery-brown/40">Prepped Stock</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-bakery-beige/30 rounded-2xl">
                    <p className="text-xl sm:text-2xl font-black text-bakery-brown">{users.filter(u => u.role !== 'owner').length}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-bakery-brown/40">Team Members</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={completeOnboarding}
                    className="w-full py-4 sm:py-5 bg-bakery-brown text-white rounded-2xl font-bold text-lg sm:text-xl hover:bg-bakery-brown/90 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    Go to my dashboard
                    <ChevronRight size={24} />
                  </button>
                  <button onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold hover:text-bakery-brown transition-colors text-xs uppercase tracking-widest">
                    Back
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  </div>
);
};
