# Plan de travail — IRLM Node Interface

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
**Problème** : L'IA peut générer des réponses verbeuses avec des explications inutiles pour le document final.

**Objectif** : Définir des règles pour que l'IA génère du contenu "prêt à intégrer".

**Tâches** :
- [ ] Ajouter un mode "Rédaction" vs "Discussion" dans le chat
  - **Discussion** : Réponses explicatives, conversationnelles
  - **Rédaction** : Réponses concises, directement intégrables au document

- [ ] Créer des instructions système spécifiques :
  ```
  MODE RÉDACTION :
  - Réponds UNIQUEMENT avec le contenu à intégrer
  - Pas d'introduction ("Voici...", "Bien sûr...")
  - Pas de conclusion ("N'hésite pas à...")
  - Format Markdown propre et structuré
  - Utilise les listes, tableaux, et titres appropriés
  ```

- [ ] Bouton "Intégrer au document" amélioré :
  - Prévisualisation avant intégration
  - Choix de l'emplacement (remplacer, ajouter au début, ajouter à la fin)
  - Option de reformatage automatique

### 4.2 Templates de prompts
- [ ] Créer des raccourcis de prompts par type de section :
  - "Développe ce point" → génère un paragraphe détaillé
  - "Résume" → synthétise le contenu existant
  - "Ajoute des exemples" → enrichit avec des cas concrets
  - "Crée un tableau comparatif" → format tableau
  - "Génère un diagramme" → code Mermaid

### 4.3 Historique et contexte
- [ ] Conserver l'historique de conversation par nœud
- [ ] Permettre de "reprendre" une conversation précédente
- [ ] Option pour inclure/exclure l'historique dans le contexte IA

---

## 🔲 Phase 5 : Fonctionnalités avancées (FUTUR)

### 5.1 Collaboration et export
- [ ] Export en PDF
- [ ] Export en HTML standalone
- [ ] Export en DOCX (optionnel)
- [ ] Partage de document via lien (nécessite backend)

### 5.2 Gestion des nœuds
- [ ] Drag & Drop pour réorganiser les nœuds
- [ ] Copier/Coller des nœuds
- [ ] Recherche dans tous les nœuds
- [ ] Filtrage par type de nœud

### 5.3 IA avancée
- [ ] Génération automatique de todo-list depuis le contenu
- [ ] Détection de sections incomplètes
- [ ] Suggestions proactives de l'IA
- [ ] Traduction de sections

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
