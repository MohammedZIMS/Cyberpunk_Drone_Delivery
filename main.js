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
import { TacticalMap }        from './src/ui/tactical/TacticalMap.js';
import { HealthSystem }       from './src/systems/HealthSystem.js';
import { ScoreManager }       from './src/systems/ScoreManager.js';
import { PlayTimeTracker }    from './src/systems/PlayTimeTracker.js';
import { GameOverManager }    from './src/systems/GameOverManager.js';

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
  const score      = new ScoreManager();
  const health     = new HealthSystem();
  const playTime   = new PlayTimeTracker();
  const gameOver   = new GameOverManager();
  const camera     = new Camera(canvas);

  // ── Tactical Map — created once, persists across restarts ─────────────
  // FIX: canvas.getContext('2d') was never called in the original code.
  // TacticalMap owns the 2D context independently of WebGL.
  const tacticalMap = new TacticalMap(
    document.getElementById('minimap-canvas'),
    city.buildings,
    { worldRadius: 260, canvasSize: 150 }
  );

  // ── GameOver screen button wiring ─────────────────────────────────────
  gameOver.onRestart  = () => { startSession(); };
  gameOver.onMainMenu = () => { screen.showStart(score.getHighScore()); };

  // Wire zoom buttons
  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    const z = Math.min(4.0, (tacticalMap._zoom || 1.0) * 1.4);
    tacticalMap.setZoom(z);
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    const z = Math.max(0.4, (tacticalMap._zoom || 1.0) / 1.4);
    tacticalMap.setZoom(z);
  });

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
    // Reset per-session systems
    score.reset();
    health.reset();
    playTime.start();

    // Create fresh session objects
    gameState  = new GameState(city.buildings, score);
    drone      = new Drone();
    explosion  = new ExplosionFX(gl);
    mission    = new MissionManager(city.buildings);

    const detector = new CollisionDetector(city.buildings);
    detector.setObstacles(obstacles.getCars(), obstacles.getWires(), obstacles.getBillboards());

    // DroneController now takes HealthSystem instead of old damage callback
    controller = new DroneController(drone, detector, health);

    // Hit FX callback
    controller.onHit = (type) => {
      screen.flashHit();
      audio.playHit();
      // Notify ScoreManager that mission is no longer clean
      score.onCollision();
    };

    // ── HealthSystem callbacks ────────────────────────────────────────
    health.onDamage = (amt, type) => {
      // Damage feedback handled by hit flash
    };

    health.onDeath = () => {
      playTime.stop();
      explosion.trigger(drone.getPosition());
      audio.playExplosion();
      gameState.isPlaying = false;
      gameState.isAlive   = false;

      setTimeout(() => {
        gameOver.show({
          score:       score.getScore(),
          highScore:   score.getHighScore(),
          deliveries:  score.getDeliveries(),
          pickups:     score.getPickups(),
          activeTime:  playTime.getActiveTime(),
          totalTime:   playTime.getTotalTime(),
          maxSpeed:    playTime.getMaxSpeed(),
          distance:    playTime.getDistance(),
          wave:        gameState.getWave(),
        });
      }, 1800);
    };

    health.onPkgDamage = (amt, newCond) => {
      // Flash the package icon red briefly
    };

    health.onPkgFail = () => {
      // Package destroyed — notify mission
      // pkg fail toast
      mission._spawnMission();
      health.resetPackage();
    };

    // ── Mission callbacks ─────────────────────────────────────────────
    mission._onSpawn = (pickupPos, dropoffPos) => {
      score.onMissionSpawn(playTime.getActiveTime());
    };

    mission.onDeliver((timeLeft, timeLimit, approachSpeed, weatherName) => {
      // Dropoff score
      const result = score.recordDelivery(
        timeLeft, timeLimit,
        health.getPkgCondition(),
        approachSpeed,
        weatherName
      );
      screen.showScorePopup(result.earned);

      // Reset package for next mission
      health.resetPackage();
      health.setCarryingPackage(false);
    });

    mission.onFail(() => {
      score.resetStreak();
    });

    // Wire GameState death callback (legacy — now HealthSystem handles death)
    gameState.onDeath = () => {};

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
      playTime.pause();
    } else {
      audio.resumeAll();
      screen.hidePause();
      playTime.resume();
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
      // FIX: tactical map still animates its scan-line and markers while
      // paused — no gameplay data changes, but the visual keeps running.
      if (drone && mission) {
        const dp = drone.getPosition();
        tacticalMap.update(dt, dp, drone.getYaw(), {
          state:      mission.getState(),
          pickupPos:  mission.getPickupPos(),
          dropoffPos: mission.getDropoffPos(),
        });
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // ACTIVE GAMEPLAY UPDATE
    // ─────────────────────────────────────────────────────────────────

    const dronePos = drone.getPosition();
    const velocity = drone.getVelocity();
    const hSpeed   = Math.hypot(velocity[0], velocity[2]);

    // ── Health system cooldown ─────────────────────────────────────────
    health.update(dt);

    // ── Physics ───────────────────────────────────────────────────────
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
    mission.update(dt, dronePos, velocity, weatherState);

    // ── GameState timer & wave ────────────────────────────────────────
    gameState.update(dt, weatherState);

    // ── PlayTime tracking ─────────────────────────────────────────────
    const distDt = Math.hypot(velocity[0], velocity[2]) * dt;
    playTime.update(dt, Math.hypot(...velocity), distDt);

    // ── Mission pickup state → package carrying ────────────────────────
    health.setCarryingPackage(mission.getState() === 'transit');

    // ── Delivery targets (visual pads only — scoring via mission callbacks) ─
    for (let i = 0; i < deliveryTargets.length; i++) {
      const target = deliveryTargets[i];
      const collected = target.update(dt, dronePos, velocity);
      if (collected) {
        // Pad collected — score fires via mission.onDeliver callback above.
        explosion.trigger(target.getPosition());
        audio.playDelivery();
      }
    }

    // Respawn wave when all delivered
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
      hp:            health.getHP(),
      score:         score.getScore(),
      highScore:     score.getHighScore(),
      streak:        score.getMult(),
      mission:       mission.getState(),
      timeRemaining: mission.getTimeRemaining(),
      timerWarning:  mission.getWarningLevel(),
      yaw:           drone.getYaw(),
      // New fields:
      pkgCondition:  health.getPkgCondition(),
      playTime:      playTime.getFormattedActive(),
      boosting:      drone.physics.isBoosting(),
    });

    // ── Tactical Map — updated EVERY active frame ─────────────────────
    // FIX: completely independent of weather/WebGL state. Uses its own
    // 2D canvas context. Passes pickup/dropoff world positions so markers
    // are placed correctly (the original only passed mission state string).
    tacticalMap.update(dt, dronePos, drone.getYaw(), {
      state:      mission.getState(),
      pickupPos:  mission.getPickupPos(),
      dropoffPos: mission.getDropoffPos(),
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
