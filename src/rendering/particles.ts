import { Container, Sprite } from 'pixi.js';
import { Rng } from '@/core/rng';
import { particleTexture } from './textures';

export type ParticleKind = 'silt' | 'dust' | 'drip' | 'ember';

interface Particle {
  sprite: Sprite;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Pooled particle field.
 *
 * Particles are authored in world space on the gameplay plane and recycled
 * from a fixed pool, so the field never allocates during play and the count is
 * hard-capped for mobile.
 */
export class ParticleField {
  readonly container = new Container();
  private readonly pool: Particle[] = [];
  private readonly rng = new Rng(0xa17c);
  private spawnAccum = new Map<ParticleKind, number>();
  private bounds = { x: 0, y: 0, w: 1920, h: 1080 };
  private rates = new Map<ParticleKind, number>();
  private capacity: number;

  constructor(capacity = 160) {
    this.capacity = capacity;
    const tex = particleTexture(32);
    for (let i = 0; i < capacity; i++) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.blendMode = 'add';
      this.container.addChild(sprite);
      this.pool.push({
        sprite,
        kind: 'silt',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
      });
    }
  }

  setCapacity(max: number): void {
    this.capacity = Math.max(0, Math.min(this.pool.length, max));
    for (let i = this.capacity; i < this.pool.length; i++) {
      this.pool[i].life = 0;
      this.pool[i].sprite.visible = false;
    }
  }

  configure(
    bounds: { x: number; y: number; w: number; h: number },
    rates: Partial<Record<ParticleKind, number>>,
  ): void {
    this.bounds = bounds;
    this.rates.clear();
    for (const [kind, rate] of Object.entries(rates)) {
      if (rate && rate > 0) this.rates.set(kind as ParticleKind, rate);
    }
  }

  private spawn(kind: ParticleKind, viewX: number, viewW: number): void {
    const p = this.pool.find((q, i) => q.life <= 0 && i < this.capacity);
    if (!p) return;
    const rng = this.rng;
    // Spawn across the visible span plus a margin, not the whole scene.
    const x = viewX - viewW * 0.1 + rng.next() * viewW * 1.2;
    p.kind = kind;
    p.x = x;

    if (kind === 'silt') {
      p.y = this.bounds.y + rng.next() * this.bounds.h;
      p.vx = rng.signed() * 7;
      p.vy = rng.range(-5, 5);
      p.maxLife = rng.range(5, 11);
      p.size = rng.range(1.2, 3.4);
      p.sprite.tint = 0xa8c0cc;
    } else if (kind === 'dust') {
      p.y = this.bounds.y + rng.next() * this.bounds.h;
      p.vx = rng.range(-22, 22);
      p.vy = rng.range(-14, 4);
      p.maxLife = rng.range(2.5, 6);
      p.size = rng.range(0.9, 2.4);
      p.sprite.tint = 0xd8c9ae;
    } else if (kind === 'drip') {
      p.y = this.bounds.y + rng.next() * this.bounds.h * 0.35;
      p.vx = 0;
      p.vy = rng.range(170, 320);
      p.maxLife = rng.range(1.2, 2.6);
      p.size = rng.range(1.3, 2.6);
      p.sprite.tint = 0xbcd6e2;
    } else {
      p.y = this.bounds.y + this.bounds.h * rng.range(0.5, 1);
      p.vx = rng.signed() * 10;
      p.vy = rng.range(-46, -16);
      p.maxLife = rng.range(1.4, 3.2);
      p.size = rng.range(1, 2.6);
      p.sprite.tint = 0xffb066;
    }
    p.life = p.maxLife;
    p.sprite.visible = true;
  }

  update(dt: number, viewX: number, viewW: number): void {
    for (const [kind, rate] of this.rates) {
      const accum = (this.spawnAccum.get(kind) ?? 0) + rate * dt;
      let n = Math.floor(accum);
      this.spawnAccum.set(kind, accum - n);
      while (n-- > 0) this.spawn(kind, viewX, viewW);
    }

    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'silt') {
        // Silt hangs in the air like it is still underwater.
        p.vx += Math.sin(p.y * 0.05 + p.life) * 4 * dt;
        p.vy += Math.cos(p.x * 0.04 - p.life) * 3 * dt;
      } else if (p.kind === 'ember') {
        p.vy *= 1 - 0.3 * dt;
        p.vx += Math.sin(p.life * 3) * 12 * dt;
      } else if (p.kind === 'drip') {
        p.vy += 420 * dt;
      }

      const t = p.life / p.maxLife;
      // Fade in and out so nothing pops.
      const fade = Math.min(1, t * 4) * Math.min(1, (1 - t) * 6 + 0.15);
      p.sprite.x = p.x;
      p.sprite.y = p.y;
      p.sprite.alpha = fade * (p.kind === 'silt' ? 0.4 : 0.55);
      p.sprite.width = p.size * 4;
      p.sprite.height = p.size * 4;
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.life > 0) n++;
    return n;
  }

  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.sprite.visible = false;
    }
    this.spawnAccum.clear();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
