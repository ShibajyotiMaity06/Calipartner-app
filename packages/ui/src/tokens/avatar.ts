export const avatarLayout = {
  canvasWidth: 1536,
  canvasHeight: 2752,
  heroHeight: 240,
  editorHeight: 360,
  compareHeight: 200,
  thumbnailHeight: 112,
  swatchSize: 48,
  cardMinWidth: 104,
  editorCardMinWidth: 88,
  tapSize: 48,
  borderWidth: 1,
  selectedBorderWidth: 3,
  opacityPressed: 0.7,
  aspectRatio: 1536 / 2752,
  panelFraction: 0.58,
  panelHandleHeight: 48,
  dragThreshold: 6,
  swatchInset: 4,
  beanieFemale: { scale: 0.6, x: 320, y: -140 },
} as const;

export const avatarPresentation = { modalScrim: 'rgba(0, 0, 0, 0.45)' } as const;
