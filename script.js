// =======================
// 配置区（可选）
// =======================

// 1) 默认：把 JSON 里的 audio_path 取 basename，然后拼到 docs/audio/ 下
//    /nfs/.../Y01Kf9T7o2Zs.wav  ->  audio/Y01Kf9T7o2Zs.wav
//
// 2) 如果你音频在 CDN：把 AUDIO_BASE_URL 设成 "https://xxx.com/audio/"
//    那么最终会变成 https://xxx.com/audio/Y01Kf9T7o2Zs.wav
const AUDIO_BASE_URL = ""; // 例如 "https://your-cdn.com/audio/"

// 数据文件路径（因为你用 /docs 作为 Pages 根目录，所以这里用 ./）
const DATA_URL = "./data/samples.json";

let DATA = [];
let filtered = [];
let page = 1;

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
  const s = p.toString();
  const parts = s.split(/[\\/]/);
  return parts[parts.length - 1] || "";
}

function inferAudioUrl(item){
  // 1) 如果数据里已经有 audio_url，优先用
  if(item.audio_url) return item.audio_url;

  // 2) 否则从 audio_path 推断
  const name = basename(item.audio_path);
  if(!name) return "";

  if(AUDIO_BASE_URL){
    // CDN
    return AUDIO_BASE_URL.replace(/\/+$/,"/") + name;
  }
  // 本地 docs/audio/
  return "audio/" + name;
}

function pickText(item, field){
  const audioUrl = item._audio_url || "";
  if(field === "all"){
    return [
      item.id, item.final_caption, item.asr, item.final_caption_asr, audioUrl
    ].join("\n").toLowerCase();
  }
  return (item[field] ?? "").toString().toLowerCase();
}

function applyFilter(){
  const q = elQ.value.trim().toLowerCase();
  const field = elField.value;

  if(!q){
    filtered = DATA.slice();
  } else {
    filtered = DATA.filter(it => pickText(it, field).includes(q));
  }
  page = 1;
  render();
}

function paginate(arr, page, pageSize){
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return {
    items: arr.slice(start, start + pageSize),
    total,
    pages,
    page: p
  };
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    alert("已复制: " + text);
  }catch(e){
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("已复制: " + text);
  }
}

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
        <div class="badge">
          <span class="id">${id}</span>
        </div>
        <div class="actions">
          <button class="btn small" data-copy="${id}">复制ID</button>
          ${hasAudio ? `<a class="btn small" href="${audioUrl}" target="_blank" rel="noreferrer">打开音频</a>` : ""}
          ${hasAudio ? `<a class="btn small" href="${audioUrl}" download>下载音频</a>` : ""}
        </div>
      </div>

      ${hasAudio ? `
        <audio controls preload="none">
          <source src="${audioUrl}">
          你的浏览器不支持 audio 标签。
        </audio>
        <div class="k">audio_url</div>
        <div class="v">${audioUrl}</div>
      ` : `
        <div class="k">audio</div>
        <div class="v" style="color:var(--muted)">（未找到音频：需要 audio_path 或 audio_url。若使用 audio_path，请把音频放到 docs/audio/ 下）</div>
      `}

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

async function main(){
  // cache bust：避免你改了 JSON 但浏览器还用旧缓存
  const url = DATA_URL + `?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });

  if(!res.ok){
    throw new Error(`HTTP ${res.status} ${res.statusText}：${DATA_URL}\n请检查 docs/data/samples.json 是否存在，以及 Pages 是否选 /docs`);
  }

  const txt = await res.text();
  let arr;
  try{
    arr = JSON.parse(txt);
  }catch(e){
    throw new Error(`JSON 解析失败：${e.message}\n前200字符：\n${txt.slice(0,200)}`);
  }

  // 规范化 + 推断音频 url
  DATA = (Array.isArray(arr) ? arr : []).map(x => ({
    ...x,
    _audio_url: inferAudioUrl(x)
  }));

  filtered = DATA.slice();
  render();
}

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

main().catch(err => {
  console.error(err);
  elMeta.textContent = "加载失败：" + err.message;
  elMetaTop.textContent = "Error";
});
