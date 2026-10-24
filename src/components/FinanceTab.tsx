
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, Edit2, Calculator, TrendingUp, Receipt, Info, Check, X, AlertTriangle, Camera, Upload, Loader2, Maximize2 } from 'lucide-react';
import { Expense, ExpenseCategory, TaxSettings } from '../types';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTablePagination, useTablePagination } from './DataTablePagination';
import { SortableTh, useColumnSort, sortByColumn } from '../utils/tableSort';
import { ScanProgressModal } from './ScanProgressModal';
import { AIRequestError, compressImage, extractReceiptExpense } from '../utils/aiHelper';
import { getRegionalTaxProfile, regionalTaxLines } from '../utils/taxRegions';

import { hasOwnerAccess } from '../utils/roles';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Utilities', 'Rent', 'Supplies', 'Staff', 'Transport', 'Marketing', 'Insurance', 'Equipment', 'Other'
];

export const FinanceTab = () => {
  const { t, expenses, addExpense, updateExpense, deleteExpense, taxSettings, setTaxSettings, sales, addToast, businessSettings, formatPrice, setActiveTab, user } = useApp();
  const isOwner = hasOwnerAccess(user?.role);
  const priceStr = (n: number) => `${businessSettings?.currencySymbol || '€'}${n.toFixed(2)}`;
  const taxProfile = getRegionalTaxProfile(businessSettings?.country);
  const PLACEHOLDERS = useMemo(() => [
    t('expensePlaceholder1'),
    t('expensePlaceholder2'),
    t('expensePlaceholder3'),
    t('expensePlaceholder4'),
    t('expensePlaceholder5'),
    t('expensePlaceholder6'),
    t('expensePlaceholder7'),
    t('expensePlaceholder8'),
    t('expensePlaceholder9'),
    t('expensePlaceholder10')
  ], [t]);
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
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'uploading' | 'analyzing' | 'extracting' | 'finishing' | 'error' | 'success' | 'timeout'>('uploading');
  const [scanThumbnail, setScanThumbnail] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null);
  const scanInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetScanState = (keepScannedImage = true) => {
    setIsScanning(false);
    setScanStatus('uploading');
    setScanThumbnail(null);
    setSelectedFile(null);
    abortControllerRef.current = null;
    if (!keepScannedImage) {
      setScannedImage(null);
    }
  };

  // Tax Settings State (Local for editing, then synced)
  const [localTaxSettings, setLocalTaxSettings] = useState<TaxSettings>(taxSettings);

  useEffect(() => {
    setLocalTaxSettings(taxSettings);
  }, [taxSettings]);

  const handleSaveTaxSettings = () => {
    if (!isOwner) {
      addToast(t('ownerOnlyTaxSettings') || 'Only the business owner can change tax settings.', 'error');
      return;
    }
    setTaxSettings(prev => ({
      ...prev,
      manualGrossRevenue: localTaxSettings.manualGrossRevenue,
      manualExpenses: localTaxSettings.manualExpenses,
      socialSecurityPaid: localTaxSettings.socialSecurityPaid,
      vatRegime: prev.vatRegime,
      municipalTaxRate: prev.municipalTaxRate,
      countryCode: businessSettings?.country || prev.countryCode,
    }));
    addToast(t('save'), 'success');
  };

  // Calculations
  const totalSalesRevenue = useMemo(() => sales.reduce((acc, s) => acc + s.subtotal, 0), [sales]);
  
  type ExpenseSort = 'receipt' | 'name' | 'category' | 'amount' | 'date' | 'recurring' | 'frequency';
  const { sortKey: expenseSortKey, sortDirection: expenseSortDir, toggleSort: toggleExpenseSort } = useColumnSort<ExpenseSort>('date', 'desc');

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
    return sortByColumn(list, expenseSortKey, expenseSortDir, (e: Expense, key) => {
      if (key === 'receipt') return e.receiptImage ? 1 : 0;
      if (key === 'name') return e.name;
      if (key === 'category') return e.category;
      if (key === 'amount') return e.amount;
      if (key === 'date') return e.date;
      if (key === 'recurring') return e.isRecurring ? 1 : 0;
      return e.frequency || '';
    });
  }, [expenses, expenseFilter, expenseDateRange, expenseSortKey, expenseSortDir]);

  const expensesPaging = useTablePagination(filteredExpenses.length, 10, `${expenseFilter}|${expenseDateRange.from}|${expenseDateRange.to}`);
  const paginatedExpenses = useMemo(
    () => expensesPaging.slice(filteredExpenses),
    [filteredExpenses, expensesPaging.page, expensesPaging.pageSize, expensesPaging.start]
  );

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

  const countryCode = businessSettings?.country || 'BE';

  // Tax Logic
  const taxResults = useMemo(() => {
    const gross = localTaxSettings.manualGrossRevenue ?? totalSalesRevenue;
    const deductible = localTaxSettings.manualExpenses ?? expenseSummaries.yearTotal;
    const ssPaid = localTaxSettings.socialSecurityPaid ?? 0;
    
    // Step 1: Net taxable income
    const netTaxable = Math.max(0, gross - deductible - ssPaid);
    
    // Default values
    let tax = 0;
    let allowance = 0;
    let bracketDetails: { amount: number; tax: number; rate: number }[] = [];
    let allowanceDiscount = 0;
    let pit = 0;
    let muniTax = 0;
    let totalTax = 0;
    let ssRef = 0;
    let vatCollected = 0;
    let vatRate = 0;

    // Country Specific Rules
    if (countryCode === 'BE') {
      allowance = 10910;
      const brackets = [
        { limit: 15820, rate: 0.25 },
        { limit: 27920, rate: 0.40 },
        { limit: 48320, rate: 0.45 },
        { limit: Infinity, rate: 0.50 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      allowanceDiscount = 2727.50;
      pit = Math.max(0, tax - allowanceDiscount);
      muniTax = pit * (localTaxSettings.municipalTaxRate / 100);
      totalTax = pit + muniTax;
      ssRef = netTaxable * 0.205;
      vatRate = 0.12;
      vatCollected = localTaxSettings.vatRegime === 'Standard' ? gross * vatRate : 0;
    } else if (countryCode === 'FR') {
      // France simplified
      allowance = 11294;
      const brackets = [
        { limit: 11294, rate: 0 },
        { limit: 28797, rate: 0.11 },
        { limit: 82341, rate: 0.30 },
        { limit: 177106, rate: 0.41 },
        { limit: Infinity, rate: 0.45 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit;
      ssRef = netTaxable * 0.22; // Auto-entrepreneur simplified
      vatRate = 0.20;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'GB') {
      // UK simplified
      allowance = 12570;
      const brackets = [
        { limit: 12570, rate: 0 },
        { limit: 50270, rate: 0.20 },
        { limit: 125140, rate: 0.40 },
        { limit: Infinity, rate: 0.45 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit;
      ssRef = netTaxable * 0.09; // National Insurance Class 4
      vatRate = 0.20;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'NL') {
      // Netherlands simplified
      allowance = 2470 + 2123; // Zelfstandigenaftrek + Startersaftrek
      const brackets = [
        { limit: 75518, rate: 0.3697 },
        { limit: Infinity, rate: 0.4950 }
      ];
      let remaining = Math.max(0, netTaxable - allowance);
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      const credits = 3362 + 5158; // Algemene heffingskorting + Arbeidskorting (max)
      pit = Math.max(0, tax - credits);
      totalTax = pit;
      ssRef = netTaxable * 0.0543; // Zvw
      vatRate = 0.09;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'DE') {
      // Germany simplified
      allowance = 11784;
      const brackets = [
        { limit: 11784, rate: 0 },
        { limit: 66760, rate: 0.28 }, // Simplified progressive average
        { limit: 277826, rate: 0.42 },
        { limit: Infinity, rate: 0.45 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit + (pit * 0.055); // Soli
      ssRef = netTaxable * 0.186; // Pension insurance
      vatRate = 0.07;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'US') {
      // USA simplified (Federal only)
      allowance = 15000;
      const brackets = [
        { limit: 11925, rate: 0.10 },
        { limit: 48475, rate: 0.12 },
        { limit: 103350, rate: 0.22 },
        { limit: 197300, rate: 0.24 },
        { limit: 243725, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
      ];
      let remaining = Math.max(0, netTaxable - allowance);
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      const seTax = netTaxable * 0.153;
      totalTax = pit + seTax + (netTaxable * (localTaxSettings.customIncomeTaxRate || 5) / 100);
      ssRef = seTax;
      vatRate = (localTaxSettings.customVatRate || 8) / 100;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'ES') {
      // Spain simplified
      allowance = 5550;
      const brackets = [
        { limit: 12450, rate: 0.19 },
        { limit: 20200, rate: 0.24 },
        { limit: 35200, rate: 0.30 },
        { limit: 60000, rate: 0.37 },
        { limit: 300000, rate: 0.45 },
        { limit: Infinity, rate: 0.47 }
      ];
      let remaining = Math.max(0, netTaxable - allowance);
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit + (300 * 12); // Flat SS fee average
      ssRef = 3600;
      vatRate = 0.10;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'IT') {
      // Italy simplified
      if (gross < 85000) {
        // Regime forfettario
        tax = gross * 0.40 * 0.15;
        bracketDetails = [{ amount: gross, tax: tax, rate: 6 }]; // Effective on gross
        pit = tax;
        totalTax = pit;
        ssRef = gross * 0.40 * 0.2607;
        vatRate = 0;
        vatCollected = 0;
      } else {
        const brackets = [
          { limit: 28000, rate: 0.23 },
          { limit: 50000, rate: 0.35 },
          { limit: Infinity, rate: 0.43 }
        ];
        let remaining = netTaxable;
        let prevLimit = 0;
        bracketDetails = brackets.map(b => {
          const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
          const bracketTax = amountInBracket * b.rate;
          tax += bracketTax;
          prevLimit = b.limit;
          remaining -= amountInBracket;
          return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
        });
        pit = tax;
        totalTax = pit;
        ssRef = netTaxable * 0.2607;
        vatRate = 0.10;
        vatCollected = gross * vatRate;
      }
    } else if (countryCode === 'CA') {
      // Canada simplified (Federal)
      allowance = 16129;
      const brackets = [
        { limit: 57375, rate: 0.15 },
        { limit: 114750, rate: 0.205 },
        { limit: 158519, rate: 0.26 },
        { limit: 220000, rate: 0.29 },
        { limit: Infinity, rate: 0.33 }
      ];
      let remaining = Math.max(0, netTaxable - allowance);
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      const cpp = netTaxable * 0.119;
      totalTax = pit + cpp + (netTaxable * 0.10); // Default 10% provincial
      ssRef = cpp;
      vatRate = 0.05;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'AU') {
      // Australia simplified
      allowance = 18200;
      const brackets = [
        { limit: 18200, rate: 0 },
        { limit: 45000, rate: 0.19 },
        { limit: 120000, rate: 0.325 },
        { limit: 180000, rate: 0.37 },
        { limit: Infinity, rate: 0.45 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit + (netTaxable * 0.02); // Medicare levy
      ssRef = netTaxable * 0.02;
      vatRate = 0.10;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'AE') {
      // UAE simplified
      tax = gross > 375000 ? (gross - 375000) * 0.09 : 0;
      bracketDetails = [{ amount: gross, tax: tax, rate: 9 }];
      pit = 0;
      totalTax = tax;
      ssRef = 0;
      vatRate = 0.05;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'SA') {
      // Saudi Arabia simplified
      tax = netTaxable * 0.025; // Zakat
      bracketDetails = [{ amount: netTaxable, tax: tax, rate: 2.5 }];
      pit = 0;
      totalTax = tax;
      ssRef = 0;
      vatRate = 0.15;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'EG') {
      // Egypt simplified
      allowance = 20000;
      const brackets = [
        { limit: 40000, rate: 0 },
        { limit: 55000, rate: 0.10 },
        { limit: 70000, rate: 0.15 },
        { limit: 200000, rate: 0.20 },
        { limit: 400000, rate: 0.225 },
        { limit: Infinity, rate: 0.275 }
      ];
      let remaining = Math.max(0, netTaxable - allowance);
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit + (netTaxable * 0.11);
      ssRef = netTaxable * 0.11;
      vatRate = 0.14;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'MA') {
      // Morocco simplified
      const brackets = [
        { limit: 40000, rate: 0 },
        { limit: 60000, rate: 0.10 },
        { limit: 80000, rate: 0.20 },
        { limit: 100000, rate: 0.30 },
        { limit: 180000, rate: 0.34 },
        { limit: Infinity, rate: 0.37 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit;
      ssRef = 0;
      vatRate = 0.10;
      vatCollected = gross * vatRate;
    } else if (countryCode === 'JO') {
      // Jordan simplified
      const brackets = [
        { limit: 5000, rate: 0 },
        { limit: 10000, rate: 0.05 },
        { limit: 15000, rate: 0.10 },
        { limit: 20000, rate: 0.15 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 }
      ];
      let remaining = netTaxable;
      let prevLimit = 0;
      bracketDetails = brackets.map(b => {
        const amountInBracket = Math.max(0, Math.min(remaining, b.limit - prevLimit));
        const bracketTax = amountInBracket * b.rate;
        tax += bracketTax;
        prevLimit = b.limit;
        remaining -= amountInBracket;
        return { amount: amountInBracket, tax: bracketTax, rate: b.rate * 100 };
      });
      pit = tax;
      totalTax = pit;
      ssRef = 0;
      vatRate = 0.16;
      vatCollected = gross * vatRate;
    } else {
      // Generic Fallback
      const customRate = (localTaxSettings.customIncomeTaxRate || 20) / 100;
      const customVat = (localTaxSettings.customVatRate || 15) / 100;
      const customSS = (localTaxSettings.customSocialSecurityRate || 10) / 100;
      
      tax = netTaxable * customRate;
      bracketDetails = [{ amount: netTaxable, tax: tax, rate: customRate * 100 }];
      pit = tax;
      totalTax = pit;
      ssRef = netTaxable * customSS;
      vatRate = customVat;
      vatCollected = gross * vatRate;
    }

    const effectiveRate = gross > 0 ? (totalTax / gross) * 100 : 0;

    return {
      gross, deductible, ssPaid, netTaxable, bracketDetails, pit, muniTax, totalTax, ssRef, vatCollected, effectiveRate, allowanceDiscount, vatRate
    };
  }, [localTaxSettings, totalSalesRevenue, expenseSummaries.yearTotal, countryCode]);

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

  const handleAddExpense = async () => {
    if (isSavingExpense) return;
    setIsSavingExpense(true);
    try {
      // Keep the compressed image in the expense's protected receipt_image field.
      const receiptImageUrl = scannedImage || expenseForm.receiptImage || undefined;
      if (receiptImageUrl?.startsWith('data:') && receiptImageUrl.length > 1_048_576) {
        addToast('Receipt image is too large. Please use a smaller image.', 'error');
        return;
      }
      const expensePayload = {
        ...expenseForm as Expense,
        receiptImage: receiptImageUrl,
      };

      if (editingExpense) {
        if (!await updateExpense({ ...expensePayload, id: editingExpense.id })) return;
      } else {
        if (!await addExpense(expensePayload)) return;
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
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Expense could not be saved. Please try again.', 'error');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!selectedFile || scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setIsScanning(true);
    setScanStatus('uploading');
    setScanThumbnail(selectedFile);
    setScanError('');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let stageTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const compressed = await compressImage(selectedFile, 1600, 0.8);
      setScanStatus('analyzing');
      stageTimer = setTimeout(() => setScanStatus('extracting'), 1500);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      timeoutId = setTimeout(() => {
        controller.abort();
        setScanStatus('timeout');
      }, 45000);

      const result = await extractReceiptExpense(compressed, controller.signal);
      clearTimeout(timeoutId);

      if (!result) {
        setScanStatus('error');
        setScanError(t('scanReceiptFailed'));
        addToast(t('scanReceiptFailed'), 'error');
        return;
      }

      setScanStatus('extracting');
      setExpenseForm(prev => ({
        ...prev,
        name: result.name || prev.name,
        amount: result.amount,
        date: result.date || prev.date,
        category: (EXPENSE_CATEGORIES.includes(result.category as any) ? result.category : 'Other') as ExpenseCategory
      }));
      setScannedImage(compressed.length <= 1_048_576 ? compressed : await compressImage(selectedFile, 1024, 0.65));
      setScanStatus('success');
      setSelectedFile(null);
      setIsScanning(false);
      addToast(t('receiptScanned'));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setScanStatus('error');
        const message = error instanceof AIRequestError ? error.message : t('scanReceiptFailed');
        setScanError(message);
        addToast(message, 'error');
      }
    } finally {
      scanInFlightRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (stageTimer) clearTimeout(stageTimer);
      abortControllerRef.current = null;
    }
  };

  const cancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    resetScanState();
  };

  const handleDeleteExpense = () => {
    if (expenseToDelete) {
      deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 sm:gap-2 bg-bakery-beige/30 p-1 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
        {[
          { id: 'expenses', label: t('expenses'), icon: Receipt },
          { id: 'tax', label: t('taxCalculator'), icon: Calculator },
          { id: 'profit', label: t('profitOverview'), icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 md:px-6 py-2 rounded-xl font-bold text-[10px] sm:text-xs md:text-sm transition-all whitespace-nowrap ${
              activeSection === tab.id ? 'bg-bakery-brown text-white shadow-md' : 'text-bakery-brown/60 hover:text-bakery-brown'
            }`}
          >
            <tab.icon size={14} className="sm:w-4 sm:h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: EXPENSES */}
      {activeSection === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="card-bakery p-4 md:p-6 bg-bakery-beige/20">
              <p className="text-[10px] font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesMonth')}</p>
              <p className="text-xl md:text-2xl font-black font-serif">{formatPrice(expenseSummaries.monthTotal)}</p>
            </div>
            <div className="card-bakery p-4 md:p-6 bg-bakery-beige/20">
              <p className="text-[10px] font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesYear')}</p>
              <p className="text-xl md:text-2xl font-black font-serif">{formatPrice(expenseSummaries.yearTotal)}</p>
            </div>
            <div className="card-bakery p-4 md:p-6 bg-bakery-accent/20 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] font-bold text-bakery-brown/40 uppercase tracking-widest mb-1">{t('totalExpensesAllTime')}</p>
              <p className="text-xl md:text-2xl font-black font-serif">{formatPrice(expenseSummaries.allTimeTotal)}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <select 
                className="p-3 md:p-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm bg-white"
                value={expenseFilter}
                onChange={e => setExpenseFilter(e.target.value as any)}
              >
                <option value="All">{t('all')}</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(c.toLowerCase())}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input type="date" className="flex-1 p-3 md:p-2 border border-bakery-beige rounded-xl text-xs md:text-sm bg-white min-w-0" value={expenseDateRange.from} onChange={e => setExpenseDateRange({...expenseDateRange, from: e.target.value})} />
                <span className="text-bakery-brown/40 shrink-0">→</span>
                <input type="date" className="flex-1 p-3 md:p-2 border border-bakery-beige rounded-xl text-xs md:text-sm bg-white min-w-0" value={expenseDateRange.to} onChange={e => setExpenseDateRange({...expenseDateRange, to: e.target.value})} />
              </div>
            </div>
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all shadow-lg active:scale-95 text-sm"
            >
              <Plus size={20} />
              {t('addExpense')}
            </button>
          </div>

          <div className="card-bakery overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <SortableTh label={t('receipt')} column="receipt" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('expenseName')} column="name" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('category')} column="category" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('amount')} column="amount" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('date')} column="date" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('recurring')} column="recurring" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <SortableTh label={t('frequency')} column="frequency" sortKey={expenseSortKey} sortDirection={expenseSortDir} onSort={toggleExpenseSort} />
                    <th className="p-4 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-beige">
                  {paginatedExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-bakery-cream/50 transition-colors">
                      <td className="p-4">
                        {e.receiptImage ? (
                          <button 
                            onClick={() => setFullSizeImage(e.receiptImage || null)}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-bakery-beige hover:border-bakery-caramel transition-all group relative"
                          >
                            <img src={e.receiptImage} alt={t('receipt')} className="w-full h-full object-cover" />
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
                      <td className="p-4 font-bold whitespace-nowrap">{e.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-bakery-beige/50 rounded-lg text-[10px] font-bold uppercase text-bakery-brown/60 whitespace-nowrap">
                          {t(e.category.toLowerCase())}
                        </span>
                      </td>
                      <td className="p-4 font-black whitespace-nowrap">{formatPrice(e.amount)}</td>
                      <td className="p-4 text-bakery-brown/60 whitespace-nowrap">{e.date}</td>
                      <td className="p-4">
                        {e.isRecurring ? <Check className="text-emerald-500" size={16} /> : <X className="text-rose-500" size={16} />}
                      </td>
                      <td className="p-4 text-bakery-brown/60 whitespace-nowrap">{e.isRecurring ? t(e.frequency?.toLowerCase() || '') : t('dash')}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingExpense(e); setExpenseForm(e); setIsExpenseModalOpen(true); }}
                            className="p-2 text-bakery-brown/40 hover:text-bakery-caramel transition-colors active:scale-90"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setExpenseToDelete(e)}
                            className="p-2 text-bakery-brown/40 hover:text-rose-500 transition-colors active:scale-90"
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
                {t('noExpensesFound')}
              </div>
            )}
          </div>
          <ScanProgressModal 
            isOpen={isScanning} 
            status={scanStatus}
            errorMessage={scanError}
            imageThumbnail={scanThumbnail}
            onClose={() => resetScanState()}
            onCancel={cancelScan}
            onRetry={startScan}
          />

          {selectedFile && !isScanning && (
            <Modal title={t('previewReceipt')} onClose={() => setSelectedFile(null)}>
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
                    {t('scanReceipt')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          <DataTablePagination
            page={expensesPaging.page}
            pageSize={expensesPaging.pageSize}
            totalItems={filteredExpenses.length}
            onPageChange={expensesPaging.setPage}
            onPageSizeChange={expensesPaging.setPageSize}
          />
        </div>
      )}

      {/* SECTION 2: TAX CALCULATOR */}
      {activeSection === 'tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="space-y-6">
            <div className="card-bakery p-6 space-y-4">
              <h3 className="font-serif text-base font-bold flex items-center gap-2">
                <Calculator className="text-bakery-caramel" />
                {t('settings')}
              </h3>

              <div className="rounded-2xl border border-bakery-beige/60 bg-bakery-beige/20 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">
                  {t('taxForRegion')} — {taxProfile.countryName} ({taxProfile.currencyHint})
                </p>
                <p className="text-sm font-black text-bakery-brown">
                  {t('regionalVatRate')}: {taxProfile.vatLabel} {taxProfile.standardVatPercent}%
                  {taxProfile.reducedVatPercent != null
                    ? ` / reduced ${taxProfile.reducedVatPercent}%`
                    : ''}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-bakery-brown/40 pt-1">
                  {t('taxesYouPay')}
                </p>
                <ul className="space-y-1 text-xs text-bakery-brown/80 list-disc pl-4">
                  {regionalTaxLines(taxProfile).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('grossRevenue')} ({businessSettings?.currencySymbol || '€'})</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.manualGrossRevenue ?? totalSalesRevenue}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, manualGrossRevenue: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">{t('autoFilledSales').replace('{amount}', priceStr(totalSalesRevenue))}</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('deductibleExpenses')} ({businessSettings?.currencySymbol || '€'})</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.manualExpenses ?? expenseSummaries.yearTotal}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, manualExpenses: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">{t('autoFilledExpenses').replace('{amount}', priceStr(expenseSummaries.yearTotal))}</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('socialSecurityPaid')} ({businessSettings?.currencySymbol || '€'})</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                    value={localTaxSettings.socialSecurityPaid ?? 0}
                    onChange={e => setLocalTaxSettings({...localTaxSettings, socialSecurityPaid: parseFloat(e.target.value)})}
                  />
                  <p className="text-[10px] text-bakery-brown/40 mt-1 italic">{t('socialSecurityHelp')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-bakery-beige/30 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-bakery-brown/40 mb-1">{t('municipalTaxRate')}</p>
                    <p className="font-black text-bakery-brown">{localTaxSettings.municipalTaxRate}%</p>
                  </div>
                  <div className="p-3 bg-bakery-beige/30 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-bakery-brown/40 mb-1">{t('vatRegime')}</p>
                    <p className="font-black text-bakery-brown text-sm">
                      {localTaxSettings.vatRegime === 'SmallBusiness'
                        ? t('smallBusinessExemption')
                        : t('standardVAT')}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-bakery-brown/50">
                  {t('fiscalDefaultsInSettings')}{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="font-bold text-bakery-caramel underline underline-offset-2"
                  >
                    {t('openSettings')}
                  </button>
                </p>

                {(localTaxSettings.manualGrossRevenue ?? totalSalesRevenue) < 25000 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                    <Check className="text-emerald-500 shrink-0" size={18} />
                <p className="text-[10px] text-emerald-700">
                  {t('smallBusinessEligible').replace('{amount}', priceStr(25000))}
                </p>
                  </div>
                )}

                <button 
                  onClick={handleSaveTaxSettings}
                  disabled={!isOwner}
                  className="w-full py-3 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all disabled:opacity-50"
                >
                  {isOwner ? t('save') : (t('ownerOnlyTaxSettings') || 'Owner only')}
                </button>
              </div>
            </div>

            <div className="p-4 bg-bakery-beige/10 rounded-2xl border border-bakery-beige/30">
              <p className="text-[10px] text-bakery-brown/60 leading-relaxed italic">
                {taxProfile.disclaimer}
              </p>
            </div>
          </div>

          {/* Results Panel */}
          <div className="card-bakery p-4 sm:p-8 bg-bakery-brown text-bakery-cream space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 -rotate-12 hidden sm:block">
              <Calculator size={200} />
            </div>
            
            <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-center border-b border-bakery-cream/20 pb-2">
                <span className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('grossRevenue')}</span>
                <span className="font-black text-sm sm:text-base">{formatPrice(taxResults.gross)}</span>
              </div>
              <div className="flex justify-between items-center opacity-80">
                <span className="text-xs">− {t('deductibleExpenses')}</span>
                <span className="font-bold text-sm">{formatPrice(taxResults.deductible)}</span>
              </div>
              <div className="flex justify-between items-center opacity-80">
                <span className="text-xs">− {t('socialSecurityPaid')}</span>
                <span className="font-bold text-sm">{formatPrice(taxResults.ssPaid)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-bakery-cream/40 pt-2 mt-2">
                <span className="uppercase text-xs font-black tracking-widest">{t('netTaxableIncome')}</span>
                <span className="text-lg sm:text-xl font-black">{formatPrice(taxResults.netTaxable)}</span>
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <p className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('incomeTaxCalculation')}</p>
              <div className="space-y-1">
                {taxResults.bracketDetails.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-xs opacity-80">
                    <span>{t('bracket')} {i+1} ({b.rate.toFixed(1)}%)</span>
                    <span>{formatPrice(b.tax)}</span>
                  </div>
                ))}
                {taxResults.allowanceDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-300 font-bold">
                    <span>− {t('taxFreeAllowance')}</span>
                    <span>−{formatPrice(taxResults.allowanceDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-bakery-cream/20">
                  <span className="text-sm font-bold">{t('personalIncomeTax')}</span>
                  <span className="text-sm font-black">{formatPrice(taxResults.pit)}</span>
                </div>
                {taxResults.muniTax > 0 && (
                  <div className="flex justify-between items-center text-xs opacity-80">
                    <span>+ {t('municipalTaxRate')} ({localTaxSettings.municipalTaxRate}%)</span>
                    <span>{formatPrice(taxResults.muniTax)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-bakery-cream/20 space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                <span className="uppercase text-xs sm:text-sm font-black tracking-widest">{t('totalTaxBurden')}</span>
                <span className="text-xl sm:text-2xl font-black text-bakery-caramel">{formatPrice(taxResults.totalTax)}</span>
              </div>
              <div className="flex justify-between items-center opacity-60 text-[10px] sm:text-xs">
                <span>{t('vatOwed')} ({(taxResults.vatRate * 100).toFixed(0)}%)</span>
                <span>{formatPrice(taxResults.vatCollected)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-bakery-cream/10">
                <span className="uppercase text-[10px] font-black tracking-widest opacity-60">{t('effectiveTaxRate')}</span>
                <span className="font-black text-base sm:text-lg">{taxResults.effectiveRate.toFixed(1)}%</span>
              </div>
            </div>

            {Math.abs(taxResults.ssPaid - taxResults.ssRef) > 1000 && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex gap-3 items-center relative z-10">
                <AlertTriangle className="text-rose-300 shrink-0" size={18} />
                <p className="text-[10px] text-rose-100">
                  {t('socialSecurityDiscrepancy').replace('{amount}', priceStr(taxResults.ssRef))}
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
                    {t('marginLabel').replace('{value}', period.data.margin.toFixed(1))}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-bakery-brown/40 uppercase">{t('revenueTotal')}</span>
                    <span className="font-black">{formatPrice(period.data.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-500">
                    <span className="text-xs">− {t('expenses')}</span>
                    <span className="font-bold">{formatPrice(period.data.expenses)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-bakery-beige pt-2">
                    <span className="text-xs font-bold uppercase">{t('grossProfit')}</span>
                    <span className="font-black">{formatPrice(period.data.revenue - period.data.expenses)}</span>
                  </div>
                  <div className="flex justify-between items-center text-bakery-brown/60">
                    <span className="text-xs">− {t('estimatedIncomeTax')}</span>
                    <span className="font-bold">{formatPrice(period.data.tax)}</span>
                  </div>
                  <div className="flex justify-between items-center text-bakery-brown/60">
                    <span className="text-xs">− {t('socialSecurityPaid')}</span>
                    <span className="font-bold">{formatPrice(period.data.ss)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-bakery-brown/10 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="uppercase text-xs font-black tracking-widest text-bakery-caramel">{t('estimatedNetProfit')}</span>
                    <span className="text-2xl font-black text-bakery-brown">{formatPrice(period.data.netProfit)}</span>
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
                    <span>{t('expenses')}</span>
                    <span>{t('tax')}</span>
                    <span>{t('netProfit')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-bakery-accent/10 border border-bakery-accent/30 rounded-2xl flex gap-4 items-start">
            <Info className="text-bakery-caramel shrink-0 mt-1" size={20} />
            <div className="space-y-1">
              <p className="text-xs font-bold text-bakery-brown">{t('projectionNoteTitle')}</p>
              <p className="text-[10px] text-bakery-brown/60 leading-relaxed">
                {t('projectionNote')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && !selectedFile && !isScanning && (
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
                  {t('scanReceipt')}
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
                <img src={scannedImage || expenseForm.receiptImage} alt={t('receiptPreview')} className="w-full h-full object-cover" />
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
                <label className="text-xs font-bold uppercase text-bakery-brown/40 mb-1 block">{t('amount')} ({businessSettings?.currencySymbol || '€'})</label>
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
              disabled={isSavingExpense}
              className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all shadow-lg"
            >
              {isSavingExpense ? t('processing') : editingExpense ? t('save') : t('addExpense')}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {expenseToDelete && (
        <ConfirmDialog 
          isOpen={!!expenseToDelete}
          onClose={() => setExpenseToDelete(null)}
          onConfirm={handleDeleteExpense}
          title={t('delete')}
          message={t('confirmDeleteExpense')}
        />
      )}

      {fullSizeImage && (
        <Modal title={t('receiptView')} onClose={() => setFullSizeImage(null)}>
          <div className="max-h-[80vh] overflow-auto">
            <img src={fullSizeImage} alt={t('receiptFull')} className="w-full h-auto rounded-2xl" />
          </div>
        </Modal>
      )}
    </div>
  );
};
