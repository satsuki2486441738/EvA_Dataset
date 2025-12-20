let DATA = [];
let filtered = [];

const elList = document.getElementById("list");
const elMeta = document.getElementById("meta");
const elQ = document.getElementById("q");

function escapeHtml(s) {
    return (s ?? "").toString()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function render() {
    elMeta.textContent = `共 ${DATA.length} 条 | 当前匹配 ${filtered.length} 条`;
    elList.innerHTML = filtered.map(item => `
    <div class="card">
      <div class="id">ID: ${escapeHtml(item.id)}</div>

      <div class="k">final_caption</div>
      <div class="v">${escapeHtml(item.final_caption)}</div>

      <div class="k">asr</div>
      <div class="v">${escapeHtml(item.asr)}</div>

      <div class="k">final_caption_asr</div>
      <div class="v">${escapeHtml(item.final_caption_asr)}</div>
    </div>
  `).join("");
}

function applyFilter() {
    const q = elQ.value.trim().toLowerCase();
    if (!q) {
        filtered = DATA.slice();
    } else {
        filtered = DATA.filter(x =>
            [x.id, x.final_caption, x.asr, x.final_caption_asr]
                .join("\n")
                .toLowerCase()
                .includes(q)
        );
    }
    render();
}

async function main() {
    const res = await fetch("data/samples.json", { cache: "no-store" });
    DATA = await res.json();
    filtered = DATA.slice();
    render();
}

elQ.addEventListener("input", applyFilter);
main().catch(err => {
    console.error(err);
    elMeta.textContent = "加载失败：请检查 data/samples.json 是否存在、文件名是否正确。";
});
