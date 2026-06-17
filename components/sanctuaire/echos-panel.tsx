"use client"

import { ECHOS } from "@/lib/remanence/content"
import type { Profile } from "@/lib/remanence/types"
import { Panel, EclatTag, SouvenirTag } from "./ui"

export function EchosPanel({
  profile,
  onClaim,
  onClose,
}: {
  profile: Profile
  onClaim: (id: string) => void
  onClose: () => void
}) {
  const byId = new Map(profile.echos.map((e) => [e.id, e]))
  return (
    <Panel title="ÉCHOS" subtitle="ce que le monde te demande de retenir" onClose={onClose}>
      <ul className="mx-auto flex max-w-md flex-col gap-3">
        {ECHOS.map((echo) => {
          const prog = byId.get(echo.id)
          const value = prog?.progress ?? 0
          const claimed = prog?.claimed ?? false
          const done = value >= echo.goal
          const frac = Math.min(1, value / echo.goal)
          return (
            <li
              key={echo.id}
              className="rounded-2xl border border-[rgba(210,232,255,0.1)] bg-[rgba(8,10,18,0.5)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-light tracking-wide text-[rgba(232,240,255,0.9)]">
                    {echo.titre}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[rgba(210,232,255,0.4)]">
                    {Math.min(value, echo.goal)} / {echo.goal}
                  </p>
                </div>
                {claimed ? (
                  <span className="text-xs font-light tracking-[0.2em] text-[rgba(150,220,170,0.7)]">
                    RECUEILLI
                  </span>
                ) : done ? (
                  <button
                    onClick={() => onClaim(echo.id)}
                    className="rounded-full border border-[rgba(255,178,92,0.5)] px-4 py-2 text-xs font-light tracking-[0.18em] text-[rgba(255,200,140,0.95)] transition-colors hover:bg-[rgba(255,178,92,0.1)]"
                  >
                    RECUEILLIR
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-1 opacity-70">
                    <EclatTag amount={echo.eclats} />
                    <SouvenirTag amount={echo.souvenirs} />
                  </div>
                )}
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[rgba(210,232,255,0.08)]">
                <div
                  className="h-full rounded-full bg-[rgba(255,178,92,0.7)] transition-[width] duration-500"
                  style={{ width: `${frac * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
