const STORAGE_KEY = "myMoneyJournalTransactions_v1";
const $ = (id) => document.getElementById(id);
const categories = {
  income: ["Gaji / Upah", "Uang saku", "Hadiah", "Penjualan", "Bonus", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Pendidikan", "Tagihan", "Hiburan", "Kesehatan", "Tabungan", "Lainnya"]
};
let transactions = loadTransactions();
let activeMonth = new Date().toISOString().slice(0, 7);
let editingId = null;

function loadTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {style:"currency", currency:"IDR", maximumFractionDigits:0}).format(value || 0);
}
function safeText(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function dateLabel(value) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("id-ID", {day:"numeric", month:"short", year:"numeric"});
}
function monthTransactions() {
  return transactions.filter(t => t.date && t.date.slice(0,7) === activeMonth);
}
function render() {
  const items = monthTransactions();
  const income = items.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense = items.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  $("balanceValue").textContent = rupiah(income-expense);
  $("incomeValue").textContent = rupiah(income);
  $("expenseValue").textContent = rupiah(expense);
  $("chartMonth").textContent = new Date(activeMonth+"-01T00:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  renderChart(items);
  renderList();
}
function renderChart(items) {
  const area = $("chartArea");
  if (!items.length) { area.innerHTML = '<div class="empty-chart">Belum ada transaksi pada bulan ini.</div>'; return; }
  const days = Array.from({length: new Date(Number(activeMonth.slice(0,4)), Number(activeMonth.slice(5,7)), 0).getDate()}, (_,i)=>i+1);
  const daily = days.map(day => {
    const list = items.filter(t=>Number(t.date.slice(8,10))===day);
    return {day, income:list.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense:list.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0)};
  });
  const step = Math.max(1, Math.ceil(days.length/10));
  const shown = daily.filter((d,i)=>i%step===0 || i===daily.length-1);
  const max = Math.max(1,...shown.flatMap(d=>[d.income,d.expense]));
  area.innerHTML = shown.map(d=>`<div class="chart-column"><div class="bar income" title="Masuk ${rupiah(d.income)}" style="height:${Math.max(d.income?4:0,d.income/max*100)}%"></div><div class="bar expense" title="Keluar ${rupiah(d.expense)}" style="height:${Math.max(d.expense?4:0,d.expense/max*100)}%"></div><span class="chart-label">${d.day}</span></div>`).join("");
}
function renderList() {
  const query = $("searchInput").value.toLowerCase().trim();
  const type = $("typeFilter").value;
  const items = transactions.filter(t => t.date.slice(0,7)===activeMonth)
    .filter(t => type==="all" || t.type===type)
    .filter(t => `${t.description} ${t.category}`.toLowerCase().includes(query))
    .sort((a,b)=>b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  const list = $("transactionList");
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Belum ada transaksi yang cocok. Yuk, mulai catat keuanganmu ♡</div>';
    return;
  }
  list.innerHTML = items.map(t=>`<div class="transaction-row">
    <div class="transaction-symbol ${t.type}">${t.type==="income"?"↗":"↘"}</div>
    <div><div class="transaction-name">${safeText(t.description)}</div><div class="transaction-meta">${dateLabel(t.date)} · ${safeText(t.category)}</div></div>
    <div class="transaction-category">${safeText(t.category)}</div>
    <div class="transaction-amount ${t.type}">${t.type==="income"?"+":"−"} ${rupiah(t.amount)}</div>
    <button class="delete-button" data-delete="${t.id}" title="Hapus transaksi" aria-label="Hapus transaksi">×</button>
  </div>`).join("");
}
function showToast(message) {
  const toast=$("toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove("show"),2200);
}
function setType(type) {
  $("transactionType").value=type;
  document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected",b.dataset.modalType===type));
  const select=$("categoryInput");
  select.innerHTML=categories[type].map(c=>`<option>${c}</option>`).join("");
}
function openDialog(type="expense") {
  editingId=null; $("transactionForm").reset(); $("transactionType").value=type;
  $("modalTitle").textContent="Tambah transaksi"; $("modalEyebrow").textContent="NEW TRANSACTION";
  $("dateInput").value=new Date().toISOString().slice(0,10); setType(type);
  $("transactionDialog").showModal();
}
function closeDialog() { $("transactionDialog").close(); }
document.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>openDialog(b.dataset.type)));
document.querySelectorAll("[data-modal-type]").forEach(b=>b.addEventListener("click",()=>setType(b.dataset.modalType)));
$("closeDialog").addEventListener("click",closeDialog);
$("cancelDialog").addEventListener("click",closeDialog);
$("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("amountInput").value);
  const description=$("descriptionInput").value.trim();
  const date=$("dateInput").value;
  if(!Number.isSafeInteger(amount)||amount<=0||!description||!date){showToast("Periksa kembali data transaksi.");return;}
  transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:$("transactionType").value,amount,description,category:$("categoryInput").value,date,createdAt:Date.now()});
  saveTransactions(); closeDialog(); activeMonth=date.slice(0,7); $("monthFilter").value=activeMonth; render(); showToast("Transaksi berhasil disimpan ♡");
});
$("transactionList").addEventListener("click",e=>{
  const button=e.target.closest("[data-delete]"); if(!button)return;
  const item=transactions.find(t=>t.id===button.dataset.delete); if(!item)return;
  if(confirm(`Hapus transaksi "${item.description}"?`)){transactions=transactions.filter(t=>t.id!==item.id);saveTransactions();render();showToast("Transaksi dihapus.");}
});
$("monthFilter").addEventListener("change",e=>{if(e.target.value){activeMonth=e.target.value;render();}});
$("searchInput").addEventListener("input",renderList);
$("typeFilter").addEventListener("change",renderList);
$("exportBtn").addEventListener("click",()=>{
  const rows=[["Tanggal","Jenis","Keterangan","Kategori","Nominal"],...monthTransactions().map(t=>[t.date,t.type==="income"?"Uang masuk":"Uang keluar",t.description,t.category,t.amount])];
  if(rows.length===1){showToast("Belum ada data untuk diekspor.");return;}
  const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`catatan-keuangan-${activeMonth}.csv`;a.click();URL.revokeObjectURL(url);showToast("File CSV berhasil dibuat.");
});
$("monthFilter").value=activeMonth;
$("todayText").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});
render();
