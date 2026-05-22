import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

const PICKUP_RADIUS   = 6;
const DROPOFF_RADIUS  = 8;
const PACKAGE_SCALE   = [1.2, 1.2, 1.2];

export class Package {
  constructor(buildings) {
    this.buildings = buildings;

    this.modelMatrix = mat4.create();

    this.packagePos = [0, 0, 0];
    this.dropPos    = [0, 0, 0];

    this.hasPackage = false;
    this.delivered  = false;

    this.pickupTimer = 0;

    this._generateMission();

    this._updateHUD();
  }


  // CREATE NEW DELIVERY
  _generateMission() {
    const start =
      this.buildings[
        Math.floor(Math.random() * this.buildings.length)
      ];

    let end =
      this.buildings[
        Math.floor(Math.random() * this.buildings.length)
      ];

    while (end === start) {
      end =
        this.buildings[
          Math.floor(Math.random() * this.buildings.length)
        ];
    }

    // pickup point
    this.packagePos = [
      start.x,
      start.height + 2,
      start.z
    ];

    // dropoff point
    this.dropPos = [
      end.x,
      end.height + 2,
      end.z
    ];

    this.hasPackage = false;
    this.delivered  = false;
  }

  // UPDATE

  update(dt, dronePos) {
    if (this.delivered) return;

    // Pickup logic
    if (!this.hasPackage) {
      const dist =
        this._distance(
          dronePos,
          this.packagePos
        );

      if (dist < PICKUP_RADIUS) {
        this.pickupTimer += dt;

        if (this.pickupTimer >= 1.0) {
          this.hasPackage = true;

          document.getElementById(
            'hud-pkg'
          ).textContent = 'CARRYING';

          console.log('Package picked up!');
        }
      } else {
        this.pickupTimer = 0;
      }
    }

    // Dropoff logic
    else {
      const dist =
        this._distance(
          dronePos,
          this.dropPos
        );

      if (dist < DROPOFF_RADIUS) {
        this.delivered = true;

        document.getElementById(
          'hud-pkg'
        ).textContent = 'DELIVERED';

        console.log('Package delivered!');

        setTimeout(() => {
          this._generateMission();
          this._updateHUD();
        }, 2500);
      }
    }
  }

  // DRAW

  draw(gl, program, cubeGeometry) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeGeometry.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeGeometry.ibo);

    const stride = cubeGeometry.stride;

    const aPos =
      gl.getAttribLocation(program, 'aPosition');

    const aNorm =
      gl.getAttribLocation(program, 'aNormal');

    gl.enableVertexAttribArray(aPos);

    gl.vertexAttribPointer(
      aPos,
      3,
      gl.FLOAT,
      false,
      stride,
      0
    );

    gl.enableVertexAttribArray(aNorm);

    gl.vertexAttribPointer(
      aNorm,
      3,
      gl.FLOAT,
      false,
      stride,
      12
    );

    // Pickup crate

    if (!this.hasPackage) {
      this._drawCube(
        gl,
        program,
        cubeGeometry,
        this.packagePos,
        [1.0, 0.8, 0.2]
      );
    }

    // Dropoff marker

    if (this.hasPackage && !this.delivered) {
      this._drawCube(
        gl,
        program,
        cubeGeometry,
        this.dropPos,
        [0.2, 1.0, 0.3]
      );
    }
  }

  _drawCube(
    gl,
    program,
    cubeGeometry,
    pos,
    color
  ) {
    mat4.identity(this.modelMatrix);

    mat4.translate(
      this.modelMatrix,
      this.modelMatrix,
      pos
    );

    mat4.scale(
      this.modelMatrix,
      this.modelMatrix,
      PACKAGE_SCALE
    );

    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'uModel'),
      false,
      this.modelMatrix
    );

    gl.uniform3fv(
      gl.getUniformLocation(
        program,
        'uObjectColor'
      ),
      color
    );

    gl.drawElements(
      gl.TRIANGLES,
      cubeGeometry.indexCount,
      gl.UNSIGNED_SHORT,
      0
    );
  }

  // HELPERS

  _distance(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];

    return Math.sqrt(
      dx * dx +
      dy * dy +
      dz * dz
    );
  }

  _updateHUD() {
    const pkg =
      document.getElementById('hud-pkg');

    if (!pkg) return;

    pkg.textContent =
      this.hasPackage
        ? 'CARRYING'
        : 'WAITING';
  }


  // API

  isCarrying() {
    return this.hasPackage;
  }

  getPickupPosition() {
    return this.packagePos;
  }

  getDropoffPosition() {
    return this.dropPos;
  }
}