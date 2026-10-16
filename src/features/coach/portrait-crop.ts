export type PortraitCrop = { scale: number; originY: string } | null;

export function portraitCrop(size: number): PortraitCrop {
  if (size <= 64) return { scale: 1.8, originY: "7.3%" };
  if (size <= 120) return { scale: 1.3, originY: "0%" };
  return null;
}
