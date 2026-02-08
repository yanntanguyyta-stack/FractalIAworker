# 🧠 IRLM Node Interface V2

**Architecture & Développement - Local-First Markdown Collaboration avec IA Persona**

Une application révolutionnaire de collaboration IA où un fichier Markdown unique est la seule source de vérité. Chaque section possède une "Persona IA" dédiée pour contextualiser les discussions.

## ✨ Caractéristiques Principales

- 📄 **Source Unique de Vérité**: Un fichier Markdown contient tout
- 🤖 **IA Contextuelle**: Chaque nœud a sa propre persona IA avec rôle et instructions
- 🏗️ **Architecture Local-First**: Tout fonctionnement sans serveur
- 📚 **Contexte Sandwich**: L'IA reçoit un contexte structuré en 3 couches (Global, Rôle, Tâche)
- 💾 **Métadonnées Invisibles**: Les configurations IA sont stockées en commentaires HTML
- 🎨 **Interface 3 Colonnes**: Navigation, Édition, Chat IA côte à côte
- ⚡ **State Management**: Zustand pour la gestion d'état réactive
- 🎯 **TypeScript Strict**: Typage complet pour la robustesse

## 🛠️ Stack Technique

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 18.3.1 | UI Framework |
| Vite | 5.0.8 | Build tool |
| TypeScript | 5.3.3 | Langage |
| Zustand | 4.4.7 | State management |
| Tailwind CSS | 3.4.1 | Styling |
| Unified + Remark | 10/11 | Markdown parsing |
| Zod | 3.22.4 | Validation |
| Lucide React | 0.366.0 | Icons |

## 📁 Architecture du Projet

```
src/
├── types.ts                 # Schémas Zod et types TypeScript
├── markdownEngine.ts        # Parser/Serializer Markdown bidirectionnel
├── aiService.ts             # Contexte Sandwich IA
├── store.ts                 # Store Zustand (state management)
├── mockData.ts              # Données d'exemple
├── index.css                # Styles Tailwind
├── main.tsx                 # Point d'entrée React
└── components/
    ├── App.tsx              # Layout principal (3 colonnes)
    ├── Sidebar.tsx          # Navigation arbre des nœuds
    ├── EditorPane.tsx       # Édition du nœud actif
    └── ChatPane.tsx         # Interface IA

Configuration:
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configurer votre clé API (Bring Your Own Key)
L'application utilise le modèle **BYOK** : chaque utilisateur renseigne sa clé dans l'interface.

1. Ouvrez la configuration IA via le bouton ⚙️ **Configurer IA**
2. Choisissez votre fournisseur (Gemini ou OpenAI)
3. Collez votre clé API

> La clé est stockée **localement dans votre navigateur** (localStorage) et n'est jamais envoyée à un serveur.

### 3. Lancer le serveur de développement
```bash
npm run dev
```

L'application s'ouvrira automatiquement à `http://localhost:5173`

### 4. Build pour la production
```bash
npm run build
npm run preview
```

## ☁️ Déploiement sur Vercel

Le projet est un **SPA Vite** sans backend, prêt pour Vercel.

- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Framework Preset** : Vite

Un fichier `vercel.json` est fourni pour la réécriture SPA (`/index.html`).

## 💡 Concepts Clés

### Architecture de Données

Chaque **nœud** du projet a la structure suivante:

```typescript
interface NodeData {
  id: string;
  heading: string;           // Titre (# ou ##)
  headingDepth: number;      // Profondeur (1-6)
  content: string;           // Contenu texte
  meta: NodeMeta;            // Métadonnées
  children: NodeData[];      // Enfants récursifs
}

interface NodeMeta {
  id: string;
  type: 'project-root' | 'section' | 'task';
  agentConfig?: {
    role: string;            // Ex: "Directeur Financier"
    instructions: string;    // Directives spécifiques
    tone?: string;
  };
  contextConfig?: {
    isGlobal: boolean;       // Injecter pour tous les appels IA
    dependencies?: string[]; // IDs d'autres nœuds
  };
}
```

### Contexte Sandwich IA

Chaque appel IA reçoit un contexte structuré:

```
Couche 1 (Global)
└─ Contenu des nœuds marqués isGlobal: true

Couche 2 (Rôle Local)
└─ Rôle + Instructions du nœud actif

Couche 3 (Tâche)
└─ Contenu du nœud actif
```

### Métadonnées Invisibles

Les métadonnées sont stockées en commentaires HTML à la fin de chaque section:

```markdown
## Ma Section

Contenu de la section...

<!-- {"meta": {"id": "node-123", "type": "section", ...}} -->
```

## 🎮 Usage de l'Interface

### Colonne Gauche (Navigation)
- Arbre hiérarchique des nœuds
- Clic pour sélectionner un nœud
- Boutons `+` pour ajouter des enfants
- Boutons `✕` pour supprimer

### Colonne Centrale (Édition)
- Visualisation du titre et métadonnées
- Textarea pour éditer le contenu
- Affichage du rôle IA
- Statistiques (caractères, mots)

### Colonne Droite (Chat IA)
- Discussion contextuelle avec l'IA
- Affichage du rôle actif ("Je suis [Rôle]")
- Bouton "Copier" pour chaque réponse
- Bouton "Commit" pour ajouter au nœud

## 📋 Fonctionnalités Core

### Moteur Markdown
- ✅ Parse bidirectionnel Markdown ↔ Tree
- ✅ Extraction des commentaires HTML
- ✅ Hiérarchie basée sur niveaux de titres
- ✅ Serialization robuste

### State Management (Zustand)
- `loadMarkdown()` - Charger un fichier
- `selectNode()` - Activer un nœud
- `updateNodeContent()` - Modifier le contenu
- `updateNodeMeta()` - Modifier les métadonnées
- `addChild()` - Créer un enfant
- `deleteNode()` - Supprimer un nœud
- `getActiveNode()` - Accéder au nœud actif
- `getAllNodes()` - Lister tous les nœuds

### Service IA
- `buildContextSandwich()` - Construire le contexte
- `buildSystemPrompt()` - Générer le prompt système
- `buildUserMessage()` - Formatage du message
- `callAIAPI()` - Appel IA (mock ou API réelle)

## 🔄 Workflow Typique

1. **Chargement**: L'utilisateur charge un fichier Markdown (ou utilise les données par défaut)
2. **Parsing**: Le moteur crée l'arbre NodeData[]
3. **Navigation**: Sélection d'un nœud dans la sidebar
4. **Discussion**: La colonne Chat construit le contexte sandwich
5. **Réponse IA**: L'IA répond en tenant compte du rôle et contexte
6. **Commit**: La réponse peut être ajoutée directement au nœud
7. **Sauvegarde**: Export du Markdown modifié

## 📚 Exemple de Markdown

```markdown
# Projet Marketing Q1 2026

<!-- {"meta": {"id": "root-001", "type": "project-root", "contextConfig": {"isGlobal": true}}} -->

Ceci est le projet marketing pour Q1 2026...

## 📊 Stratégie Financière

<!-- {"meta": {"id": "node-finance-001", "type": "section", "agentConfig": {"role": "Directeur Financier", "instructions": "Sois critique sur les coûts."}, "contextConfig": {"dependencies": ["root-001"]}}} -->

Budget total: 50,000€...
```

## 🧪 Tests

Les données mock (`mockData.ts`) fournissent un projet exemple complet:
- **Root**: "Projet Marketing Q1 2026"
- **Sections**: Stratégie Financière, Contenu, Audience
- **Personas**: Directeur Financier, Responsable Contenu, Expert Segmentation

## 🔒 Validation

Tous les schémas utilisent **Zod** pour une validation robuste:
- Métadonnées des nœuds
- Configurations d'agent
- Types de nœuds

## 🌟 Points Forts de cette Architecture

✅ **Zero-Server**: Tout fonctionne localement
✅ **Source Unique**: Un fichier = tout le contexte
✅ **Persona IA Robuste**: Chaque section a son propre expert
✅ **Contexte Intelligent**: Sandwich à 3 couches
✅ **Type-Safe**: TypeScript strict
✅ **Extensible**: Facile d'ajouter des APIs réelles
✅ **User-Friendly**: Interface épurée et intuitive

## 🚧 Prochaines Étapes (Optionnel)

- [ ] Intégration API OpenAI/Claude
- [ ] Sync cloud (Firebase, Supabase)
- [ ] Export PDF/HTML
- [ ] Collaboration temps réel
- [ ] Versioning et history
- [ ] Templates de nœuds
- [ ] Plugins système

## 📱 Application installable (Chromebook / Android)

### Option 1 — PWA (recommandée)
Cette application peut être installée comme **PWA** sur Chromebook et Android.

**Pré-requis** :
- Utiliser HTTPS en production (obligatoire pour l’installation PWA).

**Étapes** :
1. Installer les dépendances :
  ```bash
  npm install
  ```
2. Lancer en dev :
  ```bash
  npm run dev
  ```
3. Sur Chrome (Chromebook/Android), ouvrir l’app et choisir **Installer l’application** depuis le menu.

> Les icônes PWA sont fournies en SVG (pwa-192.svg, pwa-512.svg). Pour une expérience optimale sur Android, remplacez-les par des PNG aux mêmes dimensions.

### Option 2 — APK Android (TWA/Capacitor)
Si vous voulez une vraie application Android installable via APK :
- **TWA (Trusted Web Activity)** : empaquette la PWA en APK.
- **Capacitor** : ajoute un shell natif autour de l’app web.

Si besoin, je peux préparer la version APK (TWA ou Capacitor).

## 📝 License

MIT

---

**Made with ❤️ by Fractal IA Worker V2 Architecture**
une solution d'interaction avec l'ia basé sur un éditeur markdown
