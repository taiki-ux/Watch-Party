/* ============================================================
   MUSIC-PLAYER.JS
   Music-pane specific UI: vinyl spin / waveform bars driven by
   the 'music' YouTube-sync channel, a Spotify-link nudge (full
   Spotify playback needs OAuth + Premium + a backend — flagged
   as a roadmap item, see settings modal), and solo local-file
   playback for whatever's on your own device.
   ============================================================ */

const SONG_SUGGESTIONS = [
  "Blinding Lights — The Weeknd",
  "As It Was — Harry Styles",
  "Redbone — Childish Gambino",
  "Electric Feel — MGMT",
  "Sunflower — Post Malone & Swae Lee",
  "Levitating — Dua Lipa",
  "Feel Good Inc. — Gorillaz",
  "good 4 u — Olivia Rodrigo",
  "Heat Waves — Glass Animals",
  "Cruel Summer — Taylor Swift"
];
function suggestSong(){ return SONG_SUGGESTIONS[Math.floor(Math.random()*SONG_SUGGESTIONS.length)]; }

window.onChannelLoading = (function(prev){
  return function(ch, videoId){
    if (prev) prev(ch, videoId);
    if (ch !== 'music') return;
    const titleEl = document.getElementById('music-title');
    if (titleEl) titleEl.textContent = 'Loading…';
  };
})(window.onChannelLoading);

window.onChannelStateChange = (function(prev){
  return function(ch, ytState){
    if (prev) prev(ch, ytState);
    if (ch !== 'music') return;
    const playing = ytState === 1; // YT.PlayerState.PLAYING
    const vinyl = document.getElementById('vinyl');
    const bars = document.getElementById('music-bars');
    if (vinyl) vinyl.classList.toggle('spinning', playing);
    if (bars) bars.classList.toggle('playing', playing);
    const titleEl = document.getElementById('music-title');
    if (titleEl && titleEl.textContent === 'Loading…' && YTChannels.music.currentId){
      titleEl.textContent = 'Playing a synced track';
    }
  };
})(window.onChannelStateChange);

function musicLoadFromInput(rawUrl){
  if (isSpotifyLink(rawUrl)){
    return { ok:false, message:"Spotify sync needs sign-in, which isn't built yet — paste a YouTube link for now, or play a file from your device below." };
  }
  const id = extractVideoId(rawUrl);
  if (!id){
    return { ok:false, message:"Couldn't find a track in that link — paste a full YouTube URL, or an 11-character video ID." };
  }
  YTSync.load('music', id);
  return { ok:true };
}

// ---------- Local file playback (solo — not networked) ----------
function musicPlayLocalFile(file){
  const audioEl = document.getElementById('local-audio-player');
  const url = URL.createObjectURL(file);
  audioEl.src = url;
  audioEl.style.display = 'block';
  audioEl.play().catch(()=>{});
  const titleEl = document.getElementById('music-title');
  if (titleEl) titleEl.textContent = file.name + ' (just for you)';
  const vinyl = document.getElementById('vinyl');
  const bars = document.getElementById('music-bars');
  audioEl.onplay = ()=>{ vinyl && vinyl.classList.add('spinning'); bars && bars.classList.add('playing'); };
  audioEl.onpause = ()=>{ vinyl && vinyl.classList.remove('spinning'); bars && bars.classList.remove('playing'); };
}
