/* Embedded Systems Quiz (Vanilla JS) */
const $ = (sel) => document.querySelector(sel);

const state = {
  bank: [],
  quiz: [],
  answers: new Map(),   // qid -> selected option id
  flagged: new Set(),   // qid
  idx: 0,
  reviewMode: "after",
  timer: { enabled:false, totalSec:0, leftSec:0, t:null, startedAt:null, endedAt:null },
};

function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function fmtTime(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

async function loadBank(){
  const res = await fetch("questions.json");
  if(!res.ok) throw new Error("Failed to load questions.json");
  state.bank = await res.json();
  $("#bankInfo").textContent = `بنك الأسئلة: ${state.bank.length} سؤال`;
  $("#countInput").value = Math.min(50, state.bank.length);
  $("#countInput").max = state.bank.length;
}

function show(id){
  ["#screenLoading","#screenStart","#screenQuiz","#screenResult"].forEach(s=>$(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function resetAll(){
  state.quiz = [];
  state.answers = new Map();
  state.flagged = new Set();
  state.idx = 0;
  stopTimer();
  show("#screenStart");
}

function startQuiz(){
  const count = Math.max(1, Math.min(parseInt($("#countInput").value||"1",10), state.bank.length));
  const doShuffle = $("#shuffleSelect").value === "yes";
  state.reviewMode = $("#reviewSelect").value;

  // Timer setup
  const tsel = $("#timerSelect").value;
  state.timer.enabled = tsel !== "off";
  state.timer.totalSec = state.timer.enabled ? parseInt(tsel,10)*60 : 0;
  state.timer.leftSec = state.timer.totalSec;
  state.timer.startedAt = new Date();
  state.timer.endedAt = null;

  // pick questions
  let picked = [...state.bank];
  if(doShuffle) shuffle(picked);
  picked = picked.slice(0, count);
  state.quiz = picked;
  state.idx = 0;
  state.answers.clear();
  state.flagged.clear();

  renderNavGrid();
  renderQuestion();
  show("#screenQuiz");
  if(state.timer.enabled) startTimer();
}

function renderNavGrid(){
  const wrap = $("#navGrid");
  wrap.innerHTML = "";
  state.quiz.forEach((q, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "navbtn";
    b.textContent = (i+1);
    b.addEventListener("click", () => { state.idx = i; renderQuestion(); });
    wrap.appendChild(b);
  });
  refreshNavGrid();
}
function refreshNavGrid(){
  const btns = Array.from(document.querySelectorAll(".navbtn"));
  btns.forEach((b, i) => {
    const q = state.quiz[i];
    b.classList.toggle("ans", state.answers.has(q.id));
    b.classList.toggle("flag", state.flagged.has(q.id));
    b.style.opacity = (i === state.idx) ? "1" : "0.75";
  });
  $("#pillAnswered").textContent = `تم الحل: ${state.answers.size}`;
}

function renderQuestion(){
  const q = state.quiz[state.idx];
  $("#pillProgress").textContent = `سؤال ${state.idx+1} / ${state.quiz.length}`;
  $("#qSource").textContent = q.source || "";
  $("#qId").textContent = q.id || "";
  $("#qText").textContent = q.question;

  $("#btnFlag").textContent = state.flagged.has(q.id) ? "🚩 إزالة العلامة" : "🚩 علامة";

  const form = $("#optionsForm");
  form.innerHTML = "";

  const selected = state.answers.get(q.id) || null;

  q.options.forEach(opt => {
    const label = document.createElement("label");
    label.className = "opt";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "opt";
    input.value = opt.id;
    input.checked = selected === opt.id;

    input.addEventListener("change", () => {
      state.answers.set(q.id, opt.id);
      refreshNavGrid();
      if(state.reviewMode === "instant"){
        showInstantFeedback();
      }
    });

    const text = document.createElement("div");
    text.innerHTML = `<b>${opt.id})</b> ${opt.text}`;
    label.appendChild(input);
    label.appendChild(text);
    form.appendChild(label);
  });

  hideInstantFeedback();
  refreshNavGrid();
  updateNavButtons();
}

function updateNavButtons(){
  $("#btnPrev").disabled = state.idx === 0;
  $("#btnNext").disabled = state.idx === state.quiz.length - 1;
}

function getSelectedForCurrent(){
  const q = state.quiz[state.idx];
  return state.answers.get(q.id) || null;
}

function clearAnswer(){
  const q = state.quiz[state.idx];
  state.answers.delete(q.id);
  renderQuestion();
}

function toggleFlag(){
  const q = state.quiz[state.idx];
  if(state.flagged.has(q.id)) state.flagged.delete(q.id);
  else state.flagged.add(q.id);
  renderQuestion();
}

function showInstantFeedback(){
  const q = state.quiz[state.idx];
  const sel = getSelectedForCurrent();
  if(!sel) return hideInstantFeedback();

  const fb = $("#instantFeedback");
  const ok = sel === q.answer;
  fb.classList.remove("hidden","good","bad");
  fb.classList.add(ok ? "good" : "bad");
  fb.textContent = ok ? "✅ إجابة صحيحة" : `❌ إجابة خاطئة — الصحيح: ${q.answer}`;
}

function hideInstantFeedback(){
  $("#instantFeedback").classList.add("hidden");
  $("#instantFeedback").classList.remove("good","bad");
  $("#instantFeedback").textContent = "";
}

function calcScore(){
  let correct=0, wrong=0, blank=0;
  const details = state.quiz.map(q => {
    const sel = state.answers.get(q.id) || null;
    const isBlank = !sel;
    const isCorrect = sel === q.answer;
    if(isBlank) blank++;
    else if(isCorrect) correct++;
    else wrong++;
    return { q, sel, isCorrect, isBlank };
  });
  const total = state.quiz.length;
  const pct = total ? Math.round((correct/total)*100) : 0;
  return { correct, wrong, blank, total, pct, details };
}

function endQuiz(){
  if(state.timer.enabled) {
    state.timer.endedAt = new Date();
    stopTimer();
  }
  const res = calcScore();

  $("#scorePct").textContent = `${res.pct}%`;
  $("#scoreLine").textContent = `${res.correct} / ${res.total}`;
  $("#statCorrect").textContent = res.correct;
  $("#statWrong").textContent = res.wrong;
  $("#statBlank").textContent = res.blank;

  if(state.timer.startedAt){
    const end = state.timer.endedAt || new Date();
    const used = Math.max(0, Math.round((end - state.timer.startedAt)/1000));
    $("#statTime").textContent = fmtTime(used);
  }else{
    $("#statTime").textContent = "—";
  }

  // build review list (hidden until user clicks)
  buildReview(res.details);

  show("#screenResult");
}

function buildReview(details){
  const wrap = $("#reviewList");
  wrap.innerHTML = "";
  details.forEach((d, i) => {
    const div = document.createElement("div");
    div.className = "reviewitem";
    const your = d.sel ? d.sel : "—";
    const status = d.isBlank ? "بدون إجابة" : (d.isCorrect ? "✅ صح" : "❌ غلط");
    div.innerHTML = `
      <div class="meta">
        <div><b>سؤال ${i+1}</b> <span class="muted">(${d.q.source})</span></div>
        <div>${status}</div>
      </div>
      <div style="margin-top:8px; line-height:1.7">${escapeHtml(d.q.question)}</div>
      <div style="margin-top:10px">
        <div class="muted">إجابتك: <b>${your}</b> — الصحيح: <b>${d.q.answer}</b></div>
      </div>
      <div style="margin-top:10px">
        ${d.q.options.map(o => {
          const cls = (o.id === d.q.answer) ? "opt good" : ((o.id === d.sel && !d.isCorrect) ? "opt bad" : "opt");
          return `<div class="${cls}" style="margin-top:8px"><b>${o.id})</b> ${escapeHtml(o.text)}</div>`;
        }).join("")}
      </div>
    `;
    wrap.appendChild(div);
  });
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Timer
function startTimer(){
  $("#pillTimer").hidden = false;
  $("#pillTimer").textContent = `⏱ ${fmtTime(state.timer.leftSec)}`;
  state.timer.t = setInterval(() => {
    state.timer.leftSec = Math.max(0, state.timer.leftSec - 1);
    $("#pillTimer").textContent = `⏱ ${fmtTime(state.timer.leftSec)}`;
    if(state.timer.leftSec <= 0){
      state.timer.endedAt = new Date();
      stopTimer();
      endQuiz();
    }
  }, 1000);
}
function stopTimer(){
  if(state.timer.t){
    clearInterval(state.timer.t);
    state.timer.t = null;
  }
  $("#pillTimer").hidden = true;
}

// Theme
function toggleTheme(){
  document.documentElement.classList.toggle("light");
  localStorage.setItem("theme", document.documentElement.classList.contains("light") ? "light" : "dark");
}
function loadTheme(){
  const t = localStorage.getItem("theme");
  if(t === "light") document.documentElement.classList.add("light");
}

function wire(){
  $("#btnStart").addEventListener("click", startQuiz);
  $("#btnPrev").addEventListener("click", () => { if(state.idx>0){ state.idx--; renderQuestion(); }});
  $("#btnNext").addEventListener("click", () => { if(state.idx<state.quiz.length-1){ state.idx++; renderQuestion(); }});
  $("#btnClear").addEventListener("click", clearAnswer);
  $("#btnFlag").addEventListener("click", toggleFlag);
  $("#btnSubmit").addEventListener("click", endQuiz);
  $("#btnNew").addEventListener("click", resetAll);
  $("#btnReview").addEventListener("click", () => $("#reviewWrap").classList.toggle("hidden"));
  $("#btnReset").addEventListener("click", () => {
    if(confirm("هل تريد إعادة التعيين؟ سيتم مسح الإجابات الحالية.")) resetAll();
  });
  $("#btnToggleTheme").addEventListener("click", toggleTheme);
}

async function main(){
  loadTheme();
  wire();
  try{
    await loadBank();
    show("#screenStart");
  }catch(e){
    console.error(e);
    $("#screenLoading").innerHTML = `<h2>حصلت مشكلة في تحميل الأسئلة</h2>
    <p class="muted">تأكد إن questions.json موجود في نفس المجلد، وإنك فاتح الصفحة من سيرفر محلي.</p>`;
  }
}
main();
