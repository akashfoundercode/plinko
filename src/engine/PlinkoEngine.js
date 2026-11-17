import Matter from 'matter-js';
import { BOARD, ROW_COLORS, TIERS } from '../config/gameConfig';
import moonImgSrc from '../assets/images/Detailed full Moon Cutout.png';

const moonImg = new Image();
moonImg.src = moonImgSrc;

const { Engine, Bodies, Body, Composite, Events } = Matter;
const rand = (a, b) => a + Math.random() * (b - a);
const STEP_MS = 1000 / 120; // fixed physics step (120 Hz) for stable collisions

/**
 * Framework-free Plinko engine: Matter.js physics + Canvas 2D rendering.
 * React talks to it through the callbacks passed to the constructor:
 *   getDerived()  -> current derived game values (special pegs, per-hit bonuses)
 *   getSettings() -> { particles, trail }
 *   onPegHit({ x, y, kind, hits })
 *   onSettle({ slot, value, flat, free, x })
 */
export class PlinkoEngine {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;
    this.engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.00062 } });
    this.balls = new Set();
    this.pegs = [];
    this.particles = [];
    this.paused = false;
    this.running = false;
    this.time = 0;
    this.acc = 0;
    this.last = 0;
    this.scale = 1;
    this.meteors = [];
    this.nextMeteorTime = 1.0;
    this.cachedMoon = null;

    // Generate twinkling & blinking stars on the outer sides (open cosmic sky)
    const stars = [];
    const centerX = BOARD.W / 2;
    let attempts = 0;
    while (stars.length < 110 && attempts < 1400) {
      attempts++;
      const x = Math.random() * BOARD.W;
      const y = Math.random() * (BOARD.slotTop - 15);

      // Check if point is inside the peg pyramid or spawn path
      let insideBallZone = false;
      if (y >= 45 && y <= BOARD.slotTop) {
        const progress = (y - 45) / (BOARD.slotTop - 45);
        const halfWidth = 32 + progress * 155;
        if (Math.abs(x - centerX) < halfWidth + 14) {
          insideBallZone = true;
        }
      } else if (y < 45 && Math.abs(x - centerX) < 38) {
        insideBallZone = true;
      }

      // Keep stars away from the moon zone (no stars over the moon)
      const distToMoon = Math.hypot(x - (BOARD.W - 58), y - 48);
      if (distToMoon < 40) {
        continue;
      }

      if (!insideBallZone) {
        const color = Math.random() < 0.22 ? '#FEF08A' : Math.random() < 0.2 ? '#BAE6FD' : '#FFFFFF';
        stars.push({
          x,
          y,
          r: rand(0.5, 1.8),
          phase: rand(0, 6.28),
          speed: rand(1.4, 3.4), // brisk natural twinkling & blinking
          baseAlpha: rand(0.12, 0.4),
          color,
        });
      }
    }
    this.stars = stars;

    this.build();
    this.onCollide = (e) => this.handleCollisions(e);
    Events.on(this.engine, 'collisionStart', this.onCollide);
    this.tick = this.tick.bind(this);
    this.resize();
  }

  // ----- world ------------------------------------------------------------
  build() {
    const { W, H, rows, spacingX, spacingY, startY, pegR, slotCount, slotTop, outGutterW = 36 } = BOARD;
    const world = this.engine.world;
    const statics = [];

    for (let r = 0; r < rows; r++) {
      const n = r + 2;
      const y = startY + r * spacingY;
      for (let j = 0; j < n; j++) {
        const x = W / 2 + (j - (n - 1) / 2) * spacingX;
        const body = Bodies.circle(x, y, pegR, {
          isStatic: true,
          restitution: 0.65,
          friction: 0.002,
          label: 'peg',
        });
        body.plugin = { id: `${r}-${j}`, color: ROW_COLORS[r % ROW_COLORS.length], flash: 0 };
        this.pegs.push(body);
        statics.push(body);
      }
    }

    // Side walls keep balls inside the board.
    statics.push(
      Bodies.rectangle(-10, H / 2, 20, H * 2, { isStatic: true, restitution: 0.7, label: 'wall' }),
      Bodies.rectangle(W + 10, H / 2, 20, H * 2, { isStatic: true, restitution: 0.7, label: 'wall' })
    );

    // Slot dividers: 9 slots with Left and Right OUT gutters
    const slotAreaW = W - outGutterW * 2;
    const slotW = slotAreaW / slotCount;

    // Dividers separating OUT gutters from the 9 slots
    statics.push(
      Bodies.rectangle(outGutterW, slotTop + (H - slotTop) / 2, 4, H - slotTop, { isStatic: true, restitution: 0.5, label: 'divider' }),
      Bodies.circle(outGutterW, slotTop, 3.5, { isStatic: true, restitution: 0.6, label: 'divider' }),
      Bodies.rectangle(W - outGutterW, slotTop + (H - slotTop) / 2, 4, H - slotTop, { isStatic: true, restitution: 0.5, label: 'divider' }),
      Bodies.circle(W - outGutterW, slotTop, 3.5, { isStatic: true, restitution: 0.6, label: 'divider' })
    );

    // Inner dividers between the 9 slots
    for (let k = 1; k < slotCount; k++) {
      const x = outGutterW + k * slotW;
      statics.push(
        Bodies.rectangle(x, slotTop + (H - slotTop) / 2, 4, H - slotTop, { isStatic: true, restitution: 0.5, label: 'divider' }),
        Bodies.circle(x, slotTop, 3.5, { isStatic: true, restitution: 0.6, label: 'divider' })
      );
    }
    Composite.add(world, statics);
  }

  // ----- public API -------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    Events.off(this.engine, 'collisionStart', this.onCollide);
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }

  setPaused(p) {
    this.paused = p;
  }

  activeCount() {
    return this.balls.size;
  }

  drop({ value, free = false, tier = 0, bet = 0, betId = null, targetSlot, targetMult, isOut = false }) {
    const { ballR, spawnX, spawnY } = BOARD;
    // Drops cleanly inside the starting 2 pegs
    const spawnOffsetX = rand(-2, 2);
    const ball = Bodies.circle(spawnX + spawnOffsetX, spawnY, ballR, {
      restitution: 0.52,
      friction: 0.001,
      frictionAir: 0.0035,
      density: 0.002,
      label: 'ball',
      collisionFilter: { group: -1 }, // balls never collide with each other
    });
    ball.plugin = {
      value,
      flat: 0,
      hits: 0,
      free,
      tier,
      bet,
      betId,
      hitSpecials: new Set(),
      trail: [],
      born: performance.now(),
      stuck: 0,
    };
    Body.setVelocity(ball, { x: rand(-0.25, 0.25), y: 0.4 });
    Composite.add(this.engine.world, ball);
    this.balls.add(ball);

    // Pre-determine target trajectory from the very drop!
    if (targetSlot !== undefined || targetMult !== undefined || isOut) {
      this.setBallTarget(ball, { orderid: betId, targetSlot, targetMult, isOut });
    }

    return ball;
  }

  setBallTarget(ball, { orderid, targetSlot, targetMult, isOut = false }) {
    if (!ball || !ball.plugin) return;
    const { W, outGutterW = 36, slotCount = 9 } = BOARD;
    const slotAreaW = W - outGutterW * 2;
    const slotW = slotAreaW / slotCount;

    const outFlag = Boolean(isOut || targetSlot === -1 || targetSlot === '-1');
    ball.plugin.isOut = outFlag;
    ball.plugin.orderid = orderid;
    ball.plugin.targetMult = targetMult;

    if (outFlag) {
      // Pick left or right gutter (random 50/50 or whichever side spawn leaned)
      const isLeft = (ball.position?.x !== undefined ? ball.position.x : Math.random() * W) <= W / 2;
      ball.plugin.outSide = isLeft ? 'left' : 'right';
      ball.plugin.targetX = isLeft ? outGutterW * 0.5 : W - outGutterW * 0.5;
    } else {
      let s = targetSlot;
      if (s === undefined || s === null || s === '' || Number(s) < 0) {
        if (targetMult !== undefined) {
          const mults = this.cb.getDerived()?.slotMults || [2, 1.5, 1.2, 1.2, 1, 1.2, 1.2, 1.5, 2];
          s = mults.findIndex((m) => Math.abs(m - Number(targetMult)) < 0.05);
          if (s < 0) s = 4;
        } else {
          s = 4;
        }
      }
      s = Math.max(0, Math.min(slotCount - 1, Number(s)));
      const targetX = outGutterW + (s + 0.5) * slotW;
      ball.plugin.targetSlot = s;
      ball.plugin.targetX = targetX;
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width || BOARD.W;
    const cssH = rect.height || (cssW * BOARD.H) / BOARD.W;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // Cap mobile DPR at 1.5 to maintain retina clarity while preventing GPU fillrate lag
    const dpr = isMobile ? Math.min(1.5, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (this.canvas.width === targetW && this.canvas.height === targetH) return;
    this.canvas.width = targetW;
    this.canvas.height = targetH;
    this.scale = this.canvas.width / BOARD.W;
  }

  // ----- physics events ---------------------------------------------------
  handleCollisions(e) {
    for (const pair of e.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const ball = a.label === 'ball' ? a : b.label === 'ball' ? b : null;
      const peg = a.label === 'peg' ? a : b.label === 'peg' ? b : null;
      if (ball && peg) this.onPegHit(ball, peg, pair);
    }
  }

  onPegHit(ball, peg, pair) {
    const info = ball.plugin;
    const pi = peg.plugin;
    pi.flash = 1;
    info.hits++;

    if (info.targetX !== undefined) {
      const y = ball.position.y;
      const { slotTop = 366, spawnX = 220 } = BOARD;
      const t = Math.max(0, Math.min(1, (y - 30) / (slotTop - 45)));
      const s = t * t * (3 - 2 * t);
      const idealX = spawnX + (info.targetX - spawnX) * s;

      // Peg bounce direction: bounce towards ideal trajectory
      const dx = peg.position.x - idealX;
      // If peg is to the right of idealX, bounce left; if peg is to the left, bounce right
      const bounceDir = dx > 0 ? -1 : 1;

      // Gentle lateral kick in the bounce direction (natural ricochet)
      Body.applyForce(ball, ball.position, { x: bounceDir * 0.00018, y: 0 });
    }

    const derived = this.cb.getDerived();
    const settings = this.cb.getSettings();
    let kind = 'normal';

    if (derived.bonusPegIds.has(pi.id) && !info.hitSpecials.has(pi.id)) {
      info.hitSpecials.add(pi.id);
      info.value += derived.bonusPegValue;
      kind = 'bonus';
    } else if (derived.multPegIds.has(pi.id) && !info.hitSpecials.has(pi.id)) {
      info.hitSpecials.add(pi.id);
      info.value *= derived.multPegFactor;
      kind = 'mult';
    }
    info.value += derived.perHitValue;
    info.flat += derived.flatPerHit;

    const sp = pair.collision?.supports?.[0] || peg.position;
    if (settings.particles) this.burst(sp.x, sp.y, pi.color, kind === 'normal' ? 6 : 14);
    this.cb.onPegHit({ x: peg.position.x, y: peg.position.y, kind, hits: info.hits });
  }

  burst(x, y, color, count) {
    if (this.particles.length > 260) return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-90, 90),
        vy: rand(-130, -20),
        life: rand(0.35, 0.8),
        max: 0.8,
        r: rand(1, 2.6),
        color,
      });
    }
  }

  finalize(ball) {
    const { W, slotCount, settleY, outGutterW = 36 } = BOARD;
    const info = ball.plugin;
    const tier = info.tier || 0;
    const tierInfo = TIERS[tier] || TIERS[0];
    const x = ball.position.x;
    const betId = info.orderid || info.betId;

    // Check if outcome is OUT (server dictated isOut or physical gutter entry)
    const isOut = info.isOut !== undefined ? info.isOut : (x < outGutterW || x > W - outGutterW);

    if (isOut) {
      this.burst(x, settleY, '#EF4444', 20);
      Composite.remove(this.engine.world, ball);
      this.balls.delete(ball);
      this.cb.onOut?.({ x, y: settleY, tier, bet: info.bet || 0, betId });
      return;
    }

    const slotAreaW = W - outGutterW * 2;
    const slotW = slotAreaW / slotCount;
    const calculatedSlot = Math.max(0, Math.min(slotCount - 1, Math.floor((x - outGutterW) / slotW)));
    // If server sent a target_slot, guarantee that exact slot outcome
    const slot = info.targetSlot !== undefined && info.targetSlot >= 0 ? info.targetSlot : calculatedSlot;

    this.burst(x, settleY, tierInfo.color || '#FFC94A', 22);
    Composite.remove(this.engine.world, ball);
    this.balls.delete(ball);
    this.cb.onSettle({ slot, targetMult: info.targetMult, value: info.value, flat: info.flat, free: info.free, tier, bet: info.bet || 0, betId, x });
  }

  afterStep() {
    const now = performance.now();
    const { slotTop = 366, spawnX = 220 } = BOARD;

    for (const ball of [...this.balls]) {
      const info = ball.plugin;
      const y = ball.position.y;
      const x = ball.position.x;

      if (info.targetX !== undefined) {
        if (y < slotTop) {
          // Cubic smoothstep curve from spawnX (220) to targetX over the entire fall
          const t = Math.max(0, Math.min(1, (y - 30) / (slotTop - 45)));
          const s = t * t * (3 - 2 * t);
          const idealX = spawnX + (info.targetX - spawnX) * s;

          const diffX = idealX - x;
          // Target horizontal speed with smooth velocity steering (strictly calm, no sudden rush)
          const targetVx = Math.max(-1.5, Math.min(1.5, diffX * 0.10));
          Body.setVelocity(ball, {
            x: ball.velocity.x + (targetVx - ball.velocity.x) * 0.10,
            y: Math.max(1.15, ball.velocity.y), // guarantee smooth downward momentum, never stall on pegs
          });
        } else {
          // Inside slot chute (y >= slotTop): smoothly glide straight down onto the multiplier card
          const diffX = info.targetX - x;
          Body.setVelocity(ball, {
            x: diffX * 0.12,
            y: Math.min(3.8, Math.max(2.2, ball.velocity.y)),
          });
        }
      }

      // Speed limits: prevent flying & rushing
      const curSpeed = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (curSpeed > 4.6) {
        Body.setVelocity(ball, {
          x: (ball.velocity.x / curSpeed) * 4.6,
          y: (ball.velocity.y / curSpeed) * 4.6,
        });
      }

      info.trail.push({ x: ball.position.x, y: ball.position.y });
      if (info.trail.length > 14) info.trail.shift();

      // Anti-stuck nudge if the ball balances on a peg.
      if (curSpeed < 0.15) {
        info.stuck++;
        if (info.stuck > 35) {
          Body.setVelocity(ball, { x: rand(-1.2, 1.2), y: 0.6 });
          info.stuck = 0;
        }
      } else {
        info.stuck = 0;
      }

      if (ball.position.y > BOARD.settleY || now - info.born > 20000) this.finalize(ball);
    }
  }

  // ----- main loop --------------------------------------------------------
  tick(ts) {
    if (!this.running) return;
    const dt = Math.min(35, ts - (this.last || ts));
    this.last = ts;
    this.time += dt / 1000;

    if (!this.paused) {
      this.acc = Math.min(this.acc + dt, 35);
      let n = 0;
      while (this.acc >= STEP_MS && n < 4) {
        Engine.update(this.engine, STEP_MS);
        this.afterStep();
        this.acc -= STEP_MS;
        n++;
      }
    }

    for (const p of this.pegs) if (p.plugin.flash > 0) p.plugin.flash = Math.max(0, p.plugin.flash - dt / 280);
    this.updateParticles(dt / 1000);
    this.updateMeteors(dt / 1000);
    this.render();
    this.raf = requestAnimationFrame(this.tick);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateMeteors(dt) {
    // Periodically spawn a meteoroid across the night sky
    if (this.time >= this.nextMeteorTime) {
      this.nextMeteorTime = this.time + rand(3.0, 6.5);
      const fromLeft = Math.random() < 0.6;
      const startX = fromLeft ? rand(10, 150) : rand(BOARD.W - 150, BOARD.W - 10);
      const startY = rand(10, 75);
      const speed = rand(220, 320);
      const angle = fromLeft ? rand(0.55, 0.85) : rand(2.25, 2.55); // angled diagonal descent
      this.meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: rand(35, 60),
        life: 0,
        maxLife: rand(0.65, 1.05),
        width: rand(1.2, 2.0),
        color: Math.random() < 0.5 ? '#fed7aa' : '#bae6fd',
      });
    }

    // Advance and reap active meteoroids
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.life >= m.maxLife || m.x < -50 || m.x > BOARD.W + 50 || m.y > BOARD.H) {
        this.meteors.splice(i, 1);
      }
    }
  }

  // ----- rendering --------------------------------------------------------
  render() {
    const { ctx } = this;
    const { W, H, pegR, ballR, slotTop, slotCount, spawnX } = BOARD;
    const derived = this.cb.getDerived();
    const settings = this.cb.getSettings();
    const t = this.time;

    const scaleX = this.canvas.width / BOARD.W;
    const scaleY = this.canvas.height / BOARD.H;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Deep cosmic background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2D1B69');
    bg.addColorStop(0.35, '#1B1449');
    bg.addColorStop(0.7, '#110C2E');
    bg.addColorStop(1, '#080517');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Twinkling & blinking animated stars (excluding moon area)
    const moonX = W - 58;
    const moonY = 48;
    for (const s of this.stars) {
      if (Math.hypot(s.x - moonX, s.y - moonY) < 40) continue;
      const sinVal = Math.sin(t * s.speed + s.phase);
      const blink = Math.pow(Math.max(0, sinVal), 2.2); // sharp twinkling blink
      const alpha = s.baseAlpha + (1 - s.baseAlpha) * blink;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color || '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.85 + 0.35 * blink), 0, Math.PI * 2);
      ctx.fill();

      // Delicate 4-point sparkle cross flare on bright stars
      if (s.r >= 1.2 && blink > 0.65) {
        ctx.save();
        ctx.globalAlpha = (blink - 0.65) * 2.0;
        ctx.strokeStyle = s.color || '#ffffff';
        ctx.lineWidth = 0.65;
        const fl = s.r * 2.6;
        ctx.beginPath();
        ctx.moveTo(s.x - fl, s.y);
        ctx.lineTo(s.x + fl, s.y);
        ctx.moveTo(s.x, s.y - fl);
        ctx.lineTo(s.x, s.y + fl);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // Animated shooting meteoroids
    for (const m of this.meteors) {
      const progress = m.life / m.maxLife;
      const alpha = Math.sin(progress * Math.PI);
      if (alpha <= 0.01) continue;

      const spd = Math.hypot(m.vx, m.vy) || 1;
      const tailX = m.x - (m.vx / spd) * m.len;
      const tailY = m.y - (m.vy / spd) * m.len;

      const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.7, m.color + '88');
      grad.addColorStop(1, '#ffffff');

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // Glowing meteor head
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.width * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Photorealistic Celestial Half-Moon with Earthshine (Full Circle with faint visibility + Real Lunar Surface)
    this.drawRealisticMoon(ctx, W - 58, 48, 28, t);

    // Drop indicator (bobbing arrow)
    const bob = Math.sin(t * 4) * 3;
    ctx.save();
    ctx.translate(spawnX, 12 + bob);
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(9, -8);
    ctx.lineTo(9, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Slot dividers and OUT gutter boundaries
    const { outGutterW = 36 } = BOARD;
    const slotAreaW = W - outGutterW * 2;
    const slotW = slotAreaW / slotCount;

    // OUT boundary dividers (Red glow)
    for (const outX of [outGutterW, W - outGutterW]) {
      const g = ctx.createLinearGradient(0, slotTop, 0, H);
      g.addColorStop(0, '#EF4444');
      g.addColorStop(1, '#581C1C');
      ctx.fillStyle = g;
      ctx.fillRect(outX - 2, slotTop, 4, H - slotTop);
      ctx.save();
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#F87171';
      ctx.beginPath();
      ctx.arc(outX, slotTop, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Inner slot dividers (Purple glow)
    for (let k = 1; k < slotCount; k++) {
      const x = outGutterW + k * slotW;
      const g = ctx.createLinearGradient(0, slotTop, 0, H);
      g.addColorStop(0, '#6D4FE0');
      g.addColorStop(1, '#2A2160');
      ctx.fillStyle = g;
      ctx.fillRect(x - 2, slotTop, 4, H - slotTop);
      ctx.save();
      ctx.shadowColor = '#8B5CF6';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#B79CFF';
      ctx.beginPath();
      ctx.arc(x, slotTop, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pegs
    for (const peg of this.pegs) {
      const { x, y } = peg.position;
      const { id, color, flash } = peg.plugin;
      const isBonus = derived.bonusPegIds.has(id);
      const isMult = derived.multPegIds.has(id);

      if (flash > 0) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + flash * 16;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, pegR + flash * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, pegR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.7, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (flash > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${flash * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pegR + (1 - flash) * 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isBonus || isMult) {
        const c = isBonus ? '#FFC94A' : '#FF6FA9';
        const pulse = 0.6 + 0.4 * Math.sin(t * 5 + x);
        ctx.save();
        ctx.strokeStyle = c;
        ctx.globalAlpha = pulse;
        ctx.shadowColor = c;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, pegR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = c;
        ctx.font = '700 8px "Lilita One", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(isBonus ? `+${derived.bonusPegValue}` : `×${derived.multPegFactor}`, x, y - 11);
      }
    }

    // Balls + trails
    for (const ball of this.balls) {
      const { x, y } = ball.position;
      const trail = ball.plugin.trail;
      const tier = ball.plugin.tier || 0;
      const tierInfo = TIERS[tier] || TIERS[0];
      const ballColor = tierInfo.color || '#FFC94A';

      if (settings.trail && trail.length > 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = ballColor;
        ctx.shadowBlur = 10;
        for (let i = 1; i < trail.length; i++) {
          const k = i / trail.length;
          ctx.strokeStyle = `rgba(255,201,74,${k * 0.55})`;
          ctx.lineWidth = ballR * 1.7 * k;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.shadowColor = ballColor;
      ctx.shadowBlur = 16;
      const bg2 = ctx.createRadialGradient(x - 2.5, y - 3, 1, x, y, ballR + 1);
      bg2.addColorStop(0, '#FFFFFF');
      bg2.addColorStop(0.4, ballColor);
      bg2.addColorStop(1, '#1A0E2E');
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.arc(x, y, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, ballR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = tier === 0 ? '#6B3F00' : '#FFFFFF';
      ctx.font = '700 11px "Lilita One", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = tier === 0 ? '1' : (tierInfo.symbol || tierInfo.roman);
      ctx.fillText(label, x, y + 0.5);
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Helper to build the exact astronomical 12-phase lunar clipping path
  buildMoonPhasePath(ctx, mx, my, moonR, phi) {
    ctx.beginPath();
    const isWaxing = phi < Math.PI;
    const cosPhi = Math.cos(phi);
    const rx = Math.max(0.15, Math.abs(cosPhi) * moonR);

    if (isWaxing) {
      // Waxing phases (0 -> PI):
      // Outer illuminated limb is on the RIGHT semicircle (from top pole -PI/2 down to bottom pole PI/2)
      ctx.arc(mx, my, moonR, -Math.PI / 2, Math.PI / 2, false);
      // Terminator: ellipse from bottom pole (PI/2) back up to top pole (-PI/2)
      if (cosPhi >= 0) {
        // Waxing Crescent: terminator bows right
        ctx.ellipse(mx, my, rx, moonR, 0, Math.PI / 2, -Math.PI / 2, true);
      } else {
        // Waxing Gibbous: terminator bows left
        ctx.ellipse(mx, my, rx, moonR, 0, Math.PI / 2, 3 * Math.PI / 2, false);
      }
    } else {
      // Waning phases (PI -> 2*PI):
      // Outer illuminated limb is on the LEFT semicircle (from bottom pole PI/2 up to top pole 3*PI/2)
      ctx.arc(mx, my, moonR, Math.PI / 2, 3 * Math.PI / 2, false);
      // Terminator: ellipse from top pole (-PI/2) back down to bottom pole (PI/2)
      if (cosPhi < 0) {
        // Waning Gibbous: terminator bows right
        ctx.ellipse(mx, my, rx, moonR, 0, -Math.PI / 2, Math.PI / 2, false);
      } else {
        // Waning Crescent (Balsamic): terminator bows left
        ctx.ellipse(mx, my, rx, moonR, 0, -Math.PI / 2, Math.PI / 2, true);
      }
    }
    ctx.closePath();
  }

  // ----- Realistic Celestial Moon Rendering --------------------------------
  drawRealisticMoon(ctx, mx, my, moonR, t) {
    const pulse = 0.94 + 0.06 * Math.sin(t * 1.5);

    // Full 12-phase astronomical lunar cycle
    // Har phase change hone me 1 minute (60 seconds) ka samay lagta hai
    const SECONDS_PER_PHASE = 60; // 1 minute to transition to the next phase
    const TOTAL_CYCLE_SECONDS = SECONDS_PER_PHASE * 12; // 720s for full 12-phase cycle
    const initialPhase = Math.PI / 3; // start at visible Waxing Crescent II upon load
    const phi = (initialPhase + (t / TOTAL_CYCLE_SECONDS) * (Math.PI * 2)) % (Math.PI * 2);
    const illumination = (1 - Math.cos(phi)) / 2; // 0.0 (New Moon) to 1.0 (Full Moon)

    // Check if user's Detailed Full Moon Cutout image is loaded
    const hasImage = moonImg && moonImg.complete && moonImg.naturalWidth > 0;

    if (hasImage) {
      if (!this.cachedMoon) {
        const mc = document.createElement('canvas');
        mc.width = 128;
        mc.height = 128;
        const mctx = mc.getContext('2d');
        mctx.drawImage(moonImg, 0, 0, 128, 128);
        this.cachedMoon = mc;
      }
      const moonSrc = this.cachedMoon || moonImg;

      // 1. Faint Earthshine on the full moon disk ("shadow wale me ekdam zara sa visible rahe moon")
      // Subtle ghost silhouette (opacity 0.08) with zero stroke line so no artificial border appears
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, moonR, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.08;
      ctx.drawImage(moonSrc, mx - moonR, my - moonR, moonR * 2, moonR * 2);
      ctx.restore();

      // 2. Radiant Lunar Glow on the VISIBLE SHAPE ONLY (zero glow on the shadow side)
      // "moon me glow ness lao jo moon dhikh shadow wal nhi"
      if (illumination > 0.03) {
        ctx.save();
        this.buildMoonPhasePath(ctx, mx, my, moonR, phi);

        ctx.shadowColor = 'rgba(255, 250, 225, 0.92)';
        ctx.shadowBlur = (14 + 14 * illumination) * pulse;
        ctx.fillStyle = `rgba(255, 248, 225, ${(0.14 + 0.18 * illumination) * pulse})`;
        ctx.fill();
        ctx.restore();
      }

      // 2. Illuminated Moon Phase (Clipped to exact 12-phase astronomical shape)
      if (illumination > 0.015) {
        ctx.save();
        this.buildMoonPhasePath(ctx, mx, my, moonR, phi);
        ctx.clip();

        // Real moon cutout drawn at full opacity - crisp craters and textures
        ctx.globalAlpha = 1.0;
        ctx.drawImage(moonSrc, mx - moonR, my - moonR, moonR * 2, moonR * 2);

        // Luminous warm moonlight radiance overlay on the visible surface
        const glowOffsetX = phi < Math.PI ? moonR * 0.35 : -moonR * 0.35;
        const moonGlow = ctx.createRadialGradient(
          mx + glowOffsetX, my, 2,
          mx, my, moonR * 1.2
        );
        moonGlow.addColorStop(0, 'rgba(255, 255, 245, 0.28)');
        moonGlow.addColorStop(0.45, 'rgba(255, 245, 210, 0.14)');
        moonGlow.addColorStop(1, 'rgba(255, 220, 160, 0)');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(mx - moonR, my - moonR, moonR * 2, moonR * 2);

        ctx.restore();
      }
      return;
    }

    // Fallback: Procedural drawing if image is loading

    // Sunlit surface base gradient: high-albedo regolith from bright sunward limb to inner ivory
    const sunlitBase = ctx.createRadialGradient(
      mx + moonR * 0.65, my - moonR * 0.2, 2,
      mx, my, moonR * 1.15
    );
    sunlitBase.addColorStop(0, '#FFFFFF');
    sunlitBase.addColorStop(0.25, '#FAF6EA');
    sunlitBase.addColorStop(0.55, '#E8DFCB');
    sunlitBase.addColorStop(0.85, '#D5C9B3');
    sunlitBase.addColorStop(1, '#BFB199');
    ctx.fillStyle = sunlitBase;
    ctx.fillRect(mx - moonR, my - moonR, moonR * 2, moonR * 2);

    // Realistic Lunar Maria (Dark basalt lava plains on visible side)
    // Mare Serenitatis, Mare Tranquillitatis, Mare Crisium, Mare Fecunditatis
    const sunlitMaria = [
      { dx: 5, dy: -9, rx: 6, ry: 5, rot: 0.2, op: 0.35 },       // Mare Serenitatis
      { dx: 7, dy: -2, rx: 6.5, ry: 5.5, rot: -0.1, op: 0.38 },    // Mare Tranquillitatis
      { dx: 15, dy: -4, rx: 4, ry: 5, rot: 0.1, op: 0.42 },      // Mare Crisium (isolated oval)
      { dx: 8, dy: 6, rx: 7, ry: 6, rot: 0.3, op: 0.34 },        // Mare Fecunditatis
      { dx: 4, dy: 13, rx: 4.5, ry: 4, rot: -0.2, op: 0.30 },    // Mare Nectaris
      { dx: 2, dy: -16, rx: 4, ry: 3, rot: 0.15, op: 0.26 },     // Northern mare patch
    ];
    for (const m of sunlitMaria) {
      ctx.save();
      ctx.translate(mx + m.dx, my + m.dy);
      ctx.rotate(m.rot);
      ctx.fillStyle = `rgba(128, 120, 108, ${m.op})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Realistic Impact Craters with 3D Sunlit Rim & Cast Shadow
    // Sun shines from the right/top-right
    const sunlitCraters = [
      { dx: 12, dy: 12, r: 2.8, ray: true },  // Tycho crater (prominent south)
      { dx: 3, dy: 8, r: 2.2 },               // Albategnius / Ptolemaeus near terminator
      { dx: 2, dy: -6, r: 2.0 },              // Menelaus
      { dx: 10, dy: -14, r: 1.8 },            // Atlas / Hercules
      { dx: 17, dy: 4, r: 1.7 },              // Langrenus
      { dx: 8, dy: 2, r: 1.9 },               // Theophilus
      { dx: 14, dy: -10, r: 1.4 },            // Cleomedes
      { dx: 2.5, dy: 17, r: 1.6 },            // Clavius
    ];

    for (const c of sunlitCraters) {
      const cx = mx + c.dx;
      const cy = my + c.dy;

      // Dark crater floor & shadowed western rim
      ctx.fillStyle = 'rgba(78, 70, 62, 0.58)';
      ctx.beginPath();
      ctx.arc(cx - 0.4, cy + 0.3, c.r, 0, Math.PI * 2);
      ctx.fill();

      // Bright sunlit eastern/sunward rim crest
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.arc(cx + 0.35, cy - 0.3, c.r * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Deep shadowed center cavity
      ctx.fillStyle = 'rgba(52, 46, 40, 0.75)';
      ctx.beginPath();
      ctx.arc(cx - 0.1, cy + 0.1, c.r * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Central peak caught in sunlight
      if (c.r >= 2.0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx + 0.1, cy - 0.1, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tycho crater bright ejecta rays radiating outward
      if (c.ray) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 0.55;
        const rays = [
          [-9, -5], [-7, -12], [-2, -18], [4, -14],
          [-11, 2], [5, 4], [-4, 7]
        ];
        for (const [rx, ry] of rays) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rx, cy + ry);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Rugged mountain peaks casting shadows across the terminator
    // Sunlit mountain peaks protruding just into darkness along the center line
    const peaks = [
      { y: -18, x: -0.6, r: 0.9 },
      { y: -11, x: -1.2, r: 1.1 },
      { y: -3,  x: -0.8, r: 1.0 },
      { y: 4,   x: -1.4, r: 1.2 },
      { y: 11,  x: -0.9, r: 0.95 },
      { y: 19,  x: -0.5, r: 0.8 },
    ];
    for (const p of peaks) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(mx + p.x, my + p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Shadow behind the peak
      ctx.fillStyle = 'rgba(30, 24, 46, 0.65)';
      ctx.beginPath();
      ctx.arc(mx + p.x - p.r * 1.1, my + p.y + 0.3, p.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Natural terminator shadow falloff (grazing sunlight angle near the day-night divide)
    const terminatorShadow = ctx.createLinearGradient(mx - 2, my, mx + 11, my);
    terminatorShadow.addColorStop(0, 'rgba(32, 24, 50, 0.62)');
    terminatorShadow.addColorStop(0.35, 'rgba(65, 54, 78, 0.25)');
    terminatorShadow.addColorStop(0.7, 'rgba(120, 110, 125, 0.08)');
    terminatorShadow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = terminatorShadow;
    ctx.fillRect(mx - 4, my - moonR, 16, moonR * 2);

    // Bright outer limb edge highlight (crisp sunlit crescent boundary)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(mx, my, moonR - 0.5, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    ctx.restore();
  }
}
