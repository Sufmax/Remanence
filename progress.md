Original prompt: "rends la différenciation des fleurs légèrement plus facile et plus rapide. Objectif: faire des bouquets de fleurs (enjolive le tout). Idées: quêtes, gagner de l'exp, débloquer de nouveaux terrains, mixer deux terrains, pièces -> acheter des skins. Donne d'autres idées. Plusieurs étapes, prends ton temps."

# RÉMANENCE — méta-progression

## Décisions
- Sauvegarde LOCALE (localStorage), pas de compte.
- Noms poétiques :
  - XP = **Souvenirs**
  - Monnaie = **Éclats**
  - Quêtes = **Échos**
  - Terrains = **Contrées**
  - Skins (de la Veilleuse) = **Formes**
- Objectif central : composer des **bouquets** de fleurs.

## Idées ajoutées par v0
- **Communions** : prélever plusieurs fleurs de même espèce d'affilée → bonus de cadence/Éclats.
- **Floraison rare** : fleur dorée (luce) rare → gros bonus d'Éclats.
- **Souffle** : jauge de temps. Quand on n'a "plus de temps", le souffle s'éteint et clôt la session en douceur (tally des bouquets).
- **Sanctuaire** : hub entre deux sessions (Contrées, boutique de Formes, Échos en cours, profil/niveau).

## Espèces de fleurs (différenciation facile = silhouette + teinte distinctes)
- lotus (rose), astre (ambre, radial étoilé), clochette (bleu froid, clochettes).
- floraison rare = luce (dorée).

## Architecture
- `lib/remanence/types.ts` — types partagés.
- `lib/remanence/content.ts` — espèces, contrées, formes, échos.
- `lib/remanence/progression.ts` + `useProgression` hook — store localStorage.
- `components/remanence-game.tsx` — moteur canvas (existant, étendu).
- Sanctuaire = overlays React.

## TODO (ordre)
1. [EN COURS] Gameplay core : espèces de fleurs distinctes, bouquets, Souffle (fin de temps).
2. Économie de session : Éclats, Souvenirs, communions, floraison rare.
3. Persistance locale + Sanctuaire (hub).
4. Échos (quêtes).
5. Contrées déblocables + mixage de deux contrées.
6. Boutique de Formes (skins).
7. Tests iPhone + Samsung, perf, polish.

## Tests
- Utiliser le client playwright du skill develop-web-game après chaque étape.
- `window.render_game_to_text` et `window.advanceTime` à exposer pour les tests.
