import { initWebGL }         from './src/core/WebGLContext.js';
import { createShaderProgram } from './src/core/ShaderProgram.js';
import { Renderer }           from './src/core/Render.js';
import { Camera }             from './src/core/Camera.js';
import { InputManager }       from './src/core/InputManager.js';

import { createCubeGeometry } from './src/scene/Geometry.js';
import { CityGenerator }      from './src/scene/CityGenerator.js';
import { RoadGrid }           from './src/scene/RoadGrid.js';
import { SkyBox }             from './src/scene/SkyBox.js';
import { Ground }             from './src/scene/Ground.js';

import { Drone }              from './src/drone/Drone.js';
import { DroneController }    from './src/drone/DroneController.js';
import { CollisionDetector }  from './src/collision/CollisionDetector.js';

import { ObstacleManager }    from './src/obstacles/ObstacleManager.js';

import { WeatherSystem }      from './src/weather/WeatherSystem.js';
import { RainParticles }      from './src/weather/RainParticles.js';
import { FogVolume }          from './src/weather/FogVolume.js';

import { GameState }          from './src/game/GameState.js';
import { DeliveryTarget }     from './src/game/DeliveryTarget.js';
import { MissionManager }     from './src/game/MissionManager.js';
import { ScoreSystem }        from './src/game/ScoreSystem.js';
import { ExplosionFX }        from './src/game/ExplosionFX.js';

import { AudioManager }       from './src/audio/AudioManager.js';
import { ScreenManager }      from './src/ui/ScreenManager.js';

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ═══════════════════════════════════════════════════════════════════════════
// ONE-TIME SETUP (survives restarts)
// ═══════════════════════════════════════════════════════════════════════════

const { gl, canvas } = initWebGL('glCanvas');
const renderer = new Renderer(gl, canvas);
const screen   = new ScreenManager();
const input    = new InputManager();
const audio    = new AudioManager();

// Three.js skybox (shared context — never recreated)
const threeRenderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
threeRenderer.autoClear = false;
const threeScene  = new THREE.Scene();
const threeCamera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
const skyBox = new SkyBox(threeScene);

// Audio init on first interaction (browser autoplay policy)
window.addEventListener('keydown', () => audio.init(), { once: true });
window.addEventListener('click',   () => audio.init(), { once: true });

// ── RAF handle — always cancel before re-scheduling ──────────────────────
let rafHandle = null;

function scheduleLoop(fn) {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(fn);
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC INIT (loads shaders, builds world)
// ═══════════════════════════════════════════════════════════════════════════

async function loadShader(path) {
  return (await fetch(path)).text();
}

async function init() {
  // ── Shaders ────────────────────────────────────────────────────────────
  const vert    = await loadShader('./src/shaders/city.vert');
  const frag    = await loadShader('./src/shaders/city.frag');
  const program = createShaderProgram(gl, vert, frag);

  const uView = gl.getUniformLocation(program, 'uView');
  const uProj = gl.getUniformLocation(program, 'uProjection');

  // ── World (persistent across restarts) ────────────────────────────────
  const cubeGeo  = createCubeGeometry(gl);
  const city     = new CityGenerator();
  city.generate(8, 22);

  const ground     = new Ground(3000);
  const roadGrid   = new RoadGrid(3000, 25);
  const obstacles  = new ObstacleManager(city.buildings);

  // ── Weather (persistent — transitions should never reset) ──────────────
  const weather  = new WeatherSystem();
  const rain     = new RainParticles(gl);
  const fog      = new FogVolume();

  // ── Core game systems ──────────────────────────────────────────────────
  const score    = new ScoreSystem();
  const camera   = new Camera(canvas);

  // ── Show start screen ──────────────────────────────────────────────────
  screen.showStart(score.getHighScore());

  // ── Pause menu button wiring (done once; callbacks set per session) ────
  screen.bindPauseButtons({
    onResume:   () => resumeGame(),
    onRestart:  () => { resumeGame(); startSession(); },
    onMainMenu: () => { resumeGame(); screen.showStart(score.getHighScore()); },
  });

  // ── ESC / P key toggles pause ─────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((key === 'escape' || key === 'p') && gameState?.isPlaying) {
      togglePause();
    }
  });

  // ── Session-scoped refs (replaced on restart) ──────────────────────────
  let gameState  = null;
  let drone      = null;
  let controller = null;
  let mission    = null;
  let explosion  = null;
  let deliveryTargets = [];
  let last = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION FACTORY — called on first start and every restart
  // ─────────────────────────────────────────────────────────────────────────

  function startSession() {
    // Create fresh session objects
    gameState  = new GameState(city.buildings, score);
    drone      = new Drone();
    explosion  = new ExplosionFX(gl);
    mission    = new MissionManager(city.buildings);

    const detector = new CollisionDetector(city.buildings);
    detector.setObstacles(obstacles.getCars(), obstacles.getWires(), obstacles.getBillboards());

    controller = new DroneController(drone, detector);

    // Wire DroneController → GameState for damage
    controller.onDamage = (dmg) => gameState.applyDamage(dmg);
    controller.onHit    = ()    => { screen.flashHit(); audio.playHit(); };

    // Wire GameState death callback
    gameState.onDeath = () => {
      explosion.trigger(drone.getPosition());
      audio.playExplosion();
      setTimeout(() => {
        screen.showDead(
          score.getScore(),
          score.getDeliveries(),
          score.getHighScore()
        );
        screen.onRestartClick(() => {
          score.reset();
          startSession();
          screen.startPlaying();
        });
      }, 1800);
    };

    // Spawn delivery targets
    spawnTargets(3);

    // Start GameState
    gameState.startGame();

    // Kick off the loop
    last = performance.now();
    screen.startPlaying();
    scheduleLoop(loop);
  }

  // ── Delivery target helpers ──────────────────────────────────────────────

  function spawnTargets(count) {
    deliveryTargets = [];
    const buildings = city.buildings
      .filter(b => b.height > 25)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    for (const b of buildings) {
      deliveryTargets.push(new DeliveryTarget(b));
    }
  }

  // ── Pause helpers ────────────────────────────────────────────────────────

  function togglePause() {
    if (!gameState) return;
    const nowPaused = gameState.togglePause();
    if (nowPaused) {
      audio.pauseAll();
      screen.showPause();
    } else {
      audio.resumeAll();
      screen.hidePause();
      // Re-stamp last so dt doesn't spike after being paused
      last = performance.now();
    }
  }

  function resumeGame() {
    if (gameState?.isPaused) togglePause();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MASTER GAME LOOP
  // ═══════════════════════════════════════════════════════════════════════

  function loop(t) {
    // Always reschedule first — ensures loop keeps running even if an
    // exception fires later in this tick
    rafHandle = requestAnimationFrame(loop);

    // FIX: always advance `last` so the timestamp never goes stale,
    // even on paused frames. This prevents a dt spike on resume.
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;

    // ── Weather always updates (visual only, no gameplay impact) ──────
    // Weather transitions are purely cosmetic — fog, rain density, sky tint.
    // They MUST NOT gate or reset any gameplay variable.
    weather.update(dt);
    skyBox.update(dt);
    roadGrid.update(dt);

    const weatherState    = weather.getStateName();
    const windForce       = weather.getWindForce();
    const windStrength    = Math.hypot(windForce[0], windForce[2]);

    // ── Render-only path while paused ─────────────────────────────────
    // We still render the scene so the pause overlay looks correct.
    // No physics, no score, no camera movement.
    if (!gameState || gameState.isPaused) {
      renderScene();
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // ACTIVE GAMEPLAY UPDATE
    // ─────────────────────────────────────────────────────────────────

    const dronePos = drone.getPosition();
    const velocity = drone.getVelocity();
    const hSpeed   = Math.hypot(velocity[0], velocity[2]);

    // ── Physics ───────────────────────────────────────────────────────
    // FIX: was `controller.physics?.applyWind` which always resolved to
    // undefined. DroneController doesn't own physics — Drone does.
    drone.physics.applyWind(windForce);
    controller.update(dt, input);

    // ── World updates ─────────────────────────────────────────────────
    obstacles.update(dt);
    rain.update(dt, weather.getParticleCount());
    fog.update(dt, weather.getFogDensity());
    explosion.update(dt);

    // ── Camera — runs every active frame, independent of weather ─────
    // FIX: camera.follow() was only called when `alive` was true locally.
    // It's now called every active frame so it never loses the drone.
    camera.follow(dronePos, drone.getYaw(), dt);

    // ── Mission ───────────────────────────────────────────────────────
    mission.update(dt, dronePos, weatherState);

    // ── GameState timer & wave ────────────────────────────────────────
    gameState.update(dt, weatherState);

    // ── Delivery targets ──────────────────────────────────────────────
    for (let i = 0; i < deliveryTargets.length; i++) {
      const target = deliveryTargets[i];
      const collected = target.update(dt, dronePos, velocity);

      if (collected) {
        // FIX: score recorded ONCE via GameState — not here AND in a later
        // block. GameState.deliverParcel() is idempotent on repeat calls.
        const result = gameState.deliverParcel(i, weatherState);
        if (result) {
          explosion.trigger(target.getPosition());
          audio.playDelivery();
          screen.showScorePopup(result.earned);
        }
      }
    }

    // Respawn wave when all delivered (wave timer managed by GameState)
    const allDelivered = deliveryTargets.every(t => t.getState() === 'collected');
    if (allDelivered) {
      spawnTargets(Math.min(3 + gameState.getWave() - 1, 8));
    }

    // ── Audio mix ─────────────────────────────────────────────────────
    const speed = Math.hypot(...velocity);
    audio.update(
      isFinite(speed) ? speed : 0,
      isFinite(windStrength) ? windStrength : 0,
      weather.getParticleCount()
    );

    // ── Render ────────────────────────────────────────────────────────
    renderScene();

    // ── HUD — called UNCONDITIONALLY every active frame ───────────────
    // FIX: previously gated behind `if (collected)` so compass/score/timer
    // only updated on delivery frames. Now runs every frame.
    screen.updateHUD({
      alt:           Math.max(0, dronePos[1]),
      speed,
      weather:       weatherState,
      wind:          isFinite(windStrength) ? windStrength : 0,
      hp:            gameState.getHP(),
      score:         score.getScore(),
      highScore:     score.getHighScore(),
      streak:        score.getStreak(),
      mission:       mission.getState(),
      timeRemaining: gameState.getTimeRemaining(),
      yaw:           drone.getYaw(),   // compass always has a fresh value
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER FUNCTION (separated from update)
  // ═══════════════════════════════════════════════════════════════════════

  function renderScene() {
    const dronePos = drone ? drone.getPosition() : [0, 15, 0];

    gl.useProgram(program);
    gl.uniformMatrix4fv(uView, false, camera.getViewMatrix());
    gl.uniformMatrix4fv(uProj, false, camera.getProjectionMatrix());

    renderer.beginFrame(weather.getSkyTint());

    // Three.js skybox (background layer)
    threeCamera.position.set(...dronePos);
    threeCamera.rotation.order = 'YXZ';
    if (drone) threeCamera.rotation.y = drone.getYaw();

    threeRenderer.resetState();
    threeRenderer.render(threeScene, threeCamera);

    // FIX: restore full WebGL state after Three.js clobbers it
    renderer.resetState();
    gl.useProgram(program);

    // Scene objects
    ground.draw(gl, program, cubeGeo);
    roadGrid.draw(gl, program, cubeGeo);
    city.drawAll(gl, program, cubeGeo);
    obstacles.drawAll(gl, program, cubeGeo);

    if (drone) drone.draw(gl, program, cubeGeo);
    if (mission) mission.draw(gl, program, cubeGeo);

    // Delivery target pads
    for (const target of deliveryTargets) {
      target.draw(gl, program, cubeGeo);
    }

    // Particle effects
    rain.draw(camera, dronePos, weather.getWindForce(), 18);
    if (explosion) explosion.draw(camera);
  }

  // ── Entry point ──────────────────────────────────────────────────────────
  screen.onStartClick(() => startSession());
}

init();
