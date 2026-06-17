"use client"

import { useCallback, useEffect, useState } from "react"
import type { Profile, ContreeId, FormeId } from "./types"
import { ECHOS, levelFromSouvenirs } from "./content"

const KEY = "remanence:profile:v1"
const VERSION = 1

function freshProfile(): Profile {
  return {
    souvenirs: 0,
    eclats: 0,
    niveau: 1,
    contreesUnlocked: ["veille"],
    formesUnlocked: ["veilleuse"],
    formeActive: "veilleuse",
    echos: ECHOS.map((e) => ({ id: e.id, progress: 0, claimed: false })),
    totalPrelever: 0,
    totalBouquets: 0,
    meilleureCommunion: 0,
    luceTrouvees: 0,
    version: VERSION,
  }
}

function loadProfile(): Profile {
  if (typeof window === "undefined") return freshProfile()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return freshProfile()
    const parsed = JSON.parse(raw) as Partial<Profile>
    const base = freshProfile()
    const merged: Profile = { ...base, ...parsed, version: VERSION }
    // ensure all current échos exist (forward-compat when we add quests)
    const byId = new Map(merged.echos?.map((e) => [e.id, e]) ?? [])
    merged.echos = ECHOS.map(
      (e) => byId.get(e.id) ?? { id: e.id, progress: 0, claimed: false },
    )
    merged.niveau = levelFromSouvenirs(merged.souvenirs).level
    return merged
  } catch {
    return freshProfile()
  }
}

function saveProfile(p: Profile) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage full or blocked — non-fatal */
  }
}

// Summary of one finished session, applied to the profile at once.
export type SessionResult = {
  eclats: number
  souvenirs: number
  prelever: number
  bouquets: number
  meilleureCommunion: number
  luce: number
  especes: number // distinct species this run
  souffleVivant: boolean // finished without the Souffle dying
}

export function useProgression() {
  const [profile, setProfile] = useState<Profile>(freshProfile)
  const [ready, setReady] = useState(false)

  // hydrate once on mount (avoids SSR mismatch)
  useEffect(() => {
    setProfile(loadProfile())
    setReady(true)
  }, [])

  const persist = useCallback((next: Profile) => {
    setProfile(next)
    saveProfile(next)
  }, [])

  const applySession = useCallback(
    (r: SessionResult) => {
      setProfile((prev) => {
        const next: Profile = { ...prev }
        next.eclats = prev.eclats + r.eclats
        next.souvenirs = prev.souvenirs + r.souvenirs
        next.totalPrelever = prev.totalPrelever + r.prelever
        next.totalBouquets = prev.totalBouquets + r.bouquets
        next.meilleureCommunion = Math.max(prev.meilleureCommunion, r.meilleureCommunion)
        next.luceTrouvees = prev.luceTrouvees + r.luce
        next.niveau = levelFromSouvenirs(next.souvenirs).level

        // advance écho progress (capped at goal; not auto-claimed)
        next.echos = prev.echos.map((ep) => {
          const def = ECHOS.find((e) => e.id === ep.id)
          if (!def || ep.claimed) return ep
          let add = 0
          switch (def.metric) {
            case "prelever":
              add = r.prelever
              break
            case "bouquets":
              add = r.bouquets
              break
            case "communion":
              // store best, not sum
              return { ...ep, progress: Math.max(ep.progress, r.meilleureCommunion) }
            case "luce":
              add = r.luce
              break
            case "espece":
              return { ...ep, progress: Math.max(ep.progress, r.especes) }
            case "souffle":
              add = r.souffleVivant ? 1 : 0
              break
          }
          return { ...ep, progress: Math.min(def.goal, ep.progress + add) }
        })

        saveProfile(next)
        return next
      })
    },
    [],
  )

  const claimEcho = useCallback((id: string) => {
    setProfile((prev) => {
      const def = ECHOS.find((e) => e.id === id)
      const ep = prev.echos.find((e) => e.id === id)
      if (!def || !ep || ep.claimed || ep.progress < def.goal) return prev
      const next: Profile = {
        ...prev,
        eclats: prev.eclats + def.eclats,
        souvenirs: prev.souvenirs + def.souvenirs,
        echos: prev.echos.map((e) => (e.id === id ? { ...e, claimed: true } : e)),
      }
      next.niveau = levelFromSouvenirs(next.souvenirs).level
      saveProfile(next)
      return next
    })
  }, [])

  const unlockContree = useCallback((id: ContreeId, cost: number) => {
    let ok = false
    setProfile((prev) => {
      if (prev.contreesUnlocked.includes(id) || prev.eclats < cost) return prev
      ok = true
      const next: Profile = {
        ...prev,
        eclats: prev.eclats - cost,
        contreesUnlocked: [...prev.contreesUnlocked, id],
      }
      saveProfile(next)
      return next
    })
    return ok
  }, [])

  const unlockForme = useCallback((id: FormeId, cost: number) => {
    let ok = false
    setProfile((prev) => {
      if (prev.formesUnlocked.includes(id) || prev.eclats < cost) return prev
      ok = true
      const next: Profile = {
        ...prev,
        eclats: prev.eclats - cost,
        formesUnlocked: [...prev.formesUnlocked, id],
        formeActive: id,
      }
      saveProfile(next)
      return next
    })
    return ok
  }, [])

  const setFormeActive = useCallback((id: FormeId) => {
    setProfile((prev) => {
      if (!prev.formesUnlocked.includes(id)) return prev
      const next = { ...prev, formeActive: id }
      saveProfile(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    persist(freshProfile())
  }, [persist])

  return {
    profile,
    ready,
    applySession,
    claimEcho,
    unlockContree,
    unlockForme,
    setFormeActive,
    reset,
  }
}
