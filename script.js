// ===== 配置区 =====
const CONFIG = {
  dataUrl: "./data/samples.json",
  audioBaseDir: "./audio/",
  itemsPerPage: 20,
};

// ===== 状态管理 =====
const state = {
  rawData: [],
  filteredData: [],
  currentPage: 1,
  pageSize: CONFIG.itemsPerPage,
  searchQuery: "",
  searchField: "all",
};

// ===== DOM 元素缓存 =====
const els = {
  grid: document.getElementById("gridContainer"),
  pageInfo: document.getElementById("pageInfo"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  searchInput: document.getElementById("searchInput"),
  searchField: document.getElementById("searchField"),
  totalCount: document.getElementById("totalCount"),
  radioPageSizes: document.querySelectorAll('input[name="pageSize"]'),
  resetBtn: document.getElementById("resetBtn"),
  toast: document.getElementById("toast"),
};

// ===== 工具函数 =====
const getBasename = (path) => path ? path.split(/[\\/]/).pop() : "";

const getAudioUrl = (item) => {
  if (item.audio_url) return item.audio_url;
  const filename = getBasename(item.audio_path);
  return filename ? CONFIG.audioBaseDir + filename : null;
};

const syntaxHighlight = (json) => {
  if (typeof json !== 'string') json = JSON.stringify(json, undefined, 2);
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
    let cls = 'json-number';
    if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
    else if (/true|false/.test(match)) cls = 'json-boolean';
    else if (/null/.test(match)) cls = 'json-null';
    return `<span class="${cls}">${match}</span>`;
  });
};

const highlightText = (text, query) => {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
  return text.toString().replace(regex, "<mark>$1</mark>");
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制到剪贴板");
  } catch (err) {
    showToast("复制失败");
  }
};

const showToast = (msg) => {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 2000);
};

// ===== 核心逻辑 =====
async function init() {
  try {
    const res = await fetch(CONFIG.dataUrl + `?t=${Date.now()}`);
    if (!res.ok) throw new Error("无法加载数据");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("数据格式错误，应为数组");

    state.rawData = data.map(item => ({
      ...item,
      _audio_url: getAudioUrl(item)
    }));
    
    state.filteredData = [...state.rawData];
    render();
    setupEventListeners();
  } catch (e) {
    els.grid.innerHTML = `<div style="text-align:center; padding:40px; color:#ff7b72;">错误: ${e.message}</div>`;
  }
}

function applyFilter() {
  const q = state.searchQuery.toLowerCase().trim();
  const field = state.searchField;

  if (!q) {
    state.filteredData = [...state.rawData];
  } else {
    state.filteredData = state.rawData.filter(item => {
      // 辅助函数：安全获取字段并转小写
      const val = (k) => (item[k] || "").toString().toLowerCase();

      if (field === "all") {
        return (
          val("id").includes(q) ||
          val("final_caption_asr").includes(q) || // 重点搜索这个字段
          val("final_caption").includes(q) ||
          val("asr").includes(q) ||
          JSON.stringify(item).toLowerCase().includes(q)
        );
      } else {
        return val(field).includes(q);
      }
    });
  }

  state.currentPage = 1;
  render();
}

function render() {
  els.totalCount.textContent = `${state.filteredData.length} Items`;
  
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = state.filteredData.slice(start, end);
  const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;

  els.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages} (Total ${state.filteredData.length})`;
  els.prevBtn.disabled = state.currentPage === 1;
  els.nextBtn.disabled = state.currentPage === totalPages;

  if (pageItems.length === 0) {
    els.grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">无匹配结果</div>`;
    return;
  }

  els.grid.innerHTML = pageItems.map(item => createCardHTML(item)).join("");
  
  // 绑定事件
  document.querySelectorAll(".copy-json-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("button").dataset.id;
      const item = state.rawData.find(i => i.id === id);
      copyToClipboard(JSON.stringify(item, null, 2));
    });
  });

  document.querySelectorAll(".card-id").forEach(el => {
    el.addEventListener("click", (e) => copyToClipboard(e.target.innerText));
  });
}

function createCardHTML(item) {
  const q = state.searchQuery.trim();
  const hasAudio = !!item._audio_url;
  
  // 这里只提取 final_caption_asr
  const fullCaption = item.final_caption_asr || item.final_caption || ""; 
  const captionHtml = highlightText(fullCaption, q);
  const jsonHtml = syntaxHighlight(item);

  return `
    <article class="card">
      <div class="card-header">
        <span class="card-id" title="点击复制 ID">${highlightText(item.id, q)}</span>
        <div class="card-actions">
          ${hasAudio ? `<a href="${item._audio_url}" download class="action-btn" title="下载音频"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></a>` : ''}
          <button class="action-btn copy-json-btn" data-id="${item.id}" title="复制 JSON">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>

      <div class="audio-wrapper">
        ${hasAudio 
          ? `<audio controls preload="none" src="${item._audio_url}"></audio>`
          : `<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">无音频文件</div>`
        }
      </div>

      <!-- 单一的 Caption 展示区域 -->
      <div class="text-block">
        <h4>Final Caption ASR</h4>
        <div class="text-content full-text">${captionHtml}</div>
      </div>

      <details class="json-box">
        <summary>View Raw JSON</summary>
        <pre class="json-code"><code>${jsonHtml}</code></pre>
      </details>
    </article>
  `;
}

function setupEventListeners() {
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value;
      applyFilter();
    }, 300);
  });

  els.searchField.addEventListener("change", (e) => {
    state.searchField = e.target.value;
    applyFilter();
  });

  els.radioPageSizes.forEach(radio => {
    radio.addEventListener("change", (e) => {
      state.pageSize = parseInt(e.target.value);
      state.currentPage = 1;
      render();
      els.grid.scrollTop = 0;
    });
  });

  els.prevBtn.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      render();
      els.grid.scrollTop = 0;
    }
  });

  els.nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(state.filteredData.length / state.pageSize);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      render();
      els.grid.scrollTop = 0;
    }
  });

  els.resetBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    state.searchQuery = "";
    state.searchField = "all";
    els.searchField.value = "all";
    applyFilter();
  });
}

init();
