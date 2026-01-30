/// <reference path="../types.d.ts" />

// Lottery API v1
// Endpoints:
//  GET  /api/lottery/prizes
//  POST /api/lottery/draw   { phone }
//  POST /api/lottery/claim  { phone, name, prizeId }

routerAdd('GET', '/api/lottery/prizes', (e) => {
  try {
    const prizesCol = $app.findCollectionByNameOrId('prizes')
    const records = $app.findRecordsByFilter(prizesCol, 'enabled = true', '-sort', 200, 0)

    const items = records.map((r) => ({
      id: r.id,
      name: r.getString('name'),
      color: r.getString('color') || '',
      weight: r.getFloat('weight'),
      quantity: r.getInt('quantity'),
      isWinning: r.getBool('isWinning'),
    }))

    return e.json(200, { items, at: new Date().toISOString() })
  } catch (err) {
    console.error('lottery/prizes failed', err)
    return e.json(500, { message: String(err?.message || err) })
  }
})

routerAdd('POST', '/api/lottery/draw', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const phone = String(body.phone || '').trim()

    if (!/^1\d{10}$/.test(phone)) {
      return e.json(400, { message: '手机号格式不正确' })
    }

    const prizesCol = $app.findCollectionByNameOrId('prizes')
    const winnersCol = $app.findCollectionByNameOrId('winners')
    const drawsCol = $app.findCollectionByNameOrId('draws')

    const all = $app.findRecordsByFilter(prizesCol, 'enabled = true', '-sort', 200, 0)
    const thanksRec = all.find((r) => !r.getBool('isWinning'))

    // Already won -> always return THANKS
    let existingWinner = null
    try {
      existingWinner = $app.findFirstRecordByFilter(winnersCol, 'phone = {:phone}', { phone })
    } catch (err) {
      existingWinner = null
    }

    if (existingWinner) {
      const log = new Record(drawsCol)
      log.set('phone', phone)
      log.set('prize', thanksRec ? thanksRec.id : null)
      log.set('isWin', false)
      $app.save(log)

      const idx = Math.max(0, all.findIndex((r) => r.id === (thanksRec ? thanksRec.id : all[0]?.id)))

      return e.json(200, {
        prizeId: thanksRec ? thanksRec.id : null,
        prizeName: thanksRec ? thanksRec.getString('name') : '谢谢参与',
        isWin: false,
        index: idx,
      })
    }

    const items = all.map((r) => ({
      id: r.id,
      name: r.getString('name'),
      weight: r.getFloat('weight'),
      quantity: r.getInt('quantity'),
      isWinning: r.getBool('isWinning'),
    }))

    const eligible = items.filter((p) => {
      if (!p.isWinning) return true
      return (p.quantity || 0) > 0
    })

    const pickWeighted = (prizes) => {
      const total = prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0)
      if (total <= 0) return null
      let r = Math.random() * total
      for (const p of prizes) {
        r -= Number(p.weight) || 0
        if (r <= 0) return p
      }
      return prizes[prizes.length - 1] || null
    }

    let chosen = pickWeighted(eligible)
    if (!chosen) chosen = eligible.find((p) => !p.isWinning) || null
    if (!chosen) return e.json(500, { message: '奖品配置为空，请先在后台配置' })

    let isWin = Boolean(chosen.isWinning)
    let finalPrizeId = chosen.id
    let finalPrizeName = chosen.name

    // If chosen is winning prize, decrement qty and create winner
    if (isWin) {
      const rec = $app.findRecordById(prizesCol, chosen.id)
      const qty = rec.getInt('quantity')

      if (qty <= 0) {
        isWin = false
      } else {
        rec.set('quantity', qty - 1)
        $app.save(rec)

        const winner = new Record(winnersCol)
        winner.set('phone', phone)
        winner.set('name', '')
        winner.set('prize', chosen.id)

        try {
          $app.save(winner)
        } catch (err) {
          // if unique constraint fails, treat as no-win (qty not refunded for simplicity)
          console.error('create winner failed', err)
          isWin = false
        }
      }
    }

    // If not win -> map to thanks
    if (!isWin) {
      finalPrizeId = thanksRec ? thanksRec.id : chosen.id
      finalPrizeName = thanksRec ? thanksRec.getString('name') : '谢谢参与'
    }

    const log = new Record(drawsCol)
    log.set('phone', phone)
    log.set('prize', finalPrizeId)
    log.set('isWin', isWin)
    $app.save(log)

    const index = Math.max(0, all.findIndex((r) => r.id === finalPrizeId))

    return e.json(200, { prizeId: finalPrizeId, prizeName: finalPrizeName, isWin, index })
  } catch (err) {
    console.error('lottery/draw failed', err)
    return e.json(500, { message: String(err?.message || err) })
  }
})

routerAdd('POST', '/api/lottery/claim', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const phone = String(body.phone || '').trim()
    const name = String(body.name || '').trim()
    const prizeId = String(body.prizeId || '').trim()

    if (!/^1\d{10}$/.test(phone)) return e.json(400, { message: '手机号格式不正确' })
    if (!name) return e.json(400, { message: '请填写姓名' })
    if (!prizeId) return e.json(400, { message: '奖品信息缺失' })

    const winnersCol = $app.findCollectionByNameOrId('winners')

    let winner = null
    try {
      winner = $app.findFirstRecordByFilter(winnersCol, 'phone = {:phone}', { phone })
    } catch (err) {
      winner = null
    }
    if (!winner) return e.json(404, { message: '未找到中奖记录' })

    if (winner.getString('prize') !== prizeId) {
      return e.json(400, { message: '奖品不匹配' })
    }

    winner.set('name', name)
    $app.save(winner)

    return e.json(200, { ok: true })
  } catch (err) {
    console.error('lottery/claim failed', err)
    return e.json(500, { message: String(err?.message || err) })
  }
})
