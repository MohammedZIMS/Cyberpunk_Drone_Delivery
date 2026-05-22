// main.js

import { initWebGL } from './src/core/WebGLContext.js';
import { createShaderProgram } from './src/core/ShaderProgram.js';
import { Renderer } from './src/core/Render.js';
import { Camera } from './src/core/Camera.js';
import { InputManager } from './src/core/InputManager.js';
import { createCubeGeometry } from './src/scene/Geometry.js';
import { CityGenerator } from './src/scene/CityGenerator.js';
import { RoadGrid } from './src/scene/RoadGrid.js';
import { SkyBox } from './src/scene/SkyBox.js';
import { Ground } from './src/scene/Ground.js';
import { Drone } from './src/drone/Drone.js';
import { DroneController } from './src/drone/DroneController.js';
import { CollisionDetector } from './src/collision/CollisionDetector.js';
import { ObstacleManager } from './src/obstacles/ObstacleManager.js';
import { WeatherSystem } from './src/weather/WeatherSystem.js';
import { RainParticles } from './src/weather/RainParticles.js';
import { FogVolume } from './src/weather/FogVolume.js';
import { GameState } from './src/game/GameState.js';
import { DeliveryTarget } from './src/game/DeliveryTarget.js';
import { MissionManager } from './src/game/MissionManager.js';
import { ScoreSystem } from './src/game/ScoreSystem.js';
import { ExplosionFX } from './src/game/ExplosionFX.js';
import { AudioManager } from './src/audio/AudioManager.js';
import { ScreenManager } from './src/ui/ScreenManager.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ─────────────────────────────────────────────
// INIT WEBGL
// ─────────────────────────────────────────────
const { gl, canvas } = initWebGL('glCanvas');
const screen = new ScreenManager();
const renderer = new Renderer(gl, canvas);
const camera = new Camera(canvas);
const input = new InputManager();

// ─────────────────────────────────────────────
// THREE SKY SYSTEM
// ─────────────────────────────────────────────
const threeRenderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
threeRenderer.autoClear = false;
const threeScene = new THREE.Scene();
const threeCamera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
const skyBox = new SkyBox(threeScene);

// ─────────────────────────────────────────────
// SHADERS
// ─────────────────────────────────────────────
async function loadShader(path) { return (await fetch(path)).text(); }

// ─────────────────────────────────────────────
// GAME INIT
// ─────────────────────────────────────────────
async function init() {
  const vert = await loadShader('./src/shaders/city.vert');
  const frag = await loadShader('./src/shaders/city.frag');
  const program = createShaderProgram(gl, vert, frag);
  gl.useProgram(program);
  const cubeGeo = createCubeGeometry(gl);

  // World
  const city = new CityGenerator();
  city.generate(8, 22);
  const ground = new Ground(3000);
  const roadGrid = new RoadGrid(3000, 25);
  const obstacles = new ObstacleManager(city.buildings);

  // Game systems
  const score = new ScoreSystem();
  const gameState = new GameState(city.buildings, score);
  const drone = new Drone();
  const detector = new CollisionDetector(city.buildings);
  detector.setObstacles(obstacles.getCars(), obstacles.getWires(), obstacles.getBillboards());
  const controller = new DroneController(drone, detector);
  const mission = new MissionManager(city.buildings);

  // Delivery targets
  let deliveryTargets = [];
  function spawnTargets(count) {
    deliveryTargets = [];
    const shuffled = city.buildings.filter(b => b.height > 25).sort(() => Math.random() - 0.5).slice(0, count);
    for (const b of shuffled) deliveryTargets.push(new DeliveryTarget(b));
  }
  spawnTargets(3);

  // Weather & effects
  const weather = new WeatherSystem();
  const rain = new RainParticles(gl);
  const fog = new FogVolume();
  const explosion = new ExplosionFX(gl);
  const audio = new AudioManager();
  window.addEventListener('keydown', () => audio.init(), { once: true });

  // Uniforms
  const uView = gl.getUniformLocation(program, 'uView');
  const uProj = gl.getUniformLocation(program, 'uProjection');

  // Game state
  let wave = 1, waveTimer = 90;
  let last = 0, paused = false, hp = 100, alive = true;

  // Pause handling (ESC / P)
  const togglePause = () => {
    if (!alive) return;
    paused = !paused;
    if (paused) {
      audio.suspend();
      screen.showPauseMenu(
        () => { // Resume
          paused = false;
          audio.resume();
        },
        () => { // Restart mission
          hp = 100; alive = true; wave = 1; waveTimer = 90;
          score.reset(); spawnTargets(3);
          drone.reset?.(); paused = false; audio.resume();
          last = performance.now();
        }
      );
    } else {
      audio.resume();
      screen.hidePauseMenu();
    }
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'Escape') togglePause();
  });

  // Start screen
  screen.showStart(score.getHighScore());
  screen.onStartClick(() => {
    screen.startPlaying();
    requestAnimationFrame(loop);
  });

  // ─────────────────────────────────────────────
  // MAIN LOOP
  // ─────────────────────────────────────────────
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;

    // ========== UPDATE (only if alive and not paused) ==========
    if (alive && !paused) {
      weather.update(dt);
      skyBox.update(dt);
      roadGrid.update(dt);

      const dronePos = drone.getPosition();
      const velocity = drone.physics.velocity;
      const weatherState = weather.getStateName();
      waveTimer -= dt;

      // Delivery logic
      for (const target of deliveryTargets) {
        const collected = target.update(dt, dronePos, velocity);
        if (collected) {
          const result = score.recordDelivery(waveTimer, weatherState);
          explosion.trigger(target.getPosition());
          audio.playDelivery();
          // Show popup with bonus details
          screen.showScorePopup(result.earned, {
            stormBonus: result.stormBonus || 0,
            mult: result.mult || 1
          });
        }
        target.draw(gl, program, cubeGeo);
      }

      // Wave completion
      const allDelivered = deliveryTargets.every(t => t.getState() === 'collected');
      if (allDelivered || waveTimer <= 0) {
        wave = Math.min(wave + 1, 8);
        waveTimer = 90;
        spawnTargets(Math.min(3 + wave - 1, 8));
      }

      // Physics & collisions
      controller.physics?.applyWind(weather.getWindForce());
      controller.update(dt, input);
      obstacles.update(dt);
      camera.follow(dronePos, drone.getYaw(), dt);
      mission.update(dt, dronePos, weatherState);
      rain.update(dt, weather.getParticleCount());
      fog.update(dt, weather.getFogDensity());
      explosion.update(dt);

      const speed = Math.hypot(...velocity);
      audio.update(speed, weather.wind ?? 0, weather.getParticleCount());

      // Damage
      if (detector.checkDroneCollision?.(dronePos)) {
        hp = Math.max(0, hp - dt * 40);
        if (!explosion._active) {
          explosion.trigger(dronePos);
          audio.playHit();
          screen.flashHit();
        }
        if (hp <= 0 && alive) {
          alive = false;
          audio.playExplosion();
          screen.showDead(score.getScore(), score.getDeliveries(), score.getHighScore());
          screen.onRestartClick(() => {
            hp = 100; alive = true; wave = 1; waveTimer = 90;
            score.reset(); spawnTargets(3);
            drone.reset?.(); screen.startPlaying(); last = performance.now();
          });
        }
      }

      // Update HUD every frame
      screen.updateHUD({
        alt: Math.max(0, dronePos[1]),
        speed,
        weather: weatherState,
        wind: weather.wind ?? 0,
        hp,
        score: score.getScore(),
        highScore: score.getHighScore(),
        streak: score.getStreak(),
        mission: mission.getState(),
        timeRemaining: waveTimer,
      });
    }

    // ========== RENDER (always, even when paused) ==========
    const dronePos = drone.getPosition();
    gl.uniformMatrix4fv(uView, false, camera.getViewMatrix());
    gl.uniformMatrix4fv(uProj, false, camera.getProjectionMatrix());
    renderer.beginFrame(weather.getSkyTint());

    // Three.js skybox
    threeCamera.position.set(dronePos[0], dronePos[1], dronePos[2]);
    threeCamera.rotation.order = 'YXZ';
    threeCamera.rotation.y = drone.getYaw();
    threeRenderer.resetState();
    threeRenderer.render(threeScene, threeCamera);

    renderer.resetState();
    gl.useProgram(program);

    ground.draw(gl, program, cubeGeo);
    roadGrid.draw(gl, program, cubeGeo);
    city.drawAll(gl, program, cubeGeo);
    obstacles.drawAll(gl, program, cubeGeo);
    drone.draw(gl, program, cubeGeo);
    mission.draw(gl, program, cubeGeo);
    rain.draw(camera, dronePos, weather.getWindForce(), 18);
    explosion.draw(camera);
  }
}

init();