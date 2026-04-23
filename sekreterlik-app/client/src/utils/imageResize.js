/**
 * Client-side image resize helper.
 * Canvas ile görsel küçültülür, kalite düşürülür ve File objesi döner.
 *
 * Kullanım:
 *   const small = await resizeImageFile(file, { maxBytes: 2 * 1024 * 1024 });
 *   // küçültme gerekmiyorsa orijinal file döner.
 */

const DEFAULT_MAX_DIM = 1920;        // uzun kenar maksimum px
const DEFAULT_QUALITY = 0.82;        // JPEG kalite
const MIN_QUALITY = 0.5;

const fileToImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = (e) => {
    URL.revokeObjectURL(url);
    reject(e);
  };
  img.src = url;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    },
    type,
    quality
  );
});

const drawScaled = (img, maxDim) => {
  const { width, height } = img;
  const longest = Math.max(width, height);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas;
};

/**
 * @param {File} file
 * @param {{
 *   maxBytes?: number,
 *   maxDim?: number,
 *   mimeType?: string,
 * }} options
 * @returns {Promise<File>}
 */
export async function resizeImageFile(file, options = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;

  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const maxDim = options.maxDim ?? DEFAULT_MAX_DIM;
  // PNG'de quality çoğu tarayıcıda yoksayılır; JPEG'e çeviriyoruz şeffaflık kaybı kabul
  const outType = options.mimeType ?? (file.type === 'image/png' ? 'image/jpeg' : file.type);

  // Sınır altındaysa ve boyut tamamsa dokunma
  if (file.size <= maxBytes && outType === file.type) {
    return file;
  }

  try {
    const img = await fileToImage(file);
    let canvas = drawScaled(img, maxDim);
    let quality = DEFAULT_QUALITY;
    let blob = await canvasToBlob(canvas, outType, quality);

    // Hala büyükse kaliteyi düşürerek dene
    while (blob.size > maxBytes && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.12);
      blob = await canvasToBlob(canvas, outType, quality);
    }

    // Hala büyükse boyutu küçült
    let currentMaxDim = maxDim;
    while (blob.size > maxBytes && currentMaxDim > 640) {
      currentMaxDim = Math.round(currentMaxDim * 0.8);
      canvas = drawScaled(img, currentMaxDim);
      blob = await canvasToBlob(canvas, outType, quality);
    }

    const ext = outType === 'image/jpeg' ? 'jpg' : outType.split('/')[1] || 'jpg';
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    const resized = new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
    return resized;
  } catch (err) {
    console.warn('resizeImageFile failed, returning original:', err);
    return file;
  }
}

export default resizeImageFile;
