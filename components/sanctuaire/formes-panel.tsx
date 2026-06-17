"use client"

import { useEffect, useRef } from "react"
import { FORMES, RGB } from "@/lib/remanence/content"
import type { Profile, Forme } from "@/lib/remanence/types"
import { Panel, EclatTag } from "./ui"

// A tiny animated preview of a Forme (mirrors the in-game wisp look).
function FormePreview({ forme }: { forme: Forme }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = 72
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    let raf = 0
    let t = 0
    const hue = RGB[forme.hue]
    const draw = () => {
      t += 0.016
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      ctx.globalCompositeOperation = "lighter"
      // glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30)
      g.addColorStop(0, `rgba(${hue}, 0.5)`)
      g.addColorStop(1, `rgba(${hue}, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      // filaments
      ctx.strokeStyle = `rgba(${hue}, 0.5)`
      ctx.lineWidth = 1
      const half = (forme.rays - 1) / 2
      for (let i = 0; i < forme.rays; i++) {
        const off = (i - half) * 3
        ctx.beginPath()
        ctx.moveTo(cx + off * 0.3, cy)
        ctx.quadraticCurveTo(
          cx + off + Math.sin(t * 1.5 + i) * 3,
          cy + 14,
          cx + off * 1.3 + Math.sin(t + i) * 4,
          cy + 26,
        )
        ctx.stroke()
      }
      // core
      ctx.fillStyle = `rgba(${forme.core}, 0.98)`
      ctx.beginPath()
      ctx.arc(cx, cy, 6.5 + Math.sin(t * 2) * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = "source-over"
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [forme])
  return <canvas ref={ref} className="size-[72px]" aria-hidden />
}

export function FormesPanel({
  profile,
  onUnlock,
  onEquip,
  onClose,
}: {
  profile: Profile
  onUnlock: (id: string, cost: number) => boolean
  onEquip: (id: string) => void
  onClose: () => void
}) {
  const owned = new Set(profile.formesUnlocked)
  return (
    <Panel title="FORMES" subtitle="les visages de la Veilleuse" onClose={onClose}>
      <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        {FORMES.map((forme) => {
          const isOwned = owned.has(forme.id)
          const isActive = profile.formeActive === forme.id
          const canBuy = profile.eclats >= forme.cost
          return (
            <div
              key={forme.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                isActive
                  ? "border-[rgba(255,178,92,0.45)] bg-[rgba(255,178,92,0.06)]"
                  : "border-[rgba(210,232,255,0.12)] bg-[rgba(8,10,18,0.5)]"
              }`}
            >
              <div className="grid size-[72px] shrink-0 place-items-center rounded-xl bg-[rgba(2,3,8,0.6)]">
                <FormePreview forme={forme} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-light tracking-wide text-[rgba(232,240,255,0.9)]">
                  {forme.nom}
                </p>
                <p className="mt-0.5 text-xs font-light italic leading-snug text-[rgba(210,232,255,0.42)]">
                  {forme.description}
                </p>
                <div className="mt-2.5">
                  {isActive ? (
                    <span className="text-xs font-light tracking-[0.2em] text-[rgba(150,220,170,0.85)]">
                      PORTÉE
                    </span>
                  ) : isOwned ? (
                    <button
                      onClick={() => onEquip(forme.id)}
                      className="rounded-full border border-[rgba(210,232,255,0.3)] px-4 py-1.5 text-xs font-light tracking-[0.16em] text-[rgba(232,240,255,0.85)] transition-colors hover:bg-[rgba(210,232,255,0.07)]"
                    >
                      REVÊTIR
                    </button>
                  ) : (
                    <button
                      disabled={!canBuy}
                      onClick={() => onUnlock(forme.id, forme.cost)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-light tracking-[0.14em] transition-colors ${
                        canBuy
                          ? "border-[rgba(255,178,92,0.35)] text-[rgba(255,200,140,0.9)] hover:bg-[rgba(255,178,92,0.08)]"
                          : "border-[rgba(210,232,255,0.12)] text-[rgba(210,232,255,0.3)]"
                      }`}
                    >
                      ACQUÉRIR <EclatTag amount={forme.cost} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
