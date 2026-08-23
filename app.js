const KEY="yeie_v01", DRAFT_KEY="yeie_current_draft_v027", LOCK_HOURS=24;
const $=id=>document.getElementById(id);
let state, editingEntryId=null, autosaveTimer=null, countdownTimer=null, draftTimer=null;

try{
  state=JSON.parse(localStorage.getItem(KEY)||'{"entries":[],"ideas":[]}');
  state.entries ??=[];
  state.ideas ??=[];
}catch{state={entries:[],ideas:[]}}

const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const formatDate=iso=>new Date(iso).toLocaleString([],{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const isLocked=e=>Date.now()-new Date(e.createdAt).getTime()>=LOCK_HOURS*3600000;

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  scrollTo(0,0);
}

function timeLeftLabel(entry){
  const remaining=Math.max(0,(new Date(entry.createdAt).getTime()+LOCK_HOURS*3600000)-Date.now());
  const minutes=Math.ceil(remaining/60000);
  if(minutes<=1)return "1 minute left";
  if(minutes<60)return `${minutes} minutes left`;
  const hours=Math.ceil(minutes/60);
  return `${hours} hour${hours===1?"":"s"} left`;
}

function renderJournal(){
  const b=$("recentEntries");
  $("entryCount").textContent=state.entries.length;
  if(!state.entries.length){
    b.className="entries empty-state";
    b.innerHTML="<p>Nothing here yet.</p><p>Write without worrying about what to call it.</p>";
    return;
  }

  const sorted=[...state.entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const current=sorted.find(e=>!isLocked(e)&&e.body);

  b.className="entries";
  b.innerHTML=sorted.map(e=>{
    const isCurrent=current && current.id===e.id;
    const status=isCurrent ? `CONTINUE · ${timeLeftLabel(e)}` : (isLocked(e) ? "LOCKED" : timeLeftLabel(e));
    return `<article class="card"><button type="button" data-open="${e.id}">
      <div class="card-title">${isCurrent?"CONTINUE":formatDate(e.createdAt)}</div>
      <div class="card-date">${status}</div>
      <div class="card-preview">${esc(e.body)||"<span class='muted'>Empty entry</span>"}</div>
    </button></article>`;
  }).join("");

  b.querySelectorAll("[data-open]").forEach(x=>x.onclick=()=>openEntry(x.dataset.open));
}
function renderFound(){
  const b=$("ideasList");
  if(!state.ideas.length){
    b.className="entries empty-state";
    b.innerHTML="<p>You haven't found anything yet.</p><p>Go wander. Follow something.</p>";
    return;
  }
  b.className="entries";
  b.innerHTML=[...state.ideas].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=>`
    <article class="card">
      <div class="card-title">${esc(i.title||"Untitled thought")}</div>
      <div class="card-date">${formatDate(i.createdAt)}</div>
      <div class="card-preview">${esc(i.body||"")}</div>
    </article>`).join("");
}

function updateAutosaveStatus(){
  $("lockMessage").textContent="Autosaved · changes are being preserved";
}

function autosaveEntry(){
  if(!editingEntryId)return;
  const entry=state.entries.find(e=>e.id===editingEntryId);
  if(!entry || isLocked(entry))return;

  const body=$("bodyInput").value;
  if(!body.trim()) return;

  entry.body=body;
  entry.updatedAt=nowISO();
  save();
  updateAutosaveStatus();
}

function startAutosave(){
  clearInterval(autosaveTimer);
  autosaveTimer=setInterval(autosaveEntry,1000);
  $("bodyInput").oninput=autosaveEntry;
}

function stopTimers(){
  clearInterval(autosaveTimer);
  clearInterval(countdownTimer);
  autosaveTimer=null;
  countdownTimer=null;
}

function updateLockCountdown(){
  if(!editingEntryId)return;
  const entry=state.entries.find(e=>e.id===editingEntryId);
  if(!entry)return;
  if(isLocked(entry)){
    $("entryStatus").textContent="Locked";
    $("lockMessage").textContent="Locked. Don't rewrite it. Write the next entry.";
    $("bodyInput").disabled=true;
    stopTimers();
    renderJournal();
    return;
  }
  const seconds=Math.max(0,Math.floor((new Date(entry.createdAt).getTime()+LOCK_HOURS*3600000-Date.now())/1000));
  const h=Math.floor(seconds/3600);
  const m=Math.floor((seconds%3600)/60);
  const s=seconds%60;
  $("lockMessage").textContent=`Autosaved · locks in ${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
}

function startCountdown(){
  clearInterval(countdownTimer);
  countdownTimer=setInterval(updateLockCountdown,1000);
  updateLockCountdown();
}

function readDraft(){
  try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch{return null}
}

function saveDraft(){
  const body=$("bodyInput").value;
  if(!body.trim())return;
  const existing=readDraft();
  const draft={
    body,
    startedAt:existing?.startedAt||nowISO(),
    updatedAt:nowISO()
  };
  localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
  $("lockMessage").textContent=`Draft autosaved · ${timeLeftLabel({createdAt:draft.startedAt})}`;
}

function clearDraft(){
  localStorage.removeItem(DRAFT_KEY);
}

function draftExpired(draft){
  return !draft || (Date.now()-new Date(draft.startedAt).getTime()>=LOCK_HOURS*3600000);
}

function startDraftAutosave(){
  clearInterval(draftTimer);
  draftTimer=setInterval(saveDraft,1000);
}

function stopDraftAutosave(){
  clearInterval(draftTimer);
  draftTimer=null;
}

function draftTimeLeft(draft){
  return timeLeftLabel({createdAt:draft.startedAt});
}

function showDraftModal(){
  $("draftModal").classList.remove("hidden");
}

function closeDraftModal(){
  $("draftModal").classList.add("hidden");
}

function loadDraftIntoEditor(){
  const draft=readDraft();
  if(!draft || draftExpired(draft))return false;

  stopTimers();
  stopDraftAutosave();
  editingEntryId=null;
  $("bodyInput").value=draft.body;
  $("entryMeta").textContent=formatDate(draft.startedAt);
  $("entryStatus").textContent="Private · draft";
  $("lockMessage").textContent=`Draft · ${draftTimeLeft(draft)}`;
  $("bodyInput").disabled=false;
  showView("entryView");
  startDraftAutosave();
  setTimeout(()=>$("bodyInput").focus(),50);
  return true;
}

function keepDraftAsEntry(){
  const draft=readDraft();
  if(!draft || !draft.body.trim()){
    letDraftGo();
    return;
  }

  const entry={
    id:crypto.randomUUID(),
    body:draft.body.trim(),
    createdAt:draft.startedAt
  };
  state.entries.push(entry);
  save();
  clearDraft();
  editingEntryId=entry.id;
  closeDraftModal();
  stopDraftAutosave();

  $("bodyInput").value=entry.body;
  $("entryMeta").textContent=formatDate(entry.createdAt);
  $("entryStatus").textContent="Private · started";
  $("lockMessage").textContent=`Saved · ${timeLeftLabel(entry)}`;
  startAutosave();
  startCountdown();
}

function letDraftGo(){
  clearDraft();
  pendingDraftBody="";
  closeDraftModal();
  stopDraftAutosave();
  stopTimers();
  editingEntryId=null;
  $("bodyInput").value="";
  renderJournal();
  showView("homeView");
}

function continueDraft(){
  closeDraftModal();
  loadDraftIntoEditor();
}

function handleDraftOnReturn(){
  const draft=readDraft();
  if(!draft)return;

  if(draftExpired(draft)){
    // Preserve the thought as a locked entry rather than letting a draft live forever.
    if(draft.body?.trim()){
      state.entries.push({id:crypto.randomUUID(),body:draft.body.trim(),createdAt:draft.startedAt});
      save();
    }
    clearDraft();
    renderJournal();
    return;
  }

  showDraftModal();
}

function createEntry(){
  stopTimers();
  stopDraftAutosave();
  editingEntryId=null;
  $("bodyInput").value="";
  $("entryMeta").textContent="BEGIN";
  $("entryStatus").textContent="Private · draft";
  $("lockMessage").textContent="Write freely. Your 24-hour window begins when you write.";
  $("bodyInput").disabled=false;
  showView("entryView");

  $("bodyInput").oninput=()=>{
    const body=$("bodyInput").value;
    if(body.trim()){
      if(!readDraft()){
        localStorage.setItem(DRAFT_KEY,JSON.stringify({
          body,
          startedAt:nowISO(),
          updatedAt:nowISO()
        }));
      }else{
        saveDraft();
      }
      $("entryMeta").textContent=formatDate(readDraft().startedAt);
      $("entryStatus").textContent="Private · draft";
      $("lockMessage").textContent=`Draft autosaved · ${timeLeftLabel({createdAt:readDraft().startedAt})}`;
      startDraftAutosave();
    }else{
      $("entryStatus").textContent="Private · draft";
      $("lockMessage").textContent="Write freely. Your 24-hour window begins when you write.";
    }
  };

  setTimeout(()=>$("bodyInput").focus(),50);
}
function keepDraft(){
  keepDraftAsEntry();
}

function openKeepModal(){
  $("keepModal").classList.remove("hidden");
}

function closeKeepModal(){
  $("keepModal").classList.add("hidden");
}

function letDraftGo(){
  $("bodyInput").value="";
  closeKeepModal();
  stopTimers();
  editingEntryId=null;
  renderJournal();
  showView("homeView");
}
function openEntry(id){
  stopTimers();
  const entry=state.entries.find(e=>e.id===id);
  if(!entry)return;
  editingEntryId=id;
  const locked=isLocked(entry);
  $("bodyInput").value=entry.body||"";
  $("entryMeta").textContent=formatDate(entry.createdAt);
  $("entryStatus").textContent=locked?"Locked":"Private · open";
  $("bodyInput").disabled=locked;
  showView("entryView");

  if(locked){
    $("lockMessage").textContent="Locked. Don't rewrite it. Write the next entry.";
  }else{
    startAutosave();
    startCountdown();
  }
}

$("newEntryBtn").onclick=createEntry;

$("backBtn").onclick=()=>{
  const body=$("bodyInput").value.trim();

  if(editingEntryId){
    if(body) autosaveEntry();
    stopTimers();
    editingEntryId=null;
    renderJournal();
    showView("homeView");
    return;
  }

  if(body){
    saveDraft();
    showDraftModal();
  }else{
    letDraftGo();
  }
};

const wander={
sound:[["A SOUND","What sound keeps pulling your attention? What does it remind you of?"],["A FEELING","If this feeling had a tempo, a room, and a sound, what would they be?"]],
image:[["AN IMAGE","What is the first thing you notice? What happened right before this frame?"],["A SCENE","Where are you? Who is there? What is nobody saying?"]],
words:[["A LINE","Write one sentence you can't stop thinking about."],["A LYRIC","Write four lines without trying to make them good."]],
question:[["A QUESTION","What are you curious about but afraid might have no clean answer?"],["AN ASSUMPTION","What do you believe because someone else taught you to believe it?"]],
story:[["A PERSON","Who have you been thinking about lately? What don't you understand about them?"],["A MEMORY","Pick a memory. What detail do you remember that nobody else could have noticed?"]]};

const stuck=[
["WHERE DID THIS COME FROM?","Pick the idea you keep returning to. Where did you first learn it?"],
["WHO TAUGHT YOU THAT?","Think of something you believe about success, love, family, or yourself. Who taught you?"],
["WHAT ARE YOU AVOIDING?","What thought keeps getting pushed to the side because it might change something?"]];

function result(t,b,tr){
  const x=$("wanderResult");
  x.classList.remove("hidden");
  x.innerHTML=`<div class="result-kicker">${esc(tr)}</div><div class="result-title">${esc(t)}</div><div class="result-body">${esc(b)}</div><div class="result-actions"><button class="ghost" id="followBtn">Follow this</button><button class="ghost" id="anotherBtn">Another path</button></div>`;
  $("followBtn").onclick=()=>{
    $("ideaInput").value=t;
    $("ideaBodyInput").value="";
    $("ideaTrail").textContent=tr;
    $("ideaForm").dataset.seed=b;
    showView("ideaView");
  };
  $("anotherBtn").onclick=()=>x.classList.add("hidden");
}

document.querySelectorAll(".path-card").forEach(b=>b.onclick=()=>{
  const x=wander[b.dataset.path][Math.floor(Math.random()*wander[b.dataset.path].length)];
  result(x[0],x[1],b.querySelector("b").textContent);
});

$("lostBtn").onclick=()=>{
  const x=stuck[Math.floor(Math.random()*stuck.length)];
  result(x[0],x[1],"LOST? · LET'S START SOMEWHERE");
};

$("ideaForm").onsubmit=e=>{
  e.preventDefault();
  const t=$("ideaInput").value.trim(),b=$("ideaBodyInput").value.trim();
  if(!t&&!b)return;
  state.ideas.push({id:crypto.randomUUID(),title:t||"Untitled thought",body:b||e.currentTarget.dataset.seed||"",createdAt:nowISO()});
  e.currentTarget.dataset.seed="";
  save(); renderFound(); showView("ideasView");
};

$("ideaBackBtn").onclick=()=>showView("wanderView");

document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{
  if(b.dataset.view==="homeView")renderJournal();
  if(b.dataset.view==="ideasView")renderFound();
  showView(b.dataset.view);
});

$("lockBtn").onclick=()=>$("privacyModal").classList.remove("hidden");
$("closeModal").onclick=()=>$("privacyModal").classList.add("hidden");
$("privacyModal").onclick=e=>{if(e.target.id==="privacyModal")$("privacyModal").classList.add("hidden")};

$("keepBtn").onclick=keepDraft;
$("letGoBtn").onclick=letDraftGo;
$("keepModal").onclick=e=>{
  if(e.target.id==="keepModal") closeKeepModal();
};

$("draftContinueBtn").onclick=continueDraft;
$("draftKeepBtn").onclick=keepDraftAsEntry;
$("draftLetGoBtn").onclick=letDraftGo;
$("draftModal").onclick=e=>{
  if(e.target.id==="draftModal") closeDraftModal();
};

renderJournal();
renderFound();
showView("homeView");
handleDraftOnReturn();
