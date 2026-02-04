/**
 * Données mock pour tester l'application
 * Contient un projet exemple avec plusieurs nœuds et rôles IA différents
 * Structure fractale multi-niveaux (jusqu'à 4 niveaux de profondeur)
 */

export const INITIAL_MARKDOWN = `# Projet Marketing Q1 2026

<!-- {"meta": {"id": "root-001", "type": "project-root", "contextConfig": {"isGlobal": true}}} -->

Ceci est le projet marketing pour Q1 2026. Il contient les stratégies de communication, les budgets et les objectifs clés.

## 📊 Stratégie Financière

<!-- {"meta": {"id": "node-finance-001", "type": "section", "agentConfig": {"role": "Directeur Financier", "instructions": "Analyse chaque proposition sous l'angle financier. Sois critique sur les coûts et le ROI."}, "contextConfig": {"isGlobal": false, "dependencies": ["root-001"]}}} -->

Budget total alloué: 50,000€

Répartition prévue:
- Publicité: 25,000€
- Contenu: 15,000€
- Outils et licences: 10,000€

### 💰 Budget Publicité

<!-- {"meta": {"id": "node-finance-pub-001", "type": "section", "agentConfig": {"role": "Expert Media Buying", "instructions": "Optimise les dépenses publicitaires et maximise le ROAS."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-finance-001"]}}} -->

Répartition du budget publicité (25,000€):
- Google Ads: 10,000€
- Meta Ads: 8,000€
- LinkedIn Ads: 5,000€
- Retargeting: 2,000€

#### 🔍 Campagnes Google Ads

<!-- {"meta": {"id": "node-google-ads-001", "type": "section", "agentConfig": {"role": "Spécialiste Google Ads", "instructions": "Expert en SEA et optimisation de campagnes Google."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-finance-pub-001"]}}} -->

Campagnes prévues:
- Search Brand: 3,000€
- Search Generic: 4,000€
- Display Remarketing: 2,000€
- YouTube Pre-roll: 1,000€

KPIs cibles:
- CPC moyen < 1.50€
- CTR > 3%
- Taux de conversion > 2%

#### 📱 Campagnes Meta Ads

<!-- {"meta": {"id": "node-meta-ads-001", "type": "section", "agentConfig": {"role": "Spécialiste Meta Ads", "instructions": "Expert en publicité Facebook et Instagram."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-finance-pub-001"]}}} -->

Campagnes prévues:
- Awareness: 2,000€
- Consideration: 3,000€
- Conversion: 3,000€

Audiences cibles:
- Lookalike 1% clients existants
- Retargeting visiteurs site
- Intérêts: Marketing, SaaS, Tech

### 📈 Prévisions ROI

<!-- {"meta": {"id": "node-finance-roi-001", "type": "section", "agentConfig": {"role": "Analyste Financier", "instructions": "Calcule et projette le retour sur investissement."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-finance-001"]}}} -->

Projections Q1:
- Revenus attendus: 150,000€
- Coût total marketing: 50,000€
- ROI projeté: 200%
- Période de récupération: 45 jours

## 🎯 Stratégie de Contenu

<!-- {"meta": {"id": "node-content-001", "type": "section", "agentConfig": {"role": "Responsable Contenu", "instructions": "Tu es un expert en création de contenu. Propose des améliorations narratives et d'engagement."}, "contextConfig": {"isGlobal": false, "dependencies": ["root-001"]}}} -->

Objectifs de contenu:
- 20 articles de blog par mois
- 40 posts réseaux sociaux par mois
- 2 webinaires par mois
- 1 newsletter hebdomadaire

### ✍️ Blog & Articles

<!-- {"meta": {"id": "node-content-blog-001", "type": "section", "agentConfig": {"role": "Rédacteur SEO", "instructions": "Rédige des articles optimisés pour le référencement naturel."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-content-001"]}}} -->

Thématiques principales:
- Guides pratiques (8 articles/mois)
- Études de cas (4 articles/mois)
- Actualités secteur (4 articles/mois)
- Comparatifs (4 articles/mois)

#### 📝 Calendrier Éditorial

<!-- {"meta": {"id": "node-content-calendar-001", "type": "section", "agentConfig": {"role": "Planificateur Éditorial", "instructions": "Organise et planifie la production de contenu."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-content-blog-001"]}}} -->

Semaine 1-2: Focus guides pratiques
Semaine 3: Focus études de cas
Semaine 4: Focus actualités et comparatifs

Processus de production:
1. Brief (J-7)
2. Rédaction (J-5)
3. Relecture (J-3)
4. Publication (J-0)

### 📣 Réseaux Sociaux

<!-- {"meta": {"id": "node-content-social-001", "type": "section", "agentConfig": {"role": "Community Manager", "instructions": "Crée du contenu engageant pour les réseaux sociaux."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-content-001"]}}} -->

Fréquence de publication:
- LinkedIn: 2 posts/jour
- Twitter/X: 3 posts/jour
- Instagram: 1 post/jour + stories

Types de contenu:
- Carrousels éducatifs
- Vidéos courtes (< 60s)
- Infographies
- Citations et insights

## 👥 Stratégie Audience

<!-- {"meta": {"id": "node-audience-001", "type": "section", "agentConfig": {"role": "Expert Segmentation", "instructions": "Analyse les segments d'audience et propose des optimisations de ciblage."}, "contextConfig": {"isGlobal": false}}} -->

Segments principaux:
- PME (40% du budget)
- Startups (35% du budget)
- Entreprises (25% du budget)

### 🎭 Personas

<!-- {"meta": {"id": "node-audience-personas-001", "type": "section", "agentConfig": {"role": "UX Researcher", "instructions": "Définis et affine les personas utilisateurs."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-audience-001"]}}} -->

#### 👔 Décideur IT (CTO/CPO)

<!-- {"meta": {"id": "node-persona-cto-001", "type": "section", "agentConfig": {"role": "Expert B2B Tech", "instructions": "Comprend les besoins et motivations des décideurs techniques."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-audience-personas-001"]}}} -->

Profil:
- Âge: 35-50 ans
- Expérience: 10+ ans en tech
- Budget décisionnel: 50k-500k€

Pain points:
- Intégration complexe
- Scalabilité
- Sécurité des données

Motivations:
- Innovation
- Efficacité opérationnelle
- Réduction des coûts

#### 📈 Marketing Manager

<!-- {"meta": {"id": "node-persona-marketing-001", "type": "section", "agentConfig": {"role": "Expert Marketing B2B", "instructions": "Comprend les défis des responsables marketing."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-audience-personas-001"]}}} -->

Profil:
- Âge: 28-45 ans
- Expérience: 5+ ans en marketing
- Équipe: 2-10 personnes

Pain points:
- Attribution multi-touch
- Reporting ROI
- Automatisation

Motivations:
- Croissance des leads
- Optimisation du funnel
- Personnalisation

### 📊 Analyse Comportementale

<!-- {"meta": {"id": "node-audience-behavior-001", "type": "section", "agentConfig": {"role": "Data Analyst", "instructions": "Analyse les comportements utilisateurs et propose des insights."}, "contextConfig": {"isGlobal": false, "dependencies": ["node-audience-001"]}}} -->

Métriques clés à suivre:
- Temps sur site
- Pages par session
- Taux de rebond
- Chemins de conversion

Outils d'analyse:
- Google Analytics 4
- Hotjar (heatmaps)
- Mixpanel (events)
`;

/**
 * Arborescence attendue après parsing (4 niveaux):
 * 
 * # Projet Marketing Q1 2026 (root, niveau 1)
 *   ## Stratégie Financière (niveau 2)
 *     ### Budget Publicité (niveau 3)
 *       #### Campagnes Google Ads (niveau 4)
 *       #### Campagnes Meta Ads (niveau 4)
 *     ### Prévisions ROI (niveau 3)
 *   ## Stratégie de Contenu (niveau 2)
 *     ### Blog & Articles (niveau 3)
 *       #### Calendrier Éditorial (niveau 4)
 *     ### Réseaux Sociaux (niveau 3)
 *   ## Stratégie Audience (niveau 2)
 *     ### Personas (niveau 3)
 *       #### Décideur IT (niveau 4)
 *       #### Marketing Manager (niveau 4)
 *     ### Analyse Comportementale (niveau 3)
 */
