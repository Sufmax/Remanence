"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SpeciesId, Contree, Forme, HueName } from "@/lib/remanence/types"
import type { SessionResult } from "@/lib/remanence/progression"
import { RGB, SPECIES, BOUQUETS, CONTREES, FORMES } from "@/lib/remanence/content"

/**
 * RÉMANENCE — moteur de jeu (surface jouable).
 *
 * Verbe central : PRÉLEVER. On touche une fleur lumineuse avant qu'elle
 * ne s'éteigne ; sa lumière file vers la Veilleuse, qui glisse jusqu'à elle.
 *
 * Objectif : composer des BOUQUETS. Chaque fleur prélevée remplit le bouquet
 * en cours. Bouquet noué = Éclats + Souvenirs.
 *
 * Espèces distinctes (silhouette + teinte) → différenciation facile et rapide :
 *   lotus (rose), astre (ambre), clochette (bleu), ombelle (vert), luce (or, rare).
 *
 * SOUFFLE : jauge de temps. Prélever la regonfle ; l'inaction la vide.
 * Quand le souffle s'éteint, la session se clôt en douceur. C'est la réponse
 * à « que faire quand on n'a plus de temps » : le souffle EST le temps.
 *
 * COMMUNION : prélever la même espèce d'affilée → bonus de cadence et d'Éclats.
 *
 * Perf : toutes les lueurs / silhouettes sont pré-rendues hors-écran.
 */

type Vec = { x: number; y: number }
type FlowerState = "dormant" | "glowing" | "spending" | "extinguished" | "lost"

type Flower = {
  pos: Vec
  species: SpeciesId
  state: FlowerState
  seed: number
  glow: number
  remanence: number
  importance: number
  cherished: boolean
  scale: number
  branch: number
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  life: number
  maxLife: number
  hue: HueName
  size: number
  shard: boolean
}

type Bead = { from: Vec; to: Vec; ctrl: Vec; t: number; hue: HueName }
type Sprite = { canvas: HTMLCanvasElement; cx: number; cy: number }

const AMBER_DUST = "180, 120, 70"

function hueRGB(h: HueName) {
  return RGB[h]
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/* ----------------------------------------------------------------------- */
/* offscreen sprite caches (built once) — kills per-frame gradients/blur    */
/* ----------------------------------------------------------------------- */

const glowCache: Record<string, HTMLCanvasElement> = {}
function getGlowSprite(rgb: string): HTMLCanvasElement {
  const cached = glowCache[rgb]
  if (cached) return cached
  const size = 128
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const cx = c.getContext("2d")!
  const grd = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, `rgba(${rgb}, 1)`)
  grd.addColorStop(0.32, `rgba(${rgb}, 0.42)`)
  grd.addColorStop(0.7, `rgba(${rgb}, 0.08)`)
  grd.addColorStop(1, `rgba(${rgb}, 0)`)
  cx.fillStyle = grd
  cx.fillRect(0, 0, size, size)
  glowCache[rgb] = c
  return c
}

const spriteCache: Record<string, Sprite> = {}
function getFlowerSprite(species: SpeciesId, rgb: string): Sprite {
  const key = `${species}_${rgb}`
  const cached = spriteCache[key]
  if (cached) return cached
  const W = 280
  const H = 340
  const cx = 140
  const cy = 150
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const x = c.getContext("2d")!
  x.translate(cx, cy)
  x.globalCompositeOperation = "lighter"
  x.shadowBlur = 8
  x.shadowColor = `rgba(${rgb}, 0.85)`
  if (species === "lotus") bakeLotus(x, rgb)
  else if (species === "astre") bakeAstre(x, rgb)
  else if (species === "clochette") bakeClochette(x, rgb)
  else if (species === "ombelle") bakeOmbelle(x, rgb)
  else bakeLuce(x, rgb)
  const sprite = { canvas: c, cx, cy }
  spriteCache[key] = sprite
  return sprite
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const s = getGlowSprite(rgb)
  const d = r * 8
  ctx.globalAlpha = clamp(a, 0, 1)
  ctx.drawImage(s, x - d / 2, y - d / 2, d, d)
  ctx.globalAlpha = 1
}

/* ----------------------------------------------------------------------- */

type GameProps = {
  contree?: Contree
  forme?: Forme
  onEnd?: (result: SessionResult) => void
  onExit?: () => void
  standalone?: boolean // show its own title screen (for isolated testing)
}

const DEFAULT_CONTREE = CONTREES[0]
const DEFAULT_FORME = FORMES[0]

export default function RemanenceGame({
  contree = DEFAULT_CONTREE,
  forme = DEFAULT_FORME,
  onEnd,
  onExit,
  standalone = true,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [phase, setPhase] = useState<"title" | "playing" | "paused" | "end">(
    standalone ? "title" : "playing",
  )
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // latest props in refs (loop reads these without re-subscribing)
  const contreeRef = useRef(contree)
  contreeRef.current = contree
  const formeRef = useRef(forme)
  formeRef.current = forme
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  const settings = useRef({ halos: true, whispers: true, reduce: false })

  // result snapshot for the end screen
  const [result, setResult] = useState<SessionResult | null>(null)

  const game = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    cameraY: 0,
    wisp: { x: 0, y: 0 } as Vec,
    wispTarget: null as Vec | null,
    travel: 0,
    travelFrom: { x: 0, y: 0 } as Vec,
    flowers: [] as Flower[],
    pathPts: [] as { x: number; y: number }[],
    particles: [] as Particle[],
    beads: [] as Bead[],
    stars: [] as { x: number; y: number; r: number; tw: number; depth: number }[],
    nebula: [] as { x: number; y: number; r: number; hue: HueName; a: number }[],
    pointer: { x: 0, y: 0, active: false, downAt: { x: 0, y: 0 } },
    aim: null as Flower | null,
    spent: 0,
    sourceY: 0,
    started: false,
    time: 0,
    hint: 1,
    note: "",
    noteLife: 0,
    flash: 0,
    flow: 0, // cadence 0..1
    branchCounter: 0,
    // --- session economy ---
    eclats: 0,
    souvenirs: 0,
    souffle: 1, // time gauge 1..0
    souffleEverLow: false,
    ended: false,
    // communion
    lastSpecies: null as SpeciesId | null,
    communion: 0,
    bestCommunion: 0,
    luce: 0,
    speciesSeen: new Set<SpeciesId>(),
    // bouquet
    bouquetIdx: 0,
    bouquetCollected: 0,
    bouquetsTied: 0,
    bouquetPulse: 0,
  })

  // ---- weighted species pick for the active contrée ---------------------
  const pickSpecies = useCallback(() => {
    const list = contreeRef.current.species
    let total = 0
    for (const id of list) total += SPECIES[id].rarity
    let r = Math.random() * total
    for (const id of list) {
      r -= SPECIES[id].rarity
      if (r <= 0) return id
    }
    return list[0]
  }, [])

  // ---- world generation -------------------------------------------------
  const buildWorld = useCallback(() => {
    const g = game.current
    const w = g.w
    const c = contreeRef.current

    // warm sprite caches for this contrée's species
    for (const id of c.species) getFlowerSprite(id, RGB[SPECIES[id].cherishedChance > 0 ? SPECIES[id].hue : SPECIES[id].hue])
    for (const id of c.species) {
      getFlowerSprite(id, RGB[SPECIES[id].hue])
      getFlowerSprite(id, RGB.rose) // cherished variant
    }
    getGlowSprite(RGB.cold)
    getGlowSprite(RGB.amber)
    getGlowSprite(RGB.rose)
    getGlowSprite(RGB.gold)
    getGlowSprite(RGB.verdant)
    getGlowSprite(AMBER_DUST)

    const flowers: Flower[] = []
    let y = -40
    let branch = 0
    const COUNT = 34
    for (let i = 0; i < COUNT; i++) {
      const fork = i > 3 && i % 4 === 0
      y -= lerp(150, 210, Math.random())
      if (fork) {
        branch++
        const baseY = y
        flowers.push(makeFlower(w * (0.24 + Math.random() * 0.08), baseY - Math.random() * 40, pickSpecies(), branch))
        flowers.push(makeFlower(w * (0.68 + Math.random() * 0.08), baseY - Math.random() * 40, pickSpecies(), branch))
      } else {
        branch++
        const x = w * (0.3 + Math.random() * 0.4) + Math.sin(i * 1.2) * w * 0.06
        flowers.push(makeFlower(x, y, pickSpecies(), branch))
      }
    }
    g.flowers = flowers
    g.branchCounter = branch
    g.sourceY = y - 300

    g.stars = []
    const span = Math.abs(g.sourceY) + g.h * 2
    for (let i = 0; i < 220; i++) {
      g.stars.push({
        x: Math.random() * w,
        y: -Math.random() * span,
        r: Math.random() * 1.4 + 0.2,
        tw: Math.random() * Math.PI * 2,
        depth: 0.25 + Math.random() * 0.6,
      })
    }
    g.nebula = []
    for (let i = 0; i < 22; i++) {
      const roll = Math.random()
      g.nebula.push({
        x: Math.random() * w,
        y: -Math.random() * span,
        r: lerp(140, 380, Math.random()),
        hue: roll < 0.7 ? c.nebulaHue : "cold",
        a: lerp(0.05, 0.14, Math.random()),
      })
    }

    g.wisp = { x: w * 0.5, y: -40 }
    g.pathPts = [{ x: g.wisp.x, y: g.wisp.y }]
    g.cameraY = g.wisp.y - g.h * 0.58
    g.wispTarget = null
    g.travel = 0
    g.particles = []
    g.beads = []
    g.spent = 0
    g.started = true
    g.time = 0
    g.hint = 1
    g.note = ""
    g.noteLife = 0
    g.flash = 0
    g.flow = 0
    g.aim = null
    // reset session economy
    g.eclats = 0
    g.souvenirs = 0
    g.souffle = 1
    g.souffleEverLow = false
    g.ended = false
    g.lastSpecies = null
    g.communion = 0
    g.bestCommunion = 0
    g.luce = 0
    g.speciesSeen = new Set()
    g.bouquetIdx = 0
    g.bouquetCollected = 0
    g.bouquetsTied = 0
    g.bouquetPulse = 0
    awakenNext()
  }, [pickSpecies])

  function makeFlower(x: number, y: number, species: SpeciesId, branch: number): Flower {
    const def = SPECIES[species]
    const cherished = def.cherishedChance > 0 && Math.random() < def.cherishedChance
    return {
      pos: { x, y },
      species,
      state: "dormant",
      seed: Math.random() * 1000,
      glow: 0,
      remanence: 1,
      // longer windows than the previous prototype → differentiation is
      // easier & less punishing, scaled by species linger.
      importance: (cherished ? 1.9 : 1.35) * def.lingerMul,
      cherished,
      scale: lerp(0.9, 1.15, Math.random()),
      branch,
    }
  }

  // wake the next branch (keep ~2 branches alive for rhythm)
  const awakenNext = useCallback(() => {
    const g = game.current
    const wakeOneBranch = () => {
      const ahead = g.flowers.filter((m) => m.state === "dormant" && m.pos.y < g.wisp.y - 12)
      if (ahead.length === 0) return false
      let minBranch = Infinity
      for (const m of ahead) minBranch = Math.min(minBranch, m.branch)
      for (const m of ahead) {
        if (m.branch === minBranch) {
          m.state = "glowing"
          m.remanence = 1
        }
      }
      return true
    }
    const glowingBranches = new Set(g.flowers.filter((m) => m.state === "glowing").map((m) => m.branch))
    let guard = 0
    while (glowingBranches.size < 2 && guard < 4) {
      if (!wakeOneBranch()) break
      g.flowers.forEach((m) => m.state === "glowing" && glowingBranches.add(m.branch))
      guard++
    }
  }, [])

  // ---- resize -----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const g = game.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      g.dpr = dpr
      g.w = w
      g.h = h
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      if (!g.started) buildWorld()
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [buildWorld])

  // if mounted directly into "playing" (hub mode), build immediately
  useEffect(() => {
    if (!standalone && !game.current.started && game.current.w) buildWorld()
  }, [standalone, buildWorld])

  // ---- interaction ------------------------------------------------------
  const screenToWorld = useCallback((sx: number, sy: number): Vec => {
    const g = game.current
    return { x: sx, y: sy + g.cameraY }
  }, [])

  const findGlowingAt = useCallback(
    (sx: number, sy: number, radius: number): Flower | null => {
      const g = game.current
      const world = screenToWorld(sx, sy)
      let hit: Flower | null = null
      let best = radius
      for (const m of g.flowers) {
        if (m.state !== "glowing") continue
        const d = dist(m.pos, world)
        if (d < best) {
          best = d
          hit = m
        }
      }
      return hit
    },
    [screenToWorld],
  )

  const currentBouquet = () => BOUQUETS[game.current.bouquetIdx % BOUQUETS.length]

  const tieBouquet = useCallback(() => {
    const g = game.current
    const recipe = currentBouquet()
    g.eclats += recipe.eclats
    g.souvenirs += recipe.souvenirs
    g.bouquetsTied++
    g.bouquetPulse = 1
    g.souffle = clamp(g.souffle + 0.18, 0, 1) // a tied bouquet is a breath
    whisper(`bouquet noué — ${recipe.nom}`)
    spawnDissolve(g.wisp, "rose", 30)
    g.bouquetIdx++
    g.bouquetCollected = 0
  }, [])

  const prelever = useCallback(
    (hit: Flower) => {
      const g = game.current
      if (g.wispTarget) return
      const def = SPECIES[hit.species]
      hit.state = "spending"
      g.hint = 0
      g.flash = 1
      g.flow = clamp(g.flow + (hit.remanence > 0.5 ? 0.22 : 0.1), 0, 1)
      g.spent++
      g.speciesSeen.add(hit.species)

      // souffle: each prélèvement is a breath; brighter = deeper breath
      g.souffle = clamp(g.souffle + 0.1 + hit.remanence * 0.05, 0, 1)

      // communion streak (same species in a row)
      if (g.lastSpecies === hit.species) g.communion++
      else g.communion = 1
      g.lastSpecies = hit.species
      g.bestCommunion = Math.max(g.bestCommunion, g.communion)

      // éclats: base + cherished bonus + communion bonus + luce jackpot
      let gain = def.eclats
      if (hit.cherished) gain += 3
      if (g.communion >= 3) gain += Math.min(6, g.communion - 2) // ramping bonus
      g.eclats += gain
      if (hit.species === "luce") {
        g.luce++
        whisper("une Luce ! — l'or rare du monde")
        g.souffle = clamp(g.souffle + 0.15, 0, 1)
      } else if (g.communion === 3) {
        whisper("communion — la même lumière, encore")
      }

      // bouquet fill (species-locked recipes only accept their flower)
      const recipe = currentBouquet()
      if (!recipe.species || recipe.species === hit.species) {
        g.bouquetCollected++
        if (g.bouquetCollected >= recipe.need) tieBouquet()
      }

      const hue: HueName = hit.cherished ? "rose" : def.hue
      const ctrl = {
        x: (hit.pos.x + g.wisp.x) / 2 + (hit.pos.x > g.wisp.x ? 50 : -50),
        y: (hit.pos.y + g.wisp.y) / 2 - 70,
      }
      g.beads.push({ from: { ...hit.pos }, to: { ...g.wisp }, ctrl, t: 0, hue })
      spawnDissolve(hit.pos, hue, hit.species === "luce" ? 54 : 36)

      // siblings in the same branch are lost forever
      for (const m of g.flowers) {
        if (m.branch === hit.branch && m !== hit && m.state === "glowing") {
          m.state = "lost"
          spawnDissolve(m.pos, "cold", 12)
        }
      }

      g.travelFrom = { ...g.wisp }
      g.wispTarget = { ...hit.pos }
      g.travel = 0
      awakenNext()
    },
    [awakenNext, tieBouquet],
  )

  function whisper(text: string) {
    const g = game.current
    if (!settings.current.whispers) return
    g.note = text
    g.noteLife = 1
  }

  function spawnDissolve(p: Vec, hue: HueName, n: number) {
    const g = game.current
    const reduce = settings.current.reduce
    const count = reduce ? Math.ceil(n * 0.5) : n
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = Math.random() * 0.8 + 0.05
      const shard = Math.random() < 0.5
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 22,
        y: p.y + (Math.random() - 0.5) * 22,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.2,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.2,
        life: 1,
        maxLife: lerp(0.8, 2.0, Math.random()),
        hue,
        size: shard ? Math.random() * 2.6 + 0.8 : Math.random() * 1.6 + 0.4,
        shard,
      })
    }
  }

  // close the session and report the result
  const finish = useCallback((souffleVivant: boolean) => {
    const g = game.current
    if (g.ended) return
    g.ended = true
    const res: SessionResult = {
      eclats: g.eclats,
      souvenirs: g.souvenirs,
      prelever: g.spent,
      bouquets: g.bouquetsTied,
      meilleureCommunion: g.bestCommunion,
      luce: g.luce,
      especes: g.speciesSeen.size,
      souffleVivant,
    }
    setResult(res)
    onEndRef.current?.(res)
    setPhase("end")
  }, [])

  // pointer handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const getXY = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      if (phaseRef.current !== "playing") return
      const g = game.current
      const { x, y } = getXY(e)
      g.pointer = { x, y, active: true, downAt: { x, y } }
      g.aim = findGlowingAt(x, y, 104)
    }
    const move = (e: PointerEvent) => {
      const g = game.current
      const { x, y } = getXY(e)
      g.pointer.x = x
      g.pointer.y = y
      if (g.pointer.active && !g.aim) g.aim = findGlowingAt(x, y, 104)
    }
    const up = (e: PointerEvent) => {
      const g = game.current
      if (phaseRef.current === "playing" && g.pointer.active) {
        const { x, y } = getXY(e)
        const target = g.aim || findGlowingAt(x, y, 104)
        if (target && target.state === "glowing") prelever(target)
      }
      g.pointer.active = false
      g.aim = null
    }
    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [findGlowingAt, prelever])

  // ---- main loop --------------------------------------------------------
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const update = (dt: number) => {
      const g = game.current
      g.time += dt
      if (g.noteLife > 0) g.noteLife = Math.max(0, g.noteLife - dt * 0.4)
      if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 1.8)
      if (g.bouquetPulse > 0) g.bouquetPulse = Math.max(0, g.bouquetPulse - dt * 1.2)

      // cadence decay
      g.flow = Math.max(0, g.flow - dt * 0.14)
      const tempo = 1 + g.flow * 0.7

      // SOUFFLE drains with time; faster as cadence falls. This is "le temps".
      const drain = 0.05 + (1 - g.flow) * 0.018
      g.souffle = clamp(g.souffle - dt * drain, 0, 1)
      if (g.souffle < 0.25) g.souffleEverLow = true
      if (g.souffle <= 0 && !g.ended && phaseRef.current === "playing") {
        finish(false)
      }

      for (const b of g.beads) b.t += dt * 1.9
      if (g.beads.length) g.beads = g.beads.filter((b) => b.t < 1)

      // glide
      if (g.wispTarget) {
        g.travel += dt * (1.35 * tempo)
        const t = easeInOut(Math.min(1, g.travel))
        const nx = lerp(g.travelFrom.x, g.wispTarget.x, t)
        const ny = lerp(g.travelFrom.y, g.wispTarget.y, t)
        const prev = g.wisp
        g.wisp = { x: nx, y: ny }
        if (dist(prev, g.wisp) > 6) {
          g.pathPts.push({ x: g.wisp.x, y: g.wisp.y })
          if (!settings.current.reduce && Math.random() < 0.7) spawnDissolve(prev, "cold", 2)
        }
        if (g.travel >= 1) {
          g.wispTarget = null
          g.travel = 0
          const m = g.flowers.find((mm) => mm.state === "spending")
          if (m) m.state = "extinguished"
          awakenNext()
        }
      }

      // camera
      const desired = g.wisp.y - g.h * 0.58
      g.cameraY = lerp(g.cameraY, desired, 1 - Math.pow(0.0009, dt))

      // particles
      const ps = g.particles
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60
        p.vx *= 0.985
        p.vy *= 0.985
        p.rot += p.vrot
        p.life -= dt / p.maxLife
      }
      if (ps.length > 360) ps.splice(0, ps.length - 360)
      if (ps.length) g.particles = ps.filter((p) => p.life > 0)

      // flower glow + rémanence countdown
      for (const m of g.flowers) {
        if (m.state === "glowing") {
          m.glow = lerp(m.glow, 1, dt * 2.6)
          m.remanence -= dt / (4.6 * m.importance)
          if (m.remanence <= 0) {
            m.state = "lost"
            g.flow = Math.max(0, g.flow - 0.2)
            g.communion = 0
            g.lastSpecies = null
            spawnDissolve(m.pos, SPECIES[m.species].hue, 16)
            const branchAlive = g.flowers.some((mm) => mm.branch === m.branch && mm.state === "glowing")
            if (!branchAlive) awakenNext()
          }
        } else if (m.state === "spending") {
          m.glow = lerp(m.glow, 0, dt * 1.8)
        } else if (m.state === "lost") {
          m.glow = lerp(m.glow, 0, dt * 1.4)
        } else {
          m.glow = lerp(m.glow, 0, dt * 2)
        }
      }

      if (g.pathPts.length > 160) g.pathPts.splice(0, g.pathPts.length - 160)

      if (g.wisp.y <= g.sourceY + 90 && !g.wispTarget && !g.ended) finish(true)
    }

    const render = () => {
      const g = game.current
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const { w, h } = g
      if (!w || !h) return
      const c = contreeRef.current
      const halos = settings.current.halos
      ctx.save()
      ctx.scale(g.dpr, g.dpr)

      // background (per-contrée palette)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, c.bgTop)
      bg.addColorStop(0.5, c.bgMid)
      bg.addColorStop(1, c.bgBottom)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // nebula
      if (halos) {
        ctx.globalCompositeOperation = "screen"
        for (const cl of g.nebula) {
          const sy = cl.y - g.cameraY * 0.5
          if (sy < -cl.r || sy > h + cl.r) continue
          const sprite = getGlowSprite(cl.hue === "amber" ? AMBER_DUST : RGB[cl.hue])
          ctx.globalAlpha = cl.a
          ctx.drawImage(sprite, cl.x - cl.r, sy - cl.r, cl.r * 2, cl.r * 2)
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
      }

      // Source glow as it nears
      const climb = clamp(Math.abs(g.cameraY) / Math.max(1, Math.abs(g.sourceY)), 0, 1)
      if (climb > 0.3) {
        const sprite = getGlowSprite(RGB.amber)
        const r = h * 1.1
        ctx.globalCompositeOperation = "screen"
        ctx.globalAlpha = (climb - 0.3) * 0.5
        ctx.drawImage(sprite, w / 2 - r, -r * 0.7, r * 2, r * 2)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
      }

      // stars
      for (const s of g.stars) {
        const screenY = s.y - g.cameraY * s.depth
        const m = ((screenY % (h + 200)) + (h + 200)) % (h + 200)
        const a = 0.18 + (Math.sin(g.time * 1.1 + s.tw) * 0.5 + 0.5) * 0.4
        ctx.fillStyle = `rgba(${RGB.cold}, ${a * s.depth * 0.7})`
        ctx.beginPath()
        ctx.arc(s.x, m - 100, s.r * s.depth, 0, Math.PI * 2)
        ctx.fill()
      }

      const srcScreenY = g.sourceY - g.cameraY
      if (srcScreenY < h + 160) drawSource(ctx, w / 2, srcScreenY, g.time)

      drawConstellationRoute(ctx, g)
      drawWake(ctx, g)

      ctx.globalCompositeOperation = "lighter"

      // flowers
      for (const m of g.flowers) {
        const sy = m.pos.y - g.cameraY
        if (sy < -200 || sy > h + 200) continue
        if (m.state === "extinguished") continue
        drawFlower(ctx, m, m.pos.x, sy, g.time)
      }

      // beads
      for (const b of g.beads) {
        const fy = b.from.y - g.cameraY
        const ty = b.to.y - g.cameraY
        const cy = b.ctrl.y - g.cameraY
        const t = b.t
        const x = (1 - t) * (1 - t) * b.from.x + 2 * (1 - t) * t * b.ctrl.x + t * t * b.to.x
        const y = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * cy + t * t * ty
        ctx.strokeStyle = `rgba(${hueRGB(b.hue)}, ${0.25 * (1 - t)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(b.from.x, fy)
        ctx.quadraticCurveTo(b.ctrl.x, cy, x, y)
        ctx.stroke()
        glowDot(ctx, x, y, 5, hueRGB(b.hue), 1 - t * 0.3)
      }

      // particles
      for (const p of g.particles) {
        const sy = p.y - g.cameraY
        if (sy < -40 || sy > h + 40) continue
        const rgb = hueRGB(p.hue)
        if (p.shard) {
          ctx.save()
          ctx.translate(p.x, sy)
          ctx.rotate(p.rot)
          ctx.fillStyle = `rgba(${rgb}, ${p.life * 0.8})`
          const s = p.size * (0.4 + p.life * 0.6)
          ctx.beginPath()
          ctx.moveTo(0, -s)
          ctx.lineTo(s * 0.7, 0)
          ctx.lineTo(0, s)
          ctx.lineTo(-s * 0.7, 0)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        } else {
          ctx.fillStyle = `rgba(${rgb}, ${p.life * 0.7})`
          ctx.beginPath()
          ctx.arc(p.x, sy, p.size * p.life, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const fm = formeRef.current
      drawWisp(ctx, g.wisp.x, g.wisp.y - g.cameraY, g.time, g.flow, fm)

      ctx.globalCompositeOperation = "source-over"

      // aim link
      if (g.aim && g.pointer.active) {
        const ay = g.aim.pos.y - g.cameraY
        const ah = g.aim.cherished ? RGB.rose : RGB[SPECIES[g.aim.species].hue]
        ctx.strokeStyle = `rgba(${ah}, 0.4)`
        ctx.lineWidth = 1
        ctx.setLineDash([2, 5])
        ctx.beginPath()
        ctx.moveTo(g.pointer.x, g.pointer.y)
        ctx.lineTo(g.aim.pos.x, ay)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // onboarding pulse
      if (halos && g.hint > 0.02 && g.spent === 0) {
        const target = g.flowers.find((m) => m.state === "glowing")
        if (target) {
          const sy = target.pos.y - g.cameraY
          const r = 34 + Math.sin(g.time * 3) * 7
          ctx.strokeStyle = `rgba(${RGB.amber}, ${0.45 * g.hint})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(target.pos.x, sy, r, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      if (g.pointer.active) glowDot(ctx, g.pointer.x, g.pointer.y, 3, RGB.cold, 0.4)

      if (g.flash > 0.01) {
        ctx.fillStyle = `rgba(${RGB.amber}, ${g.flash * 0.05})`
        ctx.fillRect(0, 0, w, h)
      }

      drawSoundwave(ctx, w, h, g.time, g.flow)
      drawHUD(ctx, g)

      // vignette tied to souffle (low souffle = the world closes in)
      const low = 1 - g.souffle
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * (0.34 - low * 0.14), w / 2, h / 2, h * 0.78)
      vg.addColorStop(0, "rgba(0,0,0,0)")
      vg.addColorStop(1, `rgba(0,0,0,${0.5 + low * 0.32})`)
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)

      if (g.noteLife > 0) {
        ctx.font = "300 15px var(--font-geist-sans, sans-serif)"
        ctx.textAlign = "center"
        ctx.fillStyle = `rgba(${RGB.cold}, ${Math.min(1, g.noteLife * 1.4) * 0.7})`
        ctx.fillText(g.note, w / 2, h * 0.42)
      }

      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (phaseRef.current === "playing") update(dt)
      render()
      raf = requestAnimationFrame(loop)
    }

    // deterministic stepping hook for automated testing
    ;(window as unknown as { advanceTime?: (ms: number) => void }).advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)))
      for (let i = 0; i < steps; i++) if (phaseRef.current === "playing") update(1 / 60)
      render()
    }
    ;(window as unknown as { render_game_to_text?: () => string }).render_game_to_text = () => {
      const g = game.current
      const recipe = BOUQUETS[g.bouquetIdx % BOUQUETS.length]
      return JSON.stringify({
        note: "origin top-left; y grows downward; world scrolls upward as you climb",
        phase: phaseRef.current,
        contree: contreeRef.current.id,
        forme: formeRef.current.id,
        wisp: { x: Math.round(g.wisp.x), y: Math.round(g.wisp.y) },
        souffle: +g.souffle.toFixed(2),
        flow: +g.flow.toFixed(2),
        eclats: g.eclats,
        souvenirs: g.souvenirs,
        communion: g.communion,
        bestCommunion: g.bestCommunion,
        luce: g.luce,
        bouquet: { nom: recipe.nom, collected: g.bouquetCollected, need: recipe.need, tied: g.bouquetsTied },
        glowing: g.flowers
          .filter((m) => m.state === "glowing")
          .map((m) => ({
            x: Math.round(m.pos.x),
            y: Math.round(m.pos.y),
            screenY: Math.round(m.pos.y - g.cameraY),
            species: m.species,
            cherished: m.cherished,
            remanence: +m.remanence.toFixed(2),
          })),
      })
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [awakenNext, finish])

  const start = () => {
    buildWorld()
    setResult(null)
    setPhase("playing")
  }
  const toggle = (key: "halos" | "whispers" | "reduce") => {
    settings.current[key] = !settings.current[key]
  }

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-[#020308] touch-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {phase === "playing" && (
        <>
          {onExit && (
            <button
              aria-label="Sanctuaire"
              onClick={() => onExit()}
              style={{
                top: "calc(1rem + env(safe-area-inset-top))",
                left: "calc(1rem + env(safe-area-inset-left))",
              }}
              className="absolute grid size-11 place-items-center rounded-full border border-[rgba(255,178,92,0.18)] bg-[rgba(8,10,18,0.4)] text-[rgba(255,200,140,0.8)] backdrop-blur-sm transition-colors hover:border-[rgba(255,178,92,0.4)] hover:text-[rgba(255,210,160,1)]"
            >
              <HomeIcon />
            </button>
          )}
          <button
            aria-label="Pause"
            onClick={() => setPhase("paused")}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-[rgba(255,178,92,0.18)] bg-[rgba(8,10,18,0.4)] text-[rgba(255,200,140,0.8)] backdrop-blur-sm transition-colors hover:border-[rgba(255,178,92,0.4)] hover:text-[rgba(255,210,160,1)]"
          >
            <span className="flex gap-[5px]">
              <span className="block h-4 w-[2px] rounded bg-current" />
              <span className="block h-4 w-[2px] rounded bg-current" />
            </span>
          </button>
        </>
      )}

      {phase === "title" && (
        <Overlay>
          <h1 className="pl-[0.3em] text-center text-[clamp(1.7rem,8.5vw,3.6rem)] font-extralight tracking-[0.32em] text-[rgba(232,240,255,0.92)]">
            RÉMANENCE
          </h1>
          <p className="mt-6 max-w-xs text-center text-sm font-light leading-relaxed tracking-wide text-[rgba(210,232,255,0.45)]">
            Un monde qui s&apos;efface. Une seule lumière.
            <br />
            Cueillez la lumière. Nouez des bouquets. Laissez partir le reste.
          </p>
          <button
            onClick={start}
            className="mt-12 rounded-full border border-[rgba(255,178,92,0.4)] px-10 py-3 text-sm font-light tracking-[0.25em] text-[rgba(255,178,92,0.85)] transition-colors hover:bg-[rgba(255,178,92,0.08)]"
          >
            EFFLEURER
          </button>
          <p className="mt-10 max-w-[18rem] text-center text-xs font-light leading-relaxed text-[rgba(210,232,255,0.3)]">
            Touchez une fleur avant qu&apos;elle ne s&apos;éteigne. Cueillez la même espèce en chaîne pour une communion.
            Le souffle est votre temps : il se ravive à chaque cueillette.
          </p>
        </Overlay>
      )}

      {phase === "paused" && (
        <Overlay>
          <h2 className="text-2xl font-extralight tracking-[0.3em] text-[rgba(232,240,255,0.85)]">SUSPENDU</h2>
          <div className="mt-10 flex flex-col items-center gap-5">
            <MenuButton onClick={() => setPhase("playing")}>REPRENDRE</MenuButton>
            <MenuButton onClick={start}>RECOMMENCER</MenuButton>
            {onExit && <MenuButton onClick={() => onExit()}>SANCTUAIRE</MenuButton>}
          </div>
          <div className="mt-10 flex w-64 flex-col gap-5 text-[rgba(210,232,255,0.55)]">
            <Toggle label="Halos" initial={settings.current.halos} onChange={() => toggle("halos")} />
            <Toggle label="Murmures" initial={settings.current.whispers} onChange={() => toggle("whispers")} />
            <Toggle label="Mouvement réduit" initial={settings.current.reduce} onChange={() => toggle("reduce")} />
          </div>
        </Overlay>
      )}

      {phase === "end" && result && (
        <Overlay>
          <p className="text-center text-xs font-light uppercase tracking-[0.3em] text-[rgba(210,232,255,0.4)]">
            {result.souffleVivant ? "tu as rejoint la source" : "le souffle s'est éteint"}
          </p>
          <p className="mt-5 max-w-sm text-center text-base font-light italic leading-loose tracking-wide text-[rgba(232,240,255,0.8)]">
            {result.souffleVivant
              ? "« Tu as tout éteint derrière toi. Et c'est ainsi que tu es arrivée. »"
              : "« Le temps n'était qu'un souffle. Il s'en est allé, comme le reste. »"}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-3 text-sm font-light">
            <Stat label="Éclats" value={`+${result.eclats}`} hue="amber" />
            <Stat label="Souvenirs" value={`+${result.souvenirs}`} hue="cold" />
            <Stat label="Bouquets" value={`${result.bouquets}`} hue="rose" />
            <Stat label="Communion" value={`${result.meilleureCommunion}`} hue="cold" />
            {result.luce > 0 && <Stat label="Luce" value={`${result.luce}`} hue="gold" />}
            <Stat label="Espèces" value={`${result.especes}`} hue="verdant" />
          </div>
          <div className="mt-10 flex items-center gap-8">
            <button
              onClick={start}
              className="rounded-full border border-[rgba(255,178,92,0.4)] px-9 py-3 text-sm font-light tracking-[0.22em] text-[rgba(255,178,92,0.85)] transition-colors hover:bg-[rgba(255,178,92,0.08)]"
            >
              REVENIR
            </button>
            {onExit && (
              <button
                onClick={() => onExit()}
                className="text-sm font-light tracking-[0.22em] text-[rgba(210,232,255,0.55)] transition-colors hover:text-[rgba(232,240,255,0.95)]"
              >
                SANCTUAIRE
              </button>
            )}
          </div>
        </Overlay>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* drawing helpers                                                          */
/* ----------------------------------------------------------------------- */

function drawWisp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  flow: number,
  forme: Forme,
) {
  const hue = RGB[forme.hue]
  glowDot(ctx, x, y, 11 + flow * 3, hue, 0.85)
  ctx.fillStyle = `rgba(${forme.core}, 0.98)`
  ctx.beginPath()
  ctx.arc(x, y, 8.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  const rays = forme.rays
  const half = (rays - 1) / 2
  for (let i = 0; i < rays; i++) {
    const off = (i - half) * 2.6
    ctx.strokeStyle = `rgba(${hue}, ${0.34 - Math.abs(i - half) * 0.03})`
    ctx.beginPath()
    ctx.moveTo(x + off * 0.4, y + 5)
    for (let s = 1; s <= 6; s++) {
      const yy = y + 5 + s * 8
      const sway = Math.sin(time * 2 + i + s * 0.5) * (2 + s * 0.9)
      ctx.lineTo(x + off + sway, yy)
    }
    ctx.stroke()
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, m: Flower, x: number, y: number, time: number) {
  const def = SPECIES[m.species]
  const rgb = m.cherished ? RGB.rose : RGB[def.hue]
  const breathe = 0.94 + Math.sin(time * 1.4 + m.seed) * 0.06
  const win = m.state === "glowing" ? clamp(m.remanence, 0, 1) : m.state === "lost" ? 0 : 0.3
  const base = m.state === "glowing" ? 0.98 : m.state === "spending" ? 0.5 : 0.25
  const a = base * (0.45 + m.glow * 0.55) * (0.4 + win * 0.6)
  if (a <= 0.01) return

  const sprite = getFlowerSprite(m.species, rgb)
  const sc = m.scale * breathe
  ctx.globalAlpha = clamp(a, 0, 1)
  ctx.drawImage(sprite.canvas, x - sprite.cx * sc, y - sprite.cy * sc, sprite.canvas.width * sc, sprite.canvas.height * sc)
  ctx.globalAlpha = 1

  if (m.state === "glowing" || m.state === "spending") {
    const pulse = 0.6 + Math.sin(time * 1.8 + m.seed) * 0.25
    glowDot(ctx, x, y, 4.8 * sc, rgb, a * pulse)
  }

  // rémanence countdown ring
  if (m.state === "glowing" && win < 0.999) {
    const r = 28 * m.scale
    const start = -Math.PI / 2
    ctx.lineWidth = 1.8
    ctx.strokeStyle = `rgba(${rgb}, ${0.2 + win * 0.32})`
    ctx.beginPath()
    ctx.arc(x, y, r, start, start + Math.PI * 2 * win)
    ctx.stroke()
  }
}

/* baked silhouettes (drawn once into offscreen sprites) ------------------- */
// Each species has a clearly different shape so they read instantly.

function bakeLotus(ctx: CanvasRenderingContext2D, rgb: string) {
  ctx.save()
  ctx.strokeStyle = `rgba(${rgb}, 0.5)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(0, 40, 56, 16, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 40, 40, 11, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  const rings = [
    { count: 12, len: 40, wid: 8, off: 0 },
    { count: 10, len: 30, wid: 7, off: Math.PI / 10 },
    { count: 8, len: 20, wid: 6, off: 0 },
  ]
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]
    const alpha = 0.6 + r * 0.18
    for (let i = 0; i < ring.count; i++) {
      const ang = (i / ring.count) * Math.PI * 2 + ring.off
      ctx.save()
      ctx.rotate(ang)
      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`
      ctx.beginPath()
      ctx.moveTo(0, 6)
      ctx.quadraticCurveTo(ring.wid, -ring.len * 0.5, 0, -ring.len)
      ctx.quadraticCurveTo(-ring.wid, -ring.len * 0.5, 0, 6)
      ctx.stroke()
      ctx.restore()
    }
  }
  glowDot(ctx, 0, 0, 6, rgb, 0.8)
}

// Astre — a radiant star-burst flower (spokes with tiny tips).
function bakeAstre(ctx: CanvasRenderingContext2D, rgb: string) {
  const spokes = 16
  for (let i = 0; i < spokes; i++) {
    const ang = (i / spokes) * Math.PI * 2
    const long = i % 2 === 0
    const len = long ? 46 : 28
    ctx.save()
    ctx.rotate(ang)
    ctx.strokeStyle = `rgba(${rgb}, ${long ? 0.85 : 0.5})`
    ctx.lineWidth = long ? 1 : 0.7
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -len)
    ctx.stroke()
    ctx.fillStyle = `rgba(${rgb}, ${long ? 0.9 : 0.5})`
    ctx.beginPath()
    ctx.arc(0, -len, long ? 1.6 : 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.strokeStyle = `rgba(${rgb}, 0.45)`
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, Math.PI * 2)
  ctx.stroke()
  glowDot(ctx, 0, 0, 7, rgb, 0.85)
}

// Clochette — hanging bell flowers on a stem.
function bakeClochette(ctx: CanvasRenderingContext2D, rgb: string) {
  ctx.strokeStyle = `rgba(${rgb}, 0.7)`
  ctx.lineWidth = 1
  // stem
  ctx.beginPath()
  ctx.moveTo(0, -52)
  ctx.quadraticCurveTo(6, -10, 0, 30)
  ctx.stroke()
  const bells = [
    { x: -2, y: -42, s: 1 },
    { x: 8, y: -22, s: 0.85 },
    { x: -6, y: -4, s: 1.05 },
    { x: 6, y: 16, s: 0.8 },
  ]
  for (const b of bells) {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.scale(b.s, b.s)
    ctx.strokeStyle = `rgba(${rgb}, 0.85)`
    ctx.beginPath()
    ctx.moveTo(0, -8) // attach point
    ctx.lineTo(-7, 4)
    ctx.quadraticCurveTo(-7, 12, 0, 13)
    ctx.quadraticCurveTo(7, 12, 7, 4)
    ctx.closePath()
    ctx.stroke()
    // clapper
    ctx.fillStyle = `rgba(${rgb}, 0.9)`
    ctx.beginPath()
    ctx.arc(0, 13, 1.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  glowDot(ctx, 0, -4, 5, rgb, 0.7)
}

// Ombelle — an umbel: many tiny florets on radiating stalks (umbrella shape).
function bakeOmbelle(ctx: CanvasRenderingContext2D, rgb: string) {
  // stem
  ctx.strokeStyle = `rgba(${rgb}, 0.6)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 40)
  ctx.lineTo(0, -6)
  ctx.stroke()
  const ribs = 11
  for (let i = 0; i < ribs; i++) {
    const ang = -Math.PI / 2 + (i - (ribs - 1) / 2) * 0.22
    const len = 36 + Math.sin(i * 1.3) * 6
    const ex = Math.cos(ang) * len
    const ey = Math.sin(ang) * len - 6
    ctx.strokeStyle = `rgba(${rgb}, 0.55)`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.fillStyle = `rgba(${rgb}, 0.85)`
    ctx.beginPath()
    ctx.arc(ex, ey, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  glowDot(ctx, 0, -24, 6, rgb, 0.75)
}

// Luce — rare golden bloom: layered petals + bright crown.
function bakeLuce(ctx: CanvasRenderingContext2D, rgb: string) {
  const petals = 6
  for (let layer = 0; layer < 2; layer++) {
    const len = layer === 0 ? 44 : 30
    const off = layer === 0 ? 0 : Math.PI / petals
    for (let i = 0; i < petals; i++) {
      const ang = (i / petals) * Math.PI * 2 + off
      ctx.save()
      ctx.rotate(ang)
      ctx.strokeStyle = `rgba(${rgb}, ${layer === 0 ? 0.9 : 0.7})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, 4)
      ctx.quadraticCurveTo(13, -len * 0.5, 0, -len)
      ctx.quadraticCurveTo(-13, -len * 0.5, 0, 4)
      ctx.stroke()
      ctx.restore()
    }
  }
  // crown of sparks
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2
    const r = 18
    ctx.fillStyle = `rgba(${rgb}, 0.9)`
    ctx.beginPath()
    ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 1, 0, Math.PI * 2)
    ctx.fill()
  }
  glowDot(ctx, 0, 0, 9, rgb, 1)
}

function drawSource(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 0.6 + Math.sin(time * 1.1) * 0.25
  glowDot(ctx, x, y, 36, RGB.amber, 0.55 * pulse)
  ctx.fillStyle = `rgba(255,238,210,${0.85 * pulse})`
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fill()
}

function drawConstellationRoute(ctx: CanvasRenderingContext2D, g: ReturnType<typeof gameShape>) {
  const glowing = g.flowers
    .filter((m) => m.state === "glowing")
    .sort((a, b) => b.pos.y - a.pos.y)
  if (glowing.length === 0) return
  ctx.lineWidth = 0.8
  ctx.setLineDash([2, 6])
  let prev: Vec = g.wisp
  for (const m of glowing) {
    const a = 0.18 * clamp(m.remanence, 0, 1)
    ctx.strokeStyle = `rgba(${RGB.cold}, ${a})`
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y - g.cameraY)
    ctx.lineTo(m.pos.x, m.pos.y - g.cameraY)
    ctx.stroke()
    prev = m.pos
  }
  ctx.setLineDash([])
}

function drawWake(ctx: CanvasRenderingContext2D, g: ReturnType<typeof gameShape>) {
  const pts = g.pathPts
  if (pts.length < 2) return
  const n = pts.length
  for (let i = 1; i < n; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const age = i / n
    const a = Math.max(0, age * 0.45 - 0.04)
    if (a <= 0.01) continue
    ctx.strokeStyle = `rgba(${RGB.cold}, ${a})`
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y - g.cameraY)
    ctx.lineTo(p1.x, p1.y - g.cameraY)
    ctx.stroke()
  }
}

function drawSoundwave(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, flow: number) {
  const baseY = h - 26
  const amp = 4 + flow * 22
  ctx.lineWidth = 1
  for (let layer = 0; layer < 4; layer++) {
    ctx.strokeStyle = `rgba(${RGB.amber}, ${0.16 + flow * 0.18 - layer * 0.035})`
    ctx.beginPath()
    for (let x = 0; x <= w; x += 5) {
      const yy =
        baseY +
        Math.sin(x * 0.025 + time * (1.4 + flow) + layer) * amp * Math.sin(x * 0.004 + time) +
        Math.sin(x * 0.07 + time * 2 + layer * 2) * (amp * 0.3)
      if (x === 0) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
}

// HUD: souffle gauge (top), éclats counter, bouquet progress ring (bottom-left).
function drawHUD(ctx: CanvasRenderingContext2D, g: ReturnType<typeof gameShape>) {
  const { w, h } = g
  // Souffle bar — centered under the top edge
  const bw = Math.min(220, w * 0.5)
  const bx = (w - bw) / 2
  const by = 26
  ctx.fillStyle = "rgba(210,232,255,0.12)"
  roundRect(ctx, bx, by, bw, 4, 2)
  ctx.fill()
  const sf = clamp(g.souffle, 0, 1)
  const hue = sf > 0.4 ? RGB.amber : RGB.rose
  ctx.fillStyle = `rgba(${hue}, ${0.5 + 0.4 * sf})`
  roundRect(ctx, bx, by, bw * sf, 4, 2)
  ctx.fill()
  ctx.font = "300 10px var(--font-geist-sans, sans-serif)"
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(210,232,255,0.4)"
  ctx.fillText("SOUFFLE", w / 2, by - 8)

  // Éclats counter — top-right-ish under pause handled in DOM; draw value center-top
  ctx.textAlign = "right"
  ctx.font = "300 13px var(--font-geist-mono, monospace)"
  ctx.fillStyle = `rgba(${RGB.amber}, 0.8)`
  ctx.fillText(`${g.eclats}`, w - 64, 30)
  ctx.font = "300 9px var(--font-geist-sans, sans-serif)"
  ctx.fillStyle = "rgba(255,178,92,0.4)"
  ctx.fillText("ÉCLATS", w - 64, 42)

  // Bouquet progress ring — bottom-left
  const recipe = BOUQUETS[g.bouquetIdx % BOUQUETS.length]
  const cxp = 42
  const cyp = h - 70
  const rr = 22
  const frac = clamp(g.bouquetCollected / recipe.need, 0, 1)
  ctx.strokeStyle = "rgba(232,178,192,0.18)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cxp, cyp, rr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(${RGB.rose}, ${0.6 + g.bouquetPulse * 0.4})`
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(cxp, cyp, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()
  ctx.textAlign = "center"
  ctx.font = "300 12px var(--font-geist-mono, monospace)"
  ctx.fillStyle = "rgba(232,240,255,0.7)"
  ctx.fillText(`${g.bouquetCollected}/${recipe.need}`, cxp, cyp + 4)
  ctx.font = "300 9px var(--font-geist-sans, sans-serif)"
  ctx.fillStyle = "rgba(232,178,192,0.5)"
  ctx.fillText(recipe.nom.toUpperCase(), cxp, cyp + rr + 14)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// type helper so drawing fns get the game ref shape
function gameShape() {
  return null as unknown as {
    w: number
    h: number
    cameraY: number
    wisp: Vec
    flowers: Flower[]
    pathPts: { x: number; y: number }[]
    souffle: number
    eclats: number
    bouquetIdx: number
    bouquetCollected: number
    bouquetPulse: number
  }
}

/* ----------------------------------------------------------------------- */
/* react UI bits                                                            */
/* ----------------------------------------------------------------------- */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(2,3,8,0.74)] px-6 backdrop-blur-[2px]">
      {children}
    </div>
  )
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-light tracking-[0.28em] text-[rgba(210,232,255,0.55)] transition-colors hover:text-[rgba(232,240,255,0.95)]"
    >
      {children}
    </button>
  )
}

function Stat({ label, value, hue }: { label: string; value: string; hue: HueName }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[rgba(210,232,255,0.45)]">{label}</span>
      <span className="font-mono" style={{ color: `rgb(${RGB[hue]})` }}>
        {value}
      </span>
    </div>
  )
}

function Toggle({
  label,
  initial = false,
  onChange,
}: {
  label: string
  initial?: boolean
  onChange?: (on: boolean) => void
}) {
  const [on, setOn] = useState(initial)
  return (
    <button
      onClick={() => {
        setOn((v) => {
          onChange?.(!v)
          return !v
        })
      }}
      className="flex items-center justify-between text-sm font-light tracking-[0.2em]"
    >
      <span>{label}</span>
      <span
        className={`relative h-4 w-9 rounded-full border transition-colors ${
          on ? "border-[rgba(255,178,92,0.6)]" : "border-[rgba(210,232,255,0.25)]"
        }`}
      >
        <span
          className={`absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-all ${
            on ? "left-[18px] bg-[rgba(255,178,92,0.9)]" : "left-[3px] bg-[rgba(210,232,255,0.4)]"
          }`}
        />
      </span>
    </button>
  )
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 10.5V19h12v-8.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const WHISPERS = [
  "ce qui s'éteint éclaire le pas suivant",
  "tu ne gardes rien — tu accompagnes",
  "la trace dure le temps d'un souffle",
  "on retient mieux ce qu'on a aimé",
]
void WHISPERS
