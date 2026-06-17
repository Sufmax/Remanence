"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useProgression } from "@/lib/remanence/progression"
import type { SessionResult } from "@/lib/remanence/progression"
import {
  findContree,
  findForme,
  levelFromSouvenirs,
  CONTREES,
  ECHOS,
} from "@/lib/remanence/content"
import { EchosPanel } from "./echos-panel"
import { ContreesPanel } from "./contrees-panel"
import { FormesPanel } from "./formes-panel"
import { EclatTag, SouvenirTag } from "./ui"

// The canvas game is heavy; load it only when a session starts.
const RemanenceGame = dynamic(() => import("@/components/remanence-game"), { ssr: false })

type View = "hub" | "echos" | "contrees" | "formes"

export default function Sanctuaire() {
  const {
    profile,
    ready,
    applySession,
    claimEcho,
    unlockContree,
    unlockForme,
    setFormeActive,
  } = useProgression()

  const [view, setView] = useState<View>("hub")
  const [playing, setPlaying] = useState(false)
  const [activeContree, setActiveContree] = useState<string>("veille")
  const [lastResult, setLastResult] = useState<SessionResult | null>(null)

  const startContree = useCallback((id: string) => {
    setActiveContree(id)
    setView("hub")
    setPlaying(true)
  }, [])

  const handleEnd = useCallback(
    (r: SessionResult) => {
      applySession(r)
      setLastResult(r)
    },
    [applySession],
  )

  // claimable échos count for the badge
  const claimable = profile.echos.filter((ep) => {
    if (ep.claimed) return false
    const def = findEchoGoal(ep.id)
    return def != null && ep.progress >= def
  }).length

  if (playing) {
    const contree = findContree(activeContree) ?? CONTREES[0]
    const forme = findForme(profile.formeActive)
    return (
      <RemanenceGame
        contree={contree}
        forme={forme}
        standalone={false}
        onEnd={handleEnd}
        onExit={() => setPlaying(false)}
      />
    )
  }

  const lvl = levelFromSouvenirs(profile.souvenirs)
  const levelFrac = lvl.span > 0 ? lvl.into / lvl.span : 0
  const currentContree = findContree(activeContree) ?? CONTREES[0]

  return (
    <main
      className="relative min-h-dvh w-full overflow-hidden"
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${currentContree.bgTop}, ${currentContree.bgBottom})`,
      }}
    >
      {/* faint starfield via layered radial dots */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(1px_1px_at_20%_30%,rgba(210,232,255,0.5),transparent),radial-gradient(1px_1px_at_70%_50%,rgba(210,232,255,0.4),transparent),radial-gradient(1px_1px_at_40%_80%,rgba(210,232,255,0.3),transparent),radial-gradient(1px_1px_at_85%_20%,rgba(210,232,255,0.4),transparent)]" />

      <div
        className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-12"
        style={{
          paddingTop: "calc(3rem + env(safe-area-inset-top))",
          paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* Wallet */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <EclatTag amount={ready ? profile.eclats : 0} />
            <SouvenirTag amount={ready ? profile.souvenirs : 0} />
          </div>
          <div className="text-right">
            <p className="font-mono text-xs tracking-[0.2em] text-[rgba(210,232,255,0.5)]">
              VEILLE {lvl.level}
            </p>
          </div>
        </div>

        {/* Level bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[rgba(210,232,255,0.08)]">
          <div
            className="h-full rounded-full bg-[rgba(210,232,255,0.55)] transition-[width] duration-500"
            style={{ width: `${levelFrac * 100}%` }}
          />
        </div>

        {/* Title */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="pl-[0.3em] text-[clamp(1.7rem,8.5vw,3.4rem)] font-extralight tracking-[0.32em] text-[rgba(232,240,255,0.92)]">
            RÉMANENCE
          </h1>
          <p className="mt-3 text-sm font-light italic tracking-wide text-[rgba(210,232,255,0.45)]">
            {currentContree.nom} — {currentContree.sousTitre}
          </p>

          <button
            onClick={() => setPlaying(true)}
            className="mt-12 rounded-full border border-[rgba(255,178,92,0.45)] px-12 py-3.5 text-sm font-light tracking-[0.28em] text-[rgba(255,200,140,0.9)] transition-colors hover:bg-[rgba(255,178,92,0.08)]"
          >
            VEILLER
          </button>

          {lastResult && (
            <p className="mt-6 max-w-xs text-xs font-light italic leading-relaxed text-[rgba(210,232,255,0.4)]">
              Dernière veille : +{lastResult.eclats} éclats, {lastResult.bouquets} bouquet
              {lastResult.bouquets > 1 ? "s" : ""} noué{lastResult.bouquets > 1 ? "s" : ""}.
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="grid grid-cols-3 gap-3">
          <HubButton label="ÉCHOS" badge={claimable} onClick={() => setView("echos")} />
          <HubButton label="CONTRÉES" onClick={() => setView("contrees")} />
          <HubButton label="FORMES" onClick={() => setView("formes")} />
        </nav>
      </div>

      {view === "echos" && (
        <EchosPanel profile={profile} onClaim={claimEcho} onClose={() => setView("hub")} />
      )}
      {view === "contrees" && (
        <ContreesPanel
          profile={profile}
          activeContree={activeContree}
          onSelect={startContree}
          onUnlock={unlockContree}
          onClose={() => setView("hub")}
        />
      )}
      {view === "formes" && (
        <FormesPanel
          profile={profile}
          onUnlock={unlockForme}
          onEquip={setFormeActive}
          onClose={() => setView("hub")}
        />
      )}
    </main>
  )
}

function HubButton({
  label,
  badge,
  onClick,
}: {
  label: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl border border-[rgba(210,232,255,0.14)] bg-[rgba(8,10,18,0.45)] py-4 text-xs font-light tracking-[0.18em] text-[rgba(232,240,255,0.8)] backdrop-blur-sm transition-colors hover:border-[rgba(210,232,255,0.35)] hover:text-[rgba(232,240,255,1)]"
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[rgba(255,178,92,0.95)] font-mono text-[0.65rem] text-[#1a0f04]">
          {badge}
        </span>
      )}
    </button>
  )
}

// local helper to read an écho's goal without importing the whole list here
function findEchoGoal(id: string): number | null {
  const e = ECHOS.find((x) => x.id === id)
  return e ? e.goal : null
}
