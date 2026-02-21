# Plan de travail — Node IA Worker

## ✅ Phase 1 : Activation Gemini/OpenAI (TERMINÉ)

### Objectif
Rendre l'interface testable et fonctionnelle avec un appel réel aux APIs IA.

### Réalisations
- [x] Configuration multi-provider (Gemini + OpenAI)
- [x] Modal de paramètres avec sélection du modèle
- [x] Persistance localStorage de la configuration
- [x] Gestion des erreurs API

---

## ✅ Phase 2 : Parcours utilisateur & Éditeur enrichi (TERMINÉ)

### Réalisations
- [x] Wizard de création de nouveau document avec IA
- [x] Templates de documents prédéfinis
- [x] Toolbar d'édition Markdown (gras, italique, listes, etc.)
- [x] Support Mermaid.js pour les diagrammes
- [x] Insertion de tableaux Markdown
- [x] Modes de vue : Éditer / Split / Aperçu

---

## ✅ Phase 3 : Améliorations UX/UI (TERMINÉ)

### 3.1 Scroll et débordement des panneaux
**Réalisations** :
- [x] Vérifier `overflow-y-auto` sur chaque panneau (Sidebar, Editor, Chat)
- [x] S'assurer que les conteneurs flex ont `min-h-0` pour permettre le scroll
- [x] Ajouter des indicateurs visuels de scroll (ombre en haut/bas si contenu dépassant)

### 3.2 Panneaux redimensionnables
**Réalisations** :
- [x] Implémentation native des panneaux redimensionnables
- [x] Poignées de redimensionnement visuelles entre les colonnes (avec icône GripVertical)
- [x] Définition des tailles minimales pour chaque panneau

### 3.3 Améliorations visuelles diverses
- [x] Améliorer le contraste des boutons de la toolbar (classe `.toolbar-btn`)
- [x] Ajouter des tooltips sur tous les boutons (classe `.tooltip-wrapper`)
- [x] Animation de transition lors du changement de nœud actif (classe `.node-transition`)
- [x] Indicateur visuel du nœud en cours d'édition dans la sidebar (classe `.node-active`)
- [x] Groupe hover pour afficher les actions sur les nœuds (classe `.sidebar-node-item`)
- [ ] Mode sombre (reporté pour une phase ultérieure)

---

## 🔲 Phase 4 : Règles de réponse IA (À FAIRE)

### 4.1 Instructions système pour l'intégration au document
## ✅ Phase 4 : Structure Fractale & Contexte IA (TERMINÉ)

### 4.1 Hiérarchie multi-niveaux (fractale)
**Réalisations** :
- [x] Structure récursive jusqu'à 6 niveaux de profondeur (H1 à H6)
- [x] Données mock avec 4 niveaux de hiérarchie
- [x] Couleurs distinctes par niveau dans la sidebar
- [x] Indicateur de niveau (H1, H2, H3, H4...)
- [x] Compteur d'enfants par nœud
- [x] Boutons "Tout déplier / Tout replier"

### 4.2 Navigation et fil d'Ariane (Breadcrumb)
**Réalisations** :
- [x] Fil d'Ariane cliquable dans l'éditeur
- [x] Navigation vers les nœuds parents
- [x] Fonction `getNodePath()` dans le store
- [x] Affichage du niveau et du nombre d'enfants

### 4.3 Contexte IA hiérarchique
**Réalisations** :
- [x] Contexte sandwich enrichi avec les ancêtres
- [x] L'IA reçoit le chemin complet dans la hiérarchie
- [x] Instructions tenant compte de la position du nœud
- [x] Mode Rédaction vs Discussion (déjà implémenté en Phase 2)
- [x] Templates de prompts rapides (déjà implémenté en Phase 2)

---

## ✅ Phase 4.5 : Différenciation Discussion/Structure (TERMINÉ)

### Objectif
Améliorer la distinction entre les commentaires de l'IA et le contenu à intégrer, et faciliter la création de sous-sections.

### 4.5.1 Format de réponse structuré
**Réalisations** :
- [x] Nouveau format de réponse IA avec 3 sections distinctes :
  - 📣 **DISCUSSION** : Commentaires, analyses, explications (non intégrables)
  - 📝 **CONTENU** : Contenu Markdown à intégrer dans le nœud actuel
  - 🏗️ **SOUS-SECTIONS** : Propositions de sous-nœuds avec titres et descriptions
- [x] Parser automatique des réponses IA (`parseAIResponse()`)
- [x] Interface structurée pour afficher les sections de manière distincte

### 4.5.2 Création automatique de sous-sections
**Réalisations** :
- [x] Extraction automatique des titres Markdown proposés par l'IA
- [x] Bouton "Créer" pour chaque sous-section proposée
- [x] Bouton "Créer toutes les sous-sections" pour création en masse
- [x] Affichage du niveau (H2, H3, H4...) pour chaque sous-section proposée

### 4.5.3 Amélioration UI création de nœuds
**Réalisations** :
- [x] Prompt de saisie du titre lors de la création d'un nœud enfant
- [x] Affichage du niveau qui sera créé dans le tooltip ("Ajouter un H3")
- [x] Désactivation du bouton "+" si profondeur maximale atteinte (H6)
- [x] Bouton "+ H1" dans le header de la sidebar pour créer des nœuds racine
- [x] Indicateur visuel clair du niveau de chaque nœud (badge H1, H2, H3...)

---

## ✅ Phase 5.1 : Import intelligent de fichiers (TERMINÉ)

### Objectif
Permettre l'importation de fichiers externes avec analyse IA automatique de la structure.

### Réalisations
- [x] Composant `ImportWizard` avec parcours guidé en 4 étapes
- [x] Interface d'upload avec drag & drop + sélecteur de fichiers
- [x] Support des formats : TXT, MD, PDF, DOCX
- [x] Extraction automatique du contenu textuel
- [x] Aperçu du contenu importé avec statistiques (caractères, mots)
- [x] **Analyse IA de la structure** :
  - Détection automatique des niveaux (Tomes → Chapitres → Sous-parties)
  - Instructions personnalisables pour guider l'analyse
  - Support de différents types de documents (romans, documents techniques)
- [x] Interface de validation et modification de la structure détectée :
  - Arbre hiérarchique éditable
  - Modification des titres de sections
  - Ajout/suppression de sections
  - Indicateur visuel des niveaux (H1 à H6)
- [x] Mode d'import : remplacer ou ajouter au document existant
- [x] Import brut (sans analyse) disponible si préféré

---

## ✅ Phase 5 : Dashboard documents & Exports (TERMINÉ)

### 5.1 Dashboard de gestion des documents
**Réalisations** :
- [x] `DocumentManager` : modal listant tous les documents de l'utilisateur
- [x] Tri par date de dernière modification
- [x] Affichage du nombre de nœuds et des dates de création / modification
- [x] Renommer un document (édition inline + touche Entrée)
- [x] Dupliquer un document
- [x] Supprimer un document avec confirmation
- [x] Bouton "Mes documents" dans la barre de navigation

### 5.2 Exports professionnels
**Réalisations** :
- [x] **Export Markdown** : fichier `.md` brut, fidèle au contenu
- [x] **Export HTML** : document HTML autonome avec CSS intégré, sans dépendance externe (Tailwind supprimé), rendu correct des tableaux, listes imbriquées, blocs de code
- [x] **Export PDF** : utilise `buildPrintHtmlDocument` avec :
  - `@page { size: A4; margin: 2.5cm 2cm 2.5cm 2.5cm; }` pour les marges d'impression
  - Saut de page automatique avant chaque `<h1>` (sauf le premier)
  - `page-break-after: avoid` sur les titres (h2–h6) pour éviter les ruptures orphelines
  - `page-break-inside: avoid` sur les blocs de code, citations et tableaux
  - Règles orphans/widows (3 lignes minimum) pour les paragraphes
  - URLs affichées entre parenthèses après les liens en impression
- [x] **Export Word (.doc)** : HTML compatible Microsoft Word avec espaces de noms Office, styles `mso-*`, et définition de la section de page Word (21×29,7 cm, marges 2,5/2 cm)
- [x] Conversion Markdown→HTML robuste : gestion des tableaux en `<table>` réelle, blocs `<pre><code>`, listes `<ul>`/`<ol>`, titres h1–h6, citations, HR

---

## 🔲 Phase 6 : Fonctionnalités avancées (FUTUR)

### 6.1 Export avancé
- [ ] **Export DOCX natif** via la bibliothèque `docx` (npm) pour générer des fichiers `.docx` réels (avec styles, numérotation, images)
- [ ] **Export ODT** pour LibreOffice (format ouvert)
- [ ] **Export ePub** pour les longs documents (romans, documentations)
- [ ] **Aperçu d'impression intégré** dans l'application avant export PDF
- [ ] **En-têtes et pieds de page** personnalisables pour PDF (titre, numéro de page, date)
- [ ] **Table des matières** auto-générée en début de document exporté

### 6.2 Gestion des nœuds
- [ ] **Drag & Drop** pour réorganiser les nœuds dans la sidebar
- [ ] **Recherche globale** dans tous les nœuds (titre + contenu)
- [ ] **Filtrage** par niveau de profondeur ou type de nœud
- [ ] **Statistiques de document** : nombre de mots, temps de lecture estimé
- [ ] **Export partiel** : exporter uniquement le nœud actif et ses enfants

### 6.3 Dashboard documents amélioré
- [ ] **Vue grille / liste** commutable dans le DocumentManager
- [ ] **Aperçu rapide** au survol d'un document (tooltip avec les 3 premiers nœuds)
- [ ] **Étiquettes / tags** pour organiser les documents
- [ ] **Recherche** parmi les documents par titre
- [ ] **Export de tous les documents** dans un fichier ZIP (JSON + assets)
- [ ] **Import en masse** depuis une archive ZIP
- [ ] **Synchronisation cloud optionnelle** (ex. : Firebase, Supabase) pour accès multi-appareils

### 6.4 IA avancée
- [ ] **Génération automatique de plan** : l'IA propose une structure complète à partir d'un titre
- [ ] **Détection de sections incomplètes** : score de complétude visible dans la sidebar
- [ ] **Suggestions proactives** : l'IA propose du contenu sans qu'on lui demande
- [ ] **Traduction de sections** : traduire un nœud sélectionné dans une autre langue
- [ ] **Résumé automatique** d'un nœud ou du document entier
- [ ] **Détection de doublons** entre nœuds (contenu proche)

### 6.5 Collaboration
- [ ] **Partage via lien court** (nécessite un backend / service de raccourcissement)
- [ ] **Commentaires par nœud** (annotations non intégrées au contenu)
- [ ] **Historique des révisions** visible par l'utilisateur (au-delà du undo/redo en mémoire)
- [ ] **Export vers Notion / Confluence** via API

### 6.6 Performance et qualité
- [ ] **Couverture de tests** : atteindre 70 % avec Vitest + React Testing Library
- [ ] **Virtualisation** de la sidebar pour les documents avec > 200 nœuds
- [ ] **Persistance via IndexedDB** (remplacement localStorage pour les grands documents)
- [ ] **Mode hors ligne** (PWA) : service worker pour mise en cache de l'application
- [ ] **Mode sombre** complet

---

## Priorités recommandées (prochaine phase)

1. **6.1 Export DOCX natif** — fort impact utilisateur, fiabilité maximale
2. **6.3 Tags & recherche documents** — améliore l'organisation dès que la bibliothèque grandit
3. **6.2 Drag & Drop nœuds** — très attendu pour la restructuration de documents complexes
4. **6.4 Génération de plan IA** — différenciateur fort par rapport aux éditeurs classiques

---

## Notes techniques

### Librairies suggérées pour la phase 6
- `docx` (npm) : génération de vrais fichiers `.docx` sans Word
- `jszip` (npm) : création d'archives ZIP pour export en masse
- `idb` ou `dexie` : accès IndexedDB plus ergonomique
- `fuse.js` : recherche floue dans les nœuds et documents
- `react-dnd` ou `@dnd-kit/core` : drag & drop des nœuds dans la sidebar

### Architecture de l'export (phase 6.1)
L'export DOCX natif devra passer par un pipeline :
`NodeData[] → Markdown → AST remark → docx.js Document`
Il est recommandé de créer un module `src/utils/docxExport.ts` dédié pour séparer la logique d'export.

### Structure des instructions IA (Phase 4)
Les instructions doivent être injectées dans `buildSystemPrompt()` de `aiService.ts` selon le mode choisi.
