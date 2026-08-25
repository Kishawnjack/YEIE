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
      // An intentionally empty editor is not a draft.
      clearDraft();
      stopDraftAutosave();
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
  // "Let go" means the draft is intentionally abandoned.
  // It must not reappear on the next visit to YEIE.
  clearDraft();
  pendingDraftBody="";
  closeDraftModal();
  closeKeepModal();
  stopDraftAutosave();
  stopTimers();
  editingEntryId=null;
  $("bodyInput").value="";
  $("entryStatus").textContent="Private · draft";
  $("lockMessage").textContent="Write freely. Your 24-hour window begins when you write.";
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

/*
 V0.4.1 WANDER + SCOUT — rabbit-hole sequencing
 The UI consumes one normalized Inspiration record whether it comes from
 the local fallback catalog or the YEIE Scout Worker.
*/
const SCOUT_ENDPOINT="https://yeie-scout.peteyrealmusic.workers.dev/scout";
const SCOUT_TIMEOUT_MS=12000;
const WANDER_HISTORY_KEY="yeie_wander_history_v041";
const WANDER_RECENT_LIMIT=40;

const INSPIRATIONS=[
{id:"real-damii",category:"sound",type:"SONG",title:"The Art of Evolving in Silence",content:"A musical encounter about growth, silence, identity, and becoming.",creator:"DAMII",sourceLabel:"YouTube",sourceUrl:"https://youtu.be/1899JtZB8UE",tags:["music","growth","identity"],connections:["real-dustin","real-sampling","real-perrys"]},
{id:"real-perrys",category:"words",type:"CONVERSATION",title:"A Word for Writers and Sufferers of Writer's Block",content:"A conversation about writing, creative struggle, and getting unstuck.",creator:"With The Perrys",sourceLabel:"YouTube",sourceUrl:"https://youtu.be/36L9cYkHyZM",tags:["writing","creative-block","process"],connections:["real-damii","real-mattcapone","words-003"]},
{id:"real-one-second-late",category:"film",type:"SHORT FILM",title:"ONE SECOND LATE",content:"A short film to wander into when a tiny moment, a decision, or a fraction of time might change everything.",creator:null,sourceLabel:"YouTube",sourceUrl:"https://www.youtube.com/watch?v=QibQLlM-C_I",tags:["film","time","choice"],connections:["real-damii","real-dustin","film-002"]},
{id:"real-sampling",category:"sound",type:"ESSAY VIDEO",title:"THIS IS WHY SAMPLING IS ART",content:"A look at sampling as an art form — a doorway from listening into taking something old and making it speak differently.",creator:"RUDE_NOISE",sourceLabel:"YouTube",sourceUrl:"https://www.youtube.com/watch?v=Kz0XIf4Eq90",tags:["sampling","music","art"],connections:["real-paintings","real-damii","sound-002"]},
{id:"real-dustin",category:"thoughts",type:"ARTIST TALK",title:"A Journey Through the Mind of an Artist",content:"An artist's way of seeing, building, thinking, and making — a reminder that process itself can be a world worth wandering through.",creator:"Dustin Yellin",sourceLabel:"TED",sourceUrl:"https://www.ted.com/talks/dustin_yellin_a_journey_through_the_mind_of_an_artist",tags:["art","process","perspective"],connections:["real-paintings","real-one-second-late","thought-003"]},
{id:"real-mattcapone",category:"words",type:"SPOKEN WORD",title:"A Love Poem",content:"A spoken-word performance. Let the rhythm of the language do the work before you decide what the words mean.",creator:"Matt Capone",sourceLabel:"Voices In Power",sourceUrl:null,tags:["poetry","spoken-word","performance"],connections:["real-perrys","real-damii","words-001"]},
{id:"real-paintings",category:"visuals",type:"PAINTINGS",title:"Let a painting interrupt you.",content:"Don't search for the perfect painting. Find one that makes you stop. Stay with the color, gesture, scale, or thing you can't explain.",creator:null,sourceLabel:null,sourceUrl:null,tags:["painting","color","gesture"],connections:["real-sampling","real-dustin","visual-001"]},
{id:"real-quotes",category:"words",type:"QUOTES",title:"A sentence can be a doorway.",content:"Find a quote from an artist, writer, filmmaker, producer, or stranger that you would normally scroll past. Keep the sentence in your head for a while.",creator:null,sourceLabel:null,sourceUrl:null,tags:["quotes","language","artists"],connections:["real-mattcapone","real-perrys","thought-001"]},
{id:"sound-001",category:"sound",type:"SONG",title:"Start with a song you didn't expect.",content:"Listen without analyzing it. Notice the first thing your body reacts to: rhythm, texture, voice, or space.",creator:null,sourceLabel:null,sourceUrl:null,tags:["listening","unexpected"],connections:["sound-002","real-sampling","real-one-second-late"]},
{id:"sound-002",category:"sound",type:"SOUND",title:"Find music inside an ordinary sound.",content:"A machine. A room. A voice. A mistake. Stop asking what it is and start asking what it could become.",creator:null,sourceLabel:null,sourceUrl:null,tags:["field-recording","sampling"],connections:["visual-001","real-sampling","sound-003"]},
{id:"sound-003",category:"sound",type:"PROCESS",title:"The studio is allowed to be uncertain.",content:"Creative work does not always begin with an answer. Sometimes the useful move is changing the question, changing the sound, or leaving the mistake alone.",creator:null,sourceLabel:null,sourceUrl:null,tags:["process","studio"],connections:["thought-001","real-damii","sound-004"]},
{id:"sound-004",category:"sound",type:"PROCESS",title:"Listen to somebody explain how they make.",content:"A producer, musician, engineer, or artist describing the moment something finally clicked can be as inspiring as the finished work.",creator:null,sourceLabel:null,sourceUrl:null,tags:["process","artists"],connections:["real-perrys","real-damii","sound-001"]},
{id:"words-001",category:"words",type:"LINE",title:"Follow a sentence.",content:"Find one sentence that makes you stop. Don't explain why. Let the sentence lead you somewhere else.",creator:null,sourceLabel:null,sourceUrl:null,tags:["writing","language"],connections:["real-mattcapone","real-one-second-late","film-002"]},
{id:"words-002",category:"words",type:"STORY",title:"A story can become a sample.",content:"A line from someone's life can become a lyric, a scene, a visual, a rhythm, or an entire project.",creator:null,sourceLabel:null,sourceUrl:null,tags:["story","cross-medium"],connections:["real-sampling","real-one-second-late","film-003"]},
{id:"words-003",category:"words",type:"WORDS",title:"Read something outside your lane.",content:"A paragraph from a writer, artist, scientist, poet, or stranger can change the shape of an idea you were already carrying.",creator:null,sourceLabel:null,sourceUrl:null,tags:["reading","cross-disciplinary"],connections:["real-dustin","real-paintings","thought-002"]},
{id:"film-001",category:"film",type:"SCENE",title:"Watch the moment before the moment.",content:"Find a scene where almost nothing happens. Pay attention to what the camera, silence, framing, and timing make you feel.",creator:null,sourceLabel:null,sourceUrl:null,tags:["cinema","silence"],connections:["real-one-second-late","sound-002","film-002"]},
{id:"film-002",category:"film",type:"PROCESS",title:"Study the choice, not the spectacle.",content:"Look for a filmmaking decision you would not have made. That's often where the useful inspiration lives.",creator:null,sourceLabel:null,sourceUrl:null,tags:["cinematography","process"],connections:["real-dustin","visual-003","words-001"]},
{id:"film-003",category:"film",type:"STORY",title:"Let a scene change the question.",content:"Don't ask what the scene means yet. Ask what it makes you curious about.",creator:null,sourceLabel:null,sourceUrl:null,tags:["story","curiosity"],connections:["real-perrys","thought-001","words-002"]},
{id:"visual-001",category:"visuals",type:"IMAGE",title:"Follow the texture.",content:"Find an image you can almost feel. Follow its light, color, texture, imperfection, or composition.",creator:null,sourceLabel:null,sourceUrl:null,tags:["texture","image"],connections:["real-paintings","sound-002","visual-002"]},
{id:"visual-002",category:"visuals",type:"COLOR",title:"Let a color start the world.",content:"Pick a color you wouldn't normally use. Imagine the room, song, person, film, or memory that belongs inside it.",creator:null,sourceLabel:null,sourceUrl:null,tags:["color","worldbuilding"],connections:["real-paintings","words-003","visual-003"]},
{id:"visual-003",category:"visuals",type:"REFERENCE",title:"See something you would never have searched for.",content:"The useful reference is sometimes the one you didn't know existed.",creator:null,sourceLabel:null,sourceUrl:null,tags:["reference","discovery"],connections:["real-dustin","film-002","thought-003"]},
{id:"thought-001",category:"thoughts",type:"QUESTION",title:"Borrow a question, not an answer.",content:"What is something you believe because somebody else taught you to believe it?",creator:null,sourceLabel:null,sourceUrl:null,tags:["identity","questions"],connections:["real-perrys","real-damii","film-003"]},
{id:"thought-002",category:"thoughts",type:"THOUGHT",title:"Make the obvious strange.",content:"Take something completely normal in your life and imagine you have never seen it before.",creator:null,sourceLabel:null,sourceUrl:null,tags:["observation","perspective"],connections:["real-dustin","real-paintings","words-003"]},
{id:"thought-003",category:"thoughts",type:"PERSPECTIVE",title:"Enter somebody else's world for a minute.",content:"Find a perspective you don't naturally share. Don't debate it. Wander around inside it.",creator:null,sourceLabel:null,sourceUrl:null,tags:["perspective","empathy"],connections:["real-dustin","visual-003","words-001"]},
{id:"unsure-001",category:"unsure",type:"SURPRISE",title:"You don't have to know.",content:"Start anywhere. A sound. A face. A color. A sentence. A memory. Something you saw today. Follow whatever catches you.",creator:null,sourceLabel:null,sourceUrl:null,tags:["uncertainty"],connections:["real-damii","real-paintings","real-mattcapone"]},
{id:"unsure-002",category:"unsure",type:"SURPRISE",title:"Go toward the thing you can't name.",content:"The fact that you don't know what you're looking for is enough. Let the first spark choose the direction.",creator:null,sourceLabel:null,sourceUrl:null,tags:["uncertainty","intuition"],connections:["real-dustin","real-one-second-late","real-quotes"]},
{id:"unsure-003",category:"unsure",type:"SURPRISE",title:"Open a door you weren't looking for.",content:"The next useful thing may have nothing to do with what you thought you came here for.",creator:null,sourceLabel:null,sourceUrl:null,tags:["surprise","cross-medium"],connections:["real-sampling","real-mattcapone","real-paintings"]}
];

function normalizeScoutItem(item, fallbackCategory="unsure"){
  if(!item || typeof item!=="object")return null;
  return {
    id:String(item.id||`scout-${Date.now()}`),
    category:String(item.category||fallbackCategory),
    type:String(item.type||"DISCOVERY").toUpperCase(),
    title:String(item.title||"Something worth wandering into."),
    content:String(item.content||item.description||"Follow this wherever it takes you."),
    creator:item.creator?String(item.creator):null,
    sourceLabel:item.sourceLabel?String(item.sourceLabel):null,
    sourceUrl:(typeof item.sourceUrl==="string" && /^https?:\/\//i.test(item.sourceUrl))?item.sourceUrl:null,
    tags:Array.isArray(item.tags)?item.tags.map(String):[],
    connections:Array.isArray(item.connections)?item.connections.map(String):[]
  };
}

function readWanderHistory(){
  try{
    const parsed=JSON.parse(localStorage.getItem(WANDER_HISTORY_KEY)||"[]");
    return Array.isArray(parsed)?parsed.filter(x=>x&&x.id):[];
  }catch{return []}
}

function recentWanderIds(){
  return new Set(readWanderHistory().slice(-WANDER_RECENT_LIMIT).map(x=>x.id));
}

function rememberWanderItem(item){
  if(!item?.id)return;
  const history=readWanderHistory().filter(x=>x.id!==item.id);
  history.push({id:item.id,seenAt:Date.now()});
  localStorage.setItem(WANDER_HISTORY_KEY,JSON.stringify(history.slice(-WANDER_RECENT_LIMIT)));
}

function localScoutNext(preferredCategory){
  const sessionIds=new Set(wanderTrail.map(x=>x.item.id));
  const recentIds=recentWanderIds();
  const current=wanderCurrent;
  const connected=(current?.connections||[])
    .map(id=>INSPIRATIONS.find(x=>x.id===id))
    .filter(Boolean)
    .filter(x=>x.id!==current?.id&&!sessionIds.has(x.id));

  const fresh=INSPIRATIONS.filter(x=>x.id!==current?.id&&!sessionIds.has(x.id)&&!recentIds.has(x.id));
  const same=fresh.filter(x=>x.category===preferredCategory);
  const wildcard=fresh.filter(x=>x.category!==preferredCategory);

  if(connected.length&&Math.random()<0.72)return connected[Math.floor(Math.random()*connected.length)];
  if(same.length&&Math.random()<0.60)return same[Math.floor(Math.random()*same.length)];
  if(wildcard.length)return wildcard[Math.floor(Math.random()*wildcard.length)];

  const sessionFresh=INSPIRATIONS.filter(x=>x.id!==current?.id&&!sessionIds.has(x.id));
  const sameOld=sessionFresh.filter(x=>x.category===preferredCategory);
  return sameOld[0]||sessionFresh[0]||INSPIRATIONS[Math.floor(Math.random()*INSPIRATIONS.length)];
}

async function fetchScout(preferredCategory){
  const category=preferredCategory==="unsure"?"not-sure":preferredCategory;
  const seen=[...new Set([...wanderTrail.map(x=>x.item.id),...recentWanderIds()])].filter(Boolean).slice(-40);
  const params=new URLSearchParams({category});
  seen.forEach(id=>params.append("seen",id));

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),SCOUT_TIMEOUT_MS);
  try{
    const response=await fetch(`${SCOUT_ENDPOINT}?${params.toString()}`,{
      method:"GET",
      headers:{"Accept":"application/json"},
      signal:controller.signal,
      cache:"no-store"
    });
    if(!response.ok)throw new Error(`Scout returned ${response.status}`);
    const payload=await response.json();
    const item=normalizeScoutItem(payload?.discovery,preferredCategory);
    if(!item)throw new Error("Scout returned no discovery");
    return item;
  }finally{
    clearTimeout(timer);
  }
}

async function scoutNext(preferredCategory){
  const localCandidate=localScoutNext(preferredCategory);
  const currentConnections=(wanderCurrent?.connections||[]).length>0;

  if(currentConnections&&localCandidate&&Math.random()<0.70)return localCandidate;

  try{
    const item=await fetchScout(preferredCategory);
    if(item&&item.id!==wanderCurrent?.id&&!wanderTrail.some(x=>x.item.id===item.id))return item;
    return localCandidate;
  }catch(error){
    console.warn("YEIE Scout unavailable; using local rabbit-hole fallback.",error);
    return localCandidate;
  }
}

let wanderCategory=null,wanderTrail=[],wanderCurrent=null,wanderLoading=false;
let wanderControlsTimer=null;
const WANDER_CONTROLS_DELAY=7000;

function resetWanderControls(){
  if(wanderControlsTimer) clearTimeout(wanderControlsTimer);
  const actions=$("wanderActions");
  actions.classList.remove("wander-controls-ready","wander-controls-reveal");
  actions.classList.add("wander-actions-hidden");
  wanderControlsTimer=setTimeout(()=>{
    if(!wanderLoading){
      actions.classList.remove("wander-actions-hidden");
      actions.classList.add("wander-controls-ready");
    }
  },WANDER_CONTROLS_DELAY);
}

function revealWanderControls(){
  if(wanderLoading)return;
  $("wanderActions").classList.add("wander-controls-reveal");
}

function renderWanderItem(item){
  const result=$("wanderResult");
  result.classList.remove("wander-reveal","wander-exit");
  result.innerHTML=`<div class="wander-encounter">
    <div class="wander-encounter-title">${esc(item.title||"Something worth wandering into.")}</div>
    <div class="wander-encounter-body">${esc(item.content||"")}</div>
  </div>`;
  // Keep category/source metadata out of the encounter. YEIE knows the path;
  // the person should experience the thing itself.
  result.offsetWidth;
  result.classList.add("wander-reveal");
}

function wanderDwellMs(item){
  const type=String(item?.type||"").toLowerCase();
  if(type.includes("painting")||type.includes("image")||type.includes("visual"))return 2100;
  if(type.includes("poem")||type.includes("spoken")||type.includes("line")||type.includes("quote"))return 1700;
  if(type.includes("film")||type.includes("scene")||type.includes("video"))return 1300;
  if(type.includes("song")||type.includes("sound")||type.includes("process"))return 1100;
  return 1400;
}

async function transitionToNext(item){
  const result=$("wanderResult");
  const actions=$("wanderActions");
  result.classList.remove("wander-reveal");
  result.classList.add("wander-exit");
  actions.classList.add("wander-actions-hidden");
  actions.classList.remove("wander-controls-ready","wander-controls-reveal");
  if(wanderControlsTimer) clearTimeout(wanderControlsTimer);
  await new Promise(r=>setTimeout(r,900));
  await new Promise(r=>setTimeout(r,wanderDwellMs(item)));
  resetWanderControls();
}

function setWanderLoading(isLoading){
  wanderLoading=isLoading;
  $("wanderKeepBtn").disabled=isLoading;
  $("wanderNextBtn").disabled=isLoading;
  $("wanderActions").classList.toggle("wander-actions-hidden",isLoading);
  if(isLoading){
    $("wanderResult").innerHTML=`<div class="wander-loading"><span class="wander-pulse"></span><div>Finding something to wander into…</div></div>`;
  }
}

async function enterWander(category){
  if(wanderLoading)return;
  wanderCategory=category; wanderTrail=[]; setWanderLoading(true);
  $("wanderLanding").classList.add("hidden");
  $("wanderImmersion").classList.remove("hidden");
  $("wanderCategory").textContent=category==="unsure"?"I'M NOT SURE":category.toUpperCase();
  try{
    wanderCurrent=await scoutNext(category);
    renderWanderItem(wanderCurrent);
    resetWanderControls();
    wanderTrail.push({category:wanderCurrent.category,item:wanderCurrent,action:"encounter",at:nowISO()});
    rememberWanderItem(wanderCurrent);
    await new Promise(r=>setTimeout(r,wanderDwellMs(wanderCurrent)));
  }finally{
    setWanderLoading(false);
  }
}

async function advanceWander(){
  if(!wanderCategory||wanderLoading)return;
  setWanderLoading(true);
  try{
    const previousItem=wanderCurrent;
    wanderCurrent=await scoutNext(wanderCategory);
    if(wanderCurrent.category!==wanderCategory && wanderCategory!=="unsure"){
      // The doorway remains the user's chosen direction; the content may cross mediums.
      $("wanderCategory").textContent=wanderCategory.toUpperCase();
    }
    wanderTrail.push({category:wanderCurrent.category,item:wanderCurrent,action:"wander",at:nowISO()});
    rememberWanderItem(wanderCurrent);
    if(previousItem) await transitionToNext(previousItem);
    renderWanderItem(wanderCurrent);
    if(!previousItem) resetWanderControls();
  }finally{
    setWanderLoading(false);
  }
}

function keepWanderItem(){
  if(!wanderCurrent||wanderLoading)return;
  if(!Array.isArray(state.ideas))state.ideas=[];
  if(!state.ideas.some(x=>x.id===wanderCurrent.id)){
    state.ideas.push({
      id:wanderCurrent.id,title:wanderCurrent.title,body:wanderCurrent.content,
      category:wanderCurrent.category,type:wanderCurrent.type,
      creator:wanderCurrent.creator,sourceLabel:wanderCurrent.sourceLabel,
      sourceUrl:wanderCurrent.sourceUrl,createdAt:nowISO(),origin:"wander"
    });
    save();
    renderFound();
  }
  wanderTrail.push({category:wanderCurrent.category,item:wanderCurrent,action:"keep",at:nowISO()});
  advanceWander();
}

function leaveWanderWorld(){
  if(wanderLoading)return;
  if(wanderControlsTimer) clearTimeout(wanderControlsTimer);
  wanderCategory=null; wanderCurrent=null; wanderTrail=[];
  $("wanderImmersion").classList.add("hidden");
  $("wanderLanding").classList.remove("hidden");
}

function showWanderTrail(){
  const box=$("wanderResult");
  if(!wanderTrail.length||wanderLoading)return;
  const original=box.innerHTML;
  const rows=wanderTrail.map((s,i)=>{
    const source=s.item.sourceUrl
      ? `<a class="trail-source" href="${esc(s.item.sourceUrl)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>`
      : "";
    return `<div class="trail-row"><span>${i+1}</span><div><strong>${esc(s.item.title)}</strong><small>${esc(s.action)} · ${esc(s.category)} ${source}</small></div></div>`;
  }).join("");
  box.innerHTML=`<div class="result-kicker">YOUR TRAIL</div>
    <div class="result-title">Where you went.</div>
    <div class="trail-list">${rows}</div>
    <button id="closeTrailBtn" class="ghost" type="button">BACK TO THIS MOMENT</button>`;
  $("closeTrailBtn").onclick=()=>{box.innerHTML=original;};
}

const wanderWorld=$("wanderWorld");
wanderWorld.addEventListener("pointermove",e=>{
  if(e.pointerType==="mouse" && e.clientY>window.innerHeight-190) revealWanderControls();
});
wanderWorld.addEventListener("click",e=>{
  if(e.target.closest(".wander-action,.back,.icon-btn,.path-card"))return;
  revealWanderControls();
});
wanderWorld.addEventListener("touchstart",()=>revealWanderControls(),{passive:true});

document.querySelectorAll("[data-wander-category]").forEach(btn=>btn.onclick=()=>enterWander(btn.dataset.wanderCategory));
$("wanderNextBtn").onclick=advanceWander;
$("wanderKeepBtn").onclick=keepWanderItem;
$("wanderBackBtn").onclick=leaveWanderWorld;
$("wanderTrailBtn").onclick=showWanderTrail;

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
