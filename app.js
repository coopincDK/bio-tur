// ===== STATE =====
const DEFAULT_PERSONS = [
  "Martin M.", "Christian", "Dyari", "Freya", "Johanna",
  "Louise", "Lura", "Mathilde", "Nor", "Olivia",
  "Sara", "Savannah", "Tea", "Wesam", "William",
  "Malthe", "Thor", "Martin"
];

let state = {
  persons: [],
  orders: {},       // { name: { drink, drinkComment, snack, snackComment } }
  selectedPerson: null,
  customDrinks: [], // ekstra drik-valg oprettet af brugere
  customSnacks: []  // ekstra snack-valg oprettet af brugere
};

// ===== LOCALSTORAGE =====
function saveState() {
  localStorage.setItem('biotur_persons', JSON.stringify(state.persons));
  localStorage.setItem('biotur_orders', JSON.stringify(state.orders));
  localStorage.setItem('biotur_customDrinks', JSON.stringify(state.customDrinks));
  localStorage.setItem('biotur_customSnacks', JSON.stringify(state.customSnacks));
}

function loadState() {
  const persons = localStorage.getItem('biotur_persons');
  const orders = localStorage.getItem('biotur_orders');
  const customDrinks = localStorage.getItem('biotur_customDrinks');
  const customSnacks = localStorage.getItem('biotur_customSnacks');
  state.persons = persons ? JSON.parse(persons) : [...DEFAULT_PERSONS];
  state.orders = orders ? JSON.parse(orders) : {};
  state.customDrinks = customDrinks ? JSON.parse(customDrinks) : [];
  state.customSnacks = customSnacks ? JSON.parse(customSnacks) : [];
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

// ===== PERSON GRID (Bestil tab) =====
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

  // Re-render custom options first
  renderCustomOptions();

  // Load existing order or clear
  const order = state.orders[name] || {};

  // Drinks
  document.querySelectorAll('input[name="drink"]').forEach(r => {
    r.checked = r.value === (order.drink || '');
    updateOptionCardStyle(r);
  });
  document.getElementById('drinkComment').value = order.drinkComment || '';

  // Snacks
  document.querySelectorAll('input[name="snack"]').forEach(r => {
    r.checked = r.value === (order.snack || '');
    updateOptionCardStyle(r);
  });
  document.getElementById('snackComment').value = order.snackComment || '';

  // Reset create buttons
  onCommentInput('drink');
  onCommentInput('snack');
}

// ===== CUSTOM OPTIONS =====
function renderCustomOptions() {
  // Drink custom options
  const drinkGrid = document.getElementById('drinkOptions');
  drinkGrid.querySelectorAll('.option-card.custom').forEach(el => el.remove());
  state.customDrinks.forEach(val => {
    drinkGrid.insertBefore(makeOptionCard('drink', val, '✨', true), drinkGrid.lastElementChild);
  });

  // Snack custom options
  const snackGrid = document.getElementById('snackOptions');
  snackGrid.querySelectorAll('.option-card.custom').forEach(el => el.remove());
  state.customSnacks.forEach(val => {
    snackGrid.insertBefore(makeOptionCard('snack', val, '✨', true), snackGrid.lastElementChild);
  });

  // Re-attach radio listeners for new cards
  attachRadioListeners();
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

function attachRadioListeners() {
  document.querySelectorAll('input[type="radio"]').forEach(r => {
    r.removeEventListener('change', radioChangeHandler);
    r.addEventListener('change', radioChangeHandler);
  });
}

function radioChangeHandler() {
  const groupName = this.getAttribute('name');
  document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
    const card = radio.closest('.option-card');
    if (radio.checked) {
      card.style.borderColor = 'var(--accent)';
      card.style.background = 'rgba(245,197,24,0.1)';
    } else {
      card.style.borderColor = '';
      card.style.background = '';
    }
  });
  // Show/hide create button when "Andet" selected
  onCommentInput(groupName);
}

// Show "Opret & gem" button when Andet is selected AND comment has text
function onCommentInput(groupName) {
  const selected = document.querySelector(`input[name="${groupName}"]:checked`);
  const commentEl = document.getElementById(groupName === 'drink' ? 'drinkComment' : 'snackComment');
  const createBtn = document.getElementById(groupName === 'drink' ? 'drinkCreateBtn' : 'snackCreateBtn');
  if (!createBtn) return;

  const isAndet = selected && selected.value === 'Andet';
  const hasText = commentEl && commentEl.value.trim().length > 0;

  if (isAndet && hasText) {
    createBtn.classList.remove('hidden');
  } else {
    createBtn.classList.add('hidden');
  }
}

function createCustomOption(groupName) {
  const commentEl = document.getElementById(groupName === 'drink' ? 'drinkComment' : 'snackComment');
  const newValue = commentEl.value.trim();
  if (!newValue) return;

  // Check not already existing
  const existing = [...document.querySelectorAll(`input[name="${groupName}"]`)].map(r => r.value);
  if (existing.includes(newValue)) {
    showToast('⚠️ "' + newValue + '" findes allerede', 'error');
    return;
  }

  // Add to state
  if (groupName === 'drink') {
    state.customDrinks.push(newValue);
  } else {
    state.customSnacks.push(newValue);
  }

  // Re-render custom options
  renderCustomOptions();

  // Select the new option
  const newRadio = document.querySelector(`input[name="${groupName}"][value="${newValue}"]`);
  if (newRadio) {
    newRadio.checked = true;
    radioChangeHandler.call(newRadio);
  }

  // Clear comment field since it's now a proper option
  commentEl.value = '';
  onCommentInput(groupName);

  saveState();
  showToast('✨ "' + newValue + '" tilføjet som fast valg', 'success');

  // Auto-save the order with the new selection
  saveOrder(true);
}

// ===== SAVE ORDER =====
function saveOrder(silent = false) {
  if (!state.selectedPerson) return;

  const drink = document.querySelector('input[name="drink"]:checked')?.value || '';
  const drinkComment = document.getElementById('drinkComment').value.trim();
  const snack = document.querySelector('input[name="snack"]:checked')?.value || '';
  const snackComment = document.getElementById('snackComment').value.trim();

  if (!drink && !snack) {
    if (!silent) showToast('⚠️ Vælg mindst en drik eller snack', 'error');
    return;
  }

  state.orders[state.selectedPerson] = { drink, drinkComment, snack, snackComment };
  saveState();
  renderPersonGrid();
  if (!silent) showToast('✅ Bestilling gemt for ' + state.selectedPerson, 'success');
}

// ===== CLEAR ORDER =====
function clearOrder() {
  if (!state.selectedPerson) return;
  if (!confirm(`Ryd bestilling for ${state.selectedPerson}?`)) return;

  delete state.orders[state.selectedPerson];
  saveState();
  renderPersonGrid();
  showOrderForm(state.selectedPerson);
  showToast('🗑️ Bestilling ryddet', '');
}

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

function renderSummaryCards() {
  const container = document.getElementById('summaryCards');
  container.innerHTML = '';

  state.persons.forEach(name => {
    const order = state.orders[name];
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

    // Use data attribute to avoid escaping issues in onclick
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

    // Attach click safely via JS (avoids escaping issues with names)
    card.querySelector('.summary-edit-btn').addEventListener('click', () => editFromOversigt(name));
    container.appendChild(card);
  });
}

function renderTotals() {
  const grid = document.getElementById('totalsGrid');
  grid.innerHTML = '';

  const drinkCount = {};
  const snackCount = {};

  Object.values(state.orders).forEach(o => {
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
  const missing = state.persons.filter(p => !state.orders[p]);

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

    const hasOrder = !!state.orders[name];
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

function addPerson() {
  const input = document.getElementById('newPersonInput');
  const name = input.value.trim();
  if (!name) { showToast('⚠️ Skriv et navn', 'error'); return; }
  if (state.persons.includes(name)) { showToast('⚠️ Deltager findes allerede', 'error'); return; }

  state.persons.push(name);
  saveState();
  input.value = '';
  renderPersonList();
  renderPersonGrid();
  showToast('✅ ' + name + ' tilføjet', 'success');
}

function deletePerson(idx) {
  const name = state.persons[idx];
  if (!confirm(`Slet "${name}"?\n\nDeres bestilling slettes også.`)) return;

  state.persons.splice(idx, 1);
  delete state.orders[name];

  if (state.selectedPerson === name) {
    state.selectedPerson = null;
    document.getElementById('orderForm').classList.add('hidden');
    document.getElementById('noPersonMsg').style.display = '';
  }

  saveState();
  renderPersonList();
  renderPersonGrid();
  showToast('🗑️ ' + name + ' slettet', '');
}

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
loadState();
renderPersonGrid();
renderCustomOptions();
attachRadioListeners();
document.getElementById('noPersonMsg').style.display = '';
