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
          <button class="btn primary" data-copyjson="${id}"
