/* ============================================================
   GAMES.JS
   Trivia Night, Would You Rather, and a 1-on-1 Tic-Tac-Toe duel,
   all riding the same peer-manager data channels. Each game
   registers its own 'trivia' / 'wyr' / 'ttt' handler.
   ============================================================ */

const MOVIE_SUGGESTIONS = [
  "The Grand Budapest Hotel", "Spirited Away", "Inception", "Knives Out",
  "The Princess Bride", "Everything Everywhere All at Once", "Coco",
  "Whiplash", "La La Land", "Parasite", "The Nice Guys", "Paddington 2"
];
function suggestMovie(){ return MOVIE_SUGGESTIONS[Math.floor(Math.random()*MOVIE_SUGGESTIONS.length)]; }

function shuffledOrder(len){ const arr=[...Array(len).keys()]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

// Script tags load at the end of <body>, so the DOM is already parsed —
// wire listeners directly rather than waiting on DOMContentLoaded (which
// would already have fired by the time this file runs).
document.querySelectorAll('.game-card').forEach(c=> c.addEventListener('click', ()=>openGame(c.dataset.game)));
document.querySelectorAll('[data-back-game]').forEach(b=> b.addEventListener('click', closeGame));
document.getElementById('btn-trivia-start').addEventListener('click', ()=> triviaNext(true));
document.getElementById('btn-wyr-start').addEventListener('click', ()=> wyrNext(true));
function openGame(id){
  document.getElementById('games-picker').style.display='none';
  document.getElementById('game-'+id).style.display='block';
}
function closeGame(){
  document.getElementById('games-picker').style.display='block';
  ['trivia','wyr','ttt'].forEach(g=> document.getElementById('game-'+g).style.display='none');
}

/* ---------------- Trivia ---------------- */
const TRIVIA_BANK = [
  {q:"Which planet has the most moons?", choices:["Earth","Saturn","Mars","Mercury"], correct:1},
  {q:"What's the fastest land animal?", choices:["Lion","Cheetah","Horse","Ostrich"], correct:1},
  {q:"How many strings does a standard guitar have?", choices:["4","5","6","7"], correct:2},
  {q:"Which country invented pizza (modern form)?", choices:["France","Greece","Italy","Spain"], correct:2},
  {q:"What's the largest ocean on Earth?", choices:["Atlantic","Indian","Arctic","Pacific"], correct:3},
  {q:"Which gas do plants absorb from the air?", choices:["Oxygen","Carbon dioxide","Nitrogen","Helium"], correct:1},
  {q:"How many hearts does an octopus have?", choices:["1","2","3","9"], correct:2},
  {q:"What year did the first iPhone release?", choices:["2005","2007","2009","2011"], correct:1},
  {q:"Which element has the chemical symbol 'Au'?", choices:["Silver","Aluminum","Gold","Argon"], correct:2},
  {q:"What's the tallest mountain on Earth?", choices:["K2","Kilimanjaro","Everest","Denali"], correct:2},
  {q:"How many hours are in a week?", choices:["148","156","168","172"], correct:2},
  {q:"Which country gifted the Statue of Liberty to the US?", choices:["UK","France","Spain","Italy"], correct:1}
];
let triviaOrder = [];
let triviaState = { qIndex:-1, answers:{}, scores:{}, revealed:true, timerHandle:null };

function triviaNext(broadcastIt){
  if (triviaOrder.length===0) triviaOrder = shuffledOrder(TRIVIA_BANK.length);
  const idx = triviaOrder.shift();
  startTriviaQuestion(idx, TRIVIA_BANK[idx], broadcastIt);
}
function startTriviaQuestion(idx, bankQ, broadcastIt){
  clearTimeout(triviaState.timerHandle);
  triviaState = { qIndex: idx, answers:{}, scores: triviaState.scores||{}, revealed:false, timerHandle:null };
  renderTriviaQuestion(bankQ);
  triviaState.timerHandle = setTimeout(revealTrivia, 10000);
  if (broadcastIt) broadcast({type:'trivia', action:'question', idx, q:bankQ.q, choices:bankQ.choices, correct:bankQ.correct});
}
function renderTriviaQuestion(bankQ){
  const body = document.getElementById('trivia-body');
  body.innerHTML = `
    <p class="quiz-question">${escapeHtml(bankQ.q)}</p>
    <div class="quiz-choices">${bankQ.choices.map((c,i)=>`<button class="choice-btn" data-i="${i}"><span>${escapeHtml(c)}</span></button>`).join('')}</div>
    <p class="hint" style="margin-top:10px;" id="trivia-wait">10 seconds to answer…</p>
    <div class="scoreboard" id="trivia-scoreboard"></div>
  `;
  body.querySelectorAll('.choice-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (triviaState.revealed || triviaState.answers[myId]!==undefined) return;
      const i = parseInt(btn.dataset.i,10);
      triviaState.answers[myId] = i;
      btn.classList.add('selected');
      document.getElementById('trivia-wait').textContent = 'Answer locked in — waiting for reveal…';
      broadcast({type:'trivia', action:'answer', idx:triviaState.qIndex, peerId:myId, choice:i});
    });
  });
  renderTriviaScoreboard();
}
registerHandler('trivia', (fromId, data)=>{
  if (data.action==='question'){
    clearTimeout(triviaState.timerHandle);
    triviaState = { qIndex:data.idx, answers:{}, scores: triviaState.scores||{}, revealed:false, timerHandle:null, _correct:data.correct };
    renderTriviaQuestion({q:data.q, choices:data.choices, correct:data.correct});
    triviaState.timerHandle = setTimeout(revealTrivia, 10000);
  } else if (data.action==='answer'){
    if (data.idx===triviaState.qIndex && triviaState.answers[data.peerId]===undefined){
      triviaState.answers[data.peerId] = data.choice;
    }
  }
});
function revealTrivia(){
  if (triviaState.revealed) return;
  triviaState.revealed = true;
  const correct = triviaState._correct!==undefined ? triviaState._correct : TRIVIA_BANK[triviaState.qIndex].correct;
  document.querySelectorAll('#trivia-body .choice-btn').forEach(btn=>{
    const i = parseInt(btn.dataset.i,10);
    if (i===correct) btn.classList.add('correct');
    else if (triviaState.answers[myId]===i) btn.classList.add('wrong');
  });
  const waitEl = document.getElementById('trivia-wait');
  if (waitEl) waitEl.textContent = 'Revealed!';
  Object.entries(triviaState.answers).forEach(([pid,choice])=>{
    if (choice===correct) triviaState.scores[pid] = (triviaState.scores[pid]||0)+1;
  });
  renderTriviaScoreboard();
  const body = document.getElementById('trivia-body');
  if (!document.getElementById('btn-trivia-next')){
    const div = document.createElement('div'); div.className='quiz-actions';
    div.innerHTML = `<button class="btn btn-primary" id="btn-trivia-next">Next question</button>`;
    body.appendChild(div);
    document.getElementById('btn-trivia-next').addEventListener('click', ()=>triviaNext(true));
  }
}
function renderTriviaScoreboard(){
  const el = document.getElementById('trivia-scoreboard'); if (!el) return;
  const rows = Object.entries(triviaState.scores||{}).sort((a,b)=>b[1]-a[1]);
  el.innerHTML = rows.map(([pid,score])=>{
    const name = pid===myId ? 'You' : (participants[pid]?.name || '…');
    return `<div class="score-row"><span>${escapeHtml(name)}</span><b>${score}</b></div>`;
  }).join('');
}

/* ---------------- Would You Rather ---------------- */
const WYR_BANK = [
  {a:"Always have to sing instead of speak", b:"Always have to dance instead of walk"},
  {a:"Never watch another movie", b:"Never listen to music again"},
  {a:"Have unlimited pizza for life", b:"Have unlimited tacos for life"},
  {a:"Be able to fly", b:"Be able to turn invisible"},
  {a:"Live without your phone", b:"Live without hot showers"},
  {a:"Always be 10 minutes late", b:"Always be an hour early"},
  {a:"Explore space", b:"Explore the ocean"},
  {a:"Have a rewind button on life", b:"Have a pause button on life"},
  {a:"Only text in emojis forever", b:"Only talk in movie quotes forever"},
  {a:"Win the lottery but lose your closest friend", b:"Stay broke but keep every friend you have"}
];
let wyrOrder = [];
let wyrState = { qIndex:-1, votes:{} };
function wyrNext(broadcastIt){
  if (wyrOrder.length===0) wyrOrder = shuffledOrder(WYR_BANK.length);
  const idx = wyrOrder.shift();
  startWyrQuestion(idx, WYR_BANK[idx], broadcastIt);
}
function startWyrQuestion(idx, q, broadcastIt){
  wyrState = { qIndex: idx, votes:{} };
  renderWyr(q);
  if (broadcastIt) broadcast({type:'wyr', action:'question', idx, a:q.a, b:q.b});
}
function renderWyr(q){
  const body = document.getElementById('wyr-body');
  body.innerHTML = `
    <p class="quiz-question">Would you rather…</p>
    <div class="quiz-choices">
      <button class="choice-btn" data-c="A"><div class="choice-fill" id="wyr-fill-a" style="width:0%"></div><span>${escapeHtml(q.a)}</span></button>
      <button class="choice-btn" data-c="B"><div class="choice-fill" id="wyr-fill-b" style="width:0%"></div><span>${escapeHtml(q.b)}</span></button>
    </div>
    <p class="hint" id="wyr-tally" style="margin-top:10px;">0 votes so far</p>
    <div class="quiz-actions"><button class="btn btn-violet" id="btn-wyr-next">Next question</button></div>
  `;
  body.querySelectorAll('.choice-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      wyrState.votes[myId] = btn.dataset.c;
      renderWyrTally();
      btn.parentElement.querySelectorAll('.choice-btn').forEach(b=>b.classList.toggle('selected', b===btn));
      broadcast({type:'wyr', action:'vote', idx:wyrState.qIndex, peerId:myId, choice:btn.dataset.c});
    });
  });
  document.getElementById('btn-wyr-next').addEventListener('click', ()=>wyrNext(true));
  renderWyrTally();
}
registerHandler('wyr', (fromId, data)=>{
  if (data.action==='question'){
    wyrState = { qIndex:data.idx, votes:{} };
    renderWyr({a:data.a, b:data.b});
  } else if (data.action==='vote'){
    if (data.idx===wyrState.qIndex){ wyrState.votes[data.peerId]=data.choice; renderWyrTally(); }
  }
});
function renderWyrTally(){
  const total = Object.keys(wyrState.votes).length;
  const aCount = Object.values(wyrState.votes).filter(v=>v==='A').length;
  const bCount = total-aCount;
  const fillA = document.getElementById('wyr-fill-a');
  const fillB = document.getElementById('wyr-fill-b');
  if (fillA) fillA.style.width = (total? Math.round(aCount/total*100):0) + '%';
  if (fillB) fillB.style.width = (total? Math.round(bCount/total*100):0) + '%';
  const tally = document.getElementById('wyr-tally');
  if (tally) tally.textContent = `${total} vote${total===1?'':'s'} so far · ${aCount} vs ${bCount}`;
}

/* ---------------- Tic Tac Toe ---------------- */
let tttState = { opponentId:null, opponentName:'', mySymbol:null, board:Array(9).fill(null), myTurn:false, active:false, pendingInvite:null, waitingFor:null };
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function renderTttOpponents(){
  const list = document.getElementById('ttt-opponent-list');
  if (!list || tttState.active) return;
  const others = Object.keys(participants).filter(id=>id!==myId);
  if (others.length===0){ list.innerHTML = `<p class="hint">No one else is here yet — invite a friend into the room first.</p>`; return; }
  list.innerHTML = others.map(id=>`
    <div class="opp-row"><span>${escapeHtml(participants[id].name)}</span><button class="btn btn-ghost btn-sm" data-challenge="${id}">Challenge</button></div>
  `).join('');
  list.querySelectorAll('[data-challenge]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const to = btn.dataset.challenge;
      tttState.waitingFor = to;
      sendData(dataConns[to], {type:'ttt', action:'invite', to, from:myId, name:myName});
      renderTtt();
    });
  });
}
window.onOrbitRender = (function(prev){ return function(){ if(prev) prev(); renderTttOpponents(); }; })(window.onOrbitRender);

registerHandler('ttt', (fromId, data)=>{
  if (data.to !== myId) return;
  if (data.action==='invite'){
    tttState.pendingInvite = {from:data.from, name:data.name};
    renderTtt();
  } else if (data.action==='accept'){
    tttState = { opponentId:data.from, opponentName:participants[data.from]?.name||'Opponent', mySymbol:'X', board:Array(9).fill(null), myTurn:true, active:true, pendingInvite:null, waitingFor:null };
    renderTtt();
  } else if (data.action==='decline'){
    addSystemMessage(`${participants[data.from]?.name||'They'} declined your Tic-Tac-Toe challenge`);
    tttState.waitingFor = null;
    renderTtt();
  } else if (data.action==='move'){
    if (data.from !== tttState.opponentId) return;
    tttState.board[data.cell] = data.symbol;
    tttState.myTurn = true;
    renderTtt();
  } else if (data.action==='reset'){
    if (data.from !== tttState.opponentId) return;
    tttState.board = Array(9).fill(null);
    tttState.myTurn = (tttState.mySymbol==='X');
    renderTtt();
  }
});
window.onPeerRemoved = (function(prev){
  return function(peerId){
    if (prev) prev(peerId);
    if (tttState.opponentId===peerId){ tttState.active=false; renderTtt(); }
  };
})(window.onPeerRemoved);

function tttAccept(){
  const inv = tttState.pendingInvite;
  tttState = { opponentId:inv.from, opponentName:inv.name, mySymbol:'O', board:Array(9).fill(null), myTurn:false, active:true, pendingInvite:null, waitingFor:null };
  sendData(dataConns[inv.from], {type:'ttt', action:'accept', to:inv.from, from:myId});
  renderTtt();
}
function tttDecline(){
  const inv = tttState.pendingInvite;
  sendData(dataConns[inv.from], {type:'ttt', action:'decline', to:inv.from, from:myId});
  tttState.pendingInvite = null;
  renderTtt();
}
function tttCheckResult(){
  const b = tttState.board;
  for (const [a,c,d] of TTT_LINES){ if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]; }
  if (b.every(x=>x)) return 'draw';
  return null;
}
function tttMove(i){
  if (!tttState.active || !tttState.myTurn || tttState.board[i]) return;
  tttState.board[i] = tttState.mySymbol;
  tttState.myTurn = false;
  sendData(dataConns[tttState.opponentId], {type:'ttt', action:'move', to:tttState.opponentId, from:myId, cell:i, symbol:tttState.mySymbol});
  renderTtt();
}
function tttReset(){
  tttState.board = Array(9).fill(null);
  tttState.myTurn = (tttState.mySymbol==='X');
  sendData(dataConns[tttState.opponentId], {type:'ttt', action:'reset', to:tttState.opponentId, from:myId});
  renderTtt();
}
function renderTtt(){
  const body = document.getElementById('ttt-body');
  if (!body) return;
  if (tttState.pendingInvite && !tttState.active){
    body.innerHTML = `<div class="invite-banner"><span>🎮 <b>${escapeHtml(tttState.pendingInvite.name)}</b> challenged you to Tic-Tac-Toe</span>
      <span style="display:flex; gap:8px;"><button class="btn btn-secondary btn-sm" id="ttt-accept">Accept</button><button class="btn btn-ghost btn-sm" id="ttt-decline">Decline</button></span></div>`;
    document.getElementById('ttt-accept').addEventListener('click', tttAccept);
    document.getElementById('ttt-decline').addEventListener('click', tttDecline);
    return;
  }
  if (tttState.waitingFor && !tttState.active){
    body.innerHTML = `<p class="hint">Waiting for ${escapeHtml(participants[tttState.waitingFor]?.name||'them')} to accept…</p>`;
    return;
  }
  if (!tttState.active){
    body.innerHTML = `<p class="hint">Pick someone in the room to challenge.</p><div class="ttt-opponents" id="ttt-opponent-list"></div>`;
    renderTttOpponents();
    return;
  }
  const result = tttCheckResult();
  let status;
  if (result==='draw') status = "🤝 It's a draw!";
  else if (result) status = (result===tttState.mySymbol) ? "🎉 You won!" : `${escapeHtml(tttState.opponentName)} won this round`;
  else status = tttState.myTurn ? "Your move" : `Waiting on ${escapeHtml(tttState.opponentName)}…`;

  body.innerHTML = `
    <div class="ttt-status">You are <b style="color:${tttState.mySymbol==='X'?'var(--coral)':'var(--teal)'}">${tttState.mySymbol}</b> · vs ${escapeHtml(tttState.opponentName)} · ${status}</div>
    <div class="ttt-board" id="ttt-board"></div>
    <div class="quiz-actions">
      ${result ? '<button class="btn btn-primary btn-sm" id="ttt-again">Play again</button>' : ''}
      <button class="btn btn-ghost btn-sm" id="ttt-leave">Leave game</button>
    </div>
  `;
  const boardEl = document.getElementById('ttt-board');
  tttState.board.forEach((val,i)=>{
    const cell = document.createElement('button');
    cell.className = 'ttt-cell' + (val==='X'?' x':'') + (val==='O'?' o':'');
    cell.textContent = val||'';
    cell.disabled = !!result || !!val || !tttState.myTurn;
    cell.addEventListener('click', ()=>tttMove(i));
    boardEl.appendChild(cell);
  });
  if (result) document.getElementById('ttt-again').addEventListener('click', tttReset);
  document.getElementById('ttt-leave').addEventListener('click', ()=>{
    tttState = { opponentId:null, opponentName:'', mySymbol:null, board:Array(9).fill(null), myTurn:false, active:false, pendingInvite:null, waitingFor:null };
    renderTtt();
  });
}
