// ===== 配置 =====
const DATA_URL = "./data/samples.json";
const AUDIO_DIR = "./audio/"; // audio/ 文件夹在仓库根目录下

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
const elAutoExpandJson = document.getElementById("autoExpandJson");

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

function inferAudioUrl(item){
  if(item.audio_url) return item.audio_url;

  const name = basename(item.audio_path);
  if(!name) return "";
  return AUDIO_DIR + name;
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
    toast("已复制");
  }catch{
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("已复制");
  }
}

// 极简 toast（不用额外库）
let toastTimer = null;
function toast(msg){
  clearTimeout(toastTimer);
  let el = document.getElementById("__toast");
  if(!el){
    el = document.createElement("div");
    el.id = "__toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "22px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 12px";
    el.style.border = "1px solid rgba(255,255,255,0.10)";
    el.style.borderRadius = "999px";
    el.style.background = "rgba(0,0,0,0.55)";
    el.style.backdropFilter = "blur(10px)";
    el.style.color = "rgba(233,238,248,0.95)";
    el.style.fontSize = "12px";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 900);
}

function stableStringify(obj){
  // 为了展示“完整 JSON”，这里保留所有字段（包括 audio_path 等）
  // 如果你不想展示派生字段，可以在这里删掉 _audio_url
  return JSON.stringify(obj, null, 2);
}

function pickText(item, field){
  if(field === "json"){
    return stableStringify(item).toLowerCase();
  }

  if(field === "all"){
    return [
      item.id,
      item.final_caption,
      item.asr,
      item.final_caption_asr,
      item.audio_path,
      item.audio_url,
      item._audio_url
    ].join("\n").toLowerCase();
  }

  return (item[field] ?? "").toString().toLowerCase();
}

// ===== 渲染 =====
function renderCard(item){
  const id = escapeHtml(item.id);
  const audioUrl = escapeHtml(item._audio_url || "");
  const hasAudio = Boolean(item._audio_url);

  const finalCaption = escapeHtml(item.final_caption || "");
  const asr = escapeHtml(item.asr || "");
  const finalCaptionAsr = escapeHtml(item.final_caption_asr || "");

  const rawJson = escapeHtml(stableStringify(item));
  const openJson = elAutoExpandJson?.checked ? "open" : "";

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="badge">
          <span class="id">${id}</span>
        </div>

        <div class="actions">
          <button class="btn ghost" data-copy="${id}" type="button">复制ID</button>
          <button class="btn primary" data-copyjson="${id}" type="button">复制JSON</button>
          ${hasAudio ? `<a class="btn ghost" href="${audioUrl}" target="_blank" rel="noreferrer">打开音频</a>` : ""}
          ${hasAudio ? `<a class="btn ghost" href="${audioUrl}" download>下载</a>` : ""}
        </div>
      </div>

      <div class="section">
        <div class="k">audio_url（推断/直给）</div>
        <div class="v">${hasAudio ? audioUrl : "<span style='color:var(--muted)'>（无音频：缺少 audio_path/audio_url 或文件未放入 audio/）</span>"}</div>

        ${hasAudio ? `
          <audio controls preload="none">
            <source src="${audioUrl}">
            你的浏览器不支持 audio 标签。
          </audio>
        ` : ""}
      </div>

      <div class="section">
        <div class="k">final_caption</div>
        <div class="v">${finalCaption || "<span style='color:var(--muted)'>（空）</span>"}</div>
      </div>

      <div class="section">
        <div class="k">asr</div>
        <div class="v">${asr || "<span style='color:var(--muted)'>（空）</span>"}</div>
      </div>

      <div class="section">
        <div class="k">final_caption_asr</div>
        <div class="v">${finalCaptionAsr || "<span style='color:var(--muted)'>（空）</span>"}</div>
      </div>

      <details ${openJson}>
        <summary>Raw JSON（完整内容）</summary>
        <pre class="json">${rawJson}</pre>
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

  // 绑定复制按钮
  elList.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy")));
  });

  // 绑定复制 JSON：通过 id 找到对应 item
  elList.querySelectorAll("[data-copyjson]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-copyjson");
      const item = DATA.find(x => x.id === id);
      if(!item) return toast("未找到该条目");
      copyToClipboard(stableStringify(item));
    });
  });
}

// ===== 交互 =====
function applyFilter(){
  const q = elQ.value.trim().toLowerCase();
  const field = elField.value;

  if(!q){
    filtered = DATA.slice();
  }else{
    filtered = DATA.filter(it => pickText(it, field).includes(q));
  }

  page = 1;
  render();
}

async function main(){
  const res = await fetch(DATA_URL + `?t=${Date.now()}`, { cache: "no-store" });
  if(!res.ok){
    throw new Error(`HTTP ${res.status}：取不到 ${DATA_URL}（检查 data/samples.json 是否存在/大小写）`);
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

  // 保留原始字段，并添加派生字段 _audio_url 供页面使用
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
elAutoExpandJson.addEventListener("change", () => render());

// 启动
main().catch(err => {
  console.error(err);
  elMeta.textContent = "加载失败：" + err.message;
  elMetaTop.textContent = "Error";
});
