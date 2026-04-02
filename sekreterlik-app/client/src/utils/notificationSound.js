// Notification sound using Web Audio API (no external sound file needed)
let audioContext = null;

const MUTE_KEY = 'notification_sound_muted';

export const isNotificationMuted = () => {
  return localStorage.getItem(MUTE_KEY) === 'true';
};

export const setNotificationMuted = (muted) => {
  localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
};

export const toggleNotificationMute = () => {
  const current = isNotificationMuted();
  setNotificationMuted(!current);
  return !current;
};

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

export const playNotificationSound = async () => {
  if (isNotificationMuted()) return;

  try {
    const ctx = getAudioContext();

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Audio not supported or blocked
  }
};
