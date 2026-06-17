// Shared types for RÉMANENCE — poetic meta-progression.
// Naming: Souvenirs = XP, Éclats = currency, Échos = quests,
// Contrées = terrains/levels, Formes = skins of the Veilleuse.

export type HueName = "cold" | "amber" | "rose" | "gold" | "verdant"

// A flower species. Distinct silhouette + hue so the player can tell them
// apart at a glance (the "differentiation" the player wanted made easier).
export type SpeciesId = "lotus" | "astre" | "clochette" | "ombelle" | "luce"

export type Species = {
  id: SpeciesId
  nom: string // poetic display name
  hue: HueName
  rarity: number // 0..1 spawn weight (lower = rarer)
  cherishedChance: number // chance an individual is "chère" (rose-kept)
  eclats: number // base Éclats granted when prélevé
  // Window multiplier: how long its rémanence lingers (higher = easier/slower).
  lingerMul: number
}

// A bouquet recipe: collect N flowers (optionally of a single species or mixed)
// to "tie" it and earn rewards.
export type BouquetRecipe = {
  id: string
  nom: string
  need: number // flowers required
  species?: SpeciesId // if set, all flowers must be this species
  eclats: number
  souvenirs: number
}

// A Contrée (terrain). Defines palette + which species bloom there.
export type ContreeId = string
export type Contree = {
  id: ContreeId
  nom: string
  sousTitre: string
  species: SpeciesId[] // species that bloom here (weighted by their rarity)
  bgTop: string
  bgMid: string
  bgBottom: string
  nebulaHue: HueName
  cost: number // Éclats to unlock (0 = free / starter)
  mix?: [ContreeId, ContreeId] // if a mix, the two parents
}

// A Forme (skin) of the Veilleuse.
export type FormeId = string
export type Forme = {
  id: FormeId
  nom: string
  description: string
  cost: number // Éclats (0 = default/owned)
  // visual params
  core: string // rgb of the bright core
  hue: HueName // trailing hue
  rays: number // number of trailing filaments
}

// An Écho (quest). Tracked across a single session unless "persistent".
export type EchoMetric =
  | "prelever" // total flowers prélevés
  | "bouquets" // bouquets tied
  | "communion" // longest same-species streak reached
  | "luce" // rare flowers found
  | "souffle" // sessions finished without the Souffle dying
  | "espece" // distinct species collected in one run

export type Echo = {
  id: string
  titre: string
  metric: EchoMetric
  goal: number
  eclats: number
  souvenirs: number
}

export type EchoProgress = {
  id: string
  progress: number
  claimed: boolean
}

// Persisted player profile.
export type Profile = {
  souvenirs: number // total XP
  eclats: number // currency wallet
  niveau: number // derived but stored for convenience
  contreesUnlocked: ContreeId[]
  formesUnlocked: FormeId[]
  formeActive: FormeId
  echos: EchoProgress[]
  totalPrelever: number
  totalBouquets: number
  meilleureCommunion: number
  luceTrouvees: number
  version: number
}
