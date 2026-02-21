# Plan d’exécution détaillé — FractalIAworker

## 1) État actuel (référence)

### Fonctionnalités déjà en place
- Intégration IA multi-provider (Gemini/OpenAI), configuration persistée, gestion d’erreurs.
- Éditeur Markdown enrichi (toolbar, split/preview, tableaux, Mermaid).
- Structure hiérarchique fractale (H1→H6), breadcrumb, contexte IA hiérarchique.
- Réponses IA structurées (Discussion / Contenu / Sous-sections) + parsing.
- Import intelligent de fichiers (TXT/MD/PDF/DOCX) avec analyse IA de structure.
- Dashboard documents (liste, renommage, duplication, suppression, tri).
- Exports disponibles : Markdown, HTML standalone, PDF impression, Word `.doc` compatible.
- Base de tests existante (Vitest + RTL, tests unitaires/composants déjà présents).

### Dette documentaire détectée
- Le plan historique mélange des éléments terminés et futurs.
- Certaines priorités anciennes ne sont plus alignées avec l’état réel du codebase.

---

## 2) Objectif de ce plan

Fournir un backlog **exécutable par agent** avec :
- lots de travail indépendants,
- tâches atomiques,
- critères d’acceptation vérifiables,
- ordre de priorité clair.

---

## 3) Backlog priorisé (agent-ready)

## 🔴 P0 — Valeur immédiate (court terme)

### P0.1 Recherche globale dans les nœuds
**But** : retrouver rapidement du contenu dans des documents longs.

**Scope technique (fichiers pressentis)**
- `src/components/Sidebar.tsx`
- `src/store.ts`
- `src/types.ts`
- `src/test/Sidebar.test.tsx`

**Tâches agent**
- [x] Ajouter un champ de recherche dans la sidebar.
- [x] Filtrer sur titre + contenu des nœuds.
- [x] Mettre en évidence les correspondances dans la liste.
- [x] Conserver la navigation/sélection correcte après filtrage.

**Critères d’acceptation**
- Recherche insensible à la casse.
- Résultat fluide sur dataset moyen (mock courant).
- Aucun comportement cassé sur expand/collapse.

---

### P0.2 Drag & Drop de réorganisation des nœuds
**But** : réordonner rapidement la structure d’un document.

**Scope technique**
- `src/components/Sidebar.tsx`
- `src/store.ts`
- `src/types.ts`

**Tâches agent**
- [x] Choisir une lib DnD légère compatible React actuel.
- [x] Implémenter déplacement intra-parent (ordre).
- [x] Implémenter déplacement inter-parents (changer parent).
- [x] Bloquer les drops invalides (cycles, > H6).
- [x] Mettre à jour tests store + composants.

**Critères d’acceptation**
- Reorder et changement de parent fonctionnent (souris minimum).
- Intégrité de l’arbre garantie (pas de cycle, profondeur max respectée).

---

### P0.3 Export DOCX natif (`.docx`)
**But** : remplacer l’export `.doc` HTML-compat par un vrai `.docx`.

**Scope technique**
- nouveau module `src/utils/docxExport.ts`
- `src/components/DocumentManager.tsx` (ou composant export existant)
- `src/test/*` ciblés export

**Tâches agent**
- [x] Intégrer bibliothèque `docx` (npm).
- [x] Mapper titres/listes/paragraphes/tableaux vers le modèle DOCX.
- [x] Générer fichier `.docx` téléchargeable.
- [x] Conserver export `.doc` existant derrière option legacy (temporaire).

**Critères d’acceptation**
- Le fichier s’ouvre correctement dans Word/LibreOffice.
- Structure de titres H1→H6 lisible et cohérente.
- Pas de régression sur exports existants (MD/HTML/PDF).

---

## 🟠 P1 — Productivité avancée (moyen terme)

### P1.1 Tags + recherche dans la bibliothèque de documents
**But** : mieux organiser une collection croissante de documents.

**Tâches agent**
- [x] Ajouter tags sur `DocumentMeta`.
- [x] CRUD de tags dans le `DocumentManager`.
- [x] Recherche/filtre par nom + tags.
- [x] Migration douce des métadonnées existantes.

**Critères d’acceptation**
- Les documents historiques restent lisibles sans migration manuelle.
- Filtrage combiné nom/tags fonctionnel.

---

### P1.2 Export en masse ZIP
**But** : exporter tous les documents en une archive.

**Tâches agent**
- [x] Intégrer `jszip`.
- [x] Exporter index + documents en JSON (et assets si présents).
- [x] Ajouter import en masse depuis ZIP.
- [x] Gérer collisions d’ids/titres à l’import.

**Critères d’acceptation**
- Round-trip export→import sans perte de données critiques.
- Message d’erreur explicite si archive invalide.

---

### P1.3 IA d’assistance éditoriale (incomplétudes)
**But** : signaler les sections à enrichir.

**Tâches agent**
- [x] Définir règles de détection locale (longueur, placeholders, sections vides).
- [x] Ajouter badge “À compléter” dans la sidebar.
- [x] Ajouter action “Proposer un enrichissement IA”.

**Critères d’acceptation**
- Les nœuds détectés sont explicables par règles lisibles.
- L’action IA ouvre un prompt prérempli pertinent.

---

## 🟡 P2 — Plateforme et robustesse

### P2.1 Persistance avancée (IndexedDB)
- [ ] Concevoir stratégie de migration depuis localStorage.
- [ ] Implémenter adaptateur de stockage (`idb`/`dexie`).
- [ ] Vérifier compat, rollback et volume élevé.

### P2.2 Partage par lien (backend requis)
- [ ] Spécifier API minimale (create/read snapshot).
- [ ] Ajouter feature flag côté front.
- [ ] Préparer UI de génération/copie de lien.

### P2.3 Collaboration éditoriale
- [ ] Commentaires par nœud.
- [ ] Historique de révision visible utilisateur.
- [ ] Export Notion/Confluence (si API disponible).

---

## 4) Qualité / tests (obligatoire sur chaque lot)

## Politique
- Chaque lot inclut ses tests ciblés.
- Pas de merge sans `npm test` vert.
- Ne pas corriger de bugs hors scope sauf blocage critique.

## Check-list agent (à répéter par lot)
- [ ] Tests unitaires des fonctions ajoutées/modifiées.
- [ ] Tests de composant pour l’UI impactée.
- [ ] Vérification manuelle rapide (happy path + 1 erreur).
- [ ] Mise à jour doc si UX change.

---

## 5) Séquencement recommandé (sprints)

### Sprint A (impact direct)
1. P0.1 Recherche globale nœuds
2. P0.2 Drag & Drop nœuds

### Sprint B (exports & bibliothèque)
1. P0.3 DOCX natif
2. P1.1 Tags + recherche documents
3. P1.2 ZIP export/import

### Sprint C (IA + plateforme)
1. P1.3 Détection d’incomplétudes
2. P2.1 IndexedDB
3. P2.2 Partage backend

---

## 6) Définition de terminé (DoD globale)

Un lot est “Terminé” uniquement si :
- [ ] Feature utilisable depuis l’UI principale.
- [ ] Tests liés au lot en vert.
- [ ] Aucun warning/blocage majeur introduit.
- [ ] Documentation (README/PLAN) à jour.
- [ ] Comportements d’erreur gérés côté UX.

---

## 7) Template de mission pour agent

Utiliser ce format pour lancer un agent sur un lot :

1. **Contexte** : lot ciblé (ex: P0.1), fichiers probables.
2. **Objectif** : résultat utilisateur attendu.
3. **Contraintes** : minimal, pas de refacto hors scope, style existant.
4. **Tâches** : checklist atomique du lot.
5. **Validation** : tests à lancer + critères d’acceptation.
6. **Livrables** : fichiers modifiés + résumé des décisions.

Exemple de consigne courte :
> Implémente P0.1 (recherche globale dans les nœuds) dans le style actuel. Ajoute le champ de recherche sidebar, filtre titre + contenu, mets en évidence les matches, ajoute tests ciblés. Ne modifie pas les features non liées. Termine par le résumé des fichiers changés et des tests exécutés.

---

## 8) Prochaine action recommandée

Lancer immédiatement un agent sur **P0.1 Recherche globale dans les nœuds**, puis enchaîner sur **P0.2 Drag & Drop**.