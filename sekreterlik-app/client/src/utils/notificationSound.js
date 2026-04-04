// Notification sound — maliisler referansli basit Audio yaklaşımı
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

export const playNotificationSound = async () => {
  if (isNotificationMuted()) return;

  try {
    // Yontem 1: Ses dosyasi ile (en guvenilir)
    const audio = new Audio('/sounds/notification.wav');
    audio.volume = 0.7;
    await audio.play();
  } catch (e) {
    // Yontem 2: Web Audio API fallback (ses dosyasi yoksa)
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e2) {
      // Ses desteklenmiyor
    }
  }
};
