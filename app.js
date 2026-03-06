// ===== FIREBASE SETUP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// ===== STATE =====
const DEFAULT_PERSONS = [
  "Martin M.", "Christian", "Dyari", "Freya", "Johanna",
  "Louise", "Lura", "Mathilde", "Nor", "Olivia",
  "Sara", "Savannah", "Tea", "Wesam", "William",
  "Malthe", "Thor", "Martin"
];

let state = {
  persons: [],
  orders: {},
  selectedPerson: null,
  customDrinks: [],
  customSnacks: []
};

// ===== SYNC INDICATOR =====
function setSync(status) {
  // status: 'online' | 'offline' | 'saving'
  const dot = document.querySelector('.sync-dot');
  const ind = document.getElementById('syncIndicator');
  if (!dot) return;
  dot.className = 'sync-dot ' + status;
  ind.title = status === 'online' ? '🟢 Forbundet' : status === 'saving' ? '🟡 Gemmer...' : '🔴 Offline';
}

// ===== FIREBASE LISTENERS =====
function initFirebase() {
  // Connection state
  const connRef = ref(db, '.info/connected');
  onValue(connRef, snap => {
    setSync(snap.val() ? 'online' : 'offline');
  });

  // Listen to persons list
  onValue(ref(db, 'persons'), snap => {
    const val = snap.val();
    if (val) {
      state.persons = val;
    } else {
      // First time — seed with defaults
      set(ref(db, 'persons'), DEFAULT_PERSONS);
      state.persons = [...DEFAULT_PERSONS];
    }
    renderPersonGrid();
    if (state.selectedPerson) renderPersonGrid();
  });

  // Listen to orders (realtime updates)
  onValue(ref(db, 'orders'), snap => {
    state.orders = snap.val() || {};
    renderPersonGrid();
    // Refresh oversigt if open
    if (document.getElementById('tab-oversigt').classList.contains('active')) {
      renderOversigt();
    }
  });

  // Listen to custom options
  onValue(ref(db, 'customDrinks'), snap => {
    state.customDrinks = snap.val() || [];
    renderCustomOptions();
  });

  onValue(ref(db, 'customSnacks'), snap => {
    state.customSnacks = snap.val() || [];
    renderCustomOptions();
  });
}

// ===== TABS =====
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes("'" + tab + "'")) btn.classList.add('active');
  });
  if (tab === 'oversigt') renderOversigt();
  if (tab === 'deltagere') renderPersonList();
}
window.showTab = showTab;

// ===== PERSON GRID =====
function renderPersonGrid() {
  const grid = document.getElementById('personGrid');
  grid.innerHTML = '';
  state.persons.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'person-chip' +
      (state.orders[name] ? ' has-order' : '') +
      (state.selectedPerson === name ? ' active' : '');
    chip.textContent = name;
    chip.title = name;
    chip.onclick = () => selectPerson(name);
    grid.appendChild(chip);
  });
}

function selectPerson(name) {
  state.selectedPerson = name;
  renderPersonGrid();
  showOrderForm(name);
}

function showOrderForm(name) {
  document.getElementById('orderForm').classList.remove('hidden');
  document.getElementById('noPersonMsg').style.display = 'none';
  document.getElementById('selectedPersonName').textContent = name;

  renderCustomOptions();

  const order = state.orders[name] || {};

  document.querySelectorAll('input[name="drink"]').forEach(r => {
    r.checked = r.value === (order.drink || '');
    updateOptionCardStyle(r);
  });
  document.getElementById('drinkComment').value = order.drinkComment || '';

  document.querySelectorAll('input[name="snack"]').forEach(r => {
    r.checked = r.value === (order.snack || '');
    updateOptionCardStyle(r);
  });
  document.getElementById('snackComment').value = order.snackComment || '';

  onCommentInput('drink');
  onCommentInput('snack');
}

// ===== CUSTOM OPTIONS =====
function renderCustomOptions() {
  const drinkGrid = document.getElementById('drinkOptions');
  drinkGrid.querySelectorAll('.option-card.custom').forEach(el => el.remove());
  state.customDrinks.forEach(val => {
    drinkGrid.insertBefore(makeOptionCard('drink', val, '✨', true), drinkGrid.lastElementChild);
  });

  const snackGrid = document.getElementById('snackOptions');
  snackGrid.querySelectorAll('.option-card.custom').forEach(el => el.remove());
  state.customSnacks.forEach(val => {
    snackGrid.insertBefore(makeOptionCard('snack', val, '✨', true), snackGrid.lastElementChild);
  });

  attachRadioListeners();

  // Re-apply checked state if person is selected
  if (state.selectedPerson) {
    const order = state.orders[state.selectedPerson] || {};
    document.querySelectorAll('input[name="drink"]').forEach(r => {
      r.checked = r.value === (order.drink || '');
      updateOptionCardStyle(r);
    });
    document.querySelectorAll('input[name="snack"]').forEach(r => {
      r.checked = r.value === (order.snack || '');
      updateOptionCardStyle(r);
    });
  }
}

function makeOptionCard(groupName, value, icon, isCustom) {
  const label = document.createElement('label');
  label.className = 'option-card' + (isCustom ? ' custom' : '');
  label.innerHTML = `
    <input type="radio" name="${groupName}" value="${escHtml(value)}" />
    <span class="option-icon">${icon}</span>
    <span class="option-label">${escHtml(value)}</span>
  `;
  return label;
}

function updateOptionCardStyle(radio) {
  const card = radio.closest('.option-card');
  if (!card) return;
  if (radio.checked) {
    card.style.borderColor = 'var(--accent)';
    card.style.background = 'rgba(245,197,24,0.1)';
  } else {
    card.style.borderColor = '';
    card.style.background = '';
  }
}

function attachRadioListeners() {
  document.querySelectorAll('input[type="radio"]').forEach(r => {
    r.removeEventListener('change', radioChangeHandler);
    r.addEventListener('change', radioChangeHandler);
  });
}

function radioChangeHandler() {
  const groupName = this.getAttribute('name');
  document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
    updateOptionCardStyle(radio);
  });
  onCommentInput(groupName);
}

function onCommentInput(groupName) {
  const selected = document.querySelector(`input[name="${groupName}"]:checked`);
  const commentEl = document.getElementById(groupName === 'drink' ? 'drinkComment' : 'snackComment');
  const createBtn = document.getElementById(groupName === 'drink' ? 'drinkCreateBtn' : 'snackCreateBtn');
  if (!createBtn) return;
  const isAndet = selected && selected.value === 'Andet';
  const hasText = commentEl && commentEl.value.trim().length > 0;
  createBtn.classList.toggle('hidden', !(isAndet && hasText));
}
window.onCommentInput = onCommentInput;

async function createCustomOption(groupName) {
  const commentEl = document.getElementById(groupName === 'drink' ? 'drinkComment' : 'snackComment');
  const newValue = commentEl.value.trim();
  if (!newValue) return;

  const existing = [...document.querySelectorAll(`input[name="${groupName}"]`)].map(r => r.value);
  if (existing.includes(newValue)) {
    showToast('⚠️ "' + newValue + '" findes allerede', 'error');
    return;
  }

  setSync('saving');
  if (groupName === 'drink') {
    const updated = [...state.customDrinks, newValue];
    await set(ref(db, 'customDrinks'), updated);
  } else {
    const updated = [...state.customSnacks, newValue];
    await set(ref(db, 'customSnacks'), updated);
  }

  commentEl.value = '';
  onCommentInput(groupName);
  showToast('✨ "' + newValue + '" tilføjet som fast valg', 'success');
  await saveOrder(true);
}
window.createCustomOption = createCustomOption;

// ===== SAVE ORDER =====
async function saveOrder(silent = false) {
  if (!state.selectedPerson) return;

  const drink = document.querySelector('input[name="drink"]:checked')?.value || '';
  const drinkComment = document.getElementById('drinkComment').value.trim();
  const snack = document.querySelector('input[name="snack"]:checked')?.value || '';
  const snackComment = document.getElementById('snackComment').value.trim();

  if (!drink && !snack) {
    if (!silent) showToast('⚠️ Vælg mindst en drik eller snack', 'error');
    return;
  }

  setSync('saving');
  // Firebase keys kan ikke indeholde . # $ [ ]
  const key = state.selectedPerson.replace(/[.#$[\]]/g, '_');
  await set(ref(db, 'orders/' + key), { drink, drinkComment, snack, snackComment, _name: state.selectedPerson });

  if (!silent) showToast('✅ Bestilling gemt for ' + state.selectedPerson, 'success');
}
window.saveOrder = saveOrder;

// ===== CLEAR ORDER =====
async function clearOrder() {
  if (!state.selectedPerson) return;
  if (!confirm(`Ryd bestilling for ${state.selectedPerson}?`)) return;

  setSync('saving');
  const key = state.selectedPerson.replace(/[.#$[\]]/g, '_');
  await remove(ref(db, 'orders/' + key));

  showOrderForm(state.selectedPerson);
  showToast('🗑️ Bestilling ryddet', '');
}
window.clearOrder = clearOrder;

// ===== OVERSIGT =====
function renderOversigt() {
  renderSummaryCards();
  renderTotals();
  renderMissing();
}

function editFromOversigt(name) {
  showTab('bestil');
  selectPerson(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getOrderForPerson(name) {
  // Orders are keyed by sanitized name
  const key = name.replace(/[.#$[\]]/g, '_');
  return state.orders[key] || null;
}

function renderSummaryCards() {
  const container = document.getElementById('summaryCards');
  container.innerHTML = '';

  state.persons.forEach(name => {
    const order = getOrderForPerson(name);
    const card = document.createElement('div');
    card.className = 'summary-card' + (order ? '' : ' no-order');

    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    let itemsHtml = '';
    if (order) {
      if (order.drink) itemsHtml += `<span class="summary-tag drink">🥤 ${escHtml(order.drink)}</span>`;
      if (order.drinkComment) itemsHtml += `<span class="summary-tag comment">💬 ${escHtml(order.drinkComment)}</span>`;
      if (order.snack) itemsHtml += `<span class="summary-tag snack">🍿 ${escHtml(order.snack)}</span>`;
      if (order.snackComment) itemsHtml += `<span class="summary-tag comment">💬 ${escHtml(order.snackComment)}</span>`;
    }

    card.innerHTML = `
      <div class="summary-avatar">${initials}</div>
      <div class="summary-info">
        <div class="summary-name">${escHtml(name)}</div>
        ${order
          ? `<div class="summary-items">${itemsHtml}</div>`
          : `<div class="summary-no-order">Ingen bestilling endnu</div>`
        }
      </div>
      <button class="summary-edit-btn" title="Rediger bestilling">✏️</button>
    `;
    card.querySelector('.summary-edit-btn').addEventListener('click', () => editFromOversigt(name));
    container.appendChild(card);
  });
}

function renderTotals() {
  const grid = document.getElementById('totalsGrid');
  grid.innerHTML = '';

  const drinkCount = {};
  const snackCount = {};

  state.persons.forEach(name => {
    const o = getOrderForPerson(name);
    if (!o) return;
    if (o.drink) drinkCount[o.drink] = (drinkCount[o.drink] || 0) + 1;
    if (o.snack) snackCount[o.snack] = (snackCount[o.snack] || 0) + 1;
  });

  const allItems = [
    ...Object.entries(drinkCount).map(([k, v]) => ({ label: '🥤 ' + k, count: v })),
    ...Object.entries(snackCount).map(([k, v]) => ({ label: '🍿 ' + k, count: v }))
  ].sort((a, b) => b.count - a.count);

  if (allItems.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem">Ingen bestillinger endnu</div>';
    return;
  }

  allItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'total-row';
    row.innerHTML = `<span>${item.label}</span><span class="count">${item.count}</span>`;
    grid.appendChild(row);
  });
}

function renderMissing() {
  const list = document.getElementById('missingList');
  list.innerHTML = '';
  const missing = state.persons.filter(p => !getOrderForPerson(p));

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
  list.innerHTML = '';

  state.persons.forEach((name, idx) => {
    const li = document.createElement('li');
    li.className = 'person-list-item';
    const hasOrder = !!getOrderForPerson(name);
    li.innerHTML = `
      <span class="person-list-name">
        ${hasOrder ? '<span class="person-has-order-dot" title="Har bestilt"></span>' : ''}
        ${escHtml(name)}
      </span>
      <button class="delete-btn">🗑️ Slet</button>
    `;
    li.querySelector('.delete-btn').addEventListener('click', () => deletePerson(idx));
    list.appendChild(li);
  });
}

async function addPerson() {
  const input = document.getElementById('newPersonInput');
  const name = input.value.trim();
  if (!name) { showToast('⚠️ Skriv et navn', 'error'); return; }
  if (state.persons.includes(name)) { showToast('⚠️ Deltager findes allerede', 'error'); return; }

  setSync('saving');
  const updated = [...state.persons, name];
  await set(ref(db, 'persons'), updated);

  input.value = '';
  showToast('✅ ' + name + ' tilføjet', 'success');
}
window.addPerson = addPerson;

async function deletePerson(idx) {
  const name = state.persons[idx];
  if (!confirm(`Slet "${name}"?\n\nDeres bestilling slettes også.`)) return;

  setSync('saving');
  const updated = [...state.persons];
  updated.splice(idx, 1);
  await set(ref(db, 'persons'), updated);

  const key = name.replace(/[.#$[\]]/g, '_');
  await remove(ref(db, 'orders/' + key));

  if (state.selectedPerson === name) {
    state.selectedPerson = null;
    document.getElementById('orderForm').classList.add('hidden');
    document.getElementById('noPersonMsg').style.display = '';
  }

  showToast('🗑️ ' + name + ' slettet', '');
}

// ===== SEND BESTILLING =====
function buildMessage() {
  const drinkCount = {};
  const snackCount = {};
  const comments = [];

  state.persons.forEach(name => {
    const o = getOrderForPerson(name);
    if (!o) return;
    if (o.drink) drinkCount[o.drink] = (drinkCount[o.drink] || 0) + 1;
    if (o.snack) snackCount[o.snack] = (snackCount[o.snack] || 0) + 1;
    if (o.drinkComment) comments.push(name + ': ' + o.drinkComment + ' (drik)');
    if (o.snackComment) comments.push(name + ': ' + o.snackComment + ' (snack)');
  });

  const ordered = state.persons.filter(p => getOrderForPerson(p));
  const missing = state.persons.filter(p => !getOrderForPerson(p));

  let msg = '🎬 BIO TUR BESTILLING\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  msg += '🥤 DRIKKEVARER\n';
  if (Object.keys(drinkCount).length === 0) {
    msg += '  Ingen endnu\n';
  } else {
    Object.entries(drinkCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
      msg += `  ${v}x ${k}\n`;
    });
  }

  msg += '\n🍿 SNACKS\n';
  if (Object.keys(snackCount).length === 0) {
    msg += '  Ingen endnu\n';
  } else {
    Object.entries(snackCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
      msg += `  ${v}x ${k}\n`;
    });
  }

  if (comments.length > 0) {
    msg += '\n💬 KOMMENTARER\n';
    comments.forEach(c => { msg += `  • ${c}\n`; });
  }

  msg += `\n✅ Bestilt: ${ordered.length}/${state.persons.length}`;

  if (missing.length > 0) {
    msg += `\n⏳ Mangler: ${missing.join(', ')}`;
  }

  return msg;
}

function openSendModal() {
  const msg = buildMessage();
  document.getElementById('sendMessageBox').textContent = msg;
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
  const msg = buildMessage();
  try {
    await navigator.clipboard.writeText(msg);
    showToast('✅ Kopieret til udklipsholder!', 'success');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = msg;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Kopieret!', 'success');
  }
  closeSendModal();
}
window.copyMessage = copyMessage;

function sendWhatsApp() {
  const msg = buildMessage();
  const encoded = encodeURIComponent(msg);
  window.open('https://wa.me/?text=' + encoded, '_blank');
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
attachRadioListeners();
document.getElementById('noPersonMsg').style.display = '';
initFirebase();
