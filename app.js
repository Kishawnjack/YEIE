const KEY="yeie_v01";
const LOCK_HOURS=24;
const $=id=>document.getElementById(id);
let state;
try{state=JSON.parse(localStorage.getItem(KEY)||'{"entries":[],"ideas":[]}');if(!state.entries)state.entries=[];if(!state.ideas)state.ideas=[]}
catch{state={entries:[],ideas:[]}}
let editingEntryId=null;
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const formatDate=iso=>new Date(iso).toLocaleString([],{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const isLocked=e=>Date.now()-new Date(e.createdAt).getTime()>=LOCK_HOURS*60*60*1000;

function showView(id){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));window.scrollTo(0,0)}

function renderJournal(){
 $("entryCount").textContent=state.entries.length;const box=$("recentEntries");
 if(!state.entries.length){box.className="entries empty-state";box.innerHTML="<p>Nothing here yet.</p><p>Write without worrying about what to call it.</p>";return}
 box.className="entries";
 box.innerHTML=[...state.entries].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(e=>`<article class="card"><button type="button" data-open-entry="${e.id}"><div class="card-title">${formatDate(e.createdAt)}</div><div class="card-date">${isLocked(e)?"Locked":"Open for 24 hours"}</div><div class="card-preview">${esc(e.body)}</div></button></article>`).join("");
 box.querySelectorAll("[data-open-entry]").forEach(b=>b.onclick=()=>openEntry(b.dataset.openEntry));
}

function renderFound(){
 const box=$("ideasList");
 if(!state.ideas.length){box.className="entries empty-state";box.innerHTML="<p>You haven't found anything yet.</p><p>Go wander. Follow something.</p>";return}
 box.className="entries";
 box.innerHTML=[...state.ideas].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=>`<article class="card"><div class="card-title">${esc(i.title||"Untitled thought")}</div><div class="card-date">${formatDate(i.createdAt)}</div><div class="card-preview">${esc(i.body||"")}</div></article>`).join("");
}

function newEntry(){editingEntryId=null;$("bodyInput").value="";$("entryMeta").textContent=formatDate(nowISO());$("entryStatus").textContent="Private · starts now";$("lockMessage").textContent="This entry locks after 24 hours.";$("saveEntryBtn").style.display="inline-block";$("bodyInput").disabled=false;showView("entryView");setTimeout(()=>$("bodyInput").focus(),50)}
function openEntry(id){const e=state.entries.find(x=>x.id===id);if(!e)return;editingEntryId=id;const locked=isLocked(e);$("bodyInput").value=e.body||"";$("entryMeta").textContent=formatDate(e.createdAt);$("entryStatus").textContent=locked?"Locked":"Private · open";$("lockMessage").textContent=locked?"Locked. Don't rewrite it. Write the next entry.":"This entry locks after 24 hours.";$("saveEntryBtn").style.display=locked?"none":"inline-block";$("bodyInput").disabled=locked;showView("entryView")}

$("newEntryBtn").onclick=newEntry;
$("backBtn").onclick=()=>{renderJournal();showView("homeView")};
$("entryForm").onsubmit=e=>{e.preventDefault();const body=$("bodyInput").value.trim();if(!body)return;if(editingEntryId){const entry=state.entries.find(x=>x.id===editingEntryId);if(!entry||isLocked(entry))return;entry.body=body;entry.updatedAt=nowISO()}else state.entries.push({id:crypto.randomUUID(),body,createdAt:nowISO()});save();renderJournal();showView("homeView")};

const wanderData={
sound:[["A SOUND","What sound keeps pulling your attention? What does it remind you of?"],["A FEELING","If this feeling had a tempo, a room, and a sound, what would they be?"],["A REFERENCE","Save a song, sample, voice, rhythm, or production choice that makes you want to create."]],
image:[["AN IMAGE","What is the first thing you notice? What happened right before this frame?"],["A SCENE","Where are you? Who is there? What is nobody saying?"],["A REFERENCE","What does this image make you want to make?"]],
words:[["A LINE","Write one sentence you can't stop thinking about."],["A LYRIC","Write four lines without trying to make them good."],["A WORD","What word has been following you lately? Why?"]],
question:[["A QUESTION","What are you curious about but afraid might have no clean answer?"],["A CONTRADICTION","What are two things you believe that seem like they shouldn't coexist?"],["AN ASSUMPTION","What do you believe because someone else taught you to believe it?"]],
story:[["A PERSON","Who have you been thinking about lately? What don't you understand about them?"],["A MEMORY","Pick a memory. What detail do you remember that nobody else could have noticed?"],["A MOMENT","Describe one ordinary moment as if it belongs in a film."]]};
const stuck=[["WHERE DID THIS COME FROM?","Pick the idea you keep returning to. Where did you first learn it?"],["WHO TAUGHT YOU THAT?","Think of something you believe about success, love, family, or yourself. Who taught you?"],["WHAT ARE YOU AVOIDING?","What thought keeps getting pushed to the side because it might change something?"],["WHAT DOESN'T FIT?","What part of your current story doesn't make sense yet? Don't solve it. Follow it."],["WHAT IF YOU'RE WRONG?","Choose one belief you feel certain about. What would change if it wasn't true?"],["WHAT WOULD YOU MAKE IF NOBODY SAW IT?","No audience. No algorithm. No explanation. What would you create?"]];

function showWanderResult(title,body,trail){const box=$("wanderResult");box.classList.remove("hidden");box.innerHTML=`<div class="result-kicker">${esc(trail)}</div><div class="result-title">${esc(title)}</div><div class="result-body">${esc(body)}</div><div class="result-actions"><button type="button" class="ghost" id="followBtn">Follow this</button><button type="button" class="ghost" id="anotherBtn">Another path</button></div>`;$("followBtn").onclick=()=>openIdea(title,body,trail);$("anotherBtn").onclick=()=>box.classList.add("hidden")}
function openIdea(title,seed,trail){$("ideaInput").value=title;$("ideaBodyInput").value="";$("ideaTrail").textContent=trail;$("ideaForm").dataset.seed=seed;showView("ideaView");setTimeout(()=>$("ideaBodyInput").focus(),50)}

document.querySelectorAll(".path-card").forEach(b=>b.onclick=()=>{const item=wanderData[b.dataset.path][Math.floor(Math.random()*wanderData[b.dataset.path].length)];showWanderResult(item[0],item[1],b.querySelector("b").textContent)});
$("lostBtn").onclick=()=>{const q=stuck[Math.floor(Math.random()*stuck.length)];showWanderResult(q[0],q[1],"LOST? · LET'S START SOMEWHERE")};
$("ideaForm").onsubmit=e=>{e.preventDefault();const title=$("ideaInput").value.trim(),body=$("ideaBodyInput").value.trim();if(!title&&!body)return;state.ideas.push({id:crypto.randomUUID(),title:title||"Untitled thought",body:body||e.currentTarget.dataset.seed||"",createdAt:nowISO()});e.currentTarget.dataset.seed="";save();renderFound();showView("ideasView")};
$("ideaBackBtn").onclick=()=>{showView("wanderView")};
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{if(b.dataset.view==="homeView")renderJournal();if(b.dataset.view==="ideasView")renderFound();showView(b.dataset.view)});
$("lockBtn").onclick=()=>$("privacyModal").classList.remove("hidden");
$("closeModal").onclick=()=>$("privacyModal").classList.add("hidden");
$("privacyModal").onclick=e=>{if(e.target.id==="privacyModal")$("privacyModal").classList.add("hidden")};
renderJournal();renderFound();