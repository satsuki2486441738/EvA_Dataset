let DATA = [];
let filtered = [];

const elList = document.getElementById("list");
const elMeta = document.getElementById("meta");
const elQ = document.getElementById("q");

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

// 关键：从 audio_url 或 audio_path 推断可访问的相对路径
function getAudioUrl(item){
  if(item.audio_url) return item.audio_url;              // 如果你以后改成 audio_url，优先用
  const name = basename(item.audio_path);                // 你现在是 /nfs/.../Yxxxx.wav
  if(!name) return "";
  return "./audio/" + name;                              // 对应 docs/audio/Yxxxx.wav
}

function render(){
  elMeta.textContent = `共 ${DATA.length} 条 | 当前匹配 ${filtered.length} 条`;

  elList.innerHTML = filtered.map(item => {
    const audioUrl = getAudioUrl(item);
    return `
      <div class="card">
        <div class="id">ID: ${escapeHtml(item.id)}</div>

        ${audioUrl ? `
          <div class="k">audio</div>
          <div class="v">${escapeHtml(audioUrl)}</div>
          <audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>
          <div style="margin-top:6px">
            <a href="${escapeHtml(audioUrl)}" target="_blank" rel="noreferrer">打开音频</a>
          </div>
        ` : `
          <div class="k">audio</div>
          <div class="v" style="color:#a8b0c2">（未推断到音频：需要 audio_path 或 audio_url）</div>
        `}

        <div class="k">final_caption</div>
        <div class="v">${escapeHtml(item.final_caption || "")}</div>

        <div class="k">asr</div>
        <div class="v">${escapeHtml(item.asr || "")}</div>

        <div class="k">final_caption_asr</div>
        <div class="v">${escapeHtml(item.final_caption_asr || "")}</div>
      </div>
    `;
  }).join("");
}

function applyFilter(){
  const q = elQ.value.trim().toLowerCase();
  if(!q){
    filtered = DATA.slice();
  } else {
    filtered = DATA.filter(x =>
      [x.id, x.final_caption, x.asr, x.final_caption_asr, x.audio_path, x.audio_url]
        .join("\n")
        .toLowerCase()
        .includes(q)
    );
  }
  render();
}

async function main(){
  // cache bust，避免你更新文件但页面还是旧的
  const res = await fetch("./data/samples.json?t=" + Date.now(), { cache:"no-store" });
  if(!res.ok) throw new Error("取不到 ./data/samples.json（确认在 docs/data/samples.json）");

  const txt = await res.text();
  DATA = JSON.parse(txt);
  filtered = DATA.slice();
  render();
}

elQ.addEventListener("input", applyFilter);

main().catch(err => {
  console.error(err);
  elMeta.textContent = "加载失败：" + err.message;
});
