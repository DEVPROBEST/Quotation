/**
 * Analyst Quotation App Script - QNAP Product Database & Profit Margin Edition
 * Features:
 * - QNAP Database Product Catalog (Auto-fill Description & Cost Price) - Powered by Supabase Live Database
 * - Profit Margin (%) Input per item (Selling Price = Cost * (1 + Margin / 100))
 * - Strictly hides Cost & Margin % from customer A4 preview & print output
 * - Sticky bottom frame layout matching FP-SA-01-02 Rev.00
 * - Thai Baht text converter, custom logo uploader & resizer
 * - LocalStorage state persistence
 */

const LOCAL_STORAGE_KEY = 'analyst_quotation_state_v3';

// Supabase Live Stock System API Integration (Service Role Key for live access)
const SUPABASE_URL = "https://ewfnnsukiepnpkmjjyuy.supabase.co/rest/v1";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Zm5uc3VraWVwbnBrbWpqeXV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE3ODE1NywiZXhwIjoyMDg3NzU0MTU3fQ.Qpu_D7GAhLPZg6KZ9Yvxe1ONRKpmXHEVEWZcqpDhbvE";

let qnapProductDatabase = [
  { id: 'custom', name: '-- พิมพ์ระบุสินค้าเอง / Custom Item --', cost: 0, balance: null }
];

async function loadLiveStockDatabase() {
  try {
    const response = await fetch(`${SUPABASE_URL}/Stock?select=id,itemCode,itemName,unit,cost,balance,location&order=itemName.asc&limit=2000`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (response.ok) {
      const items = await response.json();
      const liveProducts = items.map(item => ({
        id: item.id,
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        name: `[${item.itemCode}] ${item.itemName}`,
        cost: Number(item.cost || 0),
        unit: item.unit || 'pcs',
        balance: Number(item.balance || 0),
        location: item.location || ''
      }));

      qnapProductDatabase = [
        { id: 'custom', name: '-- พิมพ์ระบุสินค้าเอง / Custom Item --', cost: 0, balance: null },
        ...liveProducts
      ];

      console.log(`Loaded ${liveProducts.length} live stock items into Quotation App Database.`);
      renderItemInputs();
      updateCalculations();
    }
  } catch (err) {
    console.warn("Could not fetch live stock database:", err);
  }
}

function getTodayFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear() + 543).slice(-2);
  return `${day}.${month}.${year}`;
}

const defaultData = {
  compName: "บริษัท อนาลิสต์ อินเตอร์เนชั่นแนล จำกัด / ANALYST INTERNATIONAL Co., Ltd.",
  compAddress: "36/46 ม.13 ต.บึงคำพร้อย อ.ลำลูกกา จ.ปทุมธานี 10150 / 36/46 Moo 13 BuengKhamPhroi, Lam Lukka, Phathum Thani 10150",
  compContact: "Tel. 02-150-0240 Fax. 02-150-0296 E-mail: dr.analyst.service@gmail.com",
  taxId: "0105555081871",

  quoteNo: "",
  quoteDate: getTodayFormatted(),
  contactPerson: "",
  custAttention: "",
  custAddress: "",
  custTel: "",
  custFax: "",
  jobTitle: "",
  items: [
    {
      productId: "custom",
      description: "",
      costPrice: 0,
      marginPercent: 0,
      qty: 1,
      price: 0
    }
  ],
  discountAmount: 0,
  calcVat: true,
  paymentTerms: "ชำระเงินมัดจำ จำนวน 30% หลังจากได้รับใบสั่งซื้อ ภายใน 7 วัน และชำระเงิน จำนวน 70% ก่อนจัดส่งสินค้า",
  notes: "- ราคาไม่รวมค่าขนส่ง                     - ระยะเวลารับประกัน 1 ปี\n- เงื่อนไขการทำงานอ้างอิง Requirement แรกที่ได้รับ (เพิ่มOption คอนโทรลระบบผ่าน Web browser)\n- จำนวน หน่วยนับคือ งาน",
  quotedBy: "",
  validDays: "หมายเหตุ : ราคานี้ตกลงตามเงื่อนไขภายใน 30 วัน"
};

function arabicToThaiBaht(number) {
  let num = parseFloat(number);
  if (isNaN(num) || num === 0) return "ศูนย์บาทถ้วน";

  const thaiNums = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiUnits = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  let [integerStr, fractionStr] = num.toFixed(2).split(".");

  function convertGroup(numStr) {
    let res = "";
    let len = numStr.length;
    for (let i = 0; i < len; i++) {
      let digit = parseInt(numStr[i]);
      let pos = len - 1 - i;
      if (digit !== 0) {
        if (pos === 1 && digit === 1) {
          res += "";
        } else if (pos === 1 && digit === 2) {
          res += "ยี่";
        } else if (pos === 0 && digit === 1 && len > 1) {
          res += "เอ็ด";
        } else {
          res += thaiNums[digit];
        }
        res += thaiUnits[pos];
      }
    }
    return res;
  }

  let intResult = "";
  let intStr = integerStr;
  let groupCount = 0;

  while (intStr.length > 0) {
    let group = intStr.slice(-6);
    intStr = intStr.slice(0, -6);
    let groupRes = convertGroup(group);
    if (groupRes !== "") {
      if (groupCount > 0) {
        intResult = groupRes + "ล้าน" + intResult;
      } else {
        intResult = groupRes;
      }
    }
    groupCount++;
  }

  let result = intResult + "บาท";

  if (fractionStr === "00") {
    result += "ถ้วน";
  } else {
    let fracRes = convertGroup(fractionStr);
    result += fracRes + "สตางค์";
  }

  return result;
}

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let appState = JSON.parse(JSON.stringify(defaultData));

const inputElements = {
  compName: document.getElementById('compName'),
  compAddress: document.getElementById('compAddress'),
  compContact: document.getElementById('compContact'),
  taxId: document.getElementById('taxId'),
  quoteNo: document.getElementById('quoteNo'),
  quoteDate: document.getElementById('quoteDate'),
  contactPerson: document.getElementById('contactPerson'),
  custAttention: document.getElementById('custAttention'),
  custAddress: document.getElementById('custAddress'),
  custTel: document.getElementById('custTel'),
  custFax: document.getElementById('custFax'),
  jobTitle: document.getElementById('jobTitle'),
  discountAmount: document.getElementById('discountAmount'),
  calcVat: document.getElementById('calcVat'),
  paymentTerms: document.getElementById('paymentTerms'),
  notes: document.getElementById('notes'),
  quotedBy: document.getElementById('quotedBy'),
  validDays: document.getElementById('validDays')
};

const viewElements = {
  viewCompName: document.getElementById('viewCompName'),
  viewCompAddress: document.getElementById('viewCompAddress'),
  viewCompContact: document.getElementById('viewCompContact'),
  viewTaxId: document.getElementById('viewTaxId'),
  viewQuoteNo: document.getElementById('viewQuoteNo'),
  viewDate: document.getElementById('viewDate'),
  viewContactPerson: document.getElementById('viewContactPerson'),
  viewAttention: document.getElementById('viewAttention'),
  viewAddress: document.getElementById('viewAddress'),
  viewTel: document.getElementById('viewTel'),
  viewFax: document.getElementById('viewFax'),
  viewJob: document.getElementById('viewJob'),
  viewPaymentTerms: document.getElementById('viewPaymentTerms'),
  viewNotes: document.getElementById('viewNotes'),
  viewSubtotal: document.getElementById('viewSubtotal'),
  viewDiscount: document.getElementById('viewDiscount'),
  viewAfterDiscount: document.getElementById('viewAfterDiscount'),
  viewVat: document.getElementById('viewVat'),
  viewGrandTotal: document.getElementById('viewGrandTotal'),
  viewBahtText: document.getElementById('viewBahtText'),
  viewQuotedByName: document.getElementById('viewQuotedByName'),
  viewValidDays: document.getElementById('viewValidDays'),
  viewItemsTable: document.getElementById('viewItemsTable'),
  itemsFormContainer: document.getElementById('itemsFormContainer'),
  viewCompanyLogo: document.getElementById('viewCompanyLogo'),
  logoUploader: document.getElementById('logoUploader'),
  btnResetLogo: document.getElementById('btnResetLogo'),
  logoSizeSlider: document.getElementById('logoSizeSlider'),
  logoSizeVal: document.getElementById('logoSizeVal')
};

async function init() {
  loadStateFromLocalStorage();
  loadInputsFromState();
  renderItemInputs();
  updateCalculations();
  setupEventListeners();
  
  await loadLiveStockDatabase();
}

function saveStateToLocalStorage() {
  try {
    const dataToSave = {
      ...appState,
      logoSrc: viewElements.viewCompanyLogo ? viewElements.viewCompanyLogo.src : 'logo.png',
      logoSize: viewElements.logoSizeSlider ? viewElements.logoSizeSlider.value : 65
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn("LocalStorage save error:", err);
  }
}

function loadStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed) {
        appState = {
          compName: parsed.compName || defaultData.compName,
          compAddress: parsed.compAddress || defaultData.compAddress,
          compContact: parsed.compContact || defaultData.compContact,
          taxId: parsed.taxId || defaultData.taxId,
          quoteNo: parsed.quoteNo !== undefined ? parsed.quoteNo : defaultData.quoteNo,
          quoteDate: parsed.quoteDate || defaultData.quoteDate,
          contactPerson: parsed.contactPerson !== undefined ? parsed.contactPerson : defaultData.contactPerson,
          custAttention: parsed.custAttention !== undefined ? parsed.custAttention : defaultData.custAttention,
          custAddress: parsed.custAddress !== undefined ? parsed.custAddress : defaultData.custAddress,
          custTel: parsed.custTel !== undefined ? parsed.custTel : defaultData.custTel,
          custFax: parsed.custFax !== undefined ? parsed.custFax : defaultData.custFax,
          jobTitle: parsed.jobTitle !== undefined ? parsed.jobTitle : defaultData.jobTitle,
          items: parsed.items && parsed.items.length ? parsed.items : defaultData.items,
          discountAmount: parsed.discountAmount !== undefined ? parsed.discountAmount : defaultData.discountAmount,
          calcVat: parsed.calcVat !== undefined ? parsed.calcVat : defaultData.calcVat,
          paymentTerms: parsed.paymentTerms || defaultData.paymentTerms,
          notes: parsed.notes || defaultData.notes,
          quotedBy: parsed.quotedBy !== undefined ? parsed.quotedBy : defaultData.quotedBy,
          validDays: parsed.validDays || defaultData.validDays
        };

        if (parsed.logoSrc && viewElements.viewCompanyLogo) {
          viewElements.viewCompanyLogo.src = parsed.logoSrc;
        }

        if (parsed.logoSize && viewElements.logoSizeSlider && viewElements.logoSizeVal) {
          viewElements.logoSizeSlider.value = parsed.logoSize;
          viewElements.logoSizeVal.textContent = parsed.logoSize + 'px';
          if (viewElements.viewCompanyLogo) {
            viewElements.viewCompanyLogo.style.maxHeight = parsed.logoSize + 'px';
            viewElements.viewCompanyLogo.style.maxWidth = (parseFloat(parsed.logoSize) * 1.8) + 'px';
          }
        }
      }
    }
  } catch (err) {
    console.warn("LocalStorage load error:", err);
  }
}

function loadInputsFromState() {
  if (inputElements.compName) inputElements.compName.value = appState.compName;
  if (inputElements.compAddress) inputElements.compAddress.value = appState.compAddress;
  if (inputElements.compContact) inputElements.compContact.value = appState.compContact;
  if (inputElements.taxId) inputElements.taxId.value = appState.taxId;
  inputElements.quoteNo.value = appState.quoteNo;
  inputElements.quoteDate.value = appState.quoteDate;
  inputElements.contactPerson.value = appState.contactPerson;
  inputElements.custAttention.value = appState.custAttention;
  inputElements.custAddress.value = appState.custAddress;
  inputElements.custTel.value = appState.custTel;
  inputElements.custFax.value = appState.custFax;
  inputElements.jobTitle.value = appState.jobTitle;
  inputElements.discountAmount.value = appState.discountAmount;
  inputElements.calcVat.checked = appState.calcVat;
  inputElements.paymentTerms.value = appState.paymentTerms;
  inputElements.notes.value = appState.notes;
  inputElements.quotedBy.value = appState.quotedBy;
  inputElements.validDays.value = appState.validDays;
}

function setupEventListeners() {
  Object.keys(inputElements).forEach(key => {
    if (!inputElements[key]) return;
    const eventType = (inputElements[key].type === 'checkbox') ? 'change' : 'input';
    inputElements[key].addEventListener(eventType, () => {
      syncStateFromInputs();
      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  if (viewElements.logoUploader) {
    viewElements.logoUploader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          viewElements.viewCompanyLogo.src = evt.target.result;
          saveStateToLocalStorage();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (viewElements.logoSizeSlider && viewElements.logoSizeVal) {
    viewElements.logoSizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      viewElements.logoSizeVal.textContent = size + 'px';
      if (viewElements.viewCompanyLogo) {
        viewElements.viewCompanyLogo.style.maxHeight = size + 'px';
        viewElements.viewCompanyLogo.style.maxWidth = (parseFloat(size) * 1.8) + 'px';
      }
      saveStateToLocalStorage();
    });
  }

  if (viewElements.btnResetLogo) {
    viewElements.btnResetLogo.addEventListener('click', () => {
      viewElements.viewCompanyLogo.src = 'logo.png';
      if (viewElements.logoUploader) viewElements.logoUploader.value = '';
      if (viewElements.logoSizeSlider) {
        viewElements.logoSizeSlider.value = 65;
        viewElements.logoSizeVal.textContent = '65px';
        viewElements.viewCompanyLogo.style.maxHeight = '65px';
        viewElements.viewCompanyLogo.style.maxWidth = '120px';
      }
      saveStateToLocalStorage();
    });
  }

  document.getElementById('btnAddItem').addEventListener('click', () => {
    appState.items.push({
      productId: "custom",
      description: "",
      costPrice: 0,
      marginPercent: 0,
      qty: 1,
      price: 0
    });
    renderItemInputs();
    updateCalculations();
    saveStateToLocalStorage();
  });

  function generatePDFTitle() {
    const originalTitle = document.title;
    const cleanQuoteNo = (appState.quoteNo || "QT-NO").trim().replace(/[/\\?%*:|"<>]/g, '_');
    const cleanDate = (appState.quoteDate || getTodayFormatted()).trim().replace(/[/\\?%*:|"<>]/g, '_');
    const cleanClient = (appState.custAttention || appState.contactPerson || "Customer").trim().replace(/[/\\?%*:|"<>]/g, '_');
    
    // Dynamic PDF filename format: [QuoteNo]_[Date]_[ClientName]
    const pdfFileName = `${cleanQuoteNo}_${cleanDate}_${cleanClient}`;
    document.title = pdfFileName;
    return originalTitle;
  }

  document.getElementById('btnPrint').addEventListener('click', () => {
    const prevTitle = generatePDFTitle();
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1500);
  });

  window.addEventListener('beforeprint', () => {
    generatePDFTitle();
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm("ต้องการล้างข้อมูลเพื่อเริ่มสร้างใบเสนอราคาใหม่หรือไม่?")) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      appState = JSON.parse(JSON.stringify(defaultData));
      loadInputsFromState();
      renderItemInputs();
      updateCalculations();
      if (viewElements.viewCompanyLogo) viewElements.viewCompanyLogo.src = 'logo.png';
      if (viewElements.logoUploader) viewElements.logoUploader.value = '';
      if (viewElements.logoSizeSlider) {
        viewElements.logoSizeSlider.value = 65;
        viewElements.logoSizeVal.textContent = '65px';
        viewElements.viewCompanyLogo.style.maxHeight = '65px';
        viewElements.viewCompanyLogo.style.maxWidth = '120px';
      }
    }
  });
}

function syncStateFromInputs() {
  appState.compName = inputElements.compName ? inputElements.compName.value : defaultData.compName;
  appState.compAddress = inputElements.compAddress ? inputElements.compAddress.value : defaultData.compAddress;
  appState.compContact = inputElements.compContact ? inputElements.compContact.value : defaultData.compContact;
  appState.taxId = inputElements.taxId ? inputElements.taxId.value : defaultData.taxId;

  appState.quoteNo = inputElements.quoteNo.value;
  appState.quoteDate = inputElements.quoteDate.value;
  appState.contactPerson = inputElements.contactPerson.value;
  appState.custAttention = inputElements.custAttention.value;
  appState.custAddress = inputElements.custAddress.value;
  appState.custTel = inputElements.custTel.value;
  appState.custFax = inputElements.custFax.value;
  appState.jobTitle = inputElements.jobTitle.value;
  appState.discountAmount = parseFloat(inputElements.discountAmount.value) || 0;
  appState.calcVat = inputElements.calcVat.checked;
  appState.paymentTerms = inputElements.paymentTerms.value;
  appState.notes = inputElements.notes.value;
  appState.quotedBy = inputElements.quotedBy.value;
  appState.validDays = inputElements.validDays.value;
}

function renderItemInputs() {
  viewElements.itemsFormContainer.innerHTML = "";
  appState.items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = "item-card";
    
    let qnapOptionsHTML = qnapProductDatabase.map(p => {
      const selected = (item.productId === p.id) ? 'selected' : '';
      if (p.id === 'custom') return `<option value="custom" ${selected}>${p.name}</option>`;
      const balanceStr = (p.balance !== null && p.balance !== undefined) ? ` (คงเหลือ: ${p.balance} ${p.unit || ''})` : '';
      const costStr = p.cost ? ` [ทุน ${formatCurrency(p.cost)} ฿]` : '';
      return `<option value="${p.id}" ${selected}>${p.name}${balanceStr}${costStr}</option>`;
    }).join('');

    card.innerHTML = `
      <div class="item-card-header">
        <span>รายการที่ ${idx + 1}</span>
        ${appState.items.length > 1 ? `<button type="button" class="btn-danger-sm btn-remove" data-idx="${idx}">ลบ</button>` : ''}
      </div>
      
      <div class="form-group" style="background: #e0f2fe; padding: 10px; border-radius: 6px; border: 1px solid #7dd3fc;">
        <label style="color: #0369a1; font-weight: 700; font-size: 0.85rem;">📦 พิมพ์ค้นหา หรือ เลือกสินค้าจากคลังสต็อก (Live Stock Data)</label>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
          <input list="stockList_${idx}" class="item-search-input form-control" data-idx="${idx}" placeholder="🔍 พิมพ์เพื่อค้นหารหัสสินค้า หรือ ชื่อสินค้า..." value="${item.productId && item.productId !== 'custom' ? (qnapProductDatabase.find(p => p.id === item.productId)?.name || '') : ''}">
          <datalist id="stockList_${idx}">
            ${qnapProductDatabase.map(p => `<option value="${p.name}">${p.name} (คงเหลือ: ${p.balance || 0} ${p.unit || ''}) [ทุน ${formatCurrency(p.cost)} ฿]</option>`).join('')}
          </datalist>
          <select class="item-qnap-select form-control" data-idx="${idx}">
            ${qnapOptionsHTML}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>รายละเอียดสินค้า/บริการ (Description)</label>
        <textarea rows="3" class="item-desc form-control" data-idx="${idx}" placeholder="ระบุรายละเอียดสินค้า/บริการ">${item.description || ''}</textarea>
      </div>

      <!-- Profit Margin & Pricing Calculator Controls -->
      <div style="background: #f1f5f9; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 4px 0;">
        <div style="font-weight: 700; font-size: 0.75rem; color: #334155; margin-bottom: 4px;">💰 คำนวณราคาทุนและกำไร (Margin Calculator)</div>
        <div class="form-grid">
          <div class="form-group">
            <label>ราคาทุน Cost (฿)</label>
            <input type="number" step="any" class="item-cost form-control" data-idx="${idx}" value="${item.costPrice !== undefined ? item.costPrice : (item.price || 0)}">
          </div>
          <div class="form-group">
            <label>บวกกำไร Margin (%)</label>
            <input type="number" step="any" class="item-margin form-control" data-idx="${idx}" value="${item.marginPercent || 0}" placeholder="เช่น 20">
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>จำนวน (Qty)</label>
          <input type="number" step="any" class="item-qty form-control" data-idx="${idx}" value="${item.qty !== undefined ? item.qty : 1}">
        </div>
        <div class="form-group">
          <label style="font-weight: 700; color: #15803d;">ราคาเสนอขาย Selling Price/Unit (฿)</label>
          <input type="number" step="any" class="item-price form-control" data-idx="${idx}" value="${item.price || 0}">
        </div>
      </div>
    `;
    viewElements.itemsFormContainer.appendChild(card);
  });

  function applyItemSelection(idx, found) {
    if (!found) return;
    if (found.id === 'custom') {
      appState.items[idx].productId = 'custom';
    } else {
      appState.items[idx].productId = found.id;
      appState.items[idx].description = found.name;
      appState.items[idx].costPrice = found.cost;
      const margin = appState.items[idx].marginPercent || 0;
      appState.items[idx].price = margin > 0 ? Math.round(found.cost * (1 + margin / 100)) : found.cost;
    }
    renderItemInputs();
    updateCalculations();
    saveStateToLocalStorage();
  }

  // Bind Type-to-Search Input
  document.querySelectorAll('.item-search-input').forEach(el => {
    const processSearch = (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      const val = e.target.value.trim();
      if (!val) return;
      const found = qnapProductDatabase.find(p => 
        p.name === val || 
        p.id === val || 
        (p.itemCode && p.itemCode.toLowerCase() === val.toLowerCase()) ||
        (p.name && p.name.toLowerCase().startsWith(val.toLowerCase()))
      );
      if (found) applyItemSelection(idx, found);
    };
    el.addEventListener('change', processSearch);
    el.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const exact = qnapProductDatabase.find(p => p.name === val);
      if (exact) processSearch(e);
    });
  });

  // Bind Dropdown Select
  document.querySelectorAll('.item-qnap-select').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      const prodId = e.target.value;
      const found = qnapProductDatabase.find(p => p.id === prodId);
      if (found) applyItemSelection(idx, found);
    });
  });

  // Bind Description Input
  document.querySelectorAll('.item-desc').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      appState.items[idx].description = e.target.value;
      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  // Bind Cost Price Input
  document.querySelectorAll('.item-cost').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      const cost = parseFloat(e.target.value) || 0;
      appState.items[idx].costPrice = cost;
      const margin = appState.items[idx].marginPercent || 0;
      appState.items[idx].price = margin > 0 ? Math.round(cost * (1 + margin / 100)) : cost;
      
      const priceInput = document.querySelector(`.item-price[data-idx="${idx}"]`);
      if (priceInput) priceInput.value = appState.items[idx].price;
      
      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  // Bind Profit Margin % Input
  document.querySelectorAll('.item-margin').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      const margin = parseFloat(e.target.value) || 0;
      appState.items[idx].marginPercent = margin;
      const cost = appState.items[idx].costPrice || 0;
      appState.items[idx].price = margin > 0 ? Math.round(cost * (1 + margin / 100)) : cost;
      
      const priceInput = document.querySelector(`.item-price[data-idx="${idx}"]`);
      if (priceInput) priceInput.value = appState.items[idx].price;

      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  // Bind Qty Input
  document.querySelectorAll('.item-qty').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      appState.items[idx].qty = parseFloat(e.target.value) || 0;
      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  // Bind Selling Price Input
  document.querySelectorAll('.item-price').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      appState.items[idx].price = parseFloat(e.target.value) || 0;
      updateCalculations();
      saveStateToLocalStorage();
    });
  });

  // Bind Remove Item Button
  document.querySelectorAll('.btn-remove').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      appState.items.splice(idx, 1);
      renderItemInputs();
      updateCalculations();
      saveStateToLocalStorage();
    });
  });
}

function updateCalculations() {
  if (inputElements.compName && viewElements.viewCompName) viewElements.viewCompName.textContent = appState.compName;
  if (inputElements.compAddress && viewElements.viewCompAddress) viewElements.viewCompAddress.textContent = appState.compAddress;
  if (inputElements.compContact && viewElements.viewCompContact) viewElements.viewCompContact.textContent = appState.compContact;
  if (inputElements.taxId && viewElements.viewTaxId) viewElements.viewTaxId.textContent = appState.taxId ? "เลขประจำตัวผู้เสียภาษี " + appState.taxId : "";

  viewElements.viewQuoteNo.textContent = appState.quoteNo || "QTXX/XXXX";
  viewElements.viewDate.textContent = appState.quoteDate || getTodayFormatted();
  viewElements.viewContactPerson.textContent = appState.contactPerson;
  viewElements.viewAttention.textContent = appState.custAttention;
  viewElements.viewAddress.textContent = appState.custAddress;
  viewElements.viewTel.textContent = appState.custTel;
  viewElements.viewFax.textContent = appState.custFax;
  viewElements.viewJob.textContent = appState.jobTitle;
  viewElements.viewPaymentTerms.textContent = appState.paymentTerms;
  viewElements.viewQuotedByName.textContent = appState.quotedBy;
  viewElements.viewValidDays.textContent = appState.validDays || "หมายเหตุ : ราคานี้ตกลงตามเงื่อนไขภายใน 30 วัน";

  viewElements.viewNotes.innerHTML = "";
  if (appState.notes) {
    const noteLines = appState.notes.split('\n');
    noteLines.forEach(line => {
      if (line.trim()) {
        const li = document.createElement('li');
        li.textContent = line;
        viewElements.viewNotes.appendChild(li);
      }
    });
  }

  let subtotal = 0;
  viewElements.viewItemsTable.innerHTML = "";

  const itemsCount = appState.items.length;
  const MIN_ROWS = 7;

  appState.items.forEach((item, index) => {
    const sellingPrice = item.price || 0;
    const lineAmount = item.qty * sellingPrice;
    subtotal += lineAmount;

    const tr = document.createElement('tr');
    tr.className = "align-top";
    tr.innerHTML = `
      <td class="text-center font-medium">${index + 1}</td>
      <td class="item-desc-cell">${item.description || '<span style="color:#cbd5e1;">(ระบุรายละเอียดสินค้า/บริการ)</span>'}</td>
      <td class="text-center">${item.qty || ''}</td>
      <td class="text-right">${sellingPrice ? formatCurrency(sellingPrice) : ''}</td>
      <td class="text-right font-medium">${lineAmount ? formatCurrency(lineAmount) : ''}</td>
    `;
    viewElements.viewItemsTable.appendChild(tr);
  });

// Empty filler rows removed as requested

  const discount = appState.discountAmount || 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const vat = appState.calcVat ? Math.round((afterDiscount * 0.07) * 100) / 100 : 0;
  let grandTotal = afterDiscount + vat;

  if (Math.abs(grandTotal - Math.round(grandTotal)) < 0.1) {
    grandTotal = Math.round(grandTotal);
  }

  viewElements.viewSubtotal.textContent = formatCurrency(subtotal);
  viewElements.viewDiscount.textContent = discount > 0 ? formatCurrency(discount) : "-";
  viewElements.viewAfterDiscount.textContent = formatCurrency(afterDiscount);
  viewElements.viewVat.textContent = formatCurrency(vat);
  viewElements.viewGrandTotal.textContent = formatCurrency(grandTotal);

  viewElements.viewBahtText.textContent = arabicToThaiBaht(grandTotal);
}

document.addEventListener('DOMContentLoaded', init);
