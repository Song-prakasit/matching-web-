// Short beeps for scan results, so a pharmacist scanning a stack of bags does not have to watch the screen.
let ctx;

function beep(freq, start, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

export function playScanSound(ok) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (ok) beep(880, 0, 0.12);
    else {
      beep(220, 0, 0.18);
      beep(220, 0.24, 0.18);
    }
  } catch {
    /* audio unavailable: the vibration and the on-screen result still show */
  }
}
