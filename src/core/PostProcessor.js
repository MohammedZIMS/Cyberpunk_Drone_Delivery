// Uses Three.js built-in render + manual bloom simulation via tone mapping
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene    = scene;
    this.camera   = camera;
  }

  resize(w, h) {
    // nothing extra needed; renderer handles it
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}