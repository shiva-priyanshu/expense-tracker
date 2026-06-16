
const STORAGE_KEY = "expenseTracker.transactions";


let transactions = loadTransactions();
let categoryChart = null;


const form = document.getElementById("transactionForm");
const labelInput = document.getElementById("label");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");

const balanceEl = document.getElementById("balance");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");

const transactionListEl = document.getElementById("transactionList");
const emptyStateEl = document.getElementById("emptyState");

const filterTypeEl = document.getElementById("filterType");
const filterDateEl = document.getElementById("filterDate");
const exportBtn = document.getElementById("exportBtn");

const chartEmptyStateEl = document.getElementById("chartEmptyState");
const chartCanvas = document.getElementById("categoryChart");


function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to load transactions:", err);
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error("Failed to save transactions:", err);
  }
}


function formatCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toFixed(2)}`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


function isWithinThisWeek(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

function isWithinThisMonth(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getFilteredTransactions() {
  const typeFilter = filterTypeEl.value;
  const dateFilter = filterDateEl.value;

  return transactions
    .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
    .filter((tx) => {
      if (dateFilter === "week") return isWithinThisWeek(tx.date);
      if (dateFilter === "month") return isWithinThisMonth(tx.date);
      return true;
    });
}


function renderSummary() {
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") {
        acc.income += tx.amount;
      } else {
        acc.expense += tx.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const balance = totals.income - totals.expense;

  balanceEl.textContent = formatCurrency(balance);
  totalIncomeEl.textContent = formatCurrency(totals.income);
  totalExpenseEl.textContent = formatCurrency(totals.expense);

  balanceEl.style.color =
    balance < 0 ? "var(--color-expense)" : "var(--color-text)";
}

function renderTransactionList() {
  const filtered = getFilteredTransactions();

  // Sort newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  transactionListEl.innerHTML = "";

  if (sorted.length === 0) {
    emptyStateEl.classList.add("visible");
  } else {
    emptyStateEl.classList.remove("visible");
  }

  sorted.forEach((tx) => {
    const li = document.createElement("li");
    li.className = `transaction-item ${tx.type}`;

    const info = document.createElement("div");
    info.className = "transaction-info";

    const labelEl = document.createElement("span");
    labelEl.className = "transaction-label";
    labelEl.textContent = tx.label;
    labelEl.title = tx.label;

    const metaEl = document.createElement("span");
    metaEl.className = "transaction-meta";
    metaEl.textContent = `${tx.category} • ${formatDate(tx.date)}`;

    info.appendChild(labelEl);
    info.appendChild(metaEl);

    const amountEl = document.createElement("span");
    amountEl.className = `transaction-amount ${tx.type}`;
    const sign = tx.type === "income" ? "+" : "-";
    amountEl.textContent = `${sign}${formatCurrency(tx.amount)}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.setAttribute("aria-label", "Delete transaction");
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => deleteTransaction(tx.id));

    li.appendChild(info);
    li.appendChild(amountEl);
    li.appendChild(deleteBtn);

    transactionListEl.appendChild(li);
  });
}

function renderChart() {
  const expenseTotals = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

  const labels = Object.keys(expenseTotals);
  const data = Object.values(expenseTotals);

  if (labels.length === 0) {
    chartEmptyStateEl.classList.add("visible");
    chartCanvas.style.display = "none";
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    return;
  }

  chartEmptyStateEl.classList.remove("visible");
  chartCanvas.style.display = "block";

  const colors = [
    "#6366f1",
    "#f87171",
    "#34d399",
    "#fbbf24",
    "#60a5fa",
    "#a78bfa",
    "#f472b6",
    "#94a3b8",
  ];

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.update();
    return;
  }

  categoryChart = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#e8eaed" },
        },
      },
    },
  });
}

function renderAll() {
  renderSummary();
  renderTransactionList();
  renderChart();
}

// ---------- CRUD ----------
function addTransaction(label, amount, type, category) {
  const newTx = {
    id: generateId(),
    label: label.trim(),
    amount: Math.abs(parseFloat(amount)),
    type,
    category,
    date: new Date().toISOString(),
  };

  transactions.push(newTx);
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter((tx) => tx.id !== id);
  saveTransactions();
  renderAll();
}

// ---------- Export ----------
function exportTransactions() {
  if (transactions.length === 0) {
    alert("No transactions to export yet.");
    return;
  }

  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Event Listeners ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const label = labelInput.value.trim();
  const amount = amountInput.value;
  const type = typeInput.value;
  const category = categoryInput.value;

  if (!label || !amount || parseFloat(amount) <= 0) {
    alert("Please enter a valid label and a positive amount.");
    return;
  }

  addTransaction(label, amount, type, category);
  form.reset();
  labelInput.focus();
});

filterTypeEl.addEventListener("change", renderTransactionList);
filterDateEl.addEventListener("change", renderTransactionList);
exportBtn.addEventListener("click", exportTransactions);

// ---------- Init ----------
renderAll();
