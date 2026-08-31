/* ============================================================
   YOUTUBE-SYNC.JS
   A small "channel" abstraction so the exact same synced-playback
   engine can drive both the Video pane and the Music pane without
   the two ever fighting over one player. Each channel keeps its
   own player, ready flag, current video id, and echo-suppression
   flag; broadcast/receive messages carry a `channel` field.
   ============================================================ */

let ytApiReady = false;
const ytTag = document.createElement('script');
ytTag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytTag);
window.onYouTubeIframeAPIReady = function(){ ytApiReady = true; };

const YTChannels = {
  video: { containerId:'yt-player-video', player:null, ready:false, currentId:null, suppress:false },
  music: { containerId:'yt-player-music', player:null, ready:false, currentId:null, suppress:false }
};

function extractVideoId(input){
  input = (input||'').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function isSpotifyLink(input){ return /open\.spotify\.com/i.test(input||''); }
function parseTimeInput(str){
  str = (str||'').trim();
  if (/^\d+$/.test(str)) return parseInt(str,10);
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  let secs = 0; for (const p of parts) secs = secs*60 + p;
  return secs;
}

function ytEnsurePlayerAndLoad(ch, videoId, startTime){
  const c = YTChannels[ch];
  c.currentId = videoId;
  if (window.onChannelLoading) window.onChannelLoading(ch, videoId);
  if (!ytApiReady || typeof YT==='undefined'){ setTimeout(()=>ytEnsurePlayerAndLoad(ch,videoId,startTime),300); return; }
  if (!c.player){
    c.player = new YT.Player(c.containerId, {
      videoId: videoId,
      playerVars:{ rel:0, playsinline:1 },
      events:{
        onReady: ()=>{ c.ready=true; if (typeof startTime!=='undefined') c.player.seekTo(startTime,true); },
        onStateChange: (e)=>ytOnStateChange(ch,e)
      }
    });
  } else {
    c.player.loadVideoById(videoId, (typeof startTime!=='undefined')?startTime:0);
  }
}
function ytOnStateChange(ch,e){
  const c = YTChannels[ch];
  if (window.onChannelStateChange) window.onChannelStateChange(ch, e.data);
  if (c.suppress || !window.YT) return;
  if (e.data === YT.PlayerState.PLAYING) ytBroadcast(ch,{action:'play', time:c.player.getCurrentTime()});
  else if (e.data === YT.PlayerState.PAUSED) ytBroadcast(ch,{action:'pause', time:c.player.getCurrentTime()});
}
function ytBroadcast(ch,payload){
  payload.type='video'; payload.channel=ch; payload.videoId = YTChannels[ch].currentId;
  broadcast(payload);
}
function ytApplyRemoteCommand(ch,data){
  const c = YTChannels[ch];
  c.suppress = true;
  if (data.action==='load'){
    ytEnsurePlayerAndLoad(ch, data.videoId, data.time||0);
  } else if (data.action==='play'){
    if (!c.player) ytEnsurePlayerAndLoad(ch, data.videoId, data.time||0);
    else { c.player.seekTo(data.time,true); c.player.playVideo(); }
  } else if (data.action==='pause'){
    if (c.player){ c.player.seekTo(data.time,true); c.player.pauseVideo(); }
  } else if (data.action==='sync'){
    if (!c.player) ytEnsurePlayerAndLoad(ch, data.videoId, data.time||0);
    else { c.player.seekTo(data.time,true); data.state==='playing' ? c.player.playVideo() : c.player.pauseVideo(); }
  } else if (data.action==='seek'){
    if (c.player) c.player.seekTo(data.time,true);
  } else if (data.action==='heartbeat'){
    if (!window.autoSyncOn){ c.suppress=false; return; }
    if (c.player && c.ready){
      const localTime = c.player.getCurrentTime();
      const drift = Math.abs(localTime - data.time);
      const localPlaying = c.player.getPlayerState()===1;
      const remotePlaying = data.state==='playing';
      if (drift > 1.5) c.player.seekTo(data.time, true);
      if (localPlaying !== remotePlaying) remotePlaying ? c.player.playVideo() : c.player.pauseVideo();
    } else { c.suppress=false; return; }
  }
  setTimeout(()=>{ c.suppress=false; }, 900);
}
registerHandler('video', (fromId, data)=> ytApplyRemoteCommand(data.channel, data));

// New joiners get the current state of whichever channels are loaded
if (typeof window !== 'undefined'){
  window.onPeerConnected = (function(prev){
    return function(peerId){
      if (prev) prev(peerId);
      ['video','music'].forEach(ch=>{
        const c = YTChannels[ch];
        if (c.currentId){
          sendData(dataConns[peerId], {type:'video', channel:ch, action:'sync', videoId:c.currentId,
            time: c.player ? c.player.getCurrentTime() : 0,
            state: (c.player && c.player.getPlayerState()===1) ? 'playing':'paused'});
        }
      });
    };
  })(window.onPeerConnected);
}

// Auto-sync heartbeat: whoever is playing quietly broadcasts position every few seconds
setInterval(()=>{
  ['video','music'].forEach(ch=>{
    const c = YTChannels[ch];
    if (!c.player || !c.ready || !c.currentId) return;
    const state = c.player.getPlayerState();
    if (state!==1 && state!==2) return;
    ytBroadcast(ch, {action:'heartbeat', time:c.player.getCurrentTime(), state: state===1?'playing':'paused'});
  });
}, 5000);

// ---------- Public actions used by app.js ----------
const YTSync = {
  load(ch, videoId){ ytEnsurePlayerAndLoad(ch, videoId, 0); ytBroadcast(ch, {action:'load', videoId, time:0}); },
  play(ch){ const c=YTChannels[ch]; c.player && c.player.playVideo(); },
  pause(ch){ const c=YTChannels[ch]; c.player && c.player.pauseVideo(); },
  syncToMe(ch){
    const c=YTChannels[ch]; if (!c.player || !c.currentId) return;
    ytBroadcast(ch, {action:'sync', time:c.player.getCurrentTime(), state:c.player.getPlayerState()===1?'playing':'paused'});
  },
  seek(ch, inputStr){
    const c=YTChannels[ch]; if (!c.player) return false;
    const secs = parseTimeInput(inputStr);
    if (secs===null) return false;
    c.player.seekTo(secs,true);
    ytBroadcast(ch, {action:'seek', time:secs});
    return true;
  }
};
