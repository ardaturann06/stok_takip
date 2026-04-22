// ===== STATE =====
const DB = {
  get(k) { try { return JSON.parse(localStorage.getItem('sp_' + k)) || null; } catch { return null; } },
  set(k, v) { localStorage.setItem('sp_' + k, JSON.stringify(v)); }
};

function loadData() {
  if (!DB.get('users')) {
    DB.set('users', [{ id: 1, fullName: 'Admin Kullanıcı', username: 'admin', password: 'admin123', role: 'admin' }]);
  }
  if (!DB.get('warehouses')) {
    DB.set('warehouses', [
      { id: 1, name: 'Merkez Depo', location: 'İstanbul', description: '' },
      { id: 2, name: 'Yedek Depo', location: 'Ankara', description: '' }
    ]);
  }
  if (!DB.get('products')) {
    DB.set('products', [
      { id: 1, name: 'Laptop', category: 'Elektronik', barcode: '8680001', unit: 'Adet', cost: 15000, sale: 22000, minStock: 5, vat: 18, description: '' },
      { id: 2, name: 'Klavye', category: 'Elektronik', barcode: '8680002', unit: 'Adet', cost: 300, sale: 550, minStock: 10, vat: 18, description: '' },
      { id: 3, name: 'Mouse', category: 'Elektronik', barcode: '8680003', unit: 'Adet', cost: 150, sale: 280, minStock: 10, vat: 18, description: '' },
      { id: 4, name: 'A4 Kağıt', category: 'Kırtasiye', barcode: '8680004', unit: 'Paket', cost: 80, sale: 120, minStock: 20, vat: 8, description: '' },
    ]);
  }
  if (!DB.get('movements')) {
    const today = new Date().toISOString().split('T')[0];
    DB.set('movements', [
      { id: 1, type: 'in',  productId: 1, warehouseId: 1, qty: 20, price: 15000, date: today, note: 'Açılış stoğu', userId: 1 },
      { id: 2, type: 'in',  productId: 2, warehouseId: 1, qty: 50, price: 300,   date: today, note: 'Açılış stoğu', userId: 1 },
      { id: 3, type: 'in',  productId: 3, warehouseId: 1, qty: 30, price: 150,   date: today, note: 'Açılış stoğu', userId: 1 },
      { id: 4, type: 'in',  productId: 4, warehouseId: 2, qty: 100, price: 80,   date: today, note: 'Açılış stoğu', userId: 1 },
      { id: 5, type: 'out', productId: 2, warehouseId: 1, qty: 5,  price: 550,   date: today, note: 'Satış',        userId: 1 },
      { id: 6, type: 'out', productId: 3, warehouseId: 1, qty: 25, price: 280,   date: today, note: 'Satış',        userId: 1 },
    ]);
  }
}

let currentUser = null;
let currentPage = 'dashboard';
let charts = {};
let confirmCallback = null;

// ===== HELPERS =====
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
function fmt(n) { return Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtN(n) { return Number(n || 0).toLocaleString('tr-TR'); }
function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function stockOf(productId, warehouseId) {
  const movements = DB.get('movements') || [];
  return movements
    .filter(m => m.productId === productId && (warehouseId == null || m.warehouseId === warehouseId))
    .reduce((acc, m) => acc + (m.type === 'in' ? m.qty : -m.qty), 0);
}

function allStocks() {
  const products = DB.get('products') || [];
  return products.map(p => ({ ...p, stock: stockOf(p.id) }));
}

function criticalProducts() {
  return allStocks().filter(p => p.stock <= p.minStock);
}

// ===== TOAST =====
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, 3000);
  el.classList.remove('hidden');
}

// ===== CONFIRM MODAL =====
function confirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  confirmCallback = cb;
  document.getElementById('confirmModal').classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    closeModal('confirmModal');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
});

// ===== MODAL =====
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function bgClose(e, id) { if (e.target.id === id) closeModal(id); }

// ===== SIDEBAR =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').style.display = 'block';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').style.display = 'none';
}

// ===== LOGIN =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    const users = DB.get('users') || [];
    const found = users.find(x => x.username === u && x.password === p);
    const errEl = document.getElementById('loginErr');
    if (!found) {
      errEl.textContent = 'Kullanıcı adı veya şifre hatalı.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    currentUser = found;
    DB.set('session', found.id);
    showApp();
  });

  const sid = DB.get('session');
  if (sid) {
    const users = DB.get('users') || [];
    const found = users.find(x => x.id === sid);
    if (found) { currentUser = found; showApp(); return; }
  }
});

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  const initials = currentUser.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  ['sAvatar', 'hAvatar'].forEach(id => document.getElementById(id).textContent = initials);
  document.getElementById('sName').textContent = currentUser.fullName;
  document.getElementById('sRole').textContent = currentUser.role === 'admin' ? 'Yönetici' : 'Kullanıcı';
  document.getElementById('hName').textContent = currentUser.fullName;

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? '' : 'none';
  });

  go('dashboard');
}

function logout() {
  DB.set('session', null);
  currentUser = null;
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

// ===== NAVIGATION =====
function go(page) {
  if (page === 'users' && currentUser.role !== 'admin') return;
  closeSidebar();
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const titles = { dashboard: 'Dashboard', products: 'Ürünler', movements: 'Stok Hareketleri', warehouses: 'Depolar', reports: 'Raporlar', users: 'Kullanıcılar' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
  charts = {};

  const content = document.getElementById('pageContent');
  switch (page) {
    case 'dashboard':   content.innerHTML = renderDashboard();   initDashboard();   break;
    case 'products':    content.innerHTML = renderProducts();    initProducts();    break;
    case 'movements':   content.innerHTML = renderMovements();   initMovements();   break;
    case 'warehouses':  content.innerHTML = renderWarehouses();  initWarehouses();  break;
    case 'reports':     content.innerHTML = renderReports();     initReports();     break;
    case 'users':       content.innerHTML = renderUsers();       initUsers();       break;
  }

  updateAlerts();
}

function updateAlerts() {
  const crit = criticalProducts();
  const badge = document.getElementById('alertBadge');
  const critAlert = document.getElementById('critAlert');
  const critCount = document.getElementById('critCount');
  if (crit.length > 0) {
    badge.textContent = crit.length;
    badge.classList.remove('hidden');
    critAlert.classList.remove('hidden');
    critCount.textContent = crit.length;
  } else {
    badge.classList.add('hidden');
    critAlert.classList.add('hidden');
  }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const stocks = allStocks();
  const movements = DB.get('movements') || [];
  const products = DB.get('products') || [];
  const warehouses = DB.get('warehouses') || [];
  const crit = criticalProducts();

  const totalProducts = products.length;
  const totalStock = stocks.reduce((a, p) => a + p.stock, 0);
  const totalValue = stocks.reduce((a, p) => a + p.stock * p.cost, 0);
  const totalWarehouses = warehouses.length;

  const recent = [...movements].reverse().slice(0, 8);

  const recentRows = recent.map(m => {
    const p = products.find(x => x.id === m.productId);
    const w = warehouses.find(x => x.id === m.warehouseId);
    return `<tr>
      <td><span class="tag ${m.type === 'in' ? 'tag-in' : 'tag-out'}">${m.type === 'in' ? '📥 Giriş' : '📤 Çıkış'}</span></td>
      <td>${escHtml(p?.name || '-')}</td>
      <td>${fmtN(m.qty)} ${escHtml(p?.unit || '')}</td>
      <td>${escHtml(w?.name || '-')}</td>
      <td class="text-muted">${m.date}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="text-muted" style="padding:20px;text-align:center">Henüz hareket yok</td></tr>';

  const critRows = crit.slice(0, 5).map(p => `
    <tr class="crit-row">
      <td>${escHtml(p.name)}</td>
      <td class="text-danger font-bold">${fmtN(p.stock)}</td>
      <td class="text-muted">${fmtN(p.minStock)}</td>
      <td>${escHtml(p.unit)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="text-muted" style="padding:20px;text-align:center">Kritik stok yok</td></tr>';

  return `
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-icon blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
        <div class="stat-val">${fmtN(totalProducts)}</div>
        <div class="stat-lbl">Toplam Ürün</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
        <div class="stat-val">${fmtN(totalStock)}</div>
        <div class="stat-lbl">Toplam Stok</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon yellow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="stat-val">₺${fmt(totalValue)}</div>
        <div class="stat-lbl">Stok Değeri</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div class="stat-val">${fmtN(crit.length)}</div>
        <div class="stat-lbl">Kritik Stok</div>
      </div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="card-head"><h3>Son Hareketler</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Tip</th><th>Ürün</th><th>Miktar</th><th>Depo</th><th>Tarih</th></tr></thead><tbody>${recentRows}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Kritik Stoklar</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Ürün</th><th>Stok</th><th>Min.</th><th>Birim</th></tr></thead><tbody>${critRows}</tbody></table></div>
      </div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="card-head"><h3>Stok Dağılımı (Ürün)</h3></div>
        <div class="chart-wrap"><canvas id="chartStock"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Son 7 Gün Hareketler</h3></div>
        <div class="chart-wrap"><canvas id="chartMov"></canvas></div>
      </div>
    </div>`;
}

function initDashboard() {
  const products = DB.get('products') || [];
  const movements = DB.get('movements') || [];
  const stocks = allStocks();

  // Stock bar chart
  const stockCtx = document.getElementById('chartStock');
  if (stockCtx) {
    charts.stock = new Chart(stockCtx, {
      type: 'bar',
      data: {
        labels: stocks.map(p => p.name),
        datasets: [{
          label: 'Stok',
          data: stocks.map(p => p.stock),
          backgroundColor: stocks.map(p => p.stock <= p.minStock ? 'rgba(239,68,68,0.7)' : 'rgba(99,102,241,0.7)'),
          borderRadius: 6,
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e2d4a' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#1e2d4a' } } } }
    });
  }

  // Last 7 days movement chart
  const movCtx = document.getElementById('chartMov');
  if (movCtx) {
    const days = [];
    const inData = [];
    const outData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      days.push(ds.slice(5));
      const dayMov = movements.filter(m => m.date === ds);
      inData.push(dayMov.filter(m => m.type === 'in').reduce((a, m) => a + m.qty, 0));
      outData.push(dayMov.filter(m => m.type === 'out').reduce((a, m) => a + m.qty, 0));
    }
    charts.mov = new Chart(movCtx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          { label: 'Giriş', data: inData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true },
          { label: 'Çıkış', data: outData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, fill: true }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e2d4a' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#1e2d4a' } } } }
    });
  }
}

// ===== PRODUCTS =====
let productSearch = '';
let productCatFilter = '';

function renderProducts() {
  const products = DB.get('products') || [];
  const cats = [...new Set(products.map(p => p.category))];
  const stocks = allStocks();

  const catOptions = cats.map(c => `<option value="${escHtml(c)}" ${productCatFilter === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  let filtered = stocks;
  if (productSearch) filtered = filtered.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.barcode || '').includes(productSearch) || p.category.toLowerCase().includes(productSearch.toLowerCase()));
  if (productCatFilter) filtered = filtered.filter(p => p.category === productCatFilter);

  const rows = filtered.map(p => {
    const stockClass = p.stock <= 0 ? 'text-danger' : p.stock <= p.minStock ? 'text-warning' : 'text-success';
    const stockTag = p.stock <= 0 ? '<span class="tag tag-out">Tükendi</span>' : p.stock <= p.minStock ? '<span class="tag tag-warn">Kritik</span>' : '<span class="tag tag-ok">Normal</span>';
    return `<tr>
      <td><strong>${escHtml(p.name)}</strong><br><span class="text-muted text-sm">${escHtml(p.barcode || '-')}</span></td>
      <td><span class="tag tag-info">${escHtml(p.category)}</span></td>
      <td class="${stockClass} font-bold">${fmtN(p.stock)} ${escHtml(p.unit)}</td>
      <td>${stockTag}</td>
      <td>₺${fmt(p.cost)}</td>
      <td>₺${fmt(p.sale)}</td>
      <td>
        <div class="flex gap-2 items-center">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="editProduct(${p.id})" title="Düzenle">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-icon btn-sm" onclick="deleteProduct(${p.id})" title="Sil">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="7"><div class="empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><p>Ürün bulunamadı</p></div></td></tr>';

  return `
    <div class="page-head">
      <h2>Ürünler</h2>
      <div class="page-head-actions">
        <button class="btn btn-primary" onclick="newProduct()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Ürün
        </button>
      </div>
    </div>
    <div class="search-bar">
      <div class="search-inp-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Ürün ara..." value="${escHtml(productSearch)}" id="productSearchInp" oninput="productSearch=this.value;go('products')">
      </div>
      <select class="filter-sel" onchange="productCatFilter=this.value;go('products')">
        <option value="">Tüm Kategoriler</option>
        ${catOptions}
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ürün</th><th>Kategori</th><th>Stok</th><th>Durum</th><th>Maliyet</th><th>Satış</th><th>İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function initProducts() {
  const products = DB.get('products') || [];
  const catList = document.getElementById('catList');
  if (catList) {
    const cats = [...new Set(products.map(p => p.category))];
    catList.innerHTML = cats.map(c => `<option value="${escHtml(c)}">`).join('');
  }
}

function newProduct() {
  document.getElementById('productModalTitle').textContent = 'Yeni Ürün';
  document.getElementById('productForm').reset();
  document.getElementById('pId').value = '';
  openModal('productModal');
}

function editProduct(id) {
  const products = DB.get('products') || [];
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'Ürünü Düzenle';
  document.getElementById('pId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pCat').value = p.category;
  document.getElementById('pBarcode').value = p.barcode || '';
  document.getElementById('pUnit').value = p.unit;
  document.getElementById('pCost').value = p.cost;
  document.getElementById('pSale').value = p.sale;
  document.getElementById('pMinStock').value = p.minStock;
  document.getElementById('pVat').value = p.vat;
  document.getElementById('pDesc').value = p.description || '';
  openModal('productModal');
}

function deleteProduct(id) {
  confirm('Bu ürünü silmek istediğinizden emin misiniz?', () => {
    let products = DB.get('products') || [];
    products = products.filter(p => p.id !== id);
    DB.set('products', products);
    toast('Ürün silindi', 'success');
    go('products');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('productForm').addEventListener('submit', e => {
    e.preventDefault();
    const products = DB.get('products') || [];
    const id = document.getElementById('pId').value;
    const data = {
      name: document.getElementById('pName').value.trim(),
      category: document.getElementById('pCat').value.trim(),
      barcode: document.getElementById('pBarcode').value.trim(),
      unit: document.getElementById('pUnit').value,
      cost: parseFloat(document.getElementById('pCost').value) || 0,
      sale: parseFloat(document.getElementById('pSale').value) || 0,
      minStock: parseInt(document.getElementById('pMinStock').value) || 0,
      vat: parseInt(document.getElementById('pVat').value) || 0,
      description: document.getElementById('pDesc').value.trim(),
    };
    if (id) {
      const idx = products.findIndex(p => p.id === parseInt(id));
      if (idx !== -1) products[idx] = { ...products[idx], ...data };
    } else {
      products.push({ id: nextId(products), ...data });
    }
    DB.set('products', products);
    closeModal('productModal');
    toast(id ? 'Ürün güncellendi' : 'Ürün eklendi', 'success');
    go('products');
  });
});

// ===== MOVEMENTS =====
let movSearch = '';
let movTypeFilter = '';

function renderMovements() {
  const movements = DB.get('movements') || [];
  const products = DB.get('products') || [];
  const warehouses = DB.get('warehouses') || [];

  let filtered = [...movements].reverse();
  if (movSearch) filtered = filtered.filter(m => {
    const p = products.find(x => x.id === m.productId);
    return (p?.name || '').toLowerCase().includes(movSearch.toLowerCase()) || (m.note || '').toLowerCase().includes(movSearch.toLowerCase());
  });
  if (movTypeFilter) filtered = filtered.filter(m => m.type === movTypeFilter);

  const rows = filtered.map(m => {
    const p = products.find(x => x.id === m.productId);
    const w = warehouses.find(x => x.id === m.warehouseId);
    return `<tr ${m.type === 'in' ? '' : ''}>
      <td><span class="tag ${m.type === 'in' ? 'tag-in' : 'tag-out'}">${m.type === 'in' ? '📥 Giriş' : '📤 Çıkış'}</span></td>
      <td><strong>${escHtml(p?.name || '-')}</strong></td>
      <td>${fmtN(m.qty)} ${escHtml(p?.unit || '')}</td>
      <td>₺${fmt(m.price || 0)}</td>
      <td>₺${fmt((m.price || 0) * m.qty)}</td>
      <td>${escHtml(w?.name || '-')}</td>
      <td>${m.date}</td>
      <td class="text-muted text-sm">${escHtml(m.note || '-')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8"><div class="empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg><p>Hareket bulunamadı</p></div></td></tr>';

  return `
    <div class="page-head">
      <h2>Stok Hareketleri</h2>
      <div class="page-head-actions">
        <button class="btn btn-success" onclick="newMovement('in')">📥 Stok Girişi</button>
        <button class="btn btn-danger" onclick="newMovement('out')">📤 Stok Çıkışı</button>
      </div>
    </div>
    <div class="search-bar">
      <div class="search-inp-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Ürün veya not ara..." value="${escHtml(movSearch)}" oninput="movSearch=this.value;go('movements')">
      </div>
      <select class="filter-sel" onchange="movTypeFilter=this.value;go('movements')">
        <option value="">Tüm Hareketler</option>
        <option value="in" ${movTypeFilter === 'in' ? 'selected' : ''}>📥 Giriş</option>
        <option value="out" ${movTypeFilter === 'out' ? 'selected' : ''}>📤 Çıkış</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tip</th><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>Toplam</th><th>Depo</th><th>Tarih</th><th>Not</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function initMovements() {}

function newMovement(type) {
  const products = DB.get('products') || [];
  const warehouses = DB.get('warehouses') || [];

  document.getElementById('movModalTitle').textContent = type === 'in' ? '📥 Stok Girişi' : '📤 Stok Çıkışı';
  document.getElementById('movementForm').reset();
  document.getElementById('mType').value = type;
  document.getElementById('mDate').value = new Date().toISOString().split('T')[0];

  const prodSel = document.getElementById('mProduct');
  prodSel.innerHTML = products.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  const whSel = document.getElementById('mWarehouse');
  whSel.innerHTML = warehouses.map(w => `<option value="${w.id}">${escHtml(w.name)}</option>`).join('');

  openModal('movementModal');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('movementForm').addEventListener('submit', e => {
    e.preventDefault();
    const movements = DB.get('movements') || [];
    const type = document.getElementById('mType').value;
    const productId = parseInt(document.getElementById('mProduct').value);
    const warehouseId = parseInt(document.getElementById('mWarehouse').value);
    const qty = parseInt(document.getElementById('mQty').value);
    const price = parseFloat(document.getElementById('mPrice').value) || 0;
    const date = document.getElementById('mDate').value;
    const note = document.getElementById('mNote').value.trim();

    if (type === 'out') {
      const current = stockOf(productId, warehouseId);
      if (qty > current) {
        toast(`Yetersiz stok! Mevcut: ${fmtN(current)}`, 'error');
        return;
      }
    }

    movements.push({ id: nextId(movements), type, productId, warehouseId, qty, price, date, note, userId: currentUser.id });
    DB.set('movements', movements);
    closeModal('movementModal');
    toast('Hareket kaydedildi', 'success');
    go('movements');
  });
});

// ===== WAREHOUSES =====
function renderWarehouses() {
  const warehouses = DB.get('warehouses') || [];
  const products = DB.get('products') || [];

  const cards = warehouses.map(w => {
    const productCount = products.length;
    const totalStock = products.reduce((a, p) => a + stockOf(p.id, w.id), 0);
    const totalValue = products.reduce((a, p) => a + stockOf(p.id, w.id) * p.cost, 0);
    return `
      <div class="card" style="position:relative">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="stat-icon blue" style="width:48px;height:48px;flex-shrink:0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style="font-size:16px;font-weight:700">${escHtml(w.name)}</div>
              <div class="text-muted text-sm">${escHtml(w.location || 'Lokasyon belirtilmedi')}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="editWarehouse(${w.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteWarehouse(${w.id})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div class="text-muted text-sm">Toplam Stok</div>
            <div style="font-size:22px;font-weight:800;color:var(--primary2)">${fmtN(totalStock)}</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div class="text-muted text-sm">Stok Değeri</div>
            <div style="font-size:22px;font-weight:800;color:var(--success)">₺${fmt(totalValue)}</div>
          </div>
        </div>
        ${w.description ? `<div class="text-muted text-sm" style="margin-top:12px">${escHtml(w.description)}</div>` : ''}
      </div>`;
  }).join('') || '<div class="empty"><p>Depo bulunamadı</p></div>';

  return `
    <div class="page-head">
      <h2>Depolar</h2>
      <div class="page-head-actions">
        <button class="btn btn-primary" onclick="newWarehouse()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Depo
        </button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">${cards}</div>`;
}

function initWarehouses() {}

function newWarehouse() {
  document.getElementById('whModalTitle').textContent = 'Yeni Depo';
  document.getElementById('warehouseForm').reset();
  document.getElementById('whId').value = '';
  openModal('warehouseModal');
}

function editWarehouse(id) {
  const warehouses = DB.get('warehouses') || [];
  const w = warehouses.find(x => x.id === id);
  if (!w) return;
  document.getElementById('whModalTitle').textContent = 'Depoyu Düzenle';
  document.getElementById('whId').value = w.id;
  document.getElementById('whName').value = w.name;
  document.getElementById('whLoc').value = w.location || '';
  document.getElementById('whDesc').value = w.description || '';
  openModal('warehouseModal');
}

function deleteWarehouse(id) {
  confirm('Bu depoyu silmek istediğinizden emin misiniz?', () => {
    let warehouses = DB.get('warehouses') || [];
    warehouses = warehouses.filter(w => w.id !== id);
    DB.set('warehouses', warehouses);
    toast('Depo silindi', 'success');
    go('warehouses');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('warehouseForm').addEventListener('submit', e => {
    e.preventDefault();
    const warehouses = DB.get('warehouses') || [];
    const id = document.getElementById('whId').value;
    const data = {
      name: document.getElementById('whName').value.trim(),
      location: document.getElementById('whLoc').value.trim(),
      description: document.getElementById('whDesc').value.trim(),
    };
    if (id) {
      const idx = warehouses.findIndex(w => w.id === parseInt(id));
      if (idx !== -1) warehouses[idx] = { ...warehouses[idx], ...data };
    } else {
      warehouses.push({ id: nextId(warehouses), ...data });
    }
    DB.set('warehouses', warehouses);
    closeModal('warehouseModal');
    toast(id ? 'Depo güncellendi' : 'Depo eklendi', 'success');
    go('warehouses');
  });
});

// ===== REPORTS =====
function renderReports() {
  const products = DB.get('products') || [];
  const movements = DB.get('movements') || [];
  const stocks = allStocks();

  const totalIn = movements.filter(m => m.type === 'in').reduce((a, m) => a + m.qty * (m.price || 0), 0);
  const totalOut = movements.filter(m => m.type === 'out').reduce((a, m) => a + m.qty * (m.price || 0), 0);
  const totalValue = stocks.reduce((a, p) => a + p.stock * p.cost, 0);

  return `
    <div class="page-head"><h2>Raporlar</h2></div>
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card green">
        <div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/></svg></div>
        <div class="stat-val">₺${fmt(totalIn)}</div>
        <div class="stat-lbl">Toplam Giriş Tutarı</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon red"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
        <div class="stat-val">₺${fmt(totalOut)}</div>
        <div class="stat-lbl">Toplam Çıkış Tutarı</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon yellow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="stat-val">₺${fmt(totalValue)}</div>
        <div class="stat-lbl">Mevcut Stok Değeri</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
        <div class="stat-val">${fmtN(criticalProducts().length)}</div>
        <div class="stat-lbl">Kritik Ürün Sayısı</div>
      </div>
    </div>
    <div class="report-grid">
      <div class="card">
        <div class="card-head"><h3>Kategoriye Göre Stok Değeri</h3></div>
        <div class="chart-wrap"><canvas id="chartCat"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Ürün Stok Durumu</h3></div>
        <div class="chart-wrap"><canvas id="chartPie"></canvas></div>
      </div>
      <div class="card" style="grid-column:1/-1">
        <div class="card-head"><h3>Ürün Bazlı Stok Raporu</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ürün</th><th>Kategori</th><th>Stok</th><th>Min. Stok</th><th>Maliyet/Birim</th><th>Stok Değeri</th><th>Durum</th></tr></thead>
            <tbody>
              ${stocks.map(p => `<tr>
                <td><strong>${escHtml(p.name)}</strong></td>
                <td>${escHtml(p.category)}</td>
                <td>${fmtN(p.stock)} ${escHtml(p.unit)}</td>
                <td>${fmtN(p.minStock)}</td>
                <td>₺${fmt(p.cost)}</td>
                <td>₺${fmt(p.stock * p.cost)}</td>
                <td>${p.stock <= 0 ? '<span class="tag tag-out">Tükendi</span>' : p.stock <= p.minStock ? '<span class="tag tag-warn">Kritik</span>' : '<span class="tag tag-ok">Normal</span>'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function initReports() {
  const products = DB.get('products') || [];
  const stocks = allStocks();

  // Category value chart
  const catCtx = document.getElementById('chartCat');
  if (catCtx) {
    const catMap = {};
    stocks.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + p.stock * p.cost; });
    const colors = ['rgba(99,102,241,.8)', 'rgba(16,185,129,.8)', 'rgba(245,158,11,.8)', 'rgba(239,68,68,.8)', 'rgba(56,189,248,.8)', 'rgba(167,139,250,.8)'];
    charts.cat = new Chart(catCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(catMap),
        datasets: [{ label: 'Değer (₺)', data: Object.values(catMap), backgroundColor: colors, borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e2d4a' } }, y: { ticks: { color: '#64748b', callback: v => '₺' + fmtN(v) }, grid: { color: '#1e2d4a' } } } }
    });
  }

  // Stock status pie
  const pieCtx = document.getElementById('chartPie');
  if (pieCtx) {
    const normal = stocks.filter(p => p.stock > p.minStock).length;
    const critical = stocks.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const empty = stocks.filter(p => p.stock <= 0).length;
    charts.pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Normal', 'Kritik', 'Tükendi'],
        datasets: [{ data: [normal, critical, empty], backgroundColor: ['rgba(16,185,129,.8)', 'rgba(245,158,11,.8)', 'rgba(239,68,68,.8)'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
    });
  }
}

// ===== USERS =====
function renderUsers() {
  if (currentUser.role !== 'admin') return '<div class="empty"><p>Bu sayfaya erişim yetkiniz yok.</p></div>';
  const users = DB.get('users') || [];

  const rows = users.map(u => `<tr>
    <td>
      <div class="flex gap-2 items-center">
        <div class="avatar sm">${u.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}</div>
        <strong>${escHtml(u.fullName)}</strong>
      </div>
    </td>
    <td class="text-muted">${escHtml(u.username)}</td>
    <td><span class="tag ${u.role === 'admin' ? 'tag-info' : 'tag-ok'}">${u.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</span></td>
    <td>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="editUser(${u.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${u.id !== currentUser.id ? `<button class="btn btn-danger btn-icon btn-sm" onclick="deleteUser(${u.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ''}
      </div>
    </td>
  </tr>`).join('');

  return `
    <div class="page-head">
      <h2>Kullanıcılar</h2>
      <div class="page-head-actions">
        <button class="btn btn-primary" onclick="newUser()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Kullanıcı
        </button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Rol</th><th>İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function initUsers() {}

function newUser() {
  document.getElementById('uModalTitle').textContent = 'Yeni Kullanıcı';
  document.getElementById('userForm').reset();
  document.getElementById('uId').value = '';
  document.getElementById('uPass').required = true;
  document.getElementById('uErr').classList.add('hidden');
  openModal('userModal');
}

function editUser(id) {
  const users = DB.get('users') || [];
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('uModalTitle').textContent = 'Kullanıcıyı Düzenle';
  document.getElementById('uId').value = u.id;
  document.getElementById('uFullName').value = u.fullName;
  document.getElementById('uUsername').value = u.username;
  document.getElementById('uPass').value = '';
  document.getElementById('uPass').required = false;
  document.getElementById('uRole').value = u.role;
  document.getElementById('uErr').classList.add('hidden');
  openModal('userModal');
}

function deleteUser(id) {
  confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?', () => {
    let users = DB.get('users') || [];
    users = users.filter(u => u.id !== id);
    DB.set('users', users);
    toast('Kullanıcı silindi', 'success');
    go('users');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('userForm').addEventListener('submit', e => {
    e.preventDefault();
    const users = DB.get('users') || [];
    const id = document.getElementById('uId').value;
    const username = document.getElementById('uUsername').value.trim();
    const fullName = document.getElementById('uFullName').value.trim();
    const pass = document.getElementById('uPass').value;
    const role = document.getElementById('uRole').value;
    const errEl = document.getElementById('uErr');

    const existing = users.find(u => u.username === username && u.id !== parseInt(id));
    if (existing) {
      errEl.textContent = 'Bu kullanıcı adı zaten kullanılıyor.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    if (id) {
      const idx = users.findIndex(u => u.id === parseInt(id));
      if (idx !== -1) {
        users[idx] = { ...users[idx], fullName, username, role };
        if (pass) users[idx].password = pass;
      }
    } else {
      users.push({ id: nextId(users), fullName, username, password: pass, role });
    }
    DB.set('users', users);
    closeModal('userModal');
    toast(id ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi', 'success');
    go('users');
  });
});
