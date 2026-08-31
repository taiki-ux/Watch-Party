/* ============================================================
   APP.JS
   Boot sequence, screen/mode transitions, settings modal, and
   the lightweight @ai chat companion. Everything DOM-facing that
   isn't specific to one activity lives here.
   ============================================================ */

// ---------- Splash: fixed 5s, no skip ----------
(function(){
  const colors = ['#ff6f91','#ffd166','#5ee6d0','#a78bfa'];
  const splash = document.getElementById('screen-splash');
  for (let i=0;i<10;i++){
    const p = document.createElement('div');
    p.className='splash-particle';
    const size = 3+Math.random()*5;
    p.style.width=size+'px'; p.style.height=size+'px';
    p.style.left = (Math.random()*100)+'%';
    p.style.top = (Math.random()*100)+'%';
    p.style.background = colors[i%colors.length];
    p.style.animationDuration = (6+Math.random()*6)+'s';
    p.style.animationDelay = (Math.random()*4)+'s';
    splash.appendChild(p);
  }
  setTimeout(()=>{
    splash.style.transition = 'opacity .5s ease';
    splash.style.opacity = '0';
    setTimeout(()=>{
      splash.style.display='none';
      // Resume a saved session, or drop into the landing form
      const saved = getSavedSession();
      if (saved){
        myName = saved.name; roomCode = saved.room; isHost = saved.isHost;
        showLandingStatus('Restoring your session…');
        document.getElementById('screen-landing').style.display='flex';
        initPeer(isHost ? roomCode : undefined);
      } else {
        document.getElementById('screen-landing').style.display='flex';
      }
    }, 500);
  }, 5000);
})();

// ---------- Global toggles used by other modules ----------
window.autoSyncOn = true;
window.soundOn = true;

// ---------- Landing ----------
const nameInput = document.getElementById('input-name');
const roomInput = document.getElementById('input-roomcode');
function showLandingStatus(msg,isErr){ const el=document.getElementById('landing-status'); if(el){ el.textContent=msg; el.classList.toggle('err',!!isErr);} }

document.getElementById('btn-create').addEventListener('click', ()=>{
  myName = nameInput.value.trim();
  if (!myName){ showLandingStatus('Enter your name first.', true); return; }
  roomCode = generateRoomCode(); isHost = true;
  showLandingStatus('Opening your room…');
  initPeer(roomCode);
});
document.getElementById('btn-join').addEventListener('click', ()=>{
  myName = nameInput.value.trim();
  const code = roomInput.value.trim().toLowerCase();
  if (!myName){ showLandingStatus('Enter your name first.', true); return; }
  if (!code){ showLandingStatus("Enter the room code your friend sent you.", true); return; }
  roomCode = code; isHost = false;
  showLandingStatus('Joining…');
  initPeer();
});
window.onPeerError = (msg)=> showLandingStatus(msg, true);

// ---------- Entry gate (choice-only) ----------
window.onPeerReady = function(){
  document.getElementById('screen-landing').style.display='none';
  document.getElementById('screen-room').style.display='block';
  document.getElementById('entry-hub').style.display='flex';
  document.getElementById('entry-room-code').textContent = roomCode;
  document.getElementById('input-rename').value = myName;
  addSystemMessage(isHost ? `Room created. Share the code "${roomCode}" with your friends.` : `You joined "${roomCode}".`);
};
document.getElementById('entry-btn-copy').addEventListener('click', copyRoomCode);
document.getElementById('btn-copy').addEventListener('click', copyRoomCode);
function copyRoomCode(){
  navigator.clipboard.writeText(roomCode).then(()=>{
    ['entry-btn-copy','btn-copy'].forEach(id=>{
      const btn=document.getElementById(id); const old=btn.textContent;
      btn.textContent='✓'; setTimeout(()=>btn.textContent=old,1200);
    });
  });
}
function leaveRoom(){
  if (!confirm('Leave the room?')) return;
  clearSession();
  if (peer) peer.destroy();
  location.reload();
}
document.getElementById('entry-btn-leave').addEventListener('click', leaveRoom);
document.getElementById('btn-leave').addEventListener('click', leaveRoom);

document.querySelectorAll('.hub-card').forEach(c=> c.addEventListener('click', ()=> enterActivity(c.dataset.mode, true)));

// ---------- Mode switching ----------
function enterActivity(mode, broadcastIt){
  document.getElementById('entry-hub').style.display='none';
  document.getElementById('activity-shell').style.display='flex';
  document.getElementById('room-code-display').textContent = roomCode;
  setMode(mode, broadcastIt);
}
function setMode(mode, broadcastIt){
  currentMode = mode;
  // if we're still on the entry gate and a peer told us to jump straight into
  // an activity (mid-session join), reveal the shell too
  if (document.getElementById('activity-shell').style.display !== 'flex') enterActivity(mode, false);
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('pane-'+mode).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));

  // Chat is only surfaced in Music mode — Video and Games stay voice-only
  const chatToggleWrap = document.getElementById('chat-toggle-wrap');
  const chatCol = document.getElementById('chat-col');
  if (mode === 'music'){
    chatToggleWrap.classList.add('visible');
  } else {
    chatToggleWrap.classList.remove('visible');
    chatCol.classList.remove('open');
    setChatToggleLabel(false);
  }
  if (broadcastIt) broadcast({type:'mode', mode});
}
window.onRemoteMode = (mode)=> setMode(mode, false);
document.querySelectorAll('.nav-btn').forEach(b=> b.addEventListener('click', ()=>setMode(b.dataset.mode, true)));

// ---------- Chat drawer (music mode only) ----------
function setChatToggleLabel(open){
  const btn = document.getElementById('btn-chat-toggle');
  if (btn) btn.textContent = open ? '✕ Close chat' : '💬 Open chat';
}
document.getElementById('btn-chat-toggle').addEventListener('click', ()=>{
  const chatCol = document.getElementById('chat-col');
  const open = !chatCol.classList.contains('open');
  chatCol.classList.toggle('open', open);
  setChatToggleLabel(open);
});

// ---------- Video pane wiring ----------
window.onChannelLoading = (function(prev){
  return function(ch, videoId){
    if (prev) prev(ch, videoId);
    if (ch === 'video'){ const ph = document.getElementById('video-placeholder'); if (ph) ph.style.display='none'; }
  };
})(window.onChannelLoading);

document.getElementById('btn-load-video').addEventListener('click', ()=>{
  const id = extractVideoId(document.getElementById('input-video-url').value);
  if (!id){ alert("Couldn't find a video in that link — paste a full YouTube URL or an 11-character video ID."); return; }
  YTSync.load('video', id);
});
document.getElementById('btn-play-video').addEventListener('click', ()=>YTSync.play('video'));
document.getElementById('btn-pause-video').addEventListener('click', ()=>YTSync.pause('video'));
document.getElementById('btn-sync-video').addEventListener('click', ()=>YTSync.syncToMe('video'));
document.getElementById('btn-seek-video').addEventListener('click', ()=>{
  if (!YTSync.seek('video', document.getElementById('input-seek-video').value)) alert('Enter a time like 1:23 or a number of seconds.');
});
document.getElementById('input-seek-video').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('btn-seek-video').click(); });
document.getElementById('btn-fullscreen').addEventListener('click', async ()=>{
  const frame = document.querySelector('#pane-video .video-frame');
  if (document.fullscreenElement){
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    document.exitFullscreen();
  } else {
    try{
      if (frame.requestFullscreen) await frame.requestFullscreen();
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(()=>{});
    }catch(err){ console.warn('Fullscreen/rotation error:', err); }
  }
});

// ---------- Music pane wiring ----------
document.getElementById('btn-load-music').addEventListener('click', ()=>{
  const res = musicLoadFromInput(document.getElementById('input-music-url').value);
  if (!res.ok) alert(res.message);
});
document.getElementById('btn-play-music').addEventListener('click', ()=>YTSync.play('music'));
document.getElementById('btn-pause-music').addEventListener('click', ()=>YTSync.pause('music'));
document.getElementById('btn-sync-music').addEventListener('click', ()=>YTSync.syncToMe('music'));
document.getElementById('btn-seek-music').addEventListener('click', ()=>{
  if (!YTSync.seek('music', document.getElementById('input-seek-music').value)) alert('Enter a time like 1:23 or a number of seconds.');
});
document.getElementById('input-seek-music').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('btn-seek-music').click(); });
document.getElementById('btn-pick-local').addEventListener('click', ()=> document.getElementById('input-local-file').click());
document.getElementById('input-local-file').addEventListener('change', function(){
  if (this.files && this.files[0]) musicPlayLocalFile(this.files[0]);
});

// ---------- Mic ----------
document.getElementById('btn-mic').addEventListener('click', async ()=>{
  const btn = document.getElementById('btn-mic');
  if (!micOn){
    try{
      if (!localStream){ localStream = await acquireMicStream(); attachSpeakingDetector(localStream, myId); }
      localStream.getAudioTracks().forEach(t=>t.enabled=true);
      micOn = true;
      btn.textContent = '🔇 Leave voice'; btn.classList.remove('btn-secondary'); btn.classList.add('btn-ghost');
      for (const id in dataConns) maybeCallPeer(id);
      broadcast({type:'mic', muted:false});
    }catch(e){ alert("Couldn't access your microphone. Check your browser's permission settings."); }
  } else {
    micOn = false;
    if (localStream) localStream.getAudioTracks().forEach(t=>t.enabled=false);
    btn.textContent = '🎤 Join voice'; btn.classList.add('btn-secondary'); btn.classList.remove('btn-ghost');
    broadcast({type:'mic', muted:true});
  }
});

// ---------- Chat send + @ai companion ----------
document.getElementById('btn-send').addEventListener('click', sendChatFromInput);
document.getElementById('input-chat').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChatFromInput(); });
function sendChatFromInput(){
  const input = document.getElementById('input-chat');
  const text = input.value.trim(); if (!text) return;
  sendChatMessage(myName, text, false);
  input.value = '';
  if (/@ai\b/i.test(text)) respondAsAI(text);
}

const AI_JOKES = [
  "Why don't scientists trust atoms? Because they make up everything.",
  "I told my WiFi I loved it. It said the connection isn't stable.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "I'm reading a book on anti-gravity. It's impossible to put down.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I used to be a banker, but I lost interest.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "Why did the video call freeze? It saw the WiFi bill."
];
const AI_FILLERS = [
  "Haha, love the energy in here! 🎉",
  "I'm just a lightweight joke-bot for now — ask me for a joke, a movie, or a song! 🎬🎵",
  "Ha! Okay okay, carry on 😄",
  "That's the spirit! Someone say the word 'joke' if you want one 👀"
];
function respondAsAI(triggerText){
  const lower = triggerText.toLowerCase();
  let reply;
  if (/joke/.test(lower)){
    reply = AI_JOKES[Math.floor(Math.random()*AI_JOKES.length)];
  } else if (/movie|watch/.test(lower)){
    reply = `Tonight's pick: 🎬 "${suggestMovie()}" — trust me on this one.`;
  } else if (/song|music|track/.test(lower)){
    reply = `Try this: 🎵 "${suggestSong()}" — put it on and thank me later.`;
  } else {
    reply = AI_FILLERS[Math.floor(Math.random()*AI_FILLERS.length)];
  }
  setTimeout(()=> sendChatMessage('🤖 Buddy', reply, true), 500 + Math.random()*400);
}
window.onChatReceived = function(){ playChime(); };
function playChime(){
  if (!window.soundOn) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value=740;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.28);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.3);
  }catch(e){}
}

// ---------- Settings ----------
document.getElementById('btn-settings').addEventListener('click', ()=>{
  document.getElementById('settings-overlay').style.display='flex';
  populateMicSelect();
});
document.getElementById('btn-settings-close').addEventListener('click', ()=>{ document.getElementById('settings-overlay').style.display='none'; });
document.getElementById('settings-overlay').addEventListener('click', e=>{ if (e.target.id==='settings-overlay') e.currentTarget.style.display='none'; });

document.getElementById('btn-rename-save').addEventListener('click', ()=>{
  const newName = document.getElementById('input-rename').value.trim();
  if (!newName || newName===myName) return;
  myName = newName;
  participants[myId].name = myName;
  renderOrbit();
  broadcast({type:'rename', name:myName});
  addSystemMessage(`You are now known as "${myName}"`);
});
document.getElementById('toggle-sound').addEventListener('click', function(){ window.soundOn=!window.soundOn; this.classList.toggle('on',window.soundOn); });
document.getElementById('toggle-autosync').addEventListener('click', function(){ window.autoSyncOn=!window.autoSyncOn; this.classList.toggle('on',window.autoSyncOn); });

async function populateMicSelect(){
  try{
    const sel = document.getElementById('select-mic');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d=>d.kind==='audioinput');
    sel.innerHTML = mics.map((d,i)=>`<option value="${d.deviceId}">${d.label||('Microphone '+(i+1))}</option>`).join('');
  }catch(e){}
}
document.getElementById('select-mic').addEventListener('change', async function(){
  const deviceId = this.value; if (!deviceId) return;
  try{
    const newStream = await acquireMicStream(deviceId);
    if (localStream) localStream.getTracks().forEach(t=>t.stop());
    localStream = newStream;
    localStream.getAudioTracks().forEach(t=>t.enabled=micOn);
    attachSpeakingDetector(localStream, myId);
    const newTrack = localStream.getAudioTracks()[0];
    Object.values(mediaConns).forEach(call=>{
      const pc = call.peerConnection;
      if (!pc) return;
      const sender = pc.getSenders().find(s=>s.track && s.track.kind==='audio');
      if (sender) sender.replaceTrack(newTrack);
    });
  }catch(e){ alert("Couldn't switch microphone."); }
});
