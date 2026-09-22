const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbw1M5DyohSY0l2AgrXKKX8JdVGUdVIa2EabOTIf1uTkDBeo6qjxbb2LBLlgD6-IxhMg/exec",
  REFRESH_INTERVAL: 20000,
  ROWS_PER_PAGE: 10
};

const state = {
  raw: [],
  filtered: [],
  page: 1,
  sortKey: "date",
  sortDir: "desc",
  chart: null,
  busy: false
};

const money = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const $ = id => document.getElementById(id);


/* 
   INITIALIZE
 */

document.addEventListener("DOMContentLoaded", () => {
  bind();
  setDefaultDate();
  fetchData();

  setInterval(fetchData, CONFIG.REFRESH_INTERVAL);
});


/* 
   EVENT BINDINGS
========================================================= */

function bind() {

  $("refreshBtn").onclick = fetchData;

  $("applyBtn").onclick = () => {
    state.page = 1;
    refresh();
  };

  $("clearBtn").onclick = () => {

    ["searchInput", "fromDate", "toDate"]
      .forEach(x => $(x).value = "");

    $("salesmanFilter").value = "";
    $("materialFilter").value = "";

    state.page = 1;

    refresh();
  };

  $("searchInput").oninput = () => {
    state.page = 1;
    refresh();
  };

  $("salesmanFilter").onchange = () => {
    state.page = 1;
    refresh();
  };

  $("materialFilter").onchange = () => {
    state.page = 1;
    refresh();
  };

  $("prev").onclick = () => {

    if (state.page > 1) {
      state.page--;
      render();
    }

  };

  $("next").onclick = () => {

    if (state.page < pages()) {
      state.page++;
      render();
    }

  };

  document
    .querySelectorAll("th[data-sort]")
    .forEach(th => {
      th.onclick = () => sortBy(th.dataset.sort);
    });

  $("entryForm").onsubmit = submitEntry;
}


/* =========================================================
   DEFAULT DATE
========================================================= */

function setDefaultDate() {

  const d = new Date();

  document.querySelector('[name="date"]').value =
    new Date(
      d - d.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 10);
}


/* =========================================================
   FETCH GOOGLE SHEETS DATA
========================================================= */

async function fetchData() {

  if (
    state.busy ||
    CONFIG.API_URL.includes("YOUR_GOOGLE")
  ) {
    return;
  }

  state.busy = true;

  try {

    const r = await fetch(CONFIG.API_URL, {
      cache: "no-store"
    });

    const j = await r.json();

    if (!j.success) {
      throw Error(j.error || "API error");
    }

    state.raw = normalize(j.data || []);

    populateFilters();

    refresh();

    $("lastUpdated").textContent =
      new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

  } catch (e) {

    console.error(e);

    toast(
      "Unable to load live Google Sheet data.",
      "error"
    );

  } finally {

    state.busy = false;

  }
}


/* =========================================================
   NORMALIZE DATA
========================================================= */

function normalize(rows) {

  let c = {
    date: "",
    billNo: "",
    salesman: "",
    particulars: "",
    materialCentre: ""
  };

  return rows.map(r => {

    if (valid(r.date)) {
      c.date = r.date;
    }

    if (valid(r.billNo)) {
      c.billNo = r.billNo;
    }

    if (valid(r.salesman)) {
      c.salesman = r.salesman;
    }

    if (valid(r.particulars)) {
      c.particulars = r.particulars;
    }

    if (valid(r.materialCentre)) {
      c.materialCentre = r.materialCentre;
    }

    return {
      ...r,

      date: c.date,
      billNo: c.billNo,
      salesman: c.salesman,
      particulars: c.particulars,
      materialCentre: c.materialCentre,

      qty: num(r.qty),
      price: num(r.price),
      amount: num(r.amount)
    };

  });
}


function valid(v) {

  return (
    v !== null &&
    v !== undefined &&
    String(v).trim() !== ""
  );

}


function num(v) {

  const n = Number(
    String(v ?? "").replace(/,/g, "")
  );

  return Number.isFinite(n) ? n : 0;

}


/* =========================================================
   DATE HELPERS
========================================================= */

function dateObj(v) {

  if (!v) {
    return null;
  }

  let s = String(v).trim();

  let m = s.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  );

  if (m) {
    return new Date(
      +m[3],
      +m[2] - 1,
      +m[1]
    );
  }

  m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/
  );

  if (m) {
    return new Date(
      +m[1],
      +m[2] - 1,
      +m[3]
    );
  }

  let d = new Date(s);

  return isNaN(d) ? null : d;
}


function displayDate(v) {

  let d = dateObj(v);

  return d
    ? `${String(d.getDate()).padStart(2, "0")}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${d.getFullYear()}`
    : v;

}


/* =========================================================
   FILTER DATA
========================================================= */

function refresh() {

  const s =
    $("searchInput")
      .value
      .toLowerCase()
      .trim();

  const sm = $("salesmanFilter").value;

  const mc = $("materialFilter").value;

  const from = $("fromDate").value;

  const to = $("toDate").value;


  $("dateError").textContent =
    from && to && from > to
      ? "From Date cannot be later than To Date."
      : "";


  state.filtered = state.raw.filter(r => {

    if (
      s &&
      ![
        r.particulars,
        r.itemDetails,
        r.alias,
        r.billNo,
        r.salesman
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    ) {
      return false;
    }


    if (
      sm &&
      r.salesman !== sm
    ) {
      return false;
    }


    if (
      mc &&
      r.materialCentre !== mc
    ) {
      return false;
    }


    let d = dateObj(r.date);


    if (
      from &&
      (
        !d ||
        d < new Date(from + "T00:00:00")
      )
    ) {
      return false;
    }


    if (
      to &&
      (
        !d ||
        d > new Date(to + "T23:59:59")
      )
    ) {
      return false;
    }


    return true;

  });


  state.filtered.sort(compare);


  /*
   * IMPORTANT
   * Keep current page valid after filtering.
   */

  const totalPages = pages();

  if (state.page > totalPages) {
    state.page = totalPages;
  }


  render();

}


/* =========================================================
   SORTING
========================================================= */

function compare(a, b) {

  let x = a[state.sortKey];
  let y = b[state.sortKey];


  if (state.sortKey === "date") {

    x =
      dateObj(x)?.getTime() || 0;

    y =
      dateObj(y)?.getTime() || 0;

  }


  else if (
    ["qty", "price", "amount"]
      .includes(state.sortKey)
  ) {

    x = num(x);
    y = num(y);

  }


  else {

    x =
      String(x ?? "")
        .toLowerCase();

    y =
      String(y ?? "")
        .toLowerCase();

  }


  return x < y
    ? state.sortDir === "asc"
      ? -1
      : 1
    : x > y
      ? state.sortDir === "asc"
        ? 1
        : -1
      : 0;

}


function sortBy(k) {

  if (state.sortKey === k) {

    state.sortDir =
      state.sortDir === "asc"
        ? "desc"
        : "asc";

  }

  else {

    state.sortKey = k;
    state.sortDir = "asc";

  }

  refresh();

}


/* =========================================================
   PAGINATION
========================================================= */

function pages() {

  return Math.max(
    1,
    Math.ceil(
      state.filtered.length /
      CONFIG.ROWS_PER_PAGE
    )
  );

}


/* =========================================================
   MAIN RENDER
========================================================= */

function render() {

  /*
   * NEW:
   * Update KPI cards
   */
  renderStats();

  renderSummary();

  renderChart();

  renderTable();

  renderPages();

}


/* =========================================================
   KPI STATISTICS
========================================================= */

function renderStats() {

  /*
   * Total Quantity
   */

  const totalQuantity =
    state.filtered.reduce(
      (total, row) => total + num(row.qty),
      0
    );


  /*
   * Total Amount
   */

  const totalAmount =
    state.filtered.reduce(
      (total, row) => total + num(row.amount),
      0
    );


  /*
   * Unique Salesmen
   */

  const salesmen = new Set(
    state.filtered
      .map(row => String(row.salesman || "").trim())
      .filter(Boolean)
  );


  /*
   * Total Records
   *
   * This is the number of records
   * after current filters.
   */

  const totalRecords =
    state.filtered.length;


  /*
   * Update Total Quantity
   */

  const quantityElement =
    $("totalQuantity");

  if (quantityElement) {

    quantityElement.textContent =
      money
        .format(totalQuantity)
        .replace(".00", "");

  }


  /*
   * Update Total Amount
   */

  const amountElement =
    $("totalAmount");

  if (amountElement) {

    amountElement.textContent =
      "₹" +
      money.format(totalAmount);

  }


  /*
   * Update Total Salesmen
   */

  const salesmanElement =
    $("totalSalesmen");

  if (salesmanElement) {

    salesmanElement.textContent =
      salesmen.size;

  }


  /*
   * Update Total Records
   */

  const recordsElement =
    $("totalRecords");

  if (recordsElement) {

    recordsElement.textContent =
      totalRecords.toLocaleString("en-IN");

  }

}


/* =========================================================
   SALESMAN SUMMARY
========================================================= */

function renderSummary() {

  const m = new Map();


  state.filtered.forEach(r => {

    let x =
      m.get(r.salesman) || {
        qty: 0,
        amount: 0,
        bills: new Set()
      };


    x.qty += r.qty;

    x.amount += r.amount;


    if (r.billNo) {
      x.bills.add(
        String(r.billNo)
      );
    }


    m.set(
      r.salesman,
      x
    );

  });


  const rows =
    [...m.entries()]
      .sort(
        (a, b) =>
          b[1].amount -
          a[1].amount
      );


  $("summaryBody").innerHTML =
    rows
      .map(
        ([n, x]) => `
          <tr>
            <td>${esc(n)}</td>

            <td>
              ${money
                .format(x.qty)
                .replace(".00", "")}
            </td>

            <td>
              ${money.format(x.amount)}
            </td>
          </tr>
        `
      )
      .join("");


  const totalQty =
    state.filtered.reduce(
      (a, r) =>
        a + r.qty,
      0
    );


  const totalAmount =
    state.filtered.reduce(
      (a, r) =>
        a + r.amount,
      0
    );


  $("summaryQty").textContent =
    money
      .format(totalQty)
      .replace(".00", "");


  $("summaryAmount").textContent =
    money.format(totalAmount);

}


/* =========================================================
   CHART
========================================================= */

function renderChart() {

  let m = new Map();


  state.filtered.forEach(r => {

    m.set(
      r.salesman,
      (m.get(r.salesman) || 0) +
      r.amount
    );

  });


  if (state.chart) {
    state.chart.destroy();
  }


  state.chart =
    new Chart(
      $("salesChart"),
      {
        type: "bar",

        data: {

          labels: [...m.keys()],

          datasets: [

            {
              data: [...m.values()],

              backgroundColor: [
                "#2878f0",
                "#55c997",
                "#ff9f43",
                "#7656e8",
                "#ef6b6b",
                "#39a9db"
              ],

              borderRadius: 2,

              barThickness: 22
            }

          ]

        },


        options: {

          responsive: true,

          maintainAspectRatio: false,


          plugins: {

            legend: {
              display: false
            },

            tooltip: {

              callbacks: {

                label: function(context) {

                  return (
                    " ₹" +
                    money.format(
                      context.raw
                    )
                  );

                }

              }

            }

          },


          scales: {

            x: {

              grid: {
                color: "#edf1f6"
              },

              ticks: {

                color: "#61758f",

                font: {
                  size: 9
                }

              }

            },


            y: {

              beginAtZero: true,

              grid: {
                color: "#e9eef5"
              },

              ticks: {

                color: "#61758f",

                font: {
                  size: 9
                },

                callback: function(v) {

                  return money
                    .format(v)
                    .replace(".00", "");

                }

              }

            }

          }

        }

      }
    );

}


/* =========================================================
   RECORDS TABLE
========================================================= */

function renderTable() {

  const start =
    (state.page - 1) *
    CONFIG.ROWS_PER_PAGE;


  const rows =
    state.filtered.slice(
      start,
      start + CONFIG.ROWS_PER_PAGE
    );


  $("recordsBody").innerHTML =
    rows
      .map(
        (r, i) => `
          <tr>

            <td>
              ${start + i + 1}
            </td>

            <td>
              ${esc(displayDate(r.date))}
            </td>

            <td>
              ${esc(r.billNo)}
            </td>

            <td>
              ${esc(r.salesman)}
            </td>

            <td>
              ${esc(r.particulars)}
            </td>

            <td>
              ${esc(r.itemDetails)}
            </td>

            <td>
              ${esc(r.alias || "-")}
            </td>

            <td>
              ${esc(r.materialCentre)}
            </td>

            <td>
              ${money
                .format(r.qty)
                .replace(".00", "")}
            </td>

            <td>
              ${esc(r.unit)}
            </td>

            <td>
              ${money.format(r.price)}
            </td>

            <td>
              ${money.format(r.amount)}
            </td>

          </tr>
        `
      )
      .join("");


  $("emptyState").style.display =
    rows.length
      ? "none"
      : "block";


  $("showing").textContent =
    state.filtered.length

      ? `Showing ${start + 1} to ${Math.min(
          start + CONFIG.ROWS_PER_PAGE,
          state.filtered.length
        )} of ${state.filtered.length} records`

      : "Showing 0 of 0 records";

}


/* =========================================================
   PAGINATION BUTTONS
========================================================= */

function renderPages() {

  const totalPages =
    pages();


  $("prev").disabled =
    state.page <= 1;


  $("next").disabled =
    state.page >= totalPages;


  let h = "";


  for (
    let i = 1;
    i <= Math.min(totalPages, 5);
    i++
  ) {

    h += `
      <button
        class="page ${
          i === state.page
            ? "active"
            : ""
        }"
        onclick="goPage(${i})"
      >
        ${i}
      </button>
    `;

  }


  if (totalPages > 5) {

    h += `
      <span>...</span>

      <button
        class="page ${
          state.page === totalPages
            ? "active"
            : ""
        }"
        onclick="goPage(${totalPages})"
      >
        ${totalPages}
      </button>
    `;

  }


  $("pageNumbers").innerHTML = h;

}


window.goPage = n => {

  state.page = n;

  render();

};


/* =========================================================
   POPULATE FILTERS
========================================================= */

function populateFilters() {

  const sm =
    [
      ...new Set(
        state.raw
          .map(r => r.salesman)
          .filter(Boolean)
      )
    ].sort();


  const mc =
    [
      ...new Set(
        state.raw
          .map(r => r.materialCentre)
          .filter(Boolean)
      )
    ].sort();


  const oldSm =
    $("salesmanFilter").value;


  const oldMc =
    $("materialFilter").value;


  $("salesmanFilter").innerHTML =
    '<option value="">All Salesman</option>' +
    sm
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");


  $("materialFilter").innerHTML =
    '<option value="">All Material Centre</option>' +
    mc
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");


  $("entrySalesman").innerHTML =
    '<option value="">Select Salesman</option>' +
    sm
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");


  $("entryMaterial").innerHTML =
    '<option value="">Select Centre</option>' +
    mc
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");


  $("salesmanFilter").value =
    oldSm;


  $("materialFilter").value =
    oldMc;

}


/* =========================================================
   ADD NEW ENTRY
========================================================= */

async function submitEntry(e) {
  e.preventDefault();

  $("formError").textContent = "";

  const formData = new FormData(e.target);
  const p = Object.fromEntries(formData.entries());

  p.date = String(p.date || "").trim();
  p.billNo = String(p.billNo || "").trim();
  p.salesman = String(p.salesman || "").trim();
  p.particulars = String(p.particulars || "").trim();
  p.itemDetails = String(p.itemDetails || "").trim();
  p.alias = String(p.alias || "").trim();
  p.materialCentre = String(p.materialCentre || "").trim();
  p.unit = String(p.unit || "").trim();

  p.qty = num(p.qty);
  p.price = num(p.price);

  if (!p.date) {
    $("formError").textContent = "Date is required.";
    return;
  }

  if (!p.salesman) {
    $("formError").textContent = "Salesman is required.";
    return;
  }

  if (!p.particulars) {
    $("formError").textContent = "Particulars / Customer is required.";
    return;
  }

  if (!p.itemDetails) {
    $("formError").textContent = "Item Details is required.";
    return;
  }

  if (!p.unit) {
    $("formError").textContent = "Unit is required.";
    return;
  }

  if (p.qty <= 0) {
    $("formError").textContent = "Quantity must be greater than zero.";
    return;
  }

  if (p.price < 0) {
    $("formError").textContent = "Price cannot be negative.";
    return;
  }

  if (!CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_GOOGLE")) {
    $("formError").textContent =
      "Configure the Apps Script URL in script.js.";
    return;
  }

  $("submitBtn").disabled = true;
  $("submitBtn").innerHTML = "<span>+</span> Adding...";

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(p),
      cache: "no-store"
    });

    const rawText = await response.text();

    let result;

    try {
      result = JSON.parse(rawText);
    } catch {
      throw new Error(
        "Apps Script returned an invalid response. Check the Web App deployment."
      );
    }

    if (!result.success) {
      throw new Error(
        result.error || "Unable to add entry."
      );
    }

    toast("✓ Entry added successfully");

    e.target.reset();
    setDefaultDate();

    await fetchData();
  } catch (err) {
    console.error("Entry submission error:", err);

    $("formError").textContent =
      err.message || "Failed to add entry.";

    toast(
      "✕ Failed to add entry",
      "error"
    );
  } finally {
    $("submitBtn").disabled = false;
    $("submitBtn").innerHTML =
      "<span>+</span> Add Entry";
  }
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function esc(v) {

  return String(v ?? "")
    .replace(
      /[&<>"']/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
    );

}


/* =========================================================
   TOAST
========================================================= */

function toast(msg, type = "ok") {

  let d =
    document.createElement("div");


  d.className =
    "toast " +
    (type === "error"
      ? "error"
      : "");


  d.textContent = msg;


  $("toast").appendChild(d);


  setTimeout(
    () => d.remove(),
    3500
  );

}