
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, Edit2, Calculator, TrendingUp, Receipt, Info, Check, X, AlertTriangle, Camera, Upload, Loader2, Maximize2 } from 'lucide-react';
import { Expense, ExpenseCategory, TaxSettings } from '../types';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleGenAI, Type } from "@google/genai";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Utilities', 'Rent', 'Supplies', 'Staff', 'Transport', 'Marketing', 'Insurance', 'Equipment', 'Other'
];

const PLACEHOLDERS = [
  "Electricity", "Water", "Gas", "LPG/Fuel for truck",
  "Parking/Market pitch fee", "Food truck insurance",
  "Packaging materials", "Cleaning products",
  "Social security contributions", "Accountant fees"
];

export const FinanceTab = () => {
  const { t, expenses, setExpenses, taxSettings, setTaxSettings, sales, addToast } = useApp();
  const [activeSection, setActiveSection] = useState<'expenses' | 'tax' | 'profit'>('expenses');
  
  // Expenses State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({
    name: '',
    category: 'Other',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: 'Monthly'
  });
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [expenseFilter, setExpenseFilter] = useState<ExpenseCategory | 'All'>('All');
  const [expenseDateRange, setExpenseDateRange] = useState({ from: '', to: '' });
  
  // Receipt Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tax Settings State (Local for editing, then synced)
  const [localTaxSettings, setLocalTaxSettings] = useState<TaxSettings>(taxSettings);

  useEffect(() => {
    setLocalTaxSettings(taxSettings);
  }, [taxSettings]);

  const handleSaveTaxSettings = () => {
    setTaxSettings(localTaxSettings);
    addToast(t('save'), 'success');
  };

  // Calculations
  const totalSalesRevenue = useMemo(() => sales.reduce((acc, s) => acc + s.subtotal, 0), [sales]);
  
  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (expenseFilter !== 'All') {
      list = list.filter(e => e.category === expenseFilter);
    }
    if (expenseDateRange.from) {
      list = list.filter(e => e.date >= expenseDateRange.from);
    }
    if (expenseDateRange.to) {
      list = list.filter(e => e.date <= expenseDateRange.to);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, expenseFilter, expenseDateRange]);

  const expenseSummaries = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthTotal = expenses.reduce((acc, e) => {
      const d = new Date(e.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) return acc + e.amount;
      return acc;
    }, 0);

    const yearTotal = expenses.reduce((acc, e) => {
      const d = new Date(e.date);
      if (d.getFullYear() === currentYear) return acc + e.amount;
      return acc;
    }, 0);

    const allTimeTotal = expenses.reduce((acc, e) => acc + e.amount, 0);

    return { monthTotal, yearTotal, allTimeTotal };
  }, [expenses]);

  // Tax Logic
  const taxResults = useMemo(() => {
    const gross = localTaxSettings.manualGrossRevenue ?? totalSalesRevenue;
    const deductible = localTaxSettings.manualExpenses ?? expenseSummaries.yearTotal;
    const ssPaid = localTaxSettings.socialSecurityPaid ?? 0;
    
    // Step 1: Net taxable income
    const netTaxable = Math.max(0, gross - deductible - ssPaid);
    
    // Step 2: Tax-free allowance
    const allowance = 10910;
    
    // Step 3: Progressive brackets
    let tax = 0;
    const brackets = [
      { limit: 15820, rate: 0.25 },
      { limit: 27920, rate: 0.40 },
      { limit: 48320, rate: 0.45 },
      { limit: Infinity, rate: 0.50 }
    ];

    let remaining = netTaxable;
    let prevLimit = 0;
    const bracketDetails = brackets.map(b => {
      const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
      const bracketTax = amountInBracket * b.rate;
      tax += bracketTax;
      const detail = { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      prevLimit = b.limit;
      remaining -= amountInBracket;
      return detail;
    });

    // Step 4: Tax-free allowance discount
    const allowanceDiscount = 2727.50;
    const pit = Math.max(0, tax - allowanceDiscount);

    // Step 5: Municipal tax
    const muniTax = pit * (localTaxSettings.municipalTaxRate / 100);

    // Step 6: Total tax burden
    const totalTax = pit + muniTax;

    // Step 7: SS Reference
    const ssRef = netTaxable * 0.205;

    // Step 8: VAT
    const vatCollected = localTaxSettings.vatRegime === 'Standard' ? gross * 0.12 : 0;

    const effectiveRate = gross > 0 ? (totalTax / gross) * 100 : 0;

    return {
      gross, deductible, ssPaid, netTaxable, bracketDetails, pit, muniTax, totalTax, ssRef, vatCollected, effectiveRate, allowanceDiscount
    };
  }, [localTaxSettings, totalSalesRevenue, expenseSummaries.yearTotal]);

  // Profit Overview Logic
  const profitOverview = useMemo(() => {
    const calculateForPeriod = (revenue: number, expensesAmount: number) => {
      const ss = Math.max(0, (revenue - expensesAmount) * 0.205);
      const netTaxable = Math.max(0, revenue - expensesAmount - ss);
      
      // Simplified annualised tax for periods
      let tax = 0;
      const brackets = [
        { limit: 15820, rate: 0.25 },
        { limit: 27920, rate: 0.40 },
        { limit: 48320, rate: 0.45 },
        { limit: Infinity, rate: 0.50 }
      ];
      let rem = netTaxable;
      let prev = 0;
      brackets.forEach(b => {
        const amt = Math.max(0, Math.min(rem, b.limit - prev));
        tax += amt * b.rate;
        prev = b.limit;
        rem -= amt;
      });
      const pit = Math.max(0, tax - 2727.50);
      const muni = pit * (localTaxSettings.municipalTaxRate / 100);
      const totalTax = pit + muni;

      const netProfit = revenue - expensesAmount - ss - totalTax;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return { revenue, expenses: expensesAmount, ss, tax: totalTax, netProfit, margin };
    };

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const monthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    }).reduce((acc, s) => acc + s.subtotal, 0);

    const yearSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === curYear;
    }).reduce((acc, s) => acc + s.subtotal, 0);

    return {
      month: calculateForPeriod(monthSales, expenseSummaries.monthTotal),
      year: calculateForPeriod(yearSales, expenseSummaries.yearTotal),
      allTime: calculateForPeriod(totalSalesRevenue, expenseSummaries.allTimeTotal)
    };
  }, [sales, expenseSummaries, totalSalesRevenue, localTaxSettings.municipalTaxRate]);

  const handleAddExpense = () => {
    const newExpense: Expense = {
      ...expenseForm as Expense,
      id: editingExpense?.id || Math.random().toString(36).substr(2, 9),
      receiptImage: scannedImage || expenseForm.receiptImage
    };

    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === editingExpense.id ? newExpense : e));
      addToast(t('edit'), 'success');
    } else {
      setExpenses(prev => [...prev, newExpense]);
      addToast(t('addExpense'), 'success');
    }
    setIsExpenseModalOpen(false);
    setEditingExpense(null);
    setScannedImage(null);
    setExpenseForm({
      name: '',
      category: 'Other',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      isRecurring: false,
      frequency: 'Monthly'
    });
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    
    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      setScannedImage(base64Data);
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = "gemini-3-flash-preview";
        
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              parts: [
                { inlineData: { data: base64Data.split(',')[1], mimeType: file.type } },
                { text: "Extract expense details from this receipt. Return JSON with fields: name (store/vendor name), amount (number), date (YYYY-MM-DD), and category (one of: Utilities, Rent, Supplies, Staff, Transport, Marketing, Insurance, Equipment, Other)." }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["name", "amount", "date", "category"]
            }
          }
        });

        const result = JSON.parse(response.text || '{}');
        setExpenseForm(prev => ({
          ...prev,
          name: result.name || prev.name,
          amount: result.amount || prev.amount,
          date: result.date || prev.date,
          category: (EXPENSE_CATEGORIES.includes(result.category as any) ? result.category : 'Other') as ExpenseCategory
        }));
        addToast("Receipt scanned successfully!");
      } catch (error) {
        console.error("Scanning failed:", error);
        addToast("Scanning failed. Please enter details manually.", "error");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteExpense = () => {
    if (expenseToDelete) {
      setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
      setExpenseToDelete(null);
      addToast(t('delete'), 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-bakery-beige/30 p-1 rounded-2xl w-fit">
        {[
          { id: 'expenses', label: t('expenses'), icon: Receipt },
          { id: 'tax', label: t('taxCalculator'), icon: Calculator },
          { id: 'profit', label: t('profitOverview'), icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeSection === tab.id ? 'bg-bakery-brown text-white shadow-md' : 'text-bakery-brown/60 hover:text-bakery-brown'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: EXPENSES */}
      {activeSection === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-bakery p-6 bg-bakery-beige/20">
              <p className="text-xs font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesMonth')}</p>
              <p className="text-2xl font-black font-serif">€{expenseSummaries.monthTotal.toFixed(2)}</p>
            </div>
            <div className="card-bakery p-6 bg-bakery-beige/20">
              <p className="text-xs font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesYear')}</p>
              <p className="text-2xl font-black font-serif">€{expenseSummaries.yearTotal.toFixed(2)}</p>
            </div>
            <div className="card-bakery p-6 bg-bakery-accent/20">
              <p className="text-xs font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesAllTime')}</p>
              <p className="text-2xl font-black font-serif">€{expenseSummaries.allTimeTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap gap-4 items-center">
              <select 
                className="p-2 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={expenseFilter}
                onChange={e => setExpenseFilter(e.target.value as any)}
              >
                <option value="All">{t('all')}</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(c.toLowerCase())}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input type="date" className="p-2 border rounded-xl text-sm" value={expenseDateRange.from} onChange={e => setExpenseDateRange({...expenseDateRange, from: e.target.value})} />
                <span className="text-bakery-brown/40">→</span>
                <input type="date" className="p-2 border rounded-xl text-sm" value={expenseDateRange.to} onChange={e => setExpenseDateRange({...expenseDateRange, to: e.target.value})} />
              </div>
            </div>
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all shadow-lg"
            >
              <Plus size={20} />
              {t('addExpense')}
            </button>
          </div>

          <div className="card-bakery overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="p-4">Receipt</th>
                    <th className="p-4">{t('expenseName')}</th>
                    <th className="p-4">{t('category')}</th>
                    <th className="p-4">{t('amount')}</th>
                    <th className="p-4">{t('date')}</th>
                    <th className="p-4">{t('recurring')}</th>
                    <th className="p-4">{t('frequency')}</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-beige">
                  {filteredExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-bakery-cream/50 transition-colors">
                      <td className="p-4">
                        {e.receiptImage ? (
                          <button 
                            onClick={() => setFullSizeImage(e.receiptImage!)}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-bakery-beige hover:border-bakery-caramel transition-all group relative"
                          >
                            <img src={e.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 size={12} className="text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-bakery-beige/20 flex items-center justify-center text-bakery-brown/20">
                            <Receipt size={16} />
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-bold">{e.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-bakery-beige/50 rounded-lg text-[10px] font-bold uppercase text-bakery-brown/60">
                          {t(e.category.toLowerCase())}
                        </span>
                      </td>
                      <td className="p-4 font-black">€{e.amount.toFixed(2)}</td>
                      <td className="p-4 text-bakery-brown/60">{e.date}</td>
                      <td className="p-4">
                        {e.isRecurring ? <Check className="text-emerald-500" size={16} /> : <X className="text-rose-500" size={16} />}
                      </td>
                      <td className="p-4 text-bakery-brown/60">{e.isRecurring ? t(e.frequency?.toLowerCase() || '') : '-'}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingExpense(e); setExpenseForm(e); setIsExpenseModalOpen(true); }}
                            className="p-2 text-bakery-brown/40 hover:text-bakery-caramel transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setExpenseToDelete(e)}
                            className="p-2 text-bakery-brown/40 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredExpenses.length === 0 && (
              <div className="p-20 text-center opacity-30 italic">
                No expenses found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: TAX CALCULATOR */}
      {activeSection === 'tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-6">
            <div className="card-bakery p-6 space-y-4">
              <h3 className="font-serif text-xl font-black flex items-center gap-2">
                <Calculator className="text-bakery-caramel" />
                Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('grossRevenue')} (€)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.manualGrossRevenue ?? totalSalesRevenue}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, manualGrossRevenue: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">Auto-filled from sales records (€{totalSalesRevenue.toFixed(2)})</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('deductibleExpenses')} (€)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.manualExpenses ?? expenseSummaries.yearTotal}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, manualExpenses: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">Auto-filled from logged expenses (€{expenseSummaries.yearTotal.toFixed(2)})</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('socialSecurityPaid')} (€)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.socialSecurityPaid ?? 0}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, socialSecurityPaid: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">Standard rate: 20.5% of net taxable income paid quarterly.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('municipalTaxRate')} (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                        value={localTaxSettings.municipalTaxRate}
                        onChange={e => setLocalTaxSettings({...localTaxSettings, municipalTaxRate: parseFloat(e.target.value)})}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 group cursor-help">
                        <Info size={14} className="text-bakery-brown/40" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-bakery-brown text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Varies by Belgian commune (typically 0% to 10%).
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('vatRegime')}</label>
                    <select 
                      className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={localTaxSettings.vatRegime}
                      onChange={e => setLocalTaxSettings({...localTaxSettings, vatRegime: e.target.value as any})}
                    >
                      <option value="SmallBusiness">{t('smallBusinessExemption')}</option>
                      <option value="Standard">{t('standardVAT')}</option>
                    </select>
                  </div>
                </div>

                {(localTaxSettings.manualGrossRevenue ?? totalSalesRevenue) < 25000 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                    <Check className="text-emerald-500 shrink-0" size={18} />
                    <p className="text-[10px] text-emerald-700">
                      Eligible for <strong>Small Business Exemption</strong> (turnover under €25,000/year). No VAT charged or reclaimed.
                    </p>
                  </div>
                )}

                <button 
                  onClick={handleSaveTaxSettings}
                  className="w-full py-3 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all"
                >
                  {t('save')}
                </button>
              </div>
            </div>

            <div className="p-4 bg-bakery-beige/10 rounded-2xl border border-bakery-beige/30">
              <p className="text-[10px] text-bakery-brown/60 leading-relaxed italic">
                {t('taxDisclaimer')}
              </p>
            </div>
          </div>

          {/* Results Panel */}
          <div className="card-bakery p-8 bg-bakery-brown text-bakery-cream space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12">
              <Calculator size={200} />
            </div>
            
            <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-center border-b border-bakery-cream/20 pb-2">
                <span className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('grossRevenue')}</span>
                <span className="font-black">€{taxResults.gross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center opacity-80">
                <span className="text-xs">− {t('deductibleExpenses')}</span>
                <span className="font-bold">€{taxResults.deductible.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center opacity-80">
                <span className="text-xs">− {t('socialSecurityPaid')}</span>
                <span className="font-bold">€{taxResults.ssPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-bakery-cream/40 pt-2 mt-2">
                <span className="uppercase text-xs font-black tracking-widest">{t('netTaxableIncome')}</span>
                <span className="text-xl font-black">€{taxResults.netTaxable.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <p className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('incomeTaxCalculation')}</p>
              <div className="space-y-1">
                {taxResults.bracketDetails.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-xs opacity-80">
                    <span>{t('bracket')} {i+1} ({b.rate}%)</span>
                    <span>€{b.tax.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs text-emerald-300 font-bold">
                  <span>− {t('taxFreeAllowance')}</span>
                  <span>−€{taxResults.allowanceDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-bakery-cream/20">
                  <span className="text-sm font-bold">{t('personalIncomeTax')}</span>
                  <span className="text-sm font-black">€{taxResults.pit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-80">
                  <span>+ {t('municipalTaxRate')} ({localTaxSettings.municipalTaxRate}%)</span>
                  <span>€{taxResults.muniTax.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-bakery-cream/20 space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                <span className="uppercase text-sm font-black tracking-widest">{t('totalTaxBurden')}</span>
                <span className="text-2xl font-black text-bakery-caramel">€{taxResults.totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center opacity-60 text-xs">
                <span>{t('vatOwed')} (12%)</span>
                <span>€{taxResults.vatCollected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-bakery-cream/10">
                <span className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('effectiveTaxRate')}</span>
                <span className="font-black text-lg">{taxResults.effectiveRate.toFixed(1)}%</span>
              </div>
            </div>

            {Math.abs(taxResults.ssPaid - taxResults.ssRef) > 1000 && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex gap-3 items-center relative z-10">
                <AlertTriangle className="text-rose-300 shrink-0" size={18} />
                <p className="text-[10px] text-rose-100">
                  Large discrepancy in Social Security. Calculated 20.5% is <strong>€{taxResults.ssRef.toFixed(2)}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: PROFIT OVERVIEW */}
      {activeSection === 'profit' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'month', label: t('thisMonth'), data: profitOverview.month },
              { id: 'year', label: t('thisYear'), data: profitOverview.year },
              { id: 'allTime', label: t('allTime'), data: profitOverview.allTime }
            ].map(period => (
              <div key={period.id} className="card-bakery p-6 space-y-6 flex flex-col">
                <div className="flex justify-between items-center border-b border-bakery-beige pb-4">
                  <h3 className="font-serif text-lg font-black">{period.label}</h3>
                  <span className="px-3 py-1 bg-bakery-accent/20 rounded-full text-[10px] font-black text-bakery-brown uppercase">
                    {period.data.margin.toFixed(1)}% Margin
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-bakery-brown/40 uppercase">{t('revenueTotal')}</span>
                    <span className="font-black">€{period.data.revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-500">
                    <span className="text-xs">− {t('expenses')}</span>
                    <span className="font-bold">€{period.data.expenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-bakery-beige pt-2">
                    <span className="text-xs font-bold uppercase">{t('grossProfit')}</span>
                    <span className="font-black">€{(period.data.revenue - period.data.expenses).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-bakery-brown/60">
                    <span className="text-xs">− {t('estimatedIncomeTax')}</span>
                    <span className="font-bold">€{period.data.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-bakery-brown/60">
                    <span className="text-xs">− {t('socialSecurityPaid')}</span>
                    <span className="font-bold">€{period.data.ss.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-bakery-brown/10 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="uppercase text-xs font-black tracking-widest text-bakery-caramel">{t('estimatedNetProfit')}</span>
                    <span className="text-2xl font-black text-bakery-brown">€{period.data.netProfit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Visualisation */}
                <div className="mt-4 space-y-1">
                  <div className="h-2 w-full bg-bakery-beige/30 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-rose-400" 
                      style={{ width: `${Math.min(100, (period.data.expenses / period.data.revenue) * 100)}%` }} 
                    />
                    <div 
                      className="h-full bg-bakery-caramel" 
                      style={{ width: `${Math.min(100, (period.data.tax / period.data.revenue) * 100)}%` }} 
                    />
                    <div 
                      className="h-full bg-bakery-brown" 
                      style={{ width: `${Math.max(0, (period.data.netProfit / period.data.revenue) * 100)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold uppercase text-bakery-brown/40">
                    <span>Expenses</span>
                    <span>Tax</span>
                    <span>Net Profit</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-bakery-accent/10 border border-bakery-accent/30 rounded-2xl flex gap-4 items-start">
            <Info className="text-bakery-caramel shrink-0 mt-1" size={20} />
            <div className="space-y-1">
              <p className="text-xs font-bold text-bakery-brown">Note on Projections</p>
              <p className="text-[10px] text-bakery-brown/60 leading-relaxed">
                These figures are annualised projections based on your current data. The tax calculator assumes a consistent income throughout the year. 
                Actual tax liability is determined at the end of the fiscal year based on total annual income and expenses.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <Modal 
          onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(null); setScannedImage(null); }}
          title={editingExpense ? t('editExpense') : t('addExpense')}
        >
          <div className="space-y-4">
            {!editingExpense && (
              <div className="flex gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-bakery-beige text-bakery-brown rounded-2xl font-bold hover:bg-bakery-beige/70 transition-all border-2 border-dashed border-bakery-brown/20"
                >
                  {isScanning ? <Loader2 className="animate-spin" /> : <Camera size={20} />}
                  Scan Receipt
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleScanReceipt}
                />
              </div>
            )}

            {(scannedImage || expenseForm.receiptImage) && (
              <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-bakery-beige">
                <img src={scannedImage || expenseForm.receiptImage} alt="Receipt Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setScannedImage(null); setExpenseForm({...expenseForm, receiptImage: undefined}); }}
                  className="absolute top-2 right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('expenseName')}</label>
              <input 
                type="text" 
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                placeholder={PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]}
                value={expenseForm.name}
                onChange={e => setExpenseForm({...expenseForm, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('category')}</label>
                <select 
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                  value={expenseForm.category}
                  onChange={e => setExpenseForm({...expenseForm, category: e.target.value as any})}
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(c.toLowerCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('amount')} (€)</label>
                <input 
                  type="number" 
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('date')}</label>
              <input 
                type="date" 
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={expenseForm.date}
                onChange={e => setExpenseForm({...expenseForm, date: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-4 p-3 bg-bakery-beige/20 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-bakery-brown focus:ring-bakery-caramel"
                  checked={expenseForm.isRecurring}
                  onChange={e => setExpenseForm({...expenseForm, isRecurring: e.target.checked})}
                />
                <span className="text-sm font-bold text-bakery-brown">{t('recurring')}</span>
              </label>
              {expenseForm.isRecurring && (
                <select 
                  className="flex-1 p-2 border rounded-lg text-sm bg-white"
                  value={expenseForm.frequency}
                  onChange={e => setExpenseForm({...expenseForm, frequency: e.target.value as any})}
                >
                  <option value="Monthly">{t('monthly')}</option>
                  <option value="Quarterly">{t('quarterly')}</option>
                  <option value="Yearly">{t('yearly')}</option>
                </select>
              )}
            </div>
            <button 
              onClick={handleAddExpense}
              className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all shadow-lg"
            >
              {editingExpense ? t('save') : t('addExpense')}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {expenseToDelete && (
        <ConfirmDialog 
          onCancel={() => setExpenseToDelete(null)}
          onConfirm={handleDeleteExpense}
          title={t('delete')}
          message={t('confirmDeleteExpense')}
        />
      )}

      {fullSizeImage && (
        <Modal title="Receipt View" onClose={() => setFullSizeImage(null)}>
          <div className="max-h-[80vh] overflow-auto">
            <img src={fullSizeImage} alt="Full Receipt" className="w-full h-auto rounded-2xl" />
          </div>
        </Modal>
      )}
    </div>
  );
};
