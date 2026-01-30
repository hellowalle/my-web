import './style.css'

// --- Model (simplified Coulomb friction) ---
// User chose: single friction coefficient μ, with mass included.
const g = 9.8
const massKg = 12 // fixed mass (user requested we choose)

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))
const round = (n, digits = 2) => {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="friction" aria-label="摩擦力演示">
    <header class="app__header friction__header">
      <div class="header-content">
        <span class="pill pill--header">物理小实验</span>
        <h1>摩擦力演示</h1>
        <p class="subtitle">拖动箱子，或设定力值并自动模拟：看它是否能克服摩擦。</p>
      </div>
    </header>

    <section class="friction__layout" aria-label="控制与画布">
      <div class="friction__panel" role="region" aria-label="参数设置">
        <div class="card">
          <div class="card__title">参数</div>
          <div class="kv">
            <div class="kv__row">
              <span class="kv__k">质量 m</span>
              <span class="kv__v"><strong data-mass></strong> kg</span>
            </div>
            <div class="kv__row">
              <span class="kv__k">重力加速度 g</span>
              <span class="kv__v"><strong>9.8</strong> m/s²</span>
            </div>
          </div>

          <div class="control">
            <label class="control__label" for="mu">摩擦系数 μ</label>
            <div class="control__row">
              <input id="mu" type="range" min="0" max="1.2" step="0.01" value="0.4" />
              <span class="control__value"><strong data-mu></strong></span>
            </div>
            <p class="control__hint">简化模型：摩擦力大小 = μ · N，方向总与运动趋势相反。</p>
          </div>

          <div class="control">
            <label class="control__label" for="force">设定拖动/施力 F（自动模式）</label>
            <div class="control__row">
              <input id="force" type="range" min="0" max="300" step="1" value="80" />
              <span class="control__value"><strong data-force></strong> N</span>
            </div>
          </div>

          <div class="segmented" role="tablist" aria-label="施力模式">
            <button class="segmented__btn is-active" type="button" data-mode="manual" aria-pressed="true">
              手动拖动
            </button>
            <button class="segmented__btn" type="button" data-mode="auto" aria-pressed="false">
              自动施力
            </button>
          </div>

          <div class="actions">
            <button class="btn btn-primary" type="button" data-action="start">开始</button>
            <button class="btn btn-ghost" type="button" data-action="pause">暂停</button>
            <button class="btn btn-ghost" type="button" data-action="reset">重置</button>
          </div>

          <div class="card__title">实时数据</div>
          <div class="stats" aria-live="polite">
            <div class="stat">
              <div class="stat__k">法向力 N</div>
              <div class="stat__v"><strong data-normal></strong> N</div>
            </div>
            <div class="stat">
              <div class="stat__k">摩擦力上限 μ·N</div>
              <div class="stat__v"><strong data-friction></strong> N</div>
            </div>
            <div class="stat">
              <div class="stat__k">当前施力 F</div>
              <div class="stat__v"><strong data-live-force></strong> N</div>
            </div>
            <div class="stat">
              <div class="stat__k">加速度 a</div>
              <div class="stat__v"><strong data-acc></strong> m/s²</div>
            </div>
            <div class="stat">
              <div class="stat__k">速度 v</div>
              <div class="stat__v"><strong data-vel></strong> m/s</div>
            </div>
          </div>
          <p class="status" data-status></p>
        </div>
      </div>

      <div class="friction__stage" role="region" aria-label="地面与箱子">
        <div class="stage" data-stage>
          <div class="stage__ground" aria-hidden="true"></div>
          <div class="box" data-box role="img" aria-label="箱子（可拖动）">
            <div class="box__label">箱子</div>
            <div class="box__sub">拖动我</div>
          </div>
          <div class="stage__overlay" data-overlay aria-hidden="true"></div>
        </div>
        <div class="stage-hint">
          <span class="pill">提示</span>
          <span>手动模式：在地面上拖动箱子，页面会估算你施加的力。</span>
          <span class="dot">•</span>
          <span>自动模式：设定 F 后点“开始”，系统自动拉动箱子。</span>
        </div>
      </div>
    </section>

    <footer class="friction__footer">
      <a class="link" href="/my-web/">返回待办</a>
      <span class="dot">•</span>
      <span class="muted">简化摩擦模型演示（教学用途）</span>
    </footer>
  </main>
`

const elMass = app.querySelector('[data-mass]')
const muInput = app.querySelector('#mu')
const elMu = app.querySelector('[data-mu]')
const forceInput = app.querySelector('#force')
const elForce = app.querySelector('[data-force]')

const modeButtons = Array.from(app.querySelectorAll('[data-mode]'))
const actionButtons = Array.from(app.querySelectorAll('[data-action]'))

const elNormal = app.querySelector('[data-normal]')
const elFriction = app.querySelector('[data-friction]')
const elLiveForce = app.querySelector('[data-live-force]')
const elAcc = app.querySelector('[data-acc]')
const elVel = app.querySelector('[data-vel]')
const elStatus = app.querySelector('[data-status]')

const stage = app.querySelector('[data-stage]')
const box = app.querySelector('[data-box]')
const overlay = app.querySelector('[data-overlay]')

elMass.textContent = String(massKg)

let mode = 'manual' // manual | auto
let isRunning = false

// Physics state (1D along x)
let xPx = 36
let v = 0 // m/s
let a = 0 // m/s^2

// Manual drag force estimate
let pointerActive = false
let lastPointerX = 0
let lastPointerT = 0
let manualForceN = 0

// Auto force
let autoForceN = Number(forceInput.value)

// Stage geometry mapping
let pxPerMeter = 180 // will be recalculated

function getMu() {
  return Number(muInput.value)
}

function normalForce() {
  return massKg * g
}

function frictionLimit() {
  return getMu() * normalForce()
}

function currentAppliedForce() {
  return mode === 'auto' ? autoForceN : manualForceN
}

function setStatus(text, tone = 'info') {
  elStatus.textContent = text
  elStatus.dataset.tone = tone
}

function updateNumbers() {
  const mu = getMu()
  elMu.textContent = mu.toFixed(2)
  elForce.textContent = String(autoForceN)
  elNormal.textContent = String(round(normalForce(), 1))
  elFriction.textContent = String(round(frictionLimit(), 1))
  elLiveForce.textContent = String(round(currentAppliedForce(), 1))
  elAcc.textContent = String(round(a, 2))
  elVel.textContent = String(round(v, 2))

  if (!isRunning) {
    if (mode === 'auto') setStatus('自动模式已就绪：点击“开始”进行模拟。')
    if (mode === 'manual') setStatus('手动模式已就绪：在地面上拖动箱子。')
  }
}

function updateModeUI() {
  modeButtons.forEach((btn) => {
    const active = btn.dataset.mode === mode
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-pressed', String(active))
  })

  // In manual mode, we ignore auto force during running (still shown as slider)
  forceInput.disabled = mode !== 'auto'

  overlay.textContent = mode === 'manual' ? '手动拖动' : '自动施力'
  overlay.dataset.mode = mode

  updateNumbers()
}

function recalcGeometry() {
  const rect = stage.getBoundingClientRect()
  // Map 1 meter to a reasonable pixel width based on stage size
  pxPerMeter = clamp(rect.width / 4, 140, 240)
}

function clampBoxWithinStage() {
  const stageRect = stage.getBoundingClientRect()
  const boxRect = box.getBoundingClientRect()

  // Convert current xPx relative to stage left
  const maxX = Math.max(16, stageRect.width - boxRect.width - 16)
  xPx = clamp(xPx, 16, maxX)
}

function renderBox() {
  clampBoxWithinStage()
  box.style.transform = `translateX(${xPx}px)`
}

function reset() {
  isRunning = false
  pointerActive = false
  manualForceN = 0
  v = 0
  a = 0
  xPx = 36
  renderBox()
  updateNumbers()
}

function step(dtSeconds) {
  // Determine applied force
  const F = currentAppliedForce()
  const Ff = frictionLimit()

  // If we have force but it doesn't exceed friction, no motion.
  // If moving already, apply friction opposite velocity.
  let net = 0

  if (Math.abs(v) < 1e-3) {
    // static-like behavior
    if (F <= Ff) {
      net = 0
      v = 0
      a = 0
    } else {
      net = F - Ff
      a = net / massKg
      v += a * dtSeconds
    }
  } else {
    // kinetic friction opposes direction of motion
    const frictionDir = v > 0 ? -1 : 1
    const friction = Ff * frictionDir
    net = F + friction
    a = net / massKg
    v += a * dtSeconds

    // stop if velocity changes sign (comes to rest)
    if ((v > 0 && v + a * dtSeconds < 0) || (v < 0 && v + a * dtSeconds > 0)) {
      v = 0
    }
  }

  // Update position (convert meters to px)
  const dxMeters = v * dtSeconds
  xPx += dxMeters * pxPerMeter
  renderBox()

  // Visual cue
  if (Math.abs(v) < 1e-3 && F > 0 && F <= Ff) {
    setStatus('施力不足以克服摩擦：箱子保持静止。', 'warn')
  } else if (F > 0) {
    setStatus('正在拖动：箱子运动中。', 'success')
  } else {
    setStatus('未施力：摩擦将逐渐让箱子停下。', 'info')
  }
}

let rafId = 0
let lastT = 0

function loop(t) {
  if (!isRunning) return

  if (!lastT) lastT = t
  const dt = clamp((t - lastT) / 1000, 0, 0.05)
  lastT = t

  // In manual mode, only simulate while pointer is active; otherwise treat force as 0
  if (mode === 'manual' && !pointerActive) {
    manualForceN = 0
  }

  step(dt)
  updateNumbers()
  rafId = requestAnimationFrame(loop)
}

function start() {
  if (isRunning) return
  isRunning = true
  lastT = 0
  setStatus('模拟开始。', 'info')
  updateNumbers()
  rafId = requestAnimationFrame(loop)
}

function pause() {
  isRunning = false
  manualForceN = 0
  if (rafId) cancelAnimationFrame(rafId)
  setStatus('已暂停。', 'info')
  updateNumbers()
}

function setMode(nextMode) {
  mode = nextMode
  manualForceN = 0
  pause()
  updateModeUI()
}

function estimateForceFromPointer(vxPxPerSec) {
  // Empirical mapping: faster drag => larger force (capped)
  // 0 px/s -> 0 N, ~1200 px/s -> ~240 N
  const k = 0.2
  return clamp(Math.abs(vxPxPerSec) * k, 0, 300)
}

function onPointerDown(event) {
  if (mode !== 'manual') return

  pointerActive = true
  box.setPointerCapture(event.pointerId)
  lastPointerX = event.clientX
  lastPointerT = performance.now()

  setStatus('手动拖动中…', 'info')
}

function onPointerMove(event) {
  if (mode !== 'manual') return
  if (!pointerActive) return

  const now = performance.now()
  const dx = event.clientX - lastPointerX
  const dt = Math.max(1, now - lastPointerT) // ms

  // Move box visually with the finger/mouse
  xPx += dx
  renderBox()

  const vx = (dx / dt) * 1000 // px/s
  manualForceN = estimateForceFromPointer(vx)

  lastPointerX = event.clientX
  lastPointerT = now

  // Keep running loop if user clicks start (optional)
  updateNumbers()
}

function onPointerUp(event) {
  if (mode !== 'manual') return
  pointerActive = false
  manualForceN = 0
  try {
    box.releasePointerCapture(event.pointerId)
  } catch (error) {
    // ignore
  }
  updateNumbers()
}

muInput.addEventListener('input', () => {
  updateNumbers()
})

forceInput.addEventListener('input', () => {
  autoForceN = Number(forceInput.value)
  updateNumbers()
})

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.mode)
  })
})

actionButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action
    if (action === 'start') start()
    if (action === 'pause') pause()
    if (action === 'reset') reset()
  })
})

box.addEventListener('pointerdown', onPointerDown)
box.addEventListener('pointermove', onPointerMove)
box.addEventListener('pointerup', onPointerUp)
box.addEventListener('pointercancel', onPointerUp)

window.addEventListener('resize', () => {
  recalcGeometry()
  renderBox()
})

recalcGeometry()
updateModeUI()
reset()
