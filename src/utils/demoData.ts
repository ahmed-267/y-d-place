
import { Sale, ShiftLog, WorkShift, Expense, Product, Ingredient, PreparedStock, User } from '../types';
import { DEFAULT_PRODUCTS, DEFAULT_INGREDIENTS } from '../constants';

export const generateDemoData = () => {
  const sales: Sale[] = [];
  const shiftLogs: ShiftLog[] = [];
  const workShifts: WorkShift[] = [];
  const expenses: Expense[] = [];
  
  // 1. Generate Staff
  const users: User[] = [
    { id: 1, username: 'owner', fullName: 'Y&D Owner', role: 'owner', password: 'keoks2024' },
    { id: 2, username: 'manager', fullName: 'Y&D Manager', role: 'manager', password: 'manager123' },
    { id: 3, username: 'sarah', fullName: 'Sarah Jenkins', role: 'staff', password: 'staff123' },
    { id: 4, username: 'ahmed', fullName: 'Ahmed Mahrez', role: 'staff', password: 'staff123' },
    { id: 5, username: 'elena', fullName: 'Elena Rodriguez', role: 'staff', password: 'staff123' },
    { id: 6, username: 'marco', fullName: 'Marco Rossi', role: 'staff', password: 'staff123' },
    { id: 7, username: 'sophie', fullName: 'Sophie Dubois', role: 'staff', password: 'staff123' },
    { id: 8, username: 'lucas', fullName: 'Lucas Van Damme', role: 'staff', password: 'staff123' },
    { id: 9, username: 'nina', fullName: 'Nina Petrov', role: 'staff', password: 'staff123' },
    { id: 10, username: 'david', fullName: 'David Smith', role: 'staff', password: 'staff123' },
  ];

  // 2. Generate Ingredients
  const ingredients: Ingredient[] = DEFAULT_INGREDIENTS.map(ing => ({
    ...ing,
    qty: 100 // Give plenty of stock
  }));

  // 3. Generate Prepared Stock
  const preparedStock: PreparedStock[] = [
    { id: 101, name: 'Waffle Batter', portions: 150, lowThreshold: 20 },
    { id: 102, name: 'Crêpe Batter', portions: 120, lowThreshold: 15 },
    { id: 103, name: 'Whipped Cream', portions: 80, lowThreshold: 10 },
  ];

  // 4. Generate Products with Links
  const products: Product[] = DEFAULT_PRODUCTS.map(p => {
    const links: any = {
      ingredientLinks: [],
      preparedStockLinks: []
    };

    if (p.category === 'Waffles') {
      links.preparedStockLinks.push({ preparedStockId: 101, portionsPerSale: 1 });
    } else if (p.category === 'Crêpes') {
      links.preparedStockLinks.push({ preparedStockId: 102, portionsPerSale: 1 });
    }

    if (p.nameEN.includes('Whipped')) {
      links.preparedStockLinks.push({ preparedStockId: 103, portionsPerSale: 1 });
    }

    return { ...p, ...links };
  });

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  
  // 5. Generate Sales
  for (let d = new Date(threeMonthsAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const numSales = Math.floor(Math.random() * 12) + 8; // 8-20 sales
    for (let i = 0; i < numSales; i++) {
        const saleTime = new Date(d);
        saleTime.setHours(Math.floor(Math.random() * 10) + 10); // 10:00 - 20:00
        saleTime.setMinutes(Math.floor(Math.random() * 60));
        
        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let subtotal = 0;
        for (let j = 0; j < numItems; j++) {
            const p = products[Math.floor(Math.random() * products.length)];
            const qty = Math.floor(Math.random() * 2) + 1;
            const lineTotal = p.price * qty;
            items.push({
                productId: p.id,
                nameEN: p.nameEN,
                qty,
                unitPrice: p.price,
                lineTotal,
                extras: []
            });
            subtotal += lineTotal;
        }
        
        const staffMember = users[Math.floor(Math.random() * users.length)];
        
        sales.push({
            id: `ORD-${saleTime.getTime()}-${i}`,
            timestamp: saleTime.getTime(),
            items,
            subtotal,
            paymentMethod: Math.random() > 0.3 ? 'Card' : 'Cash',
            cashierUsername: staffMember.username,
            cashierFullName: staffMember.fullName
        });
    }
    
    // 6. Generate Shift Logs (2 per day)
    const morningStaff = users[Math.floor(Math.random() * users.length)];
    const morningStart = new Date(d);
    morningStart.setHours(9, 0);
    const morningEnd = new Date(d);
    morningEnd.setHours(14, 0);
    
    shiftLogs.push({
        id: Date.now() + Math.random(),
        username: morningStaff.username,
        fullName: morningStaff.fullName,
        role: morningStaff.role,
        loginTime: morningStart.getTime(),
        logoutTime: morningEnd.getTime(),
        ordersProcessed: Math.floor(numSales / 2)
    });
    
    workShifts.push({
        id: `SHIFT-${d.getTime()}-1`,
        userId: morningStaff.id,
        username: morningStaff.username,
        fullName: morningStaff.fullName,
        date: d.toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '14:00',
        breakMinutes: 30,
        totalHours: 4.5
    });

    const afternoonStaff = users.filter(u => u.id !== morningStaff.id)[Math.floor(Math.random() * (users.length - 1))];
    const afternoonStart = new Date(d);
    afternoonStart.setHours(14, 0);
    const afternoonEnd = new Date(d);
    afternoonEnd.setHours(20, 0);
    
    shiftLogs.push({
        id: Date.now() + Math.random(),
        username: afternoonStaff.username,
        fullName: afternoonStaff.fullName,
        role: afternoonStaff.role,
        loginTime: afternoonStart.getTime(),
        logoutTime: afternoonEnd.getTime(),
        ordersProcessed: Math.ceil(numSales / 2)
    });
    
    workShifts.push({
        id: `SHIFT-${d.getTime()}-2`,
        userId: afternoonStaff.id,
        username: afternoonStaff.username,
        fullName: afternoonStaff.fullName,
        date: d.toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '20:00',
        breakMinutes: 30,
        totalHours: 5.5
    });
  }
  
  // 7. Generate Expenses
  for (let m = 0; m < 3; m++) {
    const rentDate = new Date(threeMonthsAgo);
    rentDate.setMonth(rentDate.getMonth() + m);
    rentDate.setDate(1);
    expenses.push({
        id: `EXP-RENT-${m}`,
        name: 'Monthly Rent',
        category: 'Rent',
        amount: 1200,
        date: rentDate.toISOString().split('T')[0],
        isRecurring: true,
        frequency: 'Monthly'
    });
    
    const utilDate = new Date(rentDate);
    utilDate.setDate(5);
    expenses.push({
        id: `EXP-UTIL-${m}`,
        name: 'Electricity & Water',
        category: 'Utilities',
        amount: 350,
        date: utilDate.toISOString().split('T')[0],
        isRecurring: true,
        frequency: 'Monthly'
    });
  }
  
  for (let w = 0; w < 12; w++) {
    const supplyDate = new Date(threeMonthsAgo);
    supplyDate.setDate(supplyDate.getDate() + (w * 7));
    expenses.push({
        id: `EXP-SUPP-${w}`,
        name: 'Weekly Ingredients Restock',
        category: 'Supplies',
        amount: 200 + Math.floor(Math.random() * 100),
        date: supplyDate.toISOString().split('T')[0],
        isRecurring: false
    });
  }

  return { sales, shiftLogs, workShifts, expenses, products, ingredients, preparedStock, users };
};