import type {
  Species,
  SpeciesId,
  BouquetRecipe,
  Contree,
  Forme,
  Echo,
  HueName,
} from "./types"

// ---- RGB palette (string form, used directly in canvas rgba()) -----------
export const RGB: Record<HueName, string> = {
  cold: "210, 232, 255",
  amber: "255, 178, 92",
  rose: "232, 178, 192",
  gold: "255, 219, 130",
  verdant: "150, 220, 170",
}

// ---- Flower species ------------------------------------------------------
// Each has a clearly distinct silhouette (baked in the canvas) and hue, so
// telling them apart is easy and fast.
export const SPECIES: Record<SpeciesId, Species> = {
  lotus: {
    id: "lotus",
    nom: "Lotus",
    hue: "rose",
    rarity: 1,
    cherishedChance: 0.18,
    eclats: 2,
    lingerMul: 1.25,
  },
  astre: {
    id: "astre",
    nom: "Astre",
    hue: "amber",
    rarity: 0.9,
    cherishedChance: 0.1,
    eclats: 2,
    lingerMul: 1.1,
  },
  clochette: {
    id: "clochette",
    nom: "Clochette",
    hue: "cold",
    rarity: 0.85,
    cherishedChance: 0.1,
    eclats: 3,
    lingerMul: 1.0,
  },
  ombelle: {
    id: "ombelle",
    nom: "Ombelle",
    hue: "verdant",
    rarity: 0.6,
    cherishedChance: 0.12,
    eclats: 4,
    lingerMul: 0.95,
  },
  luce: {
    id: "luce",
    nom: "Luce",
    hue: "gold",
    rarity: 0.08, // rare floraison
    cherishedChance: 0,
    eclats: 18,
    lingerMul: 0.85,
  },
}

export const ALL_SPECIES: SpeciesId[] = ["lotus", "astre", "clochette", "ombelle", "luce"]

// ---- Bouquet recipes -----------------------------------------------------
// Tie a bouquet by gathering flowers. Mixed bouquets are easier; single-species
// bouquets pay more.
export const BOUQUETS: BouquetRecipe[] = [
  { id: "brassee", nom: "Brassée", need: 5, eclats: 8, souvenirs: 12 },
  { id: "gerbe", nom: "Gerbe", need: 9, eclats: 16, souvenirs: 22 },
  { id: "lotus_pur", nom: "Coeur de Lotus", need: 4, species: "lotus", eclats: 20, souvenirs: 26 },
  { id: "astre_pur", nom: "Pluie d'Astres", need: 4, species: "astre", eclats: 20, souvenirs: 26 },
  { id: "couronne", nom: "Couronne", need: 14, eclats: 30, souvenirs: 40 },
]

// ---- Contrées (terrains) -------------------------------------------------
export const CONTREES: Contree[] = [
  {
    id: "veille",
    nom: "La Veille",
    sousTitre: "où tout commence à s'éteindre",
    species: ["lotus", "astre", "clochette"],
    bgTop: "#080c18",
    bgMid: "#05070f",
    bgBottom: "#020308",
    nebulaHue: "cold",
    cost: 0,
  },
  {
    id: "ombrage",
    nom: "L'Ombrage",
    sousTitre: "un sous-bois de verre",
    species: ["clochette", "ombelle", "lotus"],
    bgTop: "#06140f",
    bgMid: "#04100c",
    bgBottom: "#020806",
    nebulaHue: "verdant",
    cost: 60,
  },
  {
    id: "braise",
    nom: "La Braise",
    sousTitre: "le dernier feu du monde",
    species: ["astre", "lotus", "luce"],
    bgTop: "#160a06",
    bgMid: "#120705",
    bgBottom: "#080302",
    nebulaHue: "amber",
    cost: 120,
  },
]

// Contrées created by mixing two terrains. Unlocked once both parents are owned.
export const MIX_CONTREES: Contree[] = [
  {
    id: "mix:ombrage+braise",
    nom: "La Lisière",
    sousTitre: "là où le bois prend feu",
    species: ["ombelle", "astre", "luce", "lotus"],
    bgTop: "#120f06",
    bgMid: "#0c0a05",
    bgBottom: "#050402",
    nebulaHue: "gold",
    cost: 200,
    mix: ["ombrage", "braise"],
  },
  {
    id: "mix:veille+ombrage",
    nom: "La Brume",
    sousTitre: "un froid qui verdit",
    species: ["clochette", "ombelle", "lotus", "astre"],
    bgTop: "#06110f",
    bgMid: "#040c0d",
    bgBottom: "#020607",
    nebulaHue: "cold",
    cost: 200,
    mix: ["veille", "ombrage"],
  },
]

export function findContree(id: string): Contree | undefined {
  return CONTREES.find((c) => c.id === id) || MIX_CONTREES.find((c) => c.id === id)
}

// ---- Formes (skins of the Veilleuse) -------------------------------------
export const FORMES: Forme[] = [
  {
    id: "veilleuse",
    nom: "Veilleuse",
    description: "la forme première, claire et nue",
    cost: 0,
    core: "248, 252, 255",
    hue: "cold",
    rays: 8,
  },
  {
    id: "ardente",
    nom: "Ardente",
    description: "un coeur de braise qui ne s'éteint pas",
    cost: 50,
    core: "255, 224, 196",
    hue: "amber",
    rays: 10,
  },
  {
    id: "aubepine",
    nom: "Aubépine",
    description: "une lueur rose, tendre et tenace",
    cost: 80,
    core: "255, 226, 234",
    hue: "rose",
    rays: 7,
  },
  {
    id: "sylve",
    nom: "Sylve",
    description: "le vert calme des choses qui durent",
    cost: 110,
    core: "224, 255, 232",
    hue: "verdant",
    rays: 9,
  },
  {
    id: "doree",
    nom: "Dorée",
    description: "rare, comme la Luce qu'on cueille à peine",
    cost: 220,
    core: "255, 244, 210",
    hue: "gold",
    rays: 12,
  },
]

export function findForme(id: string): Forme {
  return FORMES.find((f) => f.id === id) || FORMES[0]
}

// ---- Échos (quests) ------------------------------------------------------
export const ECHOS: Echo[] = [
  { id: "premier_pas", titre: "Premiers pas", metric: "prelever", goal: 12, eclats: 10, souvenirs: 15 },
  { id: "lieuse", titre: "La Lieuse", metric: "bouquets", goal: 3, eclats: 18, souvenirs: 25 },
  { id: "communiante", titre: "Communion", metric: "communion", goal: 5, eclats: 16, souvenirs: 20 },
  { id: "chercheuse", titre: "Chercheuse d'or", metric: "luce", goal: 2, eclats: 30, souvenirs: 30 },
  { id: "herboriste", titre: "Herboriste", metric: "espece", goal: 4, eclats: 22, souvenirs: 28 },
  { id: "souffle", titre: "Souffle long", metric: "souffle", goal: 1, eclats: 14, souvenirs: 18 },
]

// ---- Leveling (Souvenirs -> Niveau) --------------------------------------
// Each level costs a bit more than the last.
export function souvenirsForLevel(level: number): number {
  // total souvenirs needed to REACH `level` (level 1 = 0)
  let total = 0
  for (let i = 1; i < level; i++) total += 40 + i * 30
  return total
}

export function levelFromSouvenirs(souvenirs: number): {
  level: number
  into: number
  span: number
} {
  let level = 1
  while (souvenirsForLevel(level + 1) <= souvenirs) level++
  const base = souvenirsForLevel(level)
  const next = souvenirsForLevel(level + 1)
  return { level, into: souvenirs - base, span: next - base }
}
