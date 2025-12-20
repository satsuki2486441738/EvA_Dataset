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

// 获取文件名
const getBasename = (path) => {
  if (!path) return "";
  return path.split(/[\\/]/).pop();
};

// 推断音频 URL
const getAudioUrl = (item) => {
  // 优先使用 audio_url
  if (item.audio_url) return item.audio_url;
  // 其次从 audio_path 推断
  const filename = getBasename(item.audio_path);
  if (filename) return CONFIG.audioBaseDir + filename;
  return null;
};

// 简单的 JSON 语法高亮
const syntaxHighlight = (json) => {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
};

// 文本高亮
const highlightText = (text, query) => {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
  return text.toString().replace(regex, "<mark>$1</mark>");
};

// 复制到剪贴板
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

// 初始化
async function init() {
  try {
    const res = await fetch(CONFIG.dataUrl + `?t=${Date.now()}`);
    if (!res.ok) throw new Error("无法加载数据");
    const data = await res.json();
    
    if (!Array.isArray(data)) throw new Error("数据格式错误，应为数组");

    // 预处理数据：增加 _audio_url 字段
    state.rawData = data.map(item => ({
      ...item,
      _audio_url: getAudioUrl(item)
    }));
    
    // 初始全量数据
    state.filteredData = [...state.rawData];
    
    render();
    setupEventListeners();
  } catch (e) {
    els.grid.innerHTML = `<div style="text-align:center; padding:40px; color:#ff7b72;">错误: ${e.message}</div>`;
  }
}

// 过滤逻辑
function applyFilter() {
  const q = state.searchQuery.toLowerCase().trim();
  const field = state.searchField;

  if (!q) {
    state.filteredData = [...state.rawData];
  } else {
    state.filteredData = state.rawData.filter(item => {
      if (field === "all") {
        return (
          (item.id && item.id.toLowerCase().includes(q)) ||
          (item.final_caption && item.final_caption.toLowerCase().includes(q)) ||
          (item.asr && item.asr.toLowerCase().includes(q)) ||
          (JSON.stringify(item).toLowerCase().includes(q))
        );
      } else {
        return item[field] && item[field].toString().toLowerCase().includes(q);
      }
    });
  }

  // 重置回第一页
  state.currentPage = 1;
  render();
}

// 渲染主函数
function render() {
  // 更新统计
  els.totalCount.textContent = `${state.filteredData.length} Items`;
  
  // 计算分页
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = state.filteredData.slice(start, end);
  const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;

  // 渲染分页控件状态
  els.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages} (Total ${state.filteredData.length})`;
  els.prevBtn.disabled = state.currentPage === 1;
  els.nextBtn.disabled = state.currentPage === totalPages;

  // 渲染卡片
  if (pageItems.length === 0) {
    els.grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">无匹配结果</div>`;
    return;
  }

  els.grid.innerHTML = pageItems.map(item => createCardHTML(item)).join("");
  
  // 重新绑定卡片内部事件（如 JSON 复制）
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

// 生成单张卡片 HTML
function createCardHTML(item) {
  const q = state.searchQuery.trim();
  const hasAudio = !!item._audio_url;
  
  const captionHtml = highlightText(item.final_caption || "N/A", q);
  const asrHtml = highlightText(item.asr || "N/A", q);
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

      <div class="text-block">
        <h4>Caption</h4>
        <div class="text-content">${captionHtml}</div>
      </div>

      <div class="text-block">
        <h4>ASR</h4>
        <div class="text-content" style="color:var(--text-muted)">${asrHtml}</div>
      </div>

      <details class="json-box">
        <summary>View Raw JSON</summary>
        <pre class="json-code"><code>${jsonHtml}</code></pre>
      </details>
    </article>
  `;
}

// 事件监听设置
function setupEventListeners() {
  // 搜索输入（防抖）
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value;
      applyFilter();
    }, 300);
  });

  // 搜索字段切换
  els.searchField.addEventListener("change", (e) => {
    state.searchField = e.target.value;
    applyFilter();
  });

  // 每页条数切换
  els.radioPageSizes.forEach(radio => {
    radio.addEventListener("change", (e) => {
      state.pageSize = parseInt(e.target.value);
      state.currentPage = 1;
      render();
      els.grid.scrollTop = 0; // 回到顶部
    });
  });

  // 翻页
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

  // 重置
  els.resetBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    state.searchQuery = "";
    state.searchField = "all";
    els.searchField.value = "all";
    applyFilter();
  });
}

// 启动
init();
