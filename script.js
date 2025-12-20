// ===== 配置 =====
const DATA_URL = "./data/samples.json";   // 数据文件
const AUDIO_DIR = "./audio/";             // 仓库根目录下的 audio/ 文件夹（末尾带 / 更安全）

// ===== 状态 =====
let DATA = [];
let filtered = [];
let page = 1;

// ===== 元素 =====
const elList = document.getElementById("list");
const elMeta = document.getElementById("meta");
const elMetaTop = document.getElementById("metaTop");

const elQ = document.getElementById("q");
const elField = document.getElementById("field");
const elPageSize = document.getElementById("pageSize");
const elPrev = document.getElementById("prev");
const elNext = document.getElementById("next");
const elPageInfo = document.getElementById("pageInfo");
const elClear = document.getElementById("clear");

// ===== 工具函数 =====
function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function basename(p){
  if(!p) return "";
  const parts = p.toString().split(/[\\/]/);
  return parts[parts.length - 1] || "";
}

// 推断音频 URL：
// 1) 有 audio_url -> 用它
// 2) 否则 audio_path -> 取文件名 -> AUDIO_DIR + 文件名
function inferAudioUrl(item){
  if(item.audio_url) return item.audio_url;

  const name = basename(item.audio_path);
  if(!name) return "";
  return AUDIO_DIR + name;
}

function pickText(item, field){
  if(field === "all"){
    return [item.id, item.final_caption, item.asr, item.final_caption_asr, item._audio_url]
      .join("\n")
      .toLowerCase();
  }
  return (item[field] ?? "").toString().toLowerCase();
}

function paginate(arr, page, pageSize){
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return { items: arr.slice(start, start + pageSize), total, pages, page: p };
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    alert("已复制: " + text);
  }catch{
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("已复制: " + text);
  }
}

// ===== 渲染 =====
function renderCard(item){
  const id = escapeHtml(item.id);
  const audioUrl = escapeHtml(item._audio_url || "");

  const finalCaption = escapeHtml(item.final_caption || "");
  const asr = escapeHtml(item.asr || "");
  const finalCaptionAsr = escapeHtml(item.final_caption_asr || "");

  const hasAudio = Boolean(item._audio_url);

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="badge"><span class="id">${id}</span></div>
        <div class="actions">
          <button class="btn small" data-copy="${id}">复制ID</button>
          ${hasAudio ? `<a class="btn small" href="${audioUrl}" target="_blank" rel="noreferrer">打开音频</a>` : ""}
          ${hasAudio ? `<a class="btn small" href="${audioUrl}" download>下载</a>` : ""}
        </div>
      </div>

      <div class="k">audio_url（推断/直给）</div>
      <div class="v">${hasAudio ? audioUrl : "<span style='color:var(--muted)'>（空：缺少 audio_path/audio_url，或 audio_path 不包含文件名）</span>"}</div>

      ${hasAudio ? `
        <audio controls preload="none">
          <source src="${audioUrl}">
          你的浏览器不支持 audio 标签。
        </audio>
      ` : ""}

      <div class="kv">
        <div class="k">final_caption</div>
        <div class="v">${finalCaption || "<span style='color:var(--muted)'>（空）</span>"}</div>

        <div class="k">asr</div>
        <div class="v">${asr || "<span style='color:var(--muted)'>（空）</span>"}</div>
      </div>

      <details>
        <summary>展开查看 final_caption_asr</summary>
        <div class="v" style="margin-top:8px">${finalCaptionAsr || "<span style='color:var(--muted)'>（空）</span>"}</div>
      </details>
    </article>
  `;
}

function render(){
  const pageSize = parseInt(elPageSize.value, 10);
  const { items, total, pages, page: p } = paginate(filtered, page, pageSize);
  page = p;

  elMeta.textContent = `共 ${DATA.length} 条 | 当前匹配 ${total} 条`;
  elMetaTop.textContent = `Page ${page}/${pages}`;

  elList.innerHTML = items.map(renderCard).join("");

  elPrev.disabled = (page <= 1);
  elNext.disabled = (page >= pages);
  elPageInfo.textContent = `第 ${page} / ${pages} 页`;

  elList.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy")));
  });
}

// ===== 交互 =====
function applyFilter(){
  const q = elQ.value.trim().toLowerCase();
  const field = elField.value;

  if(!q) filtered = DATA.slice();
  else filtered = DATA.filter(it => pickText(it, field).includes(q));

  page = 1;
  render();
}

async function main(){
  // cache bust：避免你改 JSON 但浏览器没更新
  const res = await fetch(DATA_URL + `?t=${Date.now()}`, { cache: "no-store" });
  if(!res.ok){
    throw new Error(`HTTP ${res.status}：取不到 ${DATA_URL}（检查文件是否存在/大小写是否正确）`);
  }

  const txt = await res.text();
  let arr;
  try{
    arr = JSON.parse(txt);
  }catch(e){
    throw new Error(`JSON 解析失败：${e.message}`);
  }

  if(!Array.isArray(arr)){
    throw new Error("samples.json 顶层必须是数组（[...]）");
  }

  DATA = arr.map(x => ({
    ...x,
    _audio_url: inferAudioUrl(x)
  }));

  filtered = DATA.slice();
  render();
}

// 绑定事件
elQ.addEventListener("input", applyFilter);
elField.addEventListener("change", applyFilter);
elPageSize.addEventListener("change", () => { page = 1; render(); });

elPrev.addEventListener("click", () => { page -= 1; render(); });
elNext.addEventListener("click", () => { page += 1; render(); });

elClear.addEventListener("click", () => {
  elQ.value = "";
  elField.value = "all";
  applyFilter();
});

// 启动
main().catch(err => {
  console.error(err);
  elMeta.textContent = "加载失败：" + err.message;
  elMetaTop.textContent = "Error";
});
