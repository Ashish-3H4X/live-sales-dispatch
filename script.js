const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbw1M5DyohSY0l2AgrXKKX8JdVGUdVIa2EabOTIf1uTkDBeo6qjxbb2LBLlgD6-IxhMg/exec",
  REFRESH_INTERVAL: 20000,
  ROWS_PER_PAGE: 10
};
const state={raw:[],filtered:[],page:1,sortKey:"date",sortDir:"desc",chart:null,busy:false};
const money=new Intl.NumberFormat("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",()=>{
  bind();
  setDefaultDate();
  fetchData();
  setInterval(fetchData,CONFIG.REFRESH_INTERVAL);
});

function bind(){
  $("refreshBtn").onclick=fetchData;
  $("applyBtn").onclick=()=>{state.page=1;refresh()};
  $("clearBtn").onclick=()=>{["searchInput","fromDate","toDate"].forEach(x=>$(x).value="");$("salesmanFilter").value="";$("materialFilter").value="";state.page=1;refresh()};
  $("searchInput").oninput=()=>{state.page=1;refresh()};
  $("salesmanFilter").onchange=()=>{state.page=1;refresh()};
  $("materialFilter").onchange=()=>{state.page=1;refresh()};
  $("prev").onclick=()=>{if(state.page>1){state.page--;render()}};
  $("next").onclick=()=>{if(state.page<pages()){state.page++;render()}};
  document.querySelectorAll("th[data-sort]").forEach(th=>th.onclick=()=>sortBy(th.dataset.sort));
  $("entryForm").onsubmit=submitEntry;
}

function setDefaultDate(){const d=new Date();document.querySelector('[name="date"]').value=new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}

async function fetchData(){
  if(state.busy||CONFIG.API_URL.includes("YOUR_GOOGLE"))return;
  state.busy=true;
  try{
    const r=await fetch(CONFIG.API_URL,{cache:"no-store"});
    const j=await r.json();
    if(!j.success)throw Error(j.error||"API error");
    state.raw=normalize(j.data||[]);
    populateFilters();refresh();
    $("lastUpdated").textContent=new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }catch(e){console.error(e);toast("Unable to load live Google Sheet data.","error")}
  finally{state.busy=false}
}

function normalize(rows){
 let c={date:"",billNo:"",salesman:"",particulars:"",materialCentre:""};
 return rows.map(r=>{
  if(valid(r.date))c.date=r.date;if(valid(r.billNo))c.billNo=r.billNo;if(valid(r.salesman))c.salesman=r.salesman;
  if(valid(r.particulars))c.particulars=r.particulars;if(valid(r.materialCentre))c.materialCentre=r.materialCentre;
  return {...r,date:c.date,billNo:c.billNo,salesman:c.salesman,particulars:c.particulars,materialCentre:c.materialCentre,
    qty:num(r.qty),price:num(r.price),amount:num(r.amount)};
 })
}
function valid(v){return v!==null&&v!==undefined&&String(v).trim()!==""}
function num(v){const n=Number(String(v??"").replace(/,/g,""));return Number.isFinite(n)?n:0}
function dateObj(v){
 if(!v)return null;let s=String(v).trim(),m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
 if(m)return new Date(+m[3],+m[2]-1,+m[1]);m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
 if(m)return new Date(+m[1],+m[2]-1,+m[3]);let d=new Date(s);return isNaN(d)?null:d;
}
function displayDate(v){let d=dateObj(v);return d?`${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`:v}
function refresh(){
 const s=$("searchInput").value.toLowerCase().trim(),sm=$("salesmanFilter").value,mc=$("materialFilter").value,from=$("fromDate").value,to=$("toDate").value;
 $("dateError").textContent=from&&to&&from>to?"From Date cannot be later than To Date.":"";
 state.filtered=state.raw.filter(r=>{
   if(s&&!([r.particulars,r.itemDetails,r.alias,r.billNo,r.salesman].join(" ").toLowerCase().includes(s)))return false;
   if(sm&&r.salesman!==sm)return false;if(mc&&r.materialCentre!==mc)return false;
   let d=dateObj(r.date);if(from&&(!d||d<new Date(from+"T00:00:00")))return false;if(to&&(!d||d>new Date(to+"T23:59:59")))return false;return true;
 });
 state.filtered.sort(compare);render();
}
function compare(a,b){
 let x=a[state.sortKey],y=b[state.sortKey];
 if(state.sortKey==="date"){x=dateObj(x)?.getTime()||0;y=dateObj(y)?.getTime()||0}
 else if(["qty","price","amount"].includes(state.sortKey)){x=num(x);y=num(y)}
 else{x=String(x??"").toLowerCase();y=String(y??"").toLowerCase()}
 return x<y?(state.sortDir==="asc"?-1:1):x>y?(state.sortDir==="asc"?1:-1):0
}
function sortBy(k){if(state.sortKey===k)state.sortDir=state.sortDir==="asc"?"desc":"asc";else{state.sortKey=k;state.sortDir="asc"};refresh()}
function pages(){return Math.max(1,Math.ceil(state.filtered.length/CONFIG.ROWS_PER_PAGE))}
function render(){renderSummary();renderChart();renderTable();renderPages()}
function renderSummary(){
 const m=new Map();state.filtered.forEach(r=>{let x=m.get(r.salesman)||{qty:0,amount:0,bills:new Set()};x.qty+=r.qty;x.amount+=r.amount;if(r.billNo)x.bills.add(String(r.billNo));m.set(r.salesman,x)});
 const rows=[...m.entries()].sort((a,b)=>b[1].amount-a[1].amount);
 $("summaryBody").innerHTML=rows.map(([n,x])=>`<tr><td>${esc(n)}</td><td>${money.format(x.qty).replace(".00","")}</td><td>${money.format(x.amount)}</td></tr>`).join("");
 $("summaryQty").textContent=money.format(state.filtered.reduce((a,r)=>a+r.qty,0)).replace(".00","");
 $("summaryAmount").textContent=money.format(state.filtered.reduce((a,r)=>a+r.amount,0));
}
function renderChart(){
 let m=new Map();state.filtered.forEach(r=>m.set(r.salesman,(m.get(r.salesman)||0)+r.amount));
 if(state.chart)state.chart.destroy();
 state.chart=new Chart($("salesChart"),{type:"bar",data:{labels:[...m.keys()],datasets:[{data:[...m.values()],backgroundColor:["#3b82f6","#55c997","#ff9f43"],borderRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>money.format(v).replace(".00","")}}}}});
}
function renderTable(){
 const start=(state.page-1)*CONFIG.ROWS_PER_PAGE,rows=state.filtered.slice(start,start+CONFIG.ROWS_PER_PAGE);
 $("recordsBody").innerHTML=rows.map((r,i)=>`<tr><td>${start+i+1}</td><td>${esc(displayDate(r.date))}</td><td>${esc(r.billNo)}</td><td>${esc(r.salesman)}</td><td>${esc(r.particulars)}</td><td>${esc(r.itemDetails)}</td><td>${esc(r.alias||"-")}</td><td>${esc(r.materialCentre)}</td><td>${money.format(r.qty).replace(".00","")}</td><td>${esc(r.unit)}</td><td>${money.format(r.price)}</td><td>${money.format(r.amount)}</td></tr>`).join("");
 $("emptyState").style.display=rows.length?"none":"block";
 $("showing").textContent=state.filtered.length?`Showing ${start+1} to ${Math.min(start+CONFIG.ROWS_PER_PAGE,state.filtered.length)} of ${state.filtered.length} records`:"Showing 0 of 0 records";
}
function renderPages(){
 $("prev").disabled=state.page<=1;$("next").disabled=state.page>=pages();
 let h="";for(let i=1;i<=Math.min(pages(),5);i++)h+=`<button class="page ${i===state.page?"active":""}" onclick="goPage(${i})">${i}</button>`;
 if(pages()>5)h+=`<span>...</span><button class="page ${state.page===pages()?"active":""}" onclick="goPage(${pages()})">${pages()}</button>`;
 $("pageNumbers").innerHTML=h;
}
window.goPage=n=>{state.page=n;render()}
function populateFilters(){
 const sm=[...new Set(state.raw.map(r=>r.salesman).filter(Boolean))].sort(),mc=[...new Set(state.raw.map(r=>r.materialCentre).filter(Boolean))].sort();
 const oldSm=$("salesmanFilter").value,oldMc=$("materialFilter").value;
 $("salesmanFilter").innerHTML='<option value="">All Salesman</option>'+sm.map(x=>`<option>${esc(x)}</option>`).join("");
 $("materialFilter").innerHTML='<option value="">All Material Centre</option>'+mc.map(x=>`<option>${esc(x)}</option>`).join("");
 $("entrySalesman").innerHTML='<option value="">Select Salesman</option>'+sm.map(x=>`<option>${esc(x)}</option>`).join("");
 $("entryMaterial").innerHTML='<option value="">Select Centre</option>'+mc.map(x=>`<option>${esc(x)}</option>`).join("");
 $("salesmanFilter").value=oldSm;$("materialFilter").value=oldMc;
}
async function submitEntry(e){
 e.preventDefault();const f=new FormData(e.target),p=Object.fromEntries(f.entries());p.qty=num(p.qty);p.price=num(p.price);
 if(p.qty<=0){$("formError").textContent="Quantity must be greater than zero.";return}
 if(!CONFIG.API_URL||CONFIG.API_URL.includes("YOUR_GOOGLE")){$("formError").textContent="Configure the Apps Script URL in script.js.";return}
 $("submitBtn").disabled=true;$("submitBtn").textContent="Adding...";
 try{let r=await fetch(CONFIG.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(p)}),j=await r.json();if(!j.success)throw Error(j.error);toast("✓ Entry added successfully");e.target.reset();setDefaultDate();await fetchData()}catch(err){console.error(err);$("formError").textContent="Failed to add entry.";toast("✕ Failed to add entry","error")}finally{$("submitBtn").disabled=false;$("submitBtn").textContent="Add Entry"}
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg,type="ok"){let d=document.createElement("div");d.className="toast "+(type==="error"?"error":"");d.textContent=msg;$("toast").appendChild(d);setTimeout(()=>d.remove(),3500)}
