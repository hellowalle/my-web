import './style.css'

const PB_BASE = 'https://api.clawdbot.beyondh5.com'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="wheel" aria-label="大转盘抽奖">
    <header class="app__header wheel__header">
      <div class="header-content">
        <span class="pill pill--header">好运来</span>
        <h1>大转盘抽奖</h1>
        <p class="subtitle">输入手机号，点击开始：转盘将按概率停在对应奖品。每个手机号最多中奖一次。</p>
      </div>
    </header>

    <section class="wheel__layout" aria-label="抽奖区域">
      <div class="wheel__panel">
        <div class="card">
          <div class="card__title">参与信息</div>
          <div class="control">
            <label class="control__label" for="phone">手机号</label>
            <input id="phone" class="input" inputmode="numeric" autocomplete="tel" placeholder="请输入手机号" />
            <p class="control__hint">用于限制：每个手机号最多中奖一次。</p>
          </div>

          <div class="card__title">开奖结果</div>
          <div class="result" aria-live="polite">
            <div class="result__name" data-result>等待抽奖…</div>
            <div class="result__sub" data-result-sub>提示：切换到后台可配置奖品库存与概率。</div>
          </div>

          <div class="claim" data-claim hidden>
            <div class="card__title">中奖登记</div>
            <div class="control">
              <label class="control__label" for="name">姓名</label>
              <input id="name" class="input" autocomplete="name" placeholder="请输入姓名" />
            </div>
            <div class="actions">
              <button class="btn btn-primary" type="button" data-claim-submit>提交登记</button>
              <button class="btn btn-ghost" type="button" data-claim-cancel>稍后再填</button>
            </div>
            <p class="control__hint">我们会保存你的手机号与姓名用于领奖联系。</p>
          </div>

          <div class="card__title">后台管理</div>
          <p class="control__hint">
            奖品数量与概率在 PocketBase 后台设置：
            <a class="link" href="https://api.clawdbot.beyondh5.com/_/" target="_blank" rel="noreferrer">打开后台</a>
          </p>
        </div>
      </div>

      <div class="wheel__stage" aria-label="转盘">
        <div class="wheel-stage">
          <canvas class="wheel-canvas" width="520" height="520" data-wheel></canvas>
          <div class="wheel-pointer" aria-hidden="true"></div>
          <button class="wheel-start" type="button" data-start>
            <span class="wheel-start__text">开始</span>
          </button>
        </div>
        <p class="wheel-hint">点击“开始”后将自动旋转减速并停在结果上。</p>
      </div>
    </section>

    <footer class="wheel__footer">
      <a class="link" href="/my-web/">返回待办</a>
      <span class="dot">•</span>
      <a class="link" href="/my-web/friction.html">摩擦力演示</a>
    </footer>
  </main>
`

const phoneInput = app.querySelector('#phone')
const nameInput = app.querySelector('#name')
const startButton = app.querySelector('[data-start]')
const resultEl = app.querySelector('[data-result]')
const resultSubEl = app.querySelector('[data-result-sub]')
const claimBox = app.querySelector('[data-claim]')
const claimSubmit = app.querySelector('[data-claim-submit]')
const claimCancel = app.querySelector('[data-claim-cancel]')
const canvas = app.querySelector('[data-wheel]')
const ctx = canvas.getContext('2d')

let prizes = []
let angle = 0
let spinning = false
let currentDraw = null // { phone, prizeId, prizeName, isWin }

function normalizePhone(raw) {
  return String(raw || '').trim().replace(/\s+/g, '')
}

function setResult(text, sub = '') {
  resultEl.textContent = text
  resultSubEl.textContent = sub
}

function showClaim(show) {
  claimBox.hidden = !show
}

function randomColor(index) {
  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22c55e', '#38bdf8']
  return palette[index % palette.length]
}

function drawWheel() {
  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - 16

  ctx.clearRect(0, 0, w, h)

  // base
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  const count = prizes.length || 6
  const seg = (Math.PI * 2) / count

  for (let i = 0; i < count; i++) {
    const start = i * seg
    const end = start + seg

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, start, end)
    ctx.closePath()

    ctx.fillStyle = prizes[i]?.color || randomColor(i)
    ctx.fill()

    // text
    const label = prizes[i]?.name || '谢谢参与'
    ctx.save()
    ctx.rotate(start + seg / 2)
    ctx.translate(r * 0.62, 0)
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = '800 20px system-ui, -apple-system, Segoe UI, Roboto, PingFang SC, Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 0, r * 0.9)
    ctx.restore()
  }

  // inner circle
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(15,23,42,0.12)'
  ctx.fill()

  ctx.restore()

  // rim
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(15,23,42,0.15)'
  ctx.lineWidth = 8
  ctx.stroke()
}

function indexToStopAngle(index) {
  // pointer at top (0 radians). We want selected segment to align to pointer.
  const seg = (Math.PI * 2) / prizes.length
  const center = index * seg + seg / 2
  // when wheel rotated by angle, segment center at top means angle = -center
  return -center
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

async function pbRequest(path, options = {}) {
  const url = new URL(path, PB_BASE)
  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.message || `请求失败 (${res.status})`
    throw new Error(message)
  }
  return data
}

async function loadPrizes() {
  const data = await pbRequest('/api/lottery/prizes')
  prizes = Array.isArray(data?.items) ? data.items : []
  if (prizes.length === 0) {
    prizes = [
      { id: 'thanks', name: '谢谢参与', color: randomColor(0), isWinning: false },
      { id: 'tv', name: '电视机', color: randomColor(1), isWinning: true },
      { id: 'phone', name: '手机', color: randomColor(2), isWinning: true },
      { id: 'oven', name: '烤箱', color: randomColor(3), isWinning: true },
      { id: 'printer', name: '打印机', color: randomColor(4), isWinning: true },
      { id: 'console', name: '游戏机', color: randomColor(5), isWinning: true },
    ]
  }
  drawWheel()
}

async function runSpinToIndex(targetIndex) {
  const baseSpins = 6
  const duration = 4200
  const startAngle = angle
  const stopAngle = indexToStopAngle(targetIndex)

  // ensure it spins forward multiple rounds then lands
  const targetAngle = startAngle + Math.PI * 2 * baseSpins + (stopAngle - (startAngle % (Math.PI * 2)))

  const t0 = performance.now()

  return new Promise((resolve) => {
    function frame(t) {
      const p = Math.min(1, (t - t0) / duration)
      const e = easeOutCubic(p)
      angle = startAngle + (targetAngle - startAngle) * e
      drawWheel()
      if (p < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

async function drawOnce() {
  const phone = normalizePhone(phoneInput.value)
  if (!/^1\d{10}$/.test(phone)) {
    setResult('请输入正确的手机号（11 位）。')
    phoneInput.focus()
    return
  }

  setResult('正在抽奖…', '转盘旋转中，请稍候')
  showClaim(false)
  currentDraw = null

  const resp = await pbRequest('/api/lottery/draw', {
    method: 'POST',
    body: { phone },
  })

  const idx = resp?.index ?? 0
  const prizeName = resp?.prizeName || '谢谢参与'
  const isWin = Boolean(resp?.isWin)

  spinning = true
  startButton.disabled = true
  await runSpinToIndex(idx)
  spinning = false
  startButton.disabled = false

  currentDraw = { phone, prizeId: resp?.prizeId || null, prizeName, isWin }

  if (isWin) {
    setResult(`恭喜中奖：${prizeName} 🎉`, '请填写姓名并提交登记（手机号已记录）。')
    showClaim(true)
    nameInput.focus()
  } else {
    setResult(`结果：${prizeName}`, '谢谢参与～你仍可继续抽，但中奖手机号只能中一次。')
    showClaim(false)
  }
}

async function submitClaim() {
  if (!currentDraw?.isWin) return
  const name = String(nameInput.value || '').trim()
  if (!name) {
    setResult(`恭喜中奖：${currentDraw.prizeName}`, '请先填写姓名再提交。')
    nameInput.focus()
    return
  }
  try {
    await pbRequest('/api/lottery/claim', {
      method: 'POST',
      body: {
        phone: currentDraw.phone,
        name,
        prizeId: currentDraw.prizeId,
      },
    })
    setResult(`登记成功：${currentDraw.prizeName}`, '我们会按你填写的信息联系领奖。')
    showClaim(false)
  } catch (e) {
    setResult('登记失败', e?.message || '请稍后重试')
  }
}

startButton.addEventListener('click', () => {
  if (spinning) return
  void drawOnce().catch((e) => {
    console.error(e)
    setResult('抽奖失败', e?.message || '请稍后重试')
    startButton.disabled = false
  })
})

claimSubmit.addEventListener('click', () => void submitClaim())
claimCancel.addEventListener('click', () => showClaim(false))

loadPrizes().catch((e) => {
  console.error(e)
  drawWheel()
  setResult('加载奖品失败', '请稍后刷新页面重试。')
})

// initial render
prizes = [
  { id: 'tv', name: '电视机', color: randomColor(0) },
  { id: 'phone', name: '手机', color: randomColor(1) },
  { id: 'oven', name: '烤箱', color: randomColor(2) },
  { id: 'printer', name: '打印机', color: randomColor(3) },
  { id: 'console', name: '游戏机', color: randomColor(4) },
  { id: 'thanks', name: '谢谢参与', color: randomColor(5) },
]

drawWheel()
