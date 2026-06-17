"use client"

import { CONTREES, MIX_CONTREES, findContree, RGB } from "@/lib/remanence/content"
import type { Profile, Contree } from "@/lib/remanence/types"
import { Panel, EclatTag } from "./ui"

function ContreeCard({
  contree,
  state,
  cost,
  onPlay,
  onUnlock,
}: {
  contree: Contree
  state: "active" | "owned" | "buyable" | "locked"
  cost: number
  onPlay: () => void
  onUnlock: () => void
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[rgba(210,232,255,0.12)]"
      style={{
        background: `linear-gradient(160deg, ${contree.bgTop}, ${contree.bgBottom})`,
      }}
    >
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-light tracking-[0.12em] text-[rgba(232,240,255,0.92)]">
            {contree.nom}
          </p>
          <p className="mt-0.5 truncate text-xs font-light italic text-[rgba(210,232,255,0.45)]">
            {contree.sousTitre}
          </p>
          <div className="mt-2 flex gap-1.5">
            {contree.species.map((s) => (
              <span
                key={s}
                className="size-2 rounded-full"
                style={{ background: `rgb(${RGB[(contreeSpeciesHue(s))]})`, boxShadow: `0 0 6px rgba(${RGB[contreeSpeciesHue(s)]},0.8)` }}
              />
            ))}
          </div>
        </div>
        <div className="shrink-0 pl-3">
          {state === "active" && (
            <span className="text-xs font-light tracking-[0.2em] text-[rgba(150,220,170,0.85)]">ICI</span>
          )}
          {state === "owned" && (
            <button
              onClick={onPlay}
              className="rounded-full border border-[rgba(255,178,92,0.45)] px-5 py-2 text-xs font-light tracking-[0.18em] text-[rgba(255,200,140,0.95)] transition-colors hover:bg-[rgba(255,178,92,0.1)]"
            >
              VEILLER
            </button>
          )}
          {state === "buyable" && (
            <button
              onClick={onUnlock}
              className="flex items-center gap-2 rounded-full border border-[rgba(255,178,92,0.3)] px-4 py-2 text-xs font-light tracking-[0.14em] text-[rgba(255,200,140,0.9)] transition-colors hover:bg-[rgba(255,178,92,0.08)]"
            >
              OUVRIR <EclatTag amount={cost} />
            </button>
          )}
          {state === "locked" && (
            <span className="flex items-center gap-2 text-xs font-light tracking-[0.14em] text-[rgba(210,232,255,0.35)]">
              <EclatTag amount={cost} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// hue accessor kept tiny + local
function contreeSpeciesHue(id: string) {
  // lazy import-free mapping mirrors SPECIES hues
  const map: Record<string, "cold" | "amber" | "rose" | "gold" | "verdant"> = {
    lotus: "rose",
    astre: "amber",
    clochette: "cold",
    ombelle: "verdant",
    luce: "gold",
  }
  return map[id] ?? "cold"
}

export function ContreesPanel({
  profile,
  activeContree,
  onSelect,
  onUnlock,
  onClose,
}: {
  profile: Profile
  activeContree: string
  onSelect: (id: string) => void
  onUnlock: (id: string, cost: number) => void
  onClose: () => void
}) {
  const owned = new Set(profile.contreesUnlocked)

  function stateFor(c: Contree): "active" | "owned" | "buyable" | "locked" {
    if (owned.has(c.id)) return c.id === activeContree ? "active" : "owned"
    if (c.mix) {
      const [a, b] = c.mix
      if (!owned.has(a) || !owned.has(b)) return "locked"
    }
    return profile.eclats >= c.cost ? "buyable" : "locked"
  }

  return (
    <Panel title="CONTRÉES" subtitle="les terres qu'il te reste à veiller" onClose={onClose}>
      <div className="mx-auto flex max-w-md flex-col gap-3">
        {CONTREES.map((c) => {
          const st = stateFor(c)
          return (
            <ContreeCard
              key={c.id}
              contree={c}
              state={st}
              cost={c.cost}
              onPlay={() => onSelect(c.id)}
              onUnlock={() => onUnlock(c.id, c.cost)}
            />
          )
        })}

        <div className="mt-5 mb-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-[rgba(210,232,255,0.12)]" />
          <span className="text-[0.65rem] font-light tracking-[0.3em] text-[rgba(210,232,255,0.4)]">
            MÉLANGES
          </span>
          <span className="h-px flex-1 bg-[rgba(210,232,255,0.12)]" />
        </div>
        <p className="mb-2 text-center text-xs font-light italic leading-relaxed text-[rgba(210,232,255,0.4)]">
          Possède deux contrées pour tisser la troisième.
        </p>

        {MIX_CONTREES.map((c) => {
          const st = stateFor(c)
          const [a, b] = c.mix!
          const parents = `${findContree(a)?.nom ?? a} + ${findContree(b)?.nom ?? b}`
          return (
            <div key={c.id}>
              <p className="mb-1 ml-1 text-[0.65rem] font-light tracking-[0.15em] text-[rgba(255,219,130,0.5)]">
                {parents}
              </p>
              <ContreeCard
                contree={c}
                state={st}
                cost={c.cost}
                onPlay={() => onSelect(c.id)}
                onUnlock={() => onUnlock(c.id, c.cost)}
              />
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
