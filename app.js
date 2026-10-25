const API = "https://api.harvardartmuseums.org";
const PAGE_SIZE = 24;
const LIST_FIELDS = "id,title,people,dated,classification,culture,primaryimageurl";

const $ = (id) => document.getElementById(id);
const state = { page: 1, pages: 1 };

function getKey() {
  if (window.HAM_API_KEY) return window.HAM_API_KEY;
  try { return localStorage.getItem("ham_api_key") || ""; } catch { return ""; }
}

function askForKey() {
  return new Promise((resolve) => {
    const dlg = $("key-dialog");
    $("key-form").onsubmit = () => {
      const key = $("key-input").value.trim();
      try { localStorage.setItem("ham_api_key", key); } catch {}
      resolve(key);
    };
    dlg.showModal();
  });
}

async function api(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set("apikey", getKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null) url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (res.status === 401) {
    try { localStorage.removeItem("ham_api_key"); } catch {}
    throw new Error("That API key was rejected. Reload the page to enter it again.");
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const artistOf = (o) => o.people?.find((p) => p.role === "Artist")?.name || o.people?.[0]?.name || "Unknown artist";
const sized = (url, w) => (url ? `${url}?width=${w}` : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadClassifications() {
  const data = await api("/classification", { size: 100, sort: "name" });
  const select = $("classification");
  for (const c of data.records) {
    if (!c.objectcount) continue;
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.objectcount.toLocaleString()})`;
    select.append(opt);
  }
}

async function loadPage(page = 1) {
  const [sort, sortorder] = $("sort").value.split(":");
  $("status").textContent = "Loading…";
  $("grid").setAttribute("aria-busy", "true");
  try {
    const data = await api("/object", {
      size: PAGE_SIZE,
      page,
      fields: LIST_FIELDS,
      keyword: $("keyword").value.trim(),
      classification: $("classification").value,
      hasimage: $("hasimage").checked ? 1 : "",
      sort,
      sortorder,
    });
    state.page = data.info.page;
    state.pages = data.info.pages;
    renderGrid(data.records || []);
    $("status").textContent = `${data.info.totalrecords.toLocaleString()} works`;
    $("page-info").textContent = `Page ${state.page.toLocaleString()} of ${state.pages.toLocaleString()}`;
    $("prev").disabled = state.page <= 1;
    $("next").disabled = state.page >= state.pages;
  } catch (err) {
    $("status").textContent = err.message;
  } finally {
    $("grid").removeAttribute("aria-busy");
  }
}

function renderGrid(records) {
  $("grid").innerHTML = records.map((o) => `
    <button class="card" data-id="${o.id}">
      <div class="thumb">${o.primaryimageurl
        ? `<img src="${esc(sized(o.primaryimageurl, 400))}" alt="${esc(o.title)}" loading="lazy">`
        : "No image"}</div>
      <div class="meta">
        <h3>${esc(o.title)}</h3>
        <p>${esc(artistOf(o))}</p>
        <p>${esc([o.dated, o.classification].filter(Boolean).join(" · "))}</p>
      </div>
    </button>`).join("");
}

async function showDetail(id) {
  const dlg = $("detail");
  $("detail-body").innerHTML = `<p style="padding:28px">Loading…</p>`;
  dlg.showModal();
  try {
    const o = await api(`/object/${id}`);
    const rows = [
      ["Date", o.dated], ["Culture", o.culture], ["Period", o.period],
      ["Classification", o.classification], ["Medium", o.medium], ["Technique", o.technique],
      ["Dimensions", o.dimensions], ["Department", o.department],
      ["Object number", o.objectnumber], ["Credit", o.creditline],
    ].filter(([, v]) => v);
    $("detail-body").innerHTML = `
      <div class="detail-layout">
        <div class="img">${o.primaryimageurl
          ? `<img src="${esc(sized(o.primaryimageurl, 1200))}" alt="${esc(o.title)}">`
          : `<p style="color:#aaa">No image available</p>`}</div>
        <div class="info">
          <h2>${esc(o.title)}</h2>
          <p class="artist">${esc(artistOf(o))}</p>
          <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
          ${o.description ? `<p>${esc(o.description)}</p>` : ""}
          ${o.url ? `<p><a href="${esc(o.url)}" target="_blank" rel="noopener">View on harvardartmuseums.org ↗</a></p>` : ""}
        </div>
      </div>`;
  } catch (err) {
    $("detail-body").innerHTML = `<p style="padding:28px">${esc(err.message)}</p>`;
  }
}

$("search-form").addEventListener("submit", (e) => { e.preventDefault(); loadPage(1); });
$("sort").addEventListener("change", () => loadPage(1));
$("classification").addEventListener("change", () => loadPage(1));
$("prev").addEventListener("click", () => { loadPage(state.page - 1); scrollTo({ top: 0, behavior: "smooth" }); });
$("next").addEventListener("click", () => { loadPage(state.page + 1); scrollTo({ top: 0, behavior: "smooth" }); });
$("grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) showDetail(card.dataset.id);
});
$("detail").querySelector(".close").addEventListener("click", () => $("detail").close());
$("detail").addEventListener("click", (e) => { if (e.target === $("detail")) $("detail").close(); });

(async function init() {
  if (!getKey()) await askForKey();
  loadClassifications().catch(() => {});
  loadPage(1);
})();
