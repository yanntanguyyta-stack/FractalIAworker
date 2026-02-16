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

## 🔲 Phase 5 : Fonctionnalités avancées (FUTUR)

### 5.2 Collaboration et export
- [ ] Export en PDF
- [ ] Export en HTML standalone
- [ ] Export en DOCX (optionnel)
- [ ] Partage de document via lien (nécessite backend)

### 5.3 Gestion des nœuds
- [ ] Drag & Drop pour réorganiser les nœuds
- [ ] Copier/Coller des nœuds
- [ ] Recherche dans tous les nœuds
- [ ] Filtrage par type de nœud

### 5.4 IA avancée
- [ ] Génération automatique de todo-list depuis le contenu
- [ ] Détection de sections incomplètes
- [ ] Suggestions proactives de l'IA
- [ ] Traduction de sections

### 5.5 Tests et qualité
**Objectif** : Assurer une couverture de tests suffisante pour garantir la stabilité et la maintenabilité du projet.

- [ ] Mise en place de l'infrastructure de tests (Vitest + React Testing Library)
- [ ] Tests unitaires des fonctions utilitaires (store, aiService, markdownEngine)
- [ ] Tests de composants React (Sidebar, EditorPane, ChatPane, etc.)
- [ ] Tests d'intégration des flux utilisateur principaux
- [ ] Configuration du rapport de couverture de code
- [ ] Objectif : couverture minimale de 70%

### 5.6 Parcours d'onboarding
**Objectif** : Guider les nouveaux utilisateurs à travers les fonctionnalités de l'application.

- [ ] Bouton "Présentation" accessible depuis l'interface principale
- [ ] Tour guidé interactif des fonctionnalités principales
- [ ] Mise en évidence des éléments UI avec explications contextuelles
- [ ] Étapes du parcours : Sidebar → Éditeur → Chat IA → Modes de vue → Toolbar
- [ ] Option de ne plus afficher au démarrage (localStorage)
- [ ] Possibilité de relancer le tour à tout moment

### 5.7 Gestion multi-documents
**Objectif** : Permettre la gestion de plusieurs documents avec import/export en masse.

- [ ] Interface de gestion de bibliothèque de documents
- [ ] Liste des documents avec métadonnées (titre, date, taille)
- [ ] Création, suppression et sélection de documents
- [ ] Export de tous les documents en un seul fichier (ZIP ou JSON)
- [ ] Import en masse depuis un fichier d'archive
- [ ] Persistance des documents dans localStorage ou IndexedDB
- [ ] Gestion des conflits lors de l'import

---

## Priorités immédiates

1. **Phase 3.1** - Scroll (rapide à implémenter)
2. **Phase 3.2** - Panneaux redimensionnables (amélioration UX majeure)
3. **Phase 4.1** - Mode Rédaction vs Discussion (qualité du contenu généré)

---

## Notes techniques

### Librairies suggérées pour Phase 3.2
- `react-resizable-panels` : léger, bien maintenu
- `allotment` : plus de fonctionnalités, style VS Code
- `react-split` : simple mais moins de features

### Structure des instructions IA (Phase 4)
Les instructions doivent être injectées dans `buildSystemPrompt()` de `aiService.ts` selon le mode choisi.
