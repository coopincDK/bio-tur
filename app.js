// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqrWR_-45N3ysJb19zNRgMG1EguBwOh-c",
  authDomain: "bio-tur.firebaseapp.com",
  databaseURL: "https://bio-tur-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bio-tur",
  storageBucket: "bio-tur.firebasestorage.app",
  messagingSenderId: "663464152840",
  appId: "1:663464152840:web:637d6a251e351c0709a6bd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== CONSTANTS =====
const DEFAULT_PERSONS = [
  "Martin M.", "Christian", "Dyari", "Freya", "Johanna",
  "Louise", "Lura", "Mathilde", "Nor", "Olivia",
  "Sara", "Savannah", "Tea", "Wesam", "William",
  "Malthe", "Thor", "Martin"
];

const BUILT_IN_CATEGORIES = [
  {
    id: 'drink', icon: '🥤', name: 'Drik',
    options: ['Cola','Sport','Sodavand','Juice Æble','Juice Appelsin','Juice Multi',
              'Slushice Rød','Slushice Blå','Slushice Blandet','Vand','Andet'],
    allowComment: true, allowCustom: true
  },
  {
    id: 'snack', icon: '🍿', name: 'Snack',
    options: ['Popcorn','Baconchips','Blandet','Andet'],
    allowComment: true, allowCustom: true
  }
];

// ===== STATE =====
let state = {
  persons: [],
  orders: {},       // keyed by sanitized name
  categories: [],   // custom categories from Firebase
  customOptions: {}, // { catId: [val, val] }
  selectedPerson: null,
  isPersonView: false,
  personViewName: null
};

// ===== URL ROUTING =====
const urlParams = new URLSearchParams(window.location.search);
const personParam = urlParams.get('person');

if (personParam) {
  // Deltager view
  state.isPersonView = true;
  state.personViewName = decodeURIComponent(personParam);
  document.getElementById('tabNav').classList.add('hidden');
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('personView').classList.remove('hidden');
  document.getElementById('headerTitle').textContent = state.personViewName;
  document.getElementById('headerSub').textContent = 'Din bestilling';
}

// ===== FIREBASE KEY =====
function fbKey(name) {
  return name.replace(/[.#$[\]/]/g, '_');
}

// ===== SYNC INDICATOR =====
function setSync(status) {
  const dot = document.querySelector('.sync-dot');
  const ind = document.getElementById('syncIndicator');
  if (!dot) return;
  dot.className = 'sync-dot ' + status;
  ind.title = status === 'online' ? '🟢 Forbundet' : status === 'saving' ? '🟡 Gemmer...' : '🔴 Offline';
}

// ===== INIT FIREBASE =====
function initFirebase() {
  onValue(ref(db, '.info/connected'), snap => setSync(snap.val() ? 'online' : 'offline'));

  onValue(ref(db, 'persons'), snap => {
    const val = snap.val();
    if (val) { state.persons = val; }
    else { set(ref(db, 'persons'), DEFAULT_PERSONS); state.persons = [...DEFAULT_PERSONS]; }
    if (!state.isPersonView) renderPersonGrid();
    if (!state.isPersonView) renderPersonList();
  });

  onValue(ref(db, 'orders'), snap => {
    state.orders = snap.val() || {};
    if (!state.isPersonView) {
      renderPersonGrid();
      if (document.getElementById('tab-oversigt').classList.contains('active')) renderOversigt();
      if (state.selectedPerson) refreshOrderFormLockState();
    } else {
      renderPersonView();
    }
  });

  onValue(ref(db, 'categories'), snap => {
    state.categories = snap.val() || [];
    if (!state.isPersonView) {
      renderCategoryList();
      if (state.selectedPerson) renderOrderCards(state.selectedPerson, false);
    } else {
      renderPersonView();
    }
  });

  onValue(ref(db, 'customOptions'), snap => {
    state.customOptions = snap.val() || {};
    if (!state.isPersonView && state.selectedPerson) renderOrderCards(state.selectedPerson, false);
    else if (state.isPersonView) renderPersonView();
  });
}

// ===== TABS =====
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes("'" + tab + "'")) btn.classList.add('active');
  });
  if (tab === 'oversigt') renderOversigt();
  if (tab === 'deltagere') renderPersonList();
  if (tab === 'kategorier') renderCategoryList();
}
window.showTab = showTab;

// ===== PERSON GRID (admin) =====
function renderPersonGrid() {
  const grid = document.getElementById('personGrid');
  if (!grid) return;
  grid.innerHTML = '';
  state.persons.forEach(name => {
    const order = getOrder(name);
    const chip = document.createElement('button');
    chip.className = 'person-chip' +
      (order ? ' has-order' : '') +
      (order?.locked ? ' is-locked' : '') +
      (state.selectedPerson === name ? ' active' : '');
    chip.textContent = name + (order?.locked ? ' 🔒' : '');
    chip.onclick = () => selectPerson(name);
    grid.appendChild(chip);
  });
}

function selectPerson(name) {
  state.selectedPerson = name;
  renderPersonGrid();
  document.getElementById('orderForm').classList.remove('hidden');
  document.getElementById('noPersonMsg').style.display = 'none';
  document.getElementById('selectedPersonName').textContent = name;
  renderOrderCards(name, false);
  refreshOrderFormLockState();
}

function refreshOrderFormLockState() {
  if (!state.selectedPerson) return;
  const order = getOrder(state.selectedPerson);
  const locked = order?.locked;
  const lockedMsg = document.getElementById('adminLockedMsg');
  const saveBtns = document.getElementById('adminSaveBtns');
  if (locked) {
    lockedMsg.classList.remove('hidden');
    saveBtns.classList.add('hidden');
  } else {
    lockedMsg.classList.add('hidden');
    saveBtns.classList.remove('hidden');
  }
}

// ===== ORDER CARDS (shared between admin + person view) =====
function getAllCategories() {
  return [...BUILT_IN_CATEGORIES, ...state.categories];
}

function renderOrderCards(name, isPersonView) {
  const container = isPersonView
    ? document.getElementById('personViewContent')
    : document.getElementById('dynamicOrderCards');
  if (!container) return;

  const order = getOrder(name) || {};
  const locked = order.locked && isPersonView; // only lock UI in person view

  container.innerHTML = '';

  getAllCategories().forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card';

    const customOpts = state.customOptions[cat.id] || [];
    const allOptions = [...cat.options, ...customOpts];
    const currentVal = order[cat.id] || '';
    const currentComment = order[cat.id + '_comment'] || '';

    let optionsHtml = allOptions.map(opt => `
      <label class="option-card ${opt === currentVal ? 'selected' : ''} ${locked ? 'disabled' : ''}">
        <input type="radio" name="cat_${cat.id}" value="${escHtml(opt)}" ${opt === currentVal ? 'checked' : ''} ${locked ? 'disabled' : ''} />
        <span class="option-icon">${optionIcon(cat.id, opt)}</span>
        <span class="option-label">${escHtml(opt)}</span>
      </label>
    `).join('');

    const commentHtml = cat.allowComment ? `
      <input type="text" class="comment-input cat-comment" data-cat="${cat.id}"
        placeholder="💬 Kommentar..." value="${escHtml(currentComment)}"
        ${locked ? 'disabled' : ''} />
    ` : '';

    const createHtml = cat.allowCustom && !locked ? `
      <div class="create-option-btn hidden" id="createBtn_${cat.id}">
        <button class="create-btn" onclick="createCustomOption('${cat.id}')">✨ Opret som fast valg & gem</button>
      </div>
    ` : '';

    card.innerHTML = `
      <h2 class="card-title">${cat.icon} ${escHtml(cat.name)}</h2>
      <div class="options-grid ${cat.id === 'drink' ? 'drink-grid' : ''}" id="grid_${cat.id}">${optionsHtml}</div>
      ${commentHtml}
      ${createHtml}
    `;

    container.appendChild(card);
  });

  // Attach radio listeners
  container.querySelectorAll('input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => {
      const catId = r.name.replace('cat_', '');
      container.querySelectorAll(`input[name="cat_${catId}"]`).forEach(radio => {
        radio.closest('.option-card').classList.toggle('selected', radio.checked);
      });
      checkCreateBtn(catId, container);
    });
  });

  // Comment input listeners
  container.querySelectorAll('.cat-comment').forEach(input => {
    input.addEventListener('input', () => {
      checkCreateBtn(input.dataset.cat, container);
    });
  });
}

function checkCreateBtn(catId, container) {
  const btn = container.querySelector(`#createBtn_${catId}`);
  if (!btn) return;
  const selected = container.querySelector(`input[name="cat_${catId}"]:checked`);
  const comment = container.querySelector(`.cat-comment[data-cat="${catId}"]`);
  const isAndet = selected?.value === 'Andet';
  const hasText = comment?.value.trim().length > 0;
  btn.classList.toggle('hidden', !(isAndet && hasText));
}

function optionIcon(catId, value) {
  const icons = {
    'Cola':'🥤','Sport':'⚡','Sodavand':'🫧','Juice Æble':'🍎','Juice Appelsin':'🍊',
    'Juice Multi':'🍹','Slushice Rød':'🔴','Slushice Blå':'🔵','Slushice Blandet':'🌈',
    'Vand':'💧','Andet':'❓','Popcorn':'🍿','Baconchips':'🥓','Blandet':'🎉'
  };
  return icons[value] || '✨';
}

// ===== COLLECT ORDER DATA =====
function collectOrderData(container) {
  const data = {};
  getAllCategories().forEach(cat => {
    const checked = container.querySelector(`input[name="cat_${cat.id}"]:checked`);
    const comment = container.querySelector(`.cat-comment[data-cat="${cat.id}"]`);
    if (checked) data[cat.id] = checked.value;
    if (comment) data[cat.id + '_comment'] = comment.value.trim();
  });
  return data;
}

// ===== SAVE ORDER (admin) =====
async function saveOrder() {
  if (!state.selectedPerson) return;
  const container = document.getElementById('dynamicOrderCards');
  const data = collectOrderData(container);
  const hasAny = getAllCategories().some(cat => data[cat.id]);
  if (!hasAny) { showToast('⚠️ Vælg mindst ét valg', 'error'); return; }

  setSync('saving');
  const key = fbKey(state.selectedPerson);
  await set(ref(db, 'orders/' + key), { ...data, _name: state.selectedPerson, locked: false });
  showToast('✅ Gemt for ' + state.selectedPerson, 'success');
}
window.saveOrder = saveOrder;

async function clearOrder() {
  if (!state.selectedPerson) return;
  if (!confirm(`Ryd bestilling for ${state.selectedPerson}?`)) return;
  setSync('saving');
  await remove(ref(db, 'orders/' + fbKey(state.selectedPerson)));
  renderOrderCards(state.selectedPerson, false);
  refreshOrderFormLockState();
  showToast('🗑️ Bestilling ryddet', '');
}
window.clearOrder = clearOrder;

async function adminUnlock() {
  if (!state.selectedPerson) return;
  const key = fbKey(state.selectedPerson);
  const order = getOrder(state.selectedPerson);
  if (!order) return;
  setSync('saving');
  await set(ref(db, 'orders/' + key), { ...order, locked: false });
  showToast('🔓 Låst op for ' + state.selectedPerson, 'success');
}
window.adminUnlock = adminUnlock;

// ===== PERSON VIEW =====
let personViewRendered = false;

function renderPersonView() {
  const name = state.personViewName;
  if (!name) return;

  const container = document.getElementById('personViewContent');
  const order = getOrder(name);
  const locked = order?.locked;

  if (locked && personViewRendered) return; // don't re-render if already locked

  container.innerHTML = '';

  if (locked) {
    personViewRendered = true;
    container.innerHTML = `
      <div class="locked-success-card">
        <div class="locked-success-icon">✅</div>
        <h2>Bestilling modtaget!</h2>
        <p>Din bestilling er gemt og låst.<br>Kontakt Martin hvis du vil ændre noget.</p>
        <div class="locked-summary">
          ${buildPersonSummaryHtml(name)}
        </div>
      </div>
    `;
    return;
  }

  personViewRendered = false;

  // Render order cards
  renderOrderCards(name, true);

  // Add save button
  const saveWrap = document.createElement('div');
  saveWrap.innerHTML = `
    <button class="save-btn person-save-btn" onclick="savePersonOrder()">
      ✅ Gem & lås min bestilling
    </button>
    <p class="save-warning">Når du gemmer kan du ikke ændre det selv bagefter.</p>
  `;
  container.appendChild(saveWrap);
}

function buildPersonSummaryHtml(name) {
  const order = getOrder(name) || {};
  return getAllCategories().map(cat => {
    const val = order[cat.id];
    const comment = order[cat.id + '_comment'];
    if (!val) return '';
    return `<div class="locked-summary-row">
      <span>${cat.icon} ${escHtml(cat.name)}:</span>
      <strong>${escHtml(val)}${comment ? ' — ' + escHtml(comment) : ''}</strong>
    </div>`;
  }).join('');
}

async function savePersonOrder() {
  const name = state.personViewName;
  const container = document.getElementById('personViewContent');
  const data = collectOrderData(container);
  const hasAny = getAllCategories().some(cat => data[cat.id]);
  if (!hasAny) { showToast('⚠️ Vælg mindst ét valg', 'error'); return; }

  setSync('saving');
  const key = fbKey(name);
  await set(ref(db, 'orders/' + key), { ...data, _name: name, locked: true });
  showToast('✅ Bestilling gemt!', 'success');
  // Firebase listener will re-render as locked
}
window.savePersonOrder = savePersonOrder;

// ===== CUSTOM OPTIONS =====
async function createCustomOption(catId) {
  const container = state.isPersonView
    ? document.getElementById('personViewContent')
    : document.getElementById('dynamicOrderCards');
  const comment = container.querySelector(`.cat-comment[data-cat="${catId}"]`);
  const newVal = comment?.value.trim();
  if (!newVal) return;

  const existing = [...container.querySelectorAll(`input[name="cat_${catId}"]`)].map(r => r.value);
  if (existing.includes(newVal)) { showToast('⚠️ Findes allerede', 'error'); return; }

  setSync('saving');
  const updated = [...(state.customOptions[catId] || []), newVal];
  await set(ref(db, 'customOptions/' + catId), updated);
  showToast('✨ "' + newVal + '" tilføjet', 'success');
}
window.createCustomOption = createCustomOption;

// ===== CATEGORIES (admin) =====
async function addCategory() {
  const icon = document.getElementById('newCatIcon').value.trim() || '🏷️';
  const name = document.getElementById('newCatName').value.trim();
  if (!name) { showToast('⚠️ Skriv et navn', 'error'); return; }

  const id = 'cat_' + Date.now();
  const newCat = { id, icon, name, options: [], allowComment: true, allowCustom: true };
  const updated = [...state.categories, newCat];
  setSync('saving');
  await set(ref(db, 'categories'), updated);

  document.getElementById('newCatIcon').value = '';
  document.getElementById('newCatName').value = '';
  showToast('✅ Kategori oprettet', 'success');
}
window.addCategory = addCategory;

async function addCategoryOption(catId) {
  const input = document.getElementById('catOptInput_' + catId);
  const val = input?.value.trim();
  if (!val) return;

  const updated = state.categories.map(c => {
    if (c.id !== catId) return c;
    return { ...c, options: [...(c.options || []), val] };
  });
  setSync('saving');
  await set(ref(db, 'categories'), updated);
  input.value = '';
}
window.addCategoryOption = addCategoryOption;

async function deleteCategoryOption(catId, optIdx) {
  const updated = state.categories.map(c => {
    if (c.id !== catId) return c;
    const opts = [...(c.options || [])];
    opts.splice(optIdx, 1);
    return { ...c, options: opts };
  });
  setSync('saving');
  await set(ref(db, 'categories'), updated);
}
window.deleteCategoryOption = deleteCategoryOption;

async function deleteCategory(catId) {
  if (!confirm('Slet denne kategori?')) return;
  const updated = state.categories.filter(c => c.id !== catId);
  setSync('saving');
  await set(ref(db, 'categories'), updated);
}
window.deleteCategory = deleteCategory;

function renderCategoryList() {
  const container = document.getElementById('categoryList');
  if (!container) return;
  container.innerHTML = '';

  if (state.categories.length === 0) {
    container.innerHTML = '<div class="no-person-msg">Ingen ekstra kategorier endnu. Opret en ovenfor.</div>';
    return;
  }

  state.categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card cat-admin-card';
    const opts = (cat.options || []).map((opt, i) => `
      <div class="cat-opt-row">
        <span>${escHtml(opt)}</span>
        <button class="delete-btn" onclick="deleteCategoryOption('${cat.id}', ${i})">✕</button>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="cat-admin-header">
        <span class="cat-admin-title">${cat.icon} ${escHtml(cat.name)}</span>
        <button class="delete-btn" onclick="deleteCategory('${cat.id}')">🗑️ Slet kategori</button>
      </div>
      <div class="cat-opts-list">${opts || '<span style="color:var(--text-dim);font-size:0.85rem">Ingen valg endnu</span>'}</div>
      <div class="add-person-row" style="margin-top:10px">
        <input type="text" id="catOptInput_${cat.id}" class="comment-input" placeholder="Tilføj valg..." onkeydown="if(event.key==='Enter') addCategoryOption('${cat.id}')" />
        <button class="add-btn" onclick="addCategoryOption('${cat.id}')">Tilføj</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ===== OVERSIGT =====
function getOrder(name) {
  return state.orders[fbKey(name)] || null;
}

function renderOversigt() {
  renderSummaryCards();
  renderTotals();
  renderMissing();
}

function renderSummaryCards() {
  const container = document.getElementById('summaryCards');
  if (!container) return;
  container.innerHTML = '';

  state.persons.forEach(name => {
    const order = getOrder(name);
    const card = document.createElement('div');
    card.className = 'summary-card' + (order ? '' : ' no-order');

    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const locked = order?.locked;

    let tagsHtml = '';
    if (order) {
      getAllCategories().forEach(cat => {
        const val = order[cat.id];
        const comment = order[cat.id + '_comment'];
        if (val) tagsHtml += `<span class="summary-tag cat-${cat.id}">${cat.icon} ${escHtml(val)}</span>`;
        if (comment) tagsHtml += `<span class="summary-tag comment">💬 ${escHtml(comment)}</span>`;
      });
    }

    card.innerHTML = `
      <div class="summary-avatar">${initials}</div>
      <div class="summary-info">
        <div class="summary-name">
          ${escHtml(name)}
          ${locked ? '<span class="lock-badge">🔒</span>' : ''}
        </div>
        ${order
          ? `<div class="summary-items">${tagsHtml}</div>`
          : `<div class="summary-no-order">Ingen bestilling endnu</div>`
        }
      </div>
      <div class="summary-actions">
        ${locked ? `<button class="unlock-btn" title="Lås op" onclick="adminUnlockFor('${escHtml(name)}')">🔓</button>` : ''}
        <button class="summary-edit-btn" title="Rediger">✏️</button>
      </div>
    `;
    card.querySelector('.summary-edit-btn').addEventListener('click', () => {
      showTab('bestil'); selectPerson(name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    container.appendChild(card);
  });
}

async function adminUnlockFor(name) {
  const order = getOrder(name);
  if (!order) return;
  setSync('saving');
  await set(ref(db, 'orders/' + fbKey(name)), { ...order, locked: false });
  showToast('🔓 Låst op for ' + name, 'success');
}
window.adminUnlockFor = adminUnlockFor;

function renderTotals() {
  const grid = document.getElementById('totalsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const counts = {};
  state.persons.forEach(name => {
    const o = getOrder(name);
    if (!o) return;
    getAllCategories().forEach(cat => {
      if (o[cat.id]) {
        const key = cat.icon + ' ' + o[cat.id];
        counts[key] = (counts[key] || 0) + 1;
      }
    });
  });

  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (items.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem">Ingen bestillinger endnu</div>';
    return;
  }
  items.forEach(([label, count]) => {
    const row = document.createElement('div');
    row.className = 'total-row';
    row.innerHTML = `<span>${label}</span><span class="count">${count}</span>`;
    grid.appendChild(row);
  });
}

function renderMissing() {
  const list = document.getElementById('missingList');
  if (!list) return;
  list.innerHTML = '';
  const missing = state.persons.filter(p => !getOrder(p));
  if (missing.length === 0) {
    list.innerHTML = '<span style="color:var(--success);font-weight:600">✅ Alle har bestilt!</span>';
    return;
  }
  missing.forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'missing-chip';
    chip.textContent = name;
    list.appendChild(chip);
  });
}

// ===== DELTAGERE =====
function renderPersonList() {
  const list = document.getElementById('personList');
  if (!list) return;
  list.innerHTML = '';

  state.persons.forEach((name, idx) => {
    const li = document.createElement('li');
    li.className = 'person-list-item';
    const hasOrder = !!getOrder(name);
    const locked = getOrder(name)?.locked;

    li.innerHTML = `
      <span class="person-list-name">
        ${hasOrder ? `<span class="person-has-order-dot ${locked ? 'locked' : ''}" title="${locked ? 'Låst' : 'Har bestilt'}"></span>` : ''}
        ${escHtml(name)}
      </span>
      <div class="person-list-actions">
        <button class="qr-btn" title="Vis QR kode">📱 QR</button>
        <button class="delete-btn">🗑️</button>
      </div>
    `;
    li.querySelector('.qr-btn').addEventListener('click', () => showQr(name));
    li.querySelector('.delete-btn').addEventListener('click', () => deletePerson(idx));
    list.appendChild(li);
  });
}

async function addPerson() {
  const input = document.getElementById('newPersonInput');
  const name = input.value.trim();
  if (!name) { showToast('⚠️ Skriv et navn', 'error'); return; }
  if (state.persons.includes(name)) { showToast('⚠️ Findes allerede', 'error'); return; }
  setSync('saving');
  await set(ref(db, 'persons'), [...state.persons, name]);
  input.value = '';
  showToast('✅ ' + name + ' tilføjet', 'success');
}
window.addPerson = addPerson;

async function deletePerson(idx) {
  const name = state.persons[idx];
  if (!confirm(`Slet "${name}"? Bestilling slettes også.`)) return;
  setSync('saving');
  const updated = [...state.persons];
  updated.splice(idx, 1);
  await set(ref(db, 'persons'), updated);
  await remove(ref(db, 'orders/' + fbKey(name)));
  if (state.selectedPerson === name) {
    state.selectedPerson = null;
    document.getElementById('orderForm').classList.add('hidden');
    document.getElementById('noPersonMsg').style.display = '';
  }
  showToast('🗑️ ' + name + ' slettet', '');
}

// ===== QR CODE =====
let currentQrLink = '';

function getPersonLink(name) {
  const base = window.location.href.split('?')[0];
  return base + '?person=' + encodeURIComponent(name);
}

function showQr(name) {
  const link = getPersonLink(name);
  currentQrLink = link;

  document.getElementById('qrModalTitle').textContent = '📱 ' + name;
  document.getElementById('qrModalSubtitle').textContent = 'Scan for at bestille';
  document.getElementById('qrLinkBox').textContent = link;

  const canvas = document.getElementById('qrCanvas');
  canvas.innerHTML = '';
  const canvasEl = document.createElement('canvas');
  canvas.appendChild(canvasEl);

  // Use QRCode library
  QRCode.toCanvas(canvasEl, link, {
    width: 220,
    margin: 2,
    color: { dark: '#1a1f2e', light: '#ffffff' }
  }, err => {
    if (err) canvas.innerHTML = '<p style="color:red">Fejl ved QR generering</p>';
  });

  document.getElementById('qrModalOverlay').classList.remove('hidden');
}
window.showQr = showQr;

function closeQrModal(e) {
  if (!e || e.target === document.getElementById('qrModalOverlay')) {
    document.getElementById('qrModalOverlay').classList.add('hidden');
  }
}
window.closeQrModal = closeQrModal;

async function copyQrLink() {
  try {
    await navigator.clipboard.writeText(currentQrLink);
    showToast('✅ Link kopieret!', 'success');
  } catch {
    showToast('⚠️ Kunne ikke kopiere', 'error');
  }
  closeQrModal();
}
window.copyQrLink = copyQrLink;

// ===== SEND MODAL =====
function buildMessage() {
  const counts = {};
  const comments = [];
  const missing = [];

  state.persons.forEach(name => {
    const o = getOrder(name);
    if (!o) { missing.push(name); return; }
    getAllCategories().forEach(cat => {
      if (o[cat.id]) {
        const key = cat.icon + ' ' + o[cat.id];
        counts[key] = (counts[key] || 0) + 1;
      }
      if (o[cat.id + '_comment']) comments.push(`${name}: ${o[cat.id + '_comment']} (${cat.name})`);
    });
  });

  const ordered = state.persons.filter(p => getOrder(p));
  let msg = '🎬 BIO TUR BESTILLING\n━━━━━━━━━━━━━━━━━━━━\n\n';

  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (items.length === 0) {
    msg += 'Ingen bestillinger endnu\n';
  } else {
    items.forEach(([label, count]) => { msg += `  ${count}x ${label}\n`; });
  }

  if (comments.length > 0) {
    msg += '\n💬 KOMMENTARER\n';
    comments.forEach(c => { msg += `  • ${c}\n`; });
  }

  msg += `\n✅ Bestilt: ${ordered.length}/${state.persons.length}`;
  if (missing.length > 0) msg += `\n⏳ Mangler: ${missing.join(', ')}`;
  return msg;
}

function openSendModal() {
  document.getElementById('sendMessageBox').textContent = buildMessage();
  document.getElementById('sendModalOverlay').classList.remove('hidden');
}
window.openSendModal = openSendModal;

function closeSendModal(e) {
  if (!e || e.target === document.getElementById('sendModalOverlay')) {
    document.getElementById('sendModalOverlay').classList.add('hidden');
  }
}
window.closeSendModal = closeSendModal;

async function copyMessage() {
  try { await navigator.clipboard.writeText(buildMessage()); }
  catch { const ta = document.createElement('textarea'); ta.value = buildMessage(); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
  showToast('✅ Kopieret!', 'success');
  closeSendModal();
}
window.copyMessage = copyMessage;

function sendWhatsApp() {
  window.open('https://wa.me/?text=' + encodeURIComponent(buildMessage()), '_blank');
  closeSendModal();
}
window.sendWhatsApp = sendWhatsApp;

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ===== UTILS =====
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== INIT =====
initFirebase();
if (state.isPersonView) {
  // Person view renders via Firebase listeners
} 
