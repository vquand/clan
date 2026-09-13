export const AVATAR_IMAGE_DIMENSION = 64;
export const AVATAR_IMAGE_MAX_DATA_URL_LENGTH = 24_000;
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('This image could not be read.'));
    };
    image.src = source;
  });
}

export async function compressAvatarImage(file: File) {
  if (!file.type.match(/^image\/(?:jpeg|png|webp)$/i)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error('Choose an image smaller than 8 MB.');
  }

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_IMAGE_DIMENSION;
  canvas.height = AVATAR_IMAGE_DIMENSION;
  const context = canvas.getContext('2d');
  if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error('This image could not be prepared.');
  }

  context.fillStyle = '#f4eee5';
  context.fillRect(0, 0, AVATAR_IMAGE_DIMENSION, AVATAR_IMAGE_DIMENSION);
  const scale = Math.max(
    AVATAR_IMAGE_DIMENSION / image.naturalWidth,
    AVATAR_IMAGE_DIMENSION / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(
    image,
    (AVATAR_IMAGE_DIMENSION - width) / 2,
    (AVATAR_IMAGE_DIMENSION - height) / 2,
    width,
    height,
  );

  for (const [format, qualities] of [
    ['image/webp', [0.78, 0.64, 0.5]],
    ['image/jpeg', [0.78, 0.64, 0.5, 0.38]],
  ] as const) {
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL(format, quality);
      if (dataUrl.length <= AVATAR_IMAGE_MAX_DATA_URL_LENGTH) return dataUrl;
    }
  }

  throw new Error('This image is still too large after compression.');
}
