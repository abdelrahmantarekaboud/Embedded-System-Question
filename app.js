let BANK = [];
let QUIZ = [];
let answers = new Map();
let idx = 0;
let feedbackMode = "end";
let timerSeconds = null;
let timerHandle = null;

function $(id){return document.getElementById(id);}

async function loadBank(){
  const res = await fetch('questions.json', {cache:'no-store'});
  BANK = await res.json();
  $('bankCount').textContent = BANK.length.toString();
  updatePoolInfo();
}

function updatePoolInfo(){
  const useMCQ = $('typeMCQ').checked;
  const useTF = $('typeTF').checked;
  const pool = BANK.filter(q => (useMCQ && q.type==='mcq') || (useTF && q.type==='tf'));
  $('poolInfo').textContent = `متاح: ${pool.length} سؤال حسب اختيارك`;
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function startTimer(){
  const timerEl = $('timer');
  if(timerSeconds===null){ timerEl.classList.add('hidden'); return; }
  timerEl.classList.remove('hidden');

  const start = Date.now();
  timerHandle = setInterval(() => {
    const elapsed = Math.floor((Date.now()-start)/1000);
    const left = Math.max(0, timerSeconds - elapsed);
    const mm = String(Math.floor(left/60)).padStart(2,'0');
    const ss = String(left%60).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
    if(left<=0){
      clearInterval(timerHandle);
      finishQuiz();
    }
  }, 250);
}

function renderQuestion(){
  const q = QUIZ[idx];
  $('progress').textContent = `سؤال ${idx+1} / ${QUIZ.length}`;
  const box = $('questionBox');
  box.innerHTML = '';
  const qP = document.createElement('p');
  qP.className='q';
  qP.textContent = q.question;
  box.appendChild(qP);

  const chosen = answers.get(idx) || null;

  q.options.forEach(opt=>{
    const row = document.createElement('label');
    row.className='opt';
    const input = document.createElement('input');
    input.type='radio';
    input.name='opt';
    input.value=opt.id;
    if(chosen===opt.id) input.checked=true;
    input.addEventListener('change', ()=>{
      answers.set(idx, opt.id);
      if(feedbackMode==='instant') showInstantFeedback();
    });
    const t = document.createElement('div');
    t.className='t';
    t.textContent = `${opt.id}) ${opt.text}`;
    row.appendChild(input);
    row.appendChild(t);
    box.appendChild(row);
  });

  $('prevBtn').disabled = idx===0;
  $('nextBtn').disabled = idx===QUIZ.length-1;

  if(feedbackMode==='instant'){
    $('instantFeedback').classList.remove('hidden');
    showInstantFeedback();
  }else{
    $('instantFeedback').classList.add('hidden');
  }
}

function showInstantFeedback(){
  const q = QUIZ[idx];
  const fb = $('instantFeedback');
  const chosen = answers.get(idx);
  if(!chosen){
    fb.className='feedback';
    fb.textContent = 'اختار إجابة.';
    return;
  }
  if(chosen === q.answer){
    fb.className='feedback ok';
    fb.textContent = `✅ صح. الإجابة الصحيحة: ${q.answer}`;
  }else{
    fb.className='feedback bad';
    fb.textContent = `❌ غلط. إجابتك: ${chosen} | الصح: ${q.answer}`;
  }
}

function finishQuiz(){
  // stop timer
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }

  $('quiz').classList.add('hidden');
  $('result').classList.remove('hidden');

  let correct=0, wrong=0, blank=0;
  QUIZ.forEach((q,i)=>{
    const a = answers.get(i);
    if(!a) blank++;
    else if(a===q.answer) correct++;
    else wrong++;
  });
  const score = Math.round((correct/QUIZ.length)*100);

  $('score').textContent = `${score}%`;
  $('correct').textContent = String(correct);
  $('wrong').textContent = String(wrong);
  $('blank').textContent = String(blank);
}

function buildReview(){
  const wrap = $('review');
  wrap.innerHTML='';
  QUIZ.forEach((q,i)=>{
    const a = answers.get(i) || null;
    const item = document.createElement('div');
    item.className='revItem';

    const badge = document.createElement('span');
    if(!a){ badge.className='badge blank'; badge.textContent='بدون إجابة'; }
    else if(a===q.answer){ badge.className='badge ok'; badge.textContent='صح'; }
    else { badge.className='badge bad'; badge.textContent='غلط'; }

    const title = document.createElement('div');
    title.style.display='flex';
    title.style.justifyContent='space-between';
    title.style.alignItems='center';
    title.style.gap='10px';
    const h = document.createElement('div');
    h.style.fontWeight='800';
    h.textContent = `سؤال ${i+1}`;
    title.appendChild(h);
    title.appendChild(badge);

    const qText = document.createElement('div');
    qText.style.marginTop='8px';
    qText.textContent = q.question;

    const your = document.createElement('div');
    your.style.marginTop='8px';
    your.innerHTML = `<span class="muted">إجابتك:</span> ${a ?? '-'} &nbsp; | &nbsp; <span class="muted">الصح:</span> ${q.answer}`;

    const src = document.createElement('div');
    src.className='muted';
    src.style.marginTop='6px';
    src.textContent = `المصدر: ${q.source} - صفحة ${q.page}`;

    item.appendChild(title);
    item.appendChild(qText);
    item.appendChild(your);
    item.appendChild(src);

    wrap.appendChild(item);
  });
}

function startQuiz(){
  const useMCQ = $('typeMCQ').checked;
  const useTF = $('typeTF').checked;
  if(!useMCQ && !useTF){
    alert('لازم تختار نوع سؤال واحد على الأقل.');
    return;
  }

  feedbackMode = $('feedbackMode').value;
  const shuffleOn = $('shuffle').value==='yes';

  const pool = BANK.filter(q => (useMCQ && q.type==='mcq') || (useTF && q.type==='tf'));
  if(pool.length===0){
    alert('مفيش أسئلة متاحة حسب اختيارك.');
    return;
  }

  let n = parseInt($('numQuestions').value || '1', 10);
  if(!Number.isFinite(n) || n<1) n=1;
  n = Math.min(n, pool.length);

  const selected = shuffleOn ? shuffle([...pool]).slice(0,n) : pool.slice(0,n);
  QUIZ = selected;

  answers = new Map();
  idx = 0;

  // timer
  const t = $('timerMode').value;
  timerSeconds = (t==='off') ? null : (parseInt(t,10)*60);

  $('setup').classList.add('hidden');
  $('result').classList.add('hidden');
  $('quiz').classList.remove('hidden');

  renderQuestion();
  startTimer();
}

function resetAll(){
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
  $('setup').classList.remove('hidden');
  $('quiz').classList.add('hidden');
  $('result').classList.add('hidden');
  $('review').classList.add('hidden');
  $('review').innerHTML='';
  $('timer').classList.add('hidden');
}

window.addEventListener('load', async ()=>{
  await loadBank();

  $('typeMCQ').addEventListener('change', updatePoolInfo);
  $('typeTF').addEventListener('change', updatePoolInfo);

  $('startBtn').addEventListener('click', startQuiz);
  $('prevBtn').addEventListener('click', ()=>{ if(idx>0){ idx--; renderQuestion(); }});
  $('nextBtn').addEventListener('click', ()=>{ if(idx<QUIZ.length-1){ idx++; renderQuestion(); }});
  $('finishBtn').addEventListener('click', finishQuiz);

  $('restartBtn').addEventListener('click', resetAll);
  $('reviewBtn').addEventListener('click', ()=>{
    const r=$('review');
    if(r.classList.contains('hidden')){
      buildReview();
      r.classList.remove('hidden');
      $('reviewBtn').textContent='إخفاء المراجعة';
    }else{
      r.classList.add('hidden');
      $('reviewBtn').textContent='مراجعة الإجابات';
    }
  });
});
