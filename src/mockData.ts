/**
 * Données mock pour tester l'application
 * Contient un projet exemple avec plusieurs nœuds et rôles IA différents
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

Points critiques à valider:
- Justification du budget publicité
- Métriques de succès quantifiables
- Période de récupération du ROI

## 🎯 Stratégie de Contenu

<!-- {"meta": {"id": "node-content-001", "type": "section", "agentConfig": {"role": "Responsable Contenu", "instructions": "Tu es un expert en création de contenu. Propose des améliorations narratives et d'engagement."}, "contextConfig": {"isGlobal": false, "dependencies": ["root-001"]}}} -->

Objectifs de contenu:
- 20 articles de blog par mois
- 40 posts réseaux sociaux par mois
- 2 webinaires par mois
- 1 newsletter hebdomadaire

Piliers de contenu:
1. Education (40% du contenu)
2. Inspiration (35% du contenu)
3. Promotion (25% du contenu)

Type de contenu prioritaire: Stories courtes et vidéos courtes pour les réseaux sociaux.

## 👥 Stratégie Audience

<!-- {"meta": {"id": "node-audience-001", "type": "section", "agentConfig": {"role": "Expert Segmentation", "instructions": "Analyse les segments d'audience et propose des optimisations de ciblage."}, "contextConfig": {"isGlobal": false}}} -->

Segments principaux:
- PME (40% du budget)
- Startups (35% du budget)
- Entreprises (25% du budget)

Personas clés:
- Décideurs IT (CTO, Chief Product Officer)
- Marketing Managers
- Entrepreneurs
`;

/**
 * Arborescence attendue après parsing:
 * - Projet Marketing Q1 2026 (root)
 *   - Stratégie Financière (section - Finance)
 *   - Stratégie de Contenu (section - Content)
 *   - Stratégie Audience (section - Audience)
 */
