// ===== STATE =====
const DEFAULT_PERSONS = [
  "Martin Mortensen", "Christian", "Dyari", "Freya", "Johanna",
  "Louise", "Lura", "Mathilde", "Nor", "Olivia",
  "Sara", "Savannah", "Tea", "Wesam", "William",
  "Malthe", "Thor", "Martin"
];

let state = {
  persons: [],
  orders: {},       // { name: { drink, drinkComment, snack, snackComment } }
  selectedPerson: null
};

// ===== LOCALSTORAGE =====
function saveState() {
  localStorage.setItem('biotur_persons', JSON.stringify(state.persons));
  localStorage.setItem('biotur_orders', JSON.stringify(state.orders));
}

function loadState() {
  const persons = localStorage.getItem('biotur_persons');
  const orders = localStorage.getItem('biotur_orders');
  state.persons = persons ? JSON.parse(persons) : [...DEFAULT_PERSONS];
  state.orders = orders ? JSON.parse(orders) : {};
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
    chip.textContent = firstName(name);
    chip.title = name;
    chip.onclick = () => selectPerson(name);
    grid.appendChild(chip);
  });
}

function firstName(name) {
  return name.split(' ')[0];
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
}

function updateOptionCardStyle(radio) {
  const card = radio.closest('.option-card');
  if (radio.checked) {
    card.style.borderColor = 'var(--accent)';
    card.style.background = 'rgba(245,197,24,0.15)';
  } else {
    card.style.borderColor = '';
    card.style.background = '';
  }
}

// Listen for radio changes
document.querySelectorAll('input[type="radio"]').forEach(r => {
  r.addEventListener('change', () => {
    const name = r.getAttribute('name');
    document.querySelectorAll(`input[name="${name}"]`).forEach(updateOptionCardStyle);
  });
});

// ===== SAVE ORDER =====
function saveOrder() {
  if (!state.selectedPerson) return;

  const drink = document.querySelector('input[name="drink"]:checked')?.value || '';
  const drinkComment = document.getElementById('drinkComment').value.trim();
  const snack = document.querySelector('input[name="snack"]:checked')?.value || '';
  const snackComment = document.getElementById('snackComment').value.trim();

  if (!drink && !snack) {
    showToast('⚠️ Vælg mindst en drik eller snack', 'error');
    return;
  }

  state.orders[state.selectedPerson] = { drink, drinkComment, snack, snackComment };
  saveState();
  renderPersonGrid();
  showToast('✅ Bestilling gemt for ' + firstName(state.selectedPerson), 'success');
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
      if (order.drink) itemsHtml += `<span class="summary-tag drink">🥤 ${order.drink}</span>`;
      if (order.drinkComment) itemsHtml += `<span class="summary-tag comment">💬 ${escHtml(order.drinkComment)}</span>`;
      if (order.snack) itemsHtml += `<span class="summary-tag snack">🍿 ${order.snack}</span>`;
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
    `;
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
      <button class="delete-btn" onclick="deletePerson(${idx})">🗑️ Slet</button>
    `;
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== INIT =====
loadState();
renderPersonGrid();
document.getElementById('noPersonMsg').style.display = '';
