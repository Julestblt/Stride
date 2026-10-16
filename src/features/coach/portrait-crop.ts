export type PortraitCrop = { scale: number; originY: number } | null;

export function portraitCrop(size: number): PortraitCrop {
  if (size <= 64) return { scale: 1.8, originY: 0.073 };
  if (size <= 120) return { scale: 1.3, originY: 0 };
  return null;
}

export function portraitSourceSize(size: number) {
  return Math.ceil(size * (portraitCrop(size)?.scale ?? 1));
}

export function portraitFrame(size: number) {
  const crop = portraitCrop(size);
  if (!crop) return null;
  const side = size * crop.scale;
  return {
    width: side,
    height: side,
    left: (size - side) / 2,
    top: (size - side) * crop.originY,
  };
}
