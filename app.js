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
  const data = await res.json();

  // Supports both formats:
  // 1) Array of questions
  // 2) { questions: [...] }
  BANK = Array.isArray(data) ? data : (data.questions || []);
  $('bankCount').textContent = BANK.length.toString();
  updatePoolInfo();
}

function updatePoolInfo(){
  const useMCQ = $('typeMCQ').checked;
  const useTF = $('typeTF').checked;
  const pool = BANK.filter(q => (useMCQ && q.type==='mcq') || (useTF && q.type==='tf'));
  $('poolInfo').textContent = `Available: ${pool.length} questions for your selection`;
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

// Helpers
function hasAnswerKey(q){
  return q && q.answer && String(q.answer).trim() !== "" && String(q.answer).toLowerCase() !== "null";
}

function getOptionText(q, optionId){
  if(!q || !q.options) return '';
  const op = q.options.find(o => o.id === optionId);
  return op ? op.text : '';
}

function renderQuestion(){
  const q = QUIZ[idx];
  $('progress').textContent = `Question ${idx+1} / ${QUIZ.length}`;
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

  // No answer key
  if(!hasAnswerKey(q)){
    fb.className = 'feedback';
    fb.textContent = 'ℹ️ This question has no Answer Key in the source file, so it will not be auto-graded.';
    return;
  }

  if(!chosen){
    fb.className='feedback';
    fb.textContent = 'Choose an answer.';
    return;
  }

  if(chosen === q.answer){
    fb.className='feedback ok';
    fb.textContent = `✅ Correct. Answer: ${q.answer}`;
  }else{
    fb.className='feedback bad';
    fb.textContent = `❌ Wrong. Your: ${chosen} | Correct: ${q.answer}`;
  }
}

function finishQuiz(){
  // stop timer
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }

  $('quiz').classList.add('hidden');
  $('result').classList.remove('hidden');

  let correct=0, wrong=0, blank=0, noKey=0, graded=0;

  QUIZ.forEach((q,i)=>{
    const a = answers.get(i);

    if(!a) {
      blank++;
      // blank is still blank, but only graded if there is a key (so it can be considered wrong/unanswered)
      if(hasAnswerKey(q)) graded++;
      else noKey++;
      return;
    }

    if(!hasAnswerKey(q)){
      // user answered but no key => do not grade
      noKey++;
      return;
    }

    graded++;
    if(a===q.answer) correct++;
    else wrong++;
  });

  // Score based on graded questions only (to avoid 0% بسبب null)
  const score = graded > 0 ? Math.round((correct/graded)*100) : 0;

  $('score').textContent = `${score}%`;
  $('correct').textContent = String(correct);
  $('wrong').textContent = String(wrong);
  $('blank').textContent = String(blank);

  // Auto-show review after finish
  buildReview();
  $('review').classList.remove('hidden');

  // If you have a review button, set its text to "Hide review"
  const rb = $('reviewBtn');
  if(rb){
    rb.textContent = 'Hide Review';
  }
}

function buildReview(){
  const wrap = $('review');
  wrap.innerHTML='';

  QUIZ.forEach((q,i)=>{
    const userAns = answers.get(i) || null;

    const item = document.createElement('div');
    item.className='revItem';

    // Badge
    const badge = document.createElement('span');

    if(!hasAnswerKey(q)){
      badge.className='badge blank';
      badge.textContent='No Key';
    }else if(!userAns){
      badge.className='badge blank';
      badge.textContent='Unanswered';
    }else if(userAns===q.answer){
      badge.className='badge ok';
      badge.textContent='Correct';
    }else{
      badge.className='badge bad';
      badge.textContent='Wrong';
    }

    const title = document.createElement('div');
    title.style.display='flex';
    title.style.justifyContent='space-between';
    title.style.alignItems='center';
    title.style.gap='10px';

    const h = document.createElement('div');
    h.style.fontWeight='800';
    h.textContent = `Question ${i+1}`;
    title.appendChild(h);
    title.appendChild(badge);

    const qText = document.createElement('div');
    qText.style.marginTop='8px';
    qText.textContent = q.question;

    // Options (show all + mark your/correct)
    const optsWrap = document.createElement('div');
    optsWrap.style.marginTop = '10px';

    q.options.forEach(opt=>{
      const row = document.createElement('div');
      row.className = 'opt';

      const isUser = userAns === opt.id;
      const isCorrect = hasAnswerKey(q) && q.answer === opt.id;

      // Highlights
      if(isCorrect) row.style.borderColor = '#2d8a5e'; // green
      if(isUser && !isCorrect) row.style.borderColor = '#a93a4d'; // red

      const mark = document.createElement('div');
      mark.style.fontWeight='800';
      mark.style.minWidth='120px';

      if(isCorrect && isUser) mark.textContent = '✅ Your + Correct';
      else if(isCorrect) mark.textContent = '✅ Correct';
      else if(isUser) mark.textContent = '❌ Your';
      else mark.textContent = '';

      const text = document.createElement('div');
      text.className='t';
      text.textContent = `${opt.id}) ${opt.text}`;

      row.appendChild(mark);
      row.appendChild(text);
      optsWrap.appendChild(row);
    });

    // Summary (FULL TEXT)
    const summary = document.createElement('div');
    summary.style.marginTop='8px';

    const yourFull = userAns ? `${userAns}) ${getOptionText(q, userAns)}` : '-';

    if(!hasAnswerKey(q)){
      summary.innerHTML =
        `<div><span class="muted">Your Answer:</span> ${yourFull}</div>
         <div><span class="muted">Correct Answer:</span> N/A (No Answer Key in source)</div>`;
    } else {
      const correctFull = `${q.answer}) ${getOptionText(q, q.answer)}`;
      summary.innerHTML =
        `<div><span class="muted">Your Answer:</span> ${yourFull}</div>
         <div><span class="muted">Correct Answer:</span> ${correctFull}</div>`;
    }

    // Source
    const src = document.createElement('div');
    src.className='muted';
    src.style.marginTop='6px';
    const srcName = q.source ?? '-';
    const srcPage = (q.page ?? '-') ;
    src.textContent = `Source: ${srcName} | Page: ${srcPage}`;

    item.appendChild(title);
    item.appendChild(qText);
    item.appendChild(optsWrap);
    item.appendChild(summary);
    item.appendChild(src);

    wrap.appendChild(item);
  });
}

function startQuiz(){
  const useMCQ = $('typeMCQ').checked;
  const useTF = $('typeTF').checked;
  if(!useMCQ && !useTF){
    alert('Please select at least one question type.');
    return;
  }

  feedbackMode = $('feedbackMode').value;
  const shuffleOn = $('shuffle').value==='yes';

  // IMPORTANT:
  // Keep all questions (including no-key) so no question is "missing".
  // They will show "No Key" and won't affect score.
  const pool = BANK.filter(q => (useMCQ && q.type==='mcq') || (useTF && q.type==='tf'));
  if(pool.length===0){
    alert('No questions available for your selection.');
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

  // hide review area while doing quiz
  const r = $('review');
  if(r){
    r.classList.add('hidden');
    r.innerHTML = '';
  }

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

  // reset review button text if exists
  const rb = $('reviewBtn');
  if(rb){
    rb.textContent = 'Review Answers';
  }
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

  // If you still keep a review toggle button:
  const rb = $('reviewBtn');
  if(rb){
    rb.addEventListener('click', ()=>{
      const r=$('review');
      if(r.classList.contains('hidden')){
        buildReview();
        r.classList.remove('hidden');
        rb.textContent='Hide Review';
      }else{
        r.classList.add('hidden');
        rb.textContent='Review Answers';
      }
    });
  }
});
