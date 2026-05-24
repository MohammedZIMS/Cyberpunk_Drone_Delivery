import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

// ─── Deterministic pseudo-random seeded from building position ────────────────
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── Cyberpunk neon palette ───────────────────────────────────────────────────
const NEON = [
  [0.00, 1.00, 0.80],
  [1.00, 0.00, 0.60],
  [0.40, 0.00, 1.00],
  [1.00, 0.50, 0.00],
  [0.00, 0.80, 1.00],
  [1.00, 0.20, 0.20],
  [0.20, 1.00, 0.40],
  [1.00, 0.80, 0.00],
];

// ─── Architectural profiles ───────────────────────────────────────────────────
const PROFILES = [
  { tiers: 1, taper: 0.00 },
  { tiers: 2, taper: 0.15 },
  { tiers: 2, taper: 0.25 },
  { tiers: 3, taper: 0.12 },
  { tiers: 1, taper: 0.00 },
  { tiers: 1, taper: 0.00 },
];

// ─── Window grid helper ───────────────────────────────────────────────────────
function buildWindowGrid(rand, faceW, faceH, bx, by, bz, face) {
  const WW = 0.35 + rand() * 0.25;
  const WH = 0.45 + rand() * 0.25;
  const GX = 1.80 + rand() * 1.20;
  const GY = 2.00 + rand() * 1.50;

  const cols = Math.max(1, Math.round(faceW / (WW + GX)));
  const rows = Math.max(1, Math.round(faceH / (WH + GY)));

  const stepX = faceW / cols;
  const stepY = faceH / rows;

  const windows = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.25) continue;

      const lx = -faceW / 2 + (c + 0.5) * stepX;
      const ly =  faceH / 2 - (r + 0.5) * stepY;

      const m = mat4.create();

      if (face === 'front') {
        mat4.translate(m, m, [bx + lx, by + ly, bz + 0.501]);
      } else if (face === 'back') {
        mat4.translate(m, m, [bx + lx, by + ly, bz - 0.501]);
      } else if (face === 'left') {
        mat4.translate(m, m, [bx - 0.501, by + ly, bz + lx]);
        mat4.rotateY(m, m, Math.PI / 2);
      } else {
        mat4.translate(m, m, [bx + 0.501, by + ly, bz + lx]);
        mat4.rotateY(m, m, -Math.PI / 2);
      }

      mat4.scale(m, m, [WW * 0.5, WH * 0.5, 0.05]);
      windows.push(m);
    }
  }

  return windows;
}

// ─── Building class ───────────────────────────────────────────────────────────
export class Building {
  constructor(x, z, width, height, depth) {
    this.x = x;
    this.z = z;
    this.width = width;
    this.height = height;
    this.depth = depth;

    const seed = Math.abs(Math.round(x * 1000 + z * 7)) | 1;
    const rand = seededRand(seed);

    const colorIdx = Math.floor(rand() * NEON.length);
    this.color = NEON[colorIdx];

    const accentIdx =
      (colorIdx + 2 + Math.floor(rand() * (NEON.length - 2))) % NEON.length;

    this.accentColor = NEON[accentIdx];

    this.bodyColor = [
      this.color[0] * 0.12 + 0.04,
      this.color[1] * 0.12 + 0.04,
      this.color[2] * 0.12 + 0.04,
    ];

    const profile = PROFILES[Math.floor(rand() * PROFILES.length)];

    this._tiers = this._buildTiers(rand, profile);
    this._windows = this._buildWindows(rand);

    // ── Neon signs ───────────────────────────────────────────────────────
    this._signs = this._buildSigns(rand);
  }

  // ── Tier geometry ───────────────────────────────────────────────────────
  _buildTiers(rand, profile) {
    const tiers = [];
    let remainH = this.height;
    let curW = this.width;
    let curD = this.depth;
    let baseY = 0;

    for (let i = 0; i < profile.tiers; i++) {
      const isLast = i === profile.tiers - 1;
      const tierH = isLast ? remainH : remainH * (0.35 + rand() * 0.30);

      const m = mat4.create();
      mat4.translate(m, m, [this.x, baseY + tierH / 2, this.z]);
      mat4.scale(m, m, [curW, tierH, curD]);

      tiers.push({ matrix: m, w: curW, h: tierH, d: curD, baseY });

      baseY += tierH;
      remainH -= tierH;

      const taper = profile.taper;
      curW *= 1 - taper - rand() * 0.05;
      curD *= 1 - taper - rand() * 0.05;
    }

    return tiers;
  }

  // ── Windows ────────────────────────────────────────────────────────────
  _buildWindows(rand) {
    const windows = [];
    const base = this._tiers[0];

    const bx = this.x;
    const bz = this.z;
    const halfY = base.baseY + base.h / 2;

    const faces = ['front', 'back', 'left', 'right'];

    for (const face of faces) {
      const faceW =
        face === 'front' || face === 'back' ? base.w : base.d;

      const faceH = base.h * 0.8;

      const grid = buildWindowGrid(rand, faceW, faceH, bx, halfY, bz, face);
      windows.push(...grid);
    }

    return windows;
  }

  // ── Neon signs ─────────────────────────────────────────────────────────
  _buildSigns(rand) {
    const signs = [];

    if (this.height < 18 || rand() < 0.55) return signs;

    const signCount = 1 + Math.floor(rand() * 2);

    for (let i = 0; i < signCount; i++) {
      const signY = this.height * (0.40 + rand() * 0.30);
      const sW = 1.2 + rand() * 2.5;
      const sH = 0.25 + rand() * 0.35;
      const sD = 0.18;

      const face = Math.floor(rand() * 4);
      let sx = this.x;
      let sz = this.z;

      const m = mat4.create();

      if (face === 0) {
        sx += (rand() - 0.5) * (this.width - sW) * 0.6;
        mat4.translate(m, m, [
          sx,
          signY,
          this.z + this.depth / 2 + sD / 2 + 0.15,
        ]);
        mat4.scale(m, m, [sW, sH, sD]);
      } else if (face === 1) {
        sx += (rand() - 0.5) * (this.width - sW) * 0.6;
        mat4.translate(m, m, [
          sx,
          signY,
          this.z - this.depth / 2 - sD / 2 - 0.15,
        ]);
        mat4.scale(m, m, [sW, sH, sD]);
      } else if (face === 2) {
        sz += (rand() - 0.5) * (this.depth - sW) * 0.6;
        mat4.translate(m, m, [
          this.x - this.width / 2 - sD / 2 - 0.15,
          signY,
          sz,
        ]);
        mat4.scale(m, m, [sD, sH, sW]);
      } else {
        sz += (rand() - 0.5) * (this.depth - sW) * 0.6;
        mat4.translate(m, m, [
          this.x + this.width / 2 + sD / 2 + 0.15,
          signY,
          sz,
        ]);
        mat4.scale(m, m, [sD, sH, sW]);
      }

      signs.push(m);
    }

    return signs;
  }

  // ── Draw ───────────────────────────────────────────────────────────────
  draw(gl, program, cubeGeometry) {
    const aPos = gl.getAttribLocation(program, 'aPosition');
    const aNorm = gl.getAttribLocation(program, 'aNormal');

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, cubeGeometry.stride, 0);

    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(
      aNorm,
      3,
      gl.FLOAT,
      false,
      cubeGeometry.stride,
      12
    );

    const uModel = gl.getUniformLocation(program, 'uModel');
    const uColor = gl.getUniformLocation(program, 'uObjectColor');

    // body
    gl.uniform3fv(uColor, this.bodyColor);
    for (const t of this._tiers) {
      gl.uniformMatrix4fv(uModel, false, t.matrix);
      gl.drawElements(
        gl.TRIANGLES,
        cubeGeometry.indexCount,
        gl.UNSIGNED_SHORT,
        0
      );
    }

    // windows
    gl.uniform3fv(uColor, this.accentColor);
    for (const w of this._windows) {
      gl.uniformMatrix4fv(uModel, false, w);
      gl.drawElements(
        gl.TRIANGLES,
        cubeGeometry.indexCount,
        gl.UNSIGNED_SHORT,
        0
      );
    }

    // signs
    gl.uniform3fv(uColor, this.color);
    for (const s of this._signs) {
      gl.uniformMatrix4fv(uModel, false, s);
      gl.drawElements(
        gl.TRIANGLES,
        cubeGeometry.indexCount,
        gl.UNSIGNED_SHORT,
        0
      );
    }
  }
}