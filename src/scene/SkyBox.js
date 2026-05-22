import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class SkyBox {
  constructor(scene) {
    this.scene = scene;
    this._t    = 0;
    this._dayDuration = 240; // seconds for a full cycle

    // Fog
    scene.fog = new THREE.FogExp2(0x000814, 0.0018);

    // Ambient
    this.ambient = new THREE.AmbientLight(0x111133, 0.5);
    scene.add(this.ambient);

    // Moon / directional
    this.sun = new THREE.DirectionalLight(0x8899cc, 0.6);
    this.sun.position.set(80, 120, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far  = 800;
    this.sun.shadow.camera.left  = -200;
    this.sun.shadow.camera.right =  200;
    this.sun.shadow.camera.top   =  200;
    this.sun.shadow.camera.bottom = -200;
    scene.add(this.sun);

    // Stars
    this._makeStars();

    // Skybox gradient using a large sphere
    this._makeSkyDome();
  }

  _makeStars() {
    const count = 2000;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 900 + Math.random() * 100;
      const θ = Math.random() * Math.PI;
      const φ = Math.random() * Math.PI * 2;
      pos[i * 3]     = r * Math.sin(θ) * Math.cos(φ);
      pos[i * 3 + 1] = r * Math.abs(Math.cos(θ)); // upper hemisphere only
      pos[i * 3 + 2] = r * Math.sin(θ) * Math.sin(φ);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _makeSkyDome() {
    const geo = new THREE.SphereGeometry(950, 24, 16);
    // vertex colours: top = deep space, bottom = neon glow horizon
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = Math.max(0, Math.min(1, (y + 200) / 1150));
      // horizon: 0x0a0520 → top: 0x000008
      const r = 0.04 * (1 - t) + 0.00 * t;
      const g = 0.02 * (1 - t) + 0.00 * t;
      const b = 0.12 * (1 - t) + 0.03 * t;
      colors.push(r, g, b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    this.dome = new THREE.Mesh(geo, mat);
    this.scene.add(this.dome);
  }

  update(dt) {
    this._t += dt;
    const phase = (this._t % this._dayDuration) / this._dayDuration;

    // Rotate stars slowly
    this.stars.rotation.y = this._t * 0.002;

    // Animate fog density with weather (called from WeatherSystem separately)
    // Subtle pulse on horizon ambient
    const pulse = Math.sin(this._t * 0.3) * 0.02;
    this.ambient.intensity = 0.3 + pulse;
  }
}