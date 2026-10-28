import { challengeLayout as layout, dark, onboardingType } from '@calipartner/ui';
interface BrowserCanvas {
  width: number;
  height: number;
  getContext(type: string): {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    strokeRect(x: number, y: number, w: number, h: number): void;
    font: string;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
  } | null;
  toBlob(callback: (blob: Blob | null) => void, type: string): void;
}
interface BrowserDocument {
  fonts: { ready: Promise<unknown> };
  body: { appendChild(node: unknown): void };
  createElement(tag: 'canvas'): BrowserCanvas;
  createElement(tag: 'a'): { href: string; download: string; click(): void; remove(): void };
}
const browser = globalThis as unknown as {
  document: BrowserDocument;
  navigator: {
    canShare?: (data: { files: File[] }) => boolean;
    share: (data: { files: File[]; title: string }) => Promise<void>;
  };
};
const { document, navigator } = browser;

/** No partner identity, weight, calories or hidden data is included in exported cards. */
export async function shareChallengeImage(
  title: string,
  score: string,
  summary: string,
  id: string,
  chapter?: string,
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = layout.shareWidth;
  canvas.height = layout.shareHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('IMAGE_UNAVAILABLE');
  await document.fonts.ready;
  ctx.fillStyle = dark.bg0;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (chapter) {
    ctx.strokeStyle = dark.iris;
    ctx.lineWidth = layout.shareFrameStroke;
    ctx.strokeRect(
      layout.shareFrameInset,
      layout.shareFrameInset,
      layout.shareWidth - layout.shareFrameInset * 2,
      layout.shareHeight - layout.shareFrameInset * 2,
    );
    ctx.fillStyle = dark.iris;
    ctx.font = `${layout.shareBodySize}px ${onboardingType.body.fontFamily}`;
    ctx.fillText(chapter, layout.shareInset, layout.shareChapterY);
  }
  ctx.fillStyle = dark.textHi;
  ctx.font = `${layout.shareTitleSize}px ${onboardingType.title1.fontFamily}`;
  ctx.fillText(
    title,
    layout.shareInset,
    layout.shareTitleY,
    layout.shareWidth - layout.shareInset * 2,
  );
  ctx.fillStyle = dark.iris;
  ctx.font = `${layout.shareScoreSize}px ${onboardingType.numeralL.fontFamily}`;
  ctx.fillText(score, layout.shareInset, layout.shareScoreY);
  ctx.fillStyle = dark.textMid;
  ctx.font = `${layout.shareBodySize}px ${onboardingType.body.fontFamily}`;
  ctx.fillText(
    summary,
    layout.shareInset,
    layout.shareSummaryY,
    layout.shareWidth - layout.shareInset * 2,
  );
  ctx.fillStyle = dark.apricot;
  ctx.fillText('CaliPartner', layout.shareInset, layout.shareBrandY);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('IMAGE_UNAVAILABLE'))),
      'image/png',
    ),
  );
  const file = new File([blob], `calipartner-${id}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
  else {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), layout.shareReleaseDelayMs);
    }
  }
}
