const KEY = "yeie_v01";

let state = JSON.parse(localStorage.getItem(KEY) || '{"entries":[],"ideas":[]}');
let editingEntryId = null;
let editingIdeaId = null;

const $ = id => document.getElementById(id);
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

function formatDate(iso){
  return new Date(iso).toLocaleString([], {
    month:"short", day:"numeric", year:"numeric",
    hour:"numeric", minute:"2-digit"
  });
}

function showView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === id));
}

function renderJournal(){
  $("entryCount").textContent = state.entries.length;
  const box = $("recentEntries");
  if(!state.entries.length){
    box.className = "entries empty-state";
    box.innerHTML = "<p>No entries yet.</p><p>Start with whatever is on your mind.</p>";
    return;
  }
  box.className = "entries";
  box.innerHTML = [...state.entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    .map(e => `<article class="card"><button onclick="openEntry('${e.id}')">
      <div class="card-title">${escapeHtml(e.title || "Untitled")}</div>
      <div class="card-date">${formatDate(e.createdAt)}</div>
      <div class="card-preview">${escapeHtml(e.body || "")}</div>
    </button></article>`).join("");
}

function renderIdeas(){
  const box = $("ideasList");
  if(!state.ideas.length){
    box.className = "entries empty-state";
    box.innerHTML = "<p>No ideas yet.</p><p>Keep the sparks before they disappear.</p>";
    return;
  }
  box.className = "entries";
  box.innerHTML = [...state.ideas].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    .map(i => `<article class="card"><button onclick="openIdea('${i.id}')">
      <div class="card-title">${escapeHtml(i.title || "Untitled idea")}</div>
      <div class="card-date">${formatDate(i.createdAt)}</div>
      <div class="card-preview">${escapeHtml(i.body || "")}</div>
    </button></article>`).join("");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function openEntry(id){
  const e = state.entries.find(x=>x.id===id);
  if(!e) return;
  editingEntryId = id;
  $("titleInput").value = e.title || "";
  $("bodyInput").value = e.body || "";
  $("deleteBtn").classList.remove("hidden");
  showView("entryView");
}

function newEntry(){
  editingEntryId = null;
  $("titleInput").value = "";
  $("bodyInput").value = "";
  $("deleteBtn").classList.add("hidden");
  showView("entryView");
  setTimeout(()=>$("titleInput").focus(),50);
}

function openIdea(id){
  const i = state.ideas.find(x=>x.id===id);
  if(!i) return;
  editingIdeaId = id;
  $("ideaInput").value = i.title || "";
  $("ideaBodyInput").value = i.body || "";
  $("ideaDeleteBtn").classList.remove("hidden");
  showView("ideaView");
}

function newIdea(){
  editingIdeaId = null;
  $("ideaInput").value = "";
  $("ideaBodyInput").value = "";
  $("ideaDeleteBtn").classList.add("hidden");
  showView("ideaView");
  setTimeout(()=>$("ideaInput").focus(),50);
}

$("newEntryBtn").onclick = newEntry;
$("newIdeaBtn").onclick = newIdea;
$("backBtn").onclick = () => { renderJournal(); showView("homeView"); };
$("ideaBackBtn").onclick = () => { renderIdeas(); showView("ideasView"); };

$("entryForm").onsubmit = e => {
  e.preventDefault();
  const title = $("titleInput").value.trim();
  const body = $("bodyInput").value.trim();
  if(!title && !body) return;
  if(editingEntryId){
    const entry = state.entries.find(x=>x.id===editingEntryId);
    entry.title = title; entry.body = body; entry.updatedAt = new Date().toISOString();
  } else {
    state.entries.push({id:crypto.randomUUID(), title, body, createdAt:new Date().toISOString()});
  }
  save(); renderJournal(); showView("homeView");
};

$("deleteBtn").onclick = () => {
  if(!editingEntryId || !confirm("Delete this entry?")) return;
  state.entries = state.entries.filter(x=>x.id!==editingEntryId);
  save(); renderJournal(); showView("homeView");
};

$("ideaForm").onsubmit = e => {
  e.preventDefault();
  const title = $("ideaInput").value.trim();
  const body = $("ideaBodyInput").value.trim();
  if(!title && !body) return;
  if(editingIdeaId){
    const idea = state.ideas.find(x=>x.id===editingIdeaId);
    idea.title = title; idea.body = body; idea.updatedAt = new Date().toISOString();
  } else {
    state.ideas.push({id:crypto.randomUUID(), title, body, createdAt:new Date().toISOString()});
  }
  save(); renderIdeas(); showView("ideasView");
};

$("ideaDeleteBtn").onclick = () => {
  if(!editingIdeaId || !confirm("Delete this idea?")) return;
  state.ideas = state.ideas.filter(x=>x.id!==editingIdeaId);
  save(); renderIdeas(); showView("ideasView");
};

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    renderJournal(); renderIdeas(); showView(btn.dataset.view);
  };
});

$("lockBtn").onclick = () => $("privacyModal").classList.remove("hidden");
$("closeModal").onclick = () => $("privacyModal").classList.add("hidden");
$("privacyModal").onclick = e => { if(e.target.id==="privacyModal") $("privacyModal").classList.add("hidden"); };

renderJournal();
renderIdeas();

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
