# 🚁 Cyberpunk Drone Delivery Simulator

A browser-based 3D drone delivery game set in a neon-lit cyberpunk city. Pilot your drone through a procedurally generated skyline, dodge flying cars and electric wires, and make deliveries before the clock runs out — all rendered with raw WebGL and Three.js.

![WebGL](https://drive.google.com/file/d/1tZi1bS5AMnE2UsDvC3ZMLfg4NqkYe4LX/view?usp=drive_link) ![Three.js](https://drive.google.com/file/d/19qznB6xQ8s2iceszGSL3riqS2nBzlSrG/view?usp=drive_link) ![glMatrix](https://drive.google.com/file/d/1rvwa21YC1GnDaLFpTRcAHNQOf9gsTBje/view?usp=drive_link) ![No build step](https://drive.google.com/file/d/1tnD0p6AHXXc8p90THVXqDYeZedliknqp/view?usp=drive_link)

---

## 🎮 Gameplay

- **Pick up packages** from rooftop landing pads (green zones) and **deliver them** to drop-off targets (orange zones)
- Each wave increases the parcel count — up to 8 simultaneous deliveries
- Beat the **90-second wave timer** or undelivered parcels cost you score points
- A **dynamic scoring system** rewards speed, clean runs, precision landings, delivery streaks, and flying in bad weather
- **Health degrades** on collision with buildings, flying cars, billboards, and electric wires; survive long enough to hit a new high score

## ✨ Features

| Category | Details |
|---|---|
| **Rendering** | Custom WebGL renderer with GLSL shaders, post-processing (bloom / composite), neon glow lighting system |
| **City** | Procedurally generated buildings, road grid, skybox, and ground plane |
| **Weather** | Four dynamic states (Clear → Drizzle → Storm → Fog) with smooth blending, rain particles, and fog volume |
| **Obstacles** | Flying cars on Bézier routes, electric wires strung between buildings, animated billboards |
| **Drone physics** | Momentum-based flight, rotor animation, hover bob, smooth tilt, ground clamping |
| **Scoring** | Base delivery + time bonus + package condition + clean-run bonus + weather bonus + streak multiplier |
| **Audio** | Web Audio API manager with autoplay-policy handling |
| **UI** | HUD (HP bar, score, wave, timer), tactical minimap, tutorial, pause/main-menu/game-over screens |
| **Persistence** | High score saved to `localStorage` |

---

## 🕹️ Controls

| Key | Action |
|---|---|
| `A ` | Thrust forward |
| `D ` | Thrust backward |
| `S ` | Strafe left |
| `W ` | Strafe right |
| `↑ ` | Ascend |
| `↓ ` | Descend |
| `Shift` | Move Fast |
| `← / →` | Yaw left / right |
| `Esc / P` | Pause / resume |

---

## 🗂️ Project Structure

```
├── index.html              # Entry point — HUD markup, canvas, font imports
├── main.js                 # Game loop, WebGL init, system wiring
└── src/
    ├── audio/
    │   └── AudioManager.js         # Web Audio API wrapper
    ├── collision/
    │   ├── AABB.js                 # Axis-aligned bounding box primitive
    │   └── CollisionDetector.js    # Broad + narrow phase collision
    ├── core/
    │   ├── Camera.js               # View/projection matrix management
    │   ├── InputManager.js         # Keyboard state tracker
    │   ├── PostProcessor.js        # Fullscreen post-process pass
    │   ├── Render.js               # WebGL draw-call abstraction
    │   ├── ShaderProgram.js        # GLSL compile & link helper
    │   └── WebGLContext.js         # Canvas + context bootstrap
    ├── drone/
    │   ├── Drone.js                # Drone mesh, rotor animation, model matrix
    │   ├── DroneController.js      # Maps input → physics forces
    │   ├── DronePhysics.js         # Momentum, drag, yaw integration
    │   └── Package.js              # Carried-package visual & state
    ├── game/
    │   ├── DeliveryTarget.js       # Pickup/drop-off zone rendering & detection
    │   ├── ExplosionFX.js          # Particle burst on collision
    │   ├── GameState.js            # Wave lifecycle, parcel list, HP, pause
    │   ├── MissionManager.js       # Per-mission spawn, timer, delivery callbacks
    │   ├── PickupEffect.js         # Visual feedback on successful pickup
    │   └── ScoreSystem.js          # Legacy score shim (delegates to ScoreManager)
    ├── lighting/
    │   ├── LightingSystem.js       # Scene-level light uniforms
    │   └── NeonGlow.js             # Per-building neon accent lights
    ├── obstacles/
    │   ├── Billboard.js            # Animated rooftop billboard
    │   ├── ElectricWire.js         # Wire strung between buildings
    │   ├── FlyingCar.js            # Bézier-path AI vehicle
    │   └── ObstacleManager.js      # Spawns and updates all obstacle types
    ├── scene/
    │   ├── Building.js             # Procedural building mesh + neon windows
    │   ├── CityGenerator.js        # Places buildings on a grid with variation
    │   ├── Geometry.js             # Shared cube geometry factory
    │   ├── Ground.js               # Ground plane mesh
    │   ├── RoadGrid.js             # Road markings overlay
    │   ├── SceneGraph.js           # Flat scene-node list + draw ordering
    │   └── SkyBox.js               # Three.js skybox (shared GL context)
    ├── shaders/
    │   ├── city.vert / city.frag   # Main scene vertex + fragment shader
    │   ├── blur.frag               # Gaussian blur pass
    │   ├── brightness.frag         # Brightness extraction for bloom
    │   ├── composite.frag          # Bloom composite pass
    │   └── quad.vert               # Fullscreen quad vertex shader
    ├── systems/
    │   ├── GameOverManager.js      # Death sequence, stat summary
    │   ├── HealthSystem.js         # HP + package condition, damage cooldown
    │   ├── MissionTimer.js         # Distance-scaled per-mission time limits
    │   ├── PlayTimeTracker.js      # Session clock fed to ScoreManager
    │   └── ScoreManager.js         # Full scoring: bonuses, streaks, high score
    ├── ui/
    │   ├── ScreenManager.js        # Main menu / pause / dead screen state machine
    │   ├── Tutorial.js             # Step-by-step first-run tutorial overlay
    │   └── tactical/
    │       ├── CoordConverter.js   # World → minimap coordinate transform
    │       ├── MapMarker.js        # Minimap icon renderer
    │       └── TacticalMap.js      # Canvas-based minimap overlay
    └── weather/
        ├── FogVolume.js            # Depth-based fog uniform controller
        ├── RainParticles.js        # GPU particle rain system
        └── WeatherSystem.js        # State machine: Clear / Drizzle / Storm / Fog
```

---

## 🚀 Getting Started

No build tools or package manager required. The game runs directly in a browser using ES modules and CDN imports.

### Prerequisites

- A modern browser with WebGL 2 support (Chrome 80+, Firefox 75+, Edge 80+, Safari 15+)
- A local HTTP server (ES modules cannot be served from `file://`)

### Running Locally

**Using Python:**
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

**Using Node.js (`npx`):**
```bash
npx serve .
```

**Using VS Code:** install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension and click *Go Live*.

---

## 🧠 Architecture Notes

- **No bundler.** All modules use native ES module `import`/`export`. Dependencies (Three.js r160, gl-matrix 3.4.3) are loaded from jsDelivr CDN.
- **Shared WebGL context.** The custom renderer and Three.js share the same `<canvas>` context. `threeRenderer.autoClear = false` prevents Three.js from wiping the custom WebGL frame.
- **Game loop.** A single `requestAnimationFrame` loop in `main.js` drives physics, AI, weather, scoring, and rendering. The loop is cancelled and re-scheduled on restart to avoid double-ticking.
- **Post-processing.** A two-pass bloom pipeline (brightness extract → Gaussian blur → composite) runs over the WebGL frame before the Three.js skybox is composited on top.
- **Damage cooldown.** `HealthSystem` enforces a 0.55 s global cooldown between hits so that grazing a building corner doesn't instantly destroy the drone.

---
