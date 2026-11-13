import * as THREE from 'three';
import type { BodyModel } from './model';
import type { Layer } from './types';
import { rng } from './math';

const TW = 2048, TH = 1024;

/**
 * Texture space: u = s (snout→tail), v = φ / 2π.
 * Patterns are authored in (s, h) with h = φ/π: 0 dorsal midline, 0.5 lateral
 * midline, 1 ventral midline – and mirrored onto both flanks.
 */
export function paintSkin(model: BodyModel, seed: number) {
  const sp = model.sp;
  const c = sp.color;
  const cv = document.createElement('canvas');
  cv.width = TW; cv.height = TH;
  const g = cv.getContext('2d')!;
  const R = rng(seed);

  // base countershading
  const [a, b] = c.cs ?? [0.3, 0.68];
  const grad = g.createLinearGradient(0, 0, 0, TH / 2);
  grad.addColorStop(0, c.top);
  grad.addColorStop(Math.max(0.01, a * 0.7), c.top);
  grad.addColorStop(Math.min(0.98, (a + b) / 2), c.side);
  grad.addColorStop(Math.min(0.99, b * 1.05), c.belly);
  grad.addColorStop(1, c.belly);
  g.fillStyle = grad;
  g.fillRect(0, 0, TW, TH / 2);
  g.save();
  g.translate(0, TH);
  g.scale(1, -1);
  g.fillRect(0, 0, TW, TH / 2);
  g.restore();

  /** run fn twice, in unit (s,h) space for right and left flank */
  const both = (fn: () => void) => {
    g.save(); g.setTransform(TW, 0, 0, TH / 2, 0, 0); fn(); g.restore();
    g.save(); g.setTransform(TW, 0, 0, -TH / 2, 0, TH); fn(); g.restore();
  };
  /** isotropic ellipse: radius r in SL units at (s,h) */
  const dot = (s: number, h: number, r: number) => {
    const rh = r / model.halfPerim(Math.min(0.999, Math.max(0.001, s)));
    g.beginPath();
    g.ellipse(s, h, r, Math.min(rh, 0.5), 0, 0, Math.PI * 2);
  };
  const hp = (s: number) => model.halfPerim(Math.min(0.999, Math.max(0.002, s)));

  for (const L of (c.layers ?? []) as Layer[]) {
    switch (L.k) {
      case 'grad': {
        both(() => {
          const soft = L.soft ?? 0.04;
          g.globalAlpha = L.a ?? 1;
          const steps = 24;
          for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const al = Math.min(1, Math.min(t, 1 - t) / Math.max(1e-3, soft / Math.max(1e-3, L.s1 - L.s0)) * 1.0);
            g.globalAlpha = (L.a ?? 1) * Math.min(1, al + 0.15);
            const s0 = L.s0 + (L.s1 - L.s0) * t;
            const hg = g.createLinearGradient(0, L.h0 - soft, 0, L.h1 + soft);
            const col = new THREE.Color(L.c);
            const rgba = (al2: number) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${al2})`;
            const span = L.h1 - L.h0 + 2 * soft;
            hg.addColorStop(0, rgba(0));
            hg.addColorStop(Math.min(0.49, soft / span), rgba(1));
            hg.addColorStop(Math.max(0.51, 1 - soft / span), rgba(1));
            hg.addColorStop(1, rgba(0));
            g.fillStyle = hg;
            g.fillRect(s0, L.h0 - soft, (L.s1 - L.s0) / steps + 0.0008, span);
          }
          g.globalAlpha = 1;
        });
        break;
      }
      case 'bars': {
        both(() => {
          const h0 = L.h0 ?? 0, h1 = L.h1 ?? 1;
          for (const at of L.at) {
            const draw = (w: number, col: string) => {
              g.fillStyle = col;
              g.beginPath();
              const N = 30;
              for (let i = 0; i <= N; i++) {
                const h = h0 + (h1 - h0) * (i / N);
                const off = (L.wob ?? 0) * Math.sin(h * 9 + at * 40) + (L.slant ?? 0) * (h - 0.5);
                const ww = w * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, (h - h0) / (h1 - h0) * 1.0 + 0.0001)) ** 0.3);
                g.lineTo(at + off - ww / 2, h);
              }
              for (let i = N; i >= 0; i--) {
                const h = h0 + (h1 - h0) * (i / N);
                const off = (L.wob ?? 0) * Math.sin(h * 9 + at * 40) + (L.slant ?? 0) * (h - 0.5);
                const ww = w * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, (h - h0) / (h1 - h0) + 0.0001)) ** 0.3);
                g.lineTo(at + off + ww / 2, h);
              }
              g.closePath();
              g.fill();
            };
            if (L.edge) draw(L.w + (L.ew ?? 0.012) * 2, L.edge);
            draw(L.w, L.c);
          }
        });
        break;
      }
      case 'stripe': {
        both(() => {
          const s0 = L.s0 ?? 0, s1 = L.s1 ?? 1;
          g.fillStyle = L.c;
          if (L.glow) { g.shadowColor = L.c; g.shadowBlur = 6; }
          g.beginPath();
          const N = 80;
          for (let i = 0; i <= N; i++) {
            const s = s0 + (s1 - s0) * (i / N);
            const tp = 1 - (L.taper ?? 0) * (i / N);
            const w = (L.w * tp) / hp(s) * 0.5;
            g.lineTo(s, L.h + (L.wob ?? 0) * Math.sin(s * 30) - w / 2);
          }
          for (let i = N; i >= 0; i--) {
            const s = s0 + (s1 - s0) * (i / N);
            const tp = 1 - (L.taper ?? 0) * (i / N);
            const w = (L.w * tp) / hp(s) * 0.5;
            g.lineTo(s, L.h + (L.wob ?? 0) * Math.sin(s * 30) + w / 2);
          }
          g.fill();
          g.shadowBlur = 0;
        });
        break;
      }
      case 'spots':
      case 'blotch': {
        const r2 = rng(seed + (L.seed ?? 0) + L.n);
        const pts: [number, number, number][] = [];
        for (let i = 0; i < L.n; i++) {
          const s = (L.s0 ?? 0.02) + r2() * ((L.s1 ?? 0.99) - (L.s0 ?? 0.02));
          const h = (L.h0 ?? 0) + r2() * ((L.h1 ?? 1) - (L.h0 ?? 0));
          const rv = L.k === 'spots' ? (L.rv ?? 0.4) : 0.6;
          pts.push([s, h, L.r * (1 - rv / 2 + r2() * rv)]);
        }
        both(() => {
          for (const [s, h, r] of pts) {
            if (L.k === 'blotch') {
              g.fillStyle = L.c;
              const rr = rng(Math.floor(s * 1e5 + h * 1e3));
              for (let j = 0; j < 7; j++) {
                dot(s + (rr() - 0.5) * r * 1.4, h + (rr() - 0.5) * (r / hp(s)) * 1.4, r * (0.45 + rr() * 0.5));
                g.fill();
              }
            } else {
              if (L.k === 'spots' && L.ring) { g.fillStyle = L.ring; dot(s, h, r * 1.45); g.fill(); }
              g.fillStyle = L.c;
              dot(s, h, r); g.fill();
            }
          }
        });
        break;
      }
      case 'waves': {
        both(() => {
          g.strokeStyle = L.c;
          const h0 = L.h0 ?? 0.02, h1 = L.h1 ?? 0.98;
          for (let i = 0; i < L.n; i++) {
            const hb = h0 + (h1 - h0) * ((i + 0.5) / L.n);
            g.beginPath();
            const s0 = L.s0 ?? 0, s1 = L.s1 ?? 1;
            for (let k = 0; k <= 120; k++) {
              const s = s0 + (s1 - s0) * (k / 120);
              const h = hb + L.amp * Math.sin(s * L.freq + i * 1.7) / hp(s) * 0.1 + (L.slant ?? 0) * (s - 0.5);
              g.lineWidth = L.w / hp(s) * 0.5;
              if (k === 0) g.moveTo(s, h); else g.lineTo(s, h);
            }
            g.stroke();
          }
        });
        break;
      }
      case 'gills': {
        both(() => {
          g.strokeStyle = L.c;
          for (const at of L.at) {
            g.lineWidth = 0.0025;
            g.beginPath();
            g.moveTo(at, L.h0 ?? 0.38);
            g.quadraticCurveTo(at - 0.006, ((L.h0 ?? 0.38) + (L.h1 ?? 0.72)) / 2, at + 0.002, L.h1 ?? 0.72);
            g.stroke();
          }
        });
        break;
      }
      case 'lateral': {
        both(() => {
          g.strokeStyle = L.c;
          g.lineWidth = (L.w ?? 0.006) / 1.2;
          g.beginPath();
          for (let k = 0; k <= 100; k++) {
            const s = sp.HL * 0.9 + (1 - sp.HL * 0.9) * (k / 100);
            const h = (L.h ?? 0.32) + 0.12 * Math.pow(k / 100, 1.3);
            if (k === 0) g.moveTo(s, h); else g.lineTo(s, h);
          }
          g.stroke();
        });
        break;
      }
      case 'photo': {
        both(() => {
          g.fillStyle = L.c;
          g.shadowColor = L.c; g.shadowBlur = 8;
          for (let i = 0; i < L.n; i++) {
            const s = (L.s0 ?? 0.15) + ((L.s1 ?? 0.9) - (L.s0 ?? 0.15)) * (i / Math.max(1, L.n - 1));
            dot(s, L.h, L.r ?? 0.006); g.fill();
          }
          g.shadowBlur = 0;
        });
        break;
      }
      case 'scaleEdge':
        break;
    }
  }

  // operculum (gill cover) edge for bony fishes
  if (sp.skin.kind !== 'placoid' && sp.plan !== 'ray' && sp.HL > 0.05 && sp.mouth.kind !== 'disc') {
    both(() => {
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 0.003;
      g.beginPath();
      for (let k = 0; k <= 40; k++) {
        const h = 0.18 + 0.7 * (k / 40);
        const s = sp.HL - 0.025 * Math.cos((h - 0.5) * 3.2) * (1 - Math.abs(h - 0.55));
        if (k === 0) g.moveTo(s, h); else g.lineTo(s, h);
      }
      g.stroke();
    });
  }

  // fine noise / mottling for realism
  const img = g.getImageData(0, 0, TW, TH);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * 10;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // scale-edge tinting
  const se = c.layers?.find((l) => l.k === 'scaleEdge') as Extract<Layer, { k: 'scaleEdge' }> | undefined;
  if (se && sp.skin.scales > 0) drawScales(g, model, sp.skin.scales, se.c, se.a ?? 0.35, false);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  return { tex, canvas: cv };
}

function drawScales(g: CanvasRenderingContext2D, model: BodyModel, n: number, col: string, alpha: number, bump: boolean, cw = TW, ch = TH) {
  const avgHP = [0.15, 0.3, 0.5, 0.7, 0.85].reduce((a, s) => a + model.halfPerim(s), 0) / 5;
  const rows = Math.max(6, Math.round(n * avgHP));
  const dx = 1 / n, dh = 1 / rows;
  const both = (fn: () => void) => {
    g.save(); g.setTransform(cw, 0, 0, ch / 2, 0, 0); fn(); g.restore();
    g.save(); g.setTransform(cw, 0, 0, -ch / 2, 0, ch); fn(); g.restore();
  };
  both(() => {
    for (let i = Math.floor(n * model.sp.HL * 0.95); i < n; i++) {
      for (let j = 0; j < rows; j++) {
        const s = (i + (j % 2) * 0.5) * dx;
        const h = (j + 0.5) * dh;
        if (bump) {
          const gr = g.createRadialGradient(s - dx * 0.25, h, 0, s - dx * 0.25, h, dx * 0.95);
          gr.addColorStop(0, 'rgba(255,255,255,0.9)');
          gr.addColorStop(0.75, 'rgba(160,160,160,0.6)');
          gr.addColorStop(1, 'rgba(60,60,60,0.0)');
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(s, h, dx * 0.85, dh * 0.95, 0, -Math.PI / 2, Math.PI / 2);
          g.fill();
        } else {
          g.strokeStyle = col;
          g.globalAlpha = alpha;
          g.lineWidth = Math.max(0.0006, dx * 0.12);
          g.beginPath();
          g.ellipse(s, h, dx * 0.7, dh * 0.62, 0, -Math.PI / 2, Math.PI / 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }
  });
}

/** grayscale height map: scales / dermal denticles / warts + opercle groove */
export function paintBump(model: BodyModel, seed: number) {
  const sp = model.sp;
  const cv = document.createElement('canvas');
  cv.width = TW / 2; cv.height = TH / 2;
  const g = cv.getContext('2d')!;
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, cv.width, cv.height);
  const R = rng(seed ^ 0x9e3779b9);
  const W = cv.width, H = cv.height;
  const k = sp.skin.kind;
  if ((k === 'cycloid' || k === 'ctenoid' || k === 'ganoid') && sp.skin.scales > 0) {
    drawScales(g, model, sp.skin.scales, '#fff', 1, true, W, H);
  } else if (k === 'warty' || k === 'bony') {
    for (let i = 0; i < (k === 'warty' ? 2600 : 1400); i++) {
      const x = R() * W, y = R() * H, r = 1 + R() * (k === 'warty' ? 6 : 3);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)');
      gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  } else {
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 128 + (R() - 0.5) * (k === 'placoid' ? 40 : 14);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    }
    g.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
