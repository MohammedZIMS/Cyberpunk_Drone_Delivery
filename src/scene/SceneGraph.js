// src/core/SceneGraph.js

import { mat4, vec3, quat } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';


export class SceneNode {
  constructor(name = 'node') {

    this.name = name;

    // Hierarchy
    this.parent = null;
    this.children = [];

    // Transform
    this.position = vec3.fromValues(0, 0, 0);

    this.rotation = quat.create();

    this.scale = vec3.fromValues(1, 1, 1);

    // Matrices
    this.localMatrix = mat4.create();

    this.worldMatrix = mat4.create();

    // Optional render callback
    this.onDraw = null;

    // Visibility
    this.visible = true;
  }

  // ─────────────────────────────────────────────
  // HIERARCHY
  // ─────────────────────────────────────────────

  addChild(child) {

    if (child.parent) {
      child.parent.removeChild(child);
    }

    child.parent = this;

    this.children.push(child);

    return child;
  }

  removeChild(child) {

    const index = this.children.indexOf(child);

    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  clearChildren() {

    for (const child of this.children) {
      child.parent = null;
    }

    this.children.length = 0;
  }

  // ─────────────────────────────────────────────
  // TRANSFORMS
  // ─────────────────────────────────────────────

  setPosition(x, y, z) {

    vec3.set(this.position, x, y, z);
  }

  setScale(x, y, z) {

    vec3.set(this.scale, x, y, z);
  }

  setRotationEuler(x, y, z) {

    quat.fromEuler(
      this.rotation,
      x,
      y,
      z
    );
  }

  rotateY(rad) {

    quat.rotateY(
      this.rotation,
      this.rotation,
      rad
    );
  }

  rotateX(rad) {

    quat.rotateX(
      this.rotation,
      this.rotation,
      rad
    );
  }

  rotateZ(rad) {

    quat.rotateZ(
      this.rotation,
      this.rotation,
      rad
    );
  }

  translate(x, y, z) {

    this.position[0] += x;
    this.position[1] += y;
    this.position[2] += z;
  }

  // ─────────────────────────────────────────────
  // MATRIX UPDATE
  // ─────────────────────────────────────────────

  updateLocalMatrix() {

    mat4.fromRotationTranslationScale(
      this.localMatrix,
      this.rotation,
      this.position,
      this.scale
    );
  }

  updateWorldMatrix(parentWorldMatrix = null) {

    // Build local matrix first
    this.updateLocalMatrix();

    // Combine with parent
    if (parentWorldMatrix) {

      mat4.multiply(
        this.worldMatrix,
        parentWorldMatrix,
        this.localMatrix
      );

    } else {

      mat4.copy(
        this.worldMatrix,
        this.localMatrix
      );
    }

    // Update children recursively
    for (const child of this.children) {

      child.updateWorldMatrix(
        this.worldMatrix
      );
    }
  }

  // ─────────────────────────────────────────────
  // DRAW
  // ─────────────────────────────────────────────

  draw(gl, program) {

    if (!this.visible) return;

    // Optional custom render callback
    if (this.onDraw) {

      this.onDraw(
        gl,
        program,
        this.worldMatrix
      );
    }

    // Draw children
    for (const child of this.children) {

      child.draw(gl, program);
    }
  }

  // ─────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────

  findByName(name) {

    if (this.name === name) {
      return this;
    }

    for (const child of this.children) {

      const result =
        child.findByName(name);

      if (result) return result;
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // DEBUG
  // ─────────────────────────────────────────────

  printTree(depth = 0) {

    console.log(
      `${' '.repeat(depth * 2)}- ${this.name}`
    );

    for (const child of this.children) {

      child.printTree(depth + 1);
    }
  }
}