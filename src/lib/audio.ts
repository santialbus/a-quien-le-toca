let audio: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  audio ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}
export function tick() {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "square"; o.frequency.value = 720 + Math.random() * 260;
  g.gain.setValueAtTime(.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(.045, c.currentTime + .006);
  g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .045);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + .05);
}
export function fanfare() {
  const c = ctx(); if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * .13;
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.12, t + .025);
    g.gain.exponentialRampToValueAtTime(.0001, t + .32);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .34);
  });
}
export function buzz(pattern: number | number[] = 35) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}