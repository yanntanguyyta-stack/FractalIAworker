import { NodeData } from './types';
import { AIConfig, AIProvider, ChatMode } from './store';

/**
 * Service IA pour construire le contexte sandwich hiérarchique
 * 
 * Couche 1 (Global): Contenu des nœuds marqués isGlobal: true
 * Couche 2 (Ancêtres): Contexte hiérarchique des nœuds parents
 * Couche 3 (Rôle Local): Role et instructions du nœud actif
 * Couche 4 (Tâche): Contenu du nœud actif
 */

/**
 * Structure d'une réponse IA parsée avec sections distinctes
 */
export interface ParsedAIResponse {
  discussion: string;        // 📣 Commentaires de l'IA
  content: string;          // 📝 Contenu à intégrer
  subsections: SubsectionProposal[];  // 🏗️ Sous-sections proposées
  raw: string;              // Réponse brute (fallback)
}

export interface SubsectionProposal {
  title: string;
  description: string;
  level: number;  // Niveau de heading (3, 4, 5, 6)
}

/**
 * Parser une réponse IA structurée
 */
export function parseAIResponse(response: string): ParsedAIResponse {
  const result: ParsedAIResponse = {
    discussion: '',
    content: '',
    subsections: [],
    raw: response,
  };

  // Patterns pour détecter les sections
  const discussionPattern = /📣\s*DISCUSSION\s*\n([\s\S]*?)(?=📝\s*CONTENU|🏗️\s*SOUS-SECTIONS|$)/i;
  const contentPattern = /📝\s*CONTENU\s*\n([\s\S]*?)(?=🏗️\s*SOUS-SECTIONS|$)/i;
  const subsectionsPattern = /🏗️\s*SOUS-SECTIONS\s*\n([\s\S]*?)$/i;

  // Extraire la section DISCUSSION
  const discussionMatch = response.match(discussionPattern);
  if (discussionMatch) {
    result.discussion = discussionMatch[1].trim();
  }

  // Extraire la section CONTENU
  const contentMatch = response.match(contentPattern);
  if (contentMatch) {
    result.content = contentMatch[1].trim();
  }

  // Extraire la section SOUS-SECTIONS
  const subsectionsMatch = response.match(subsectionsPattern);
  if (subsectionsMatch) {
    const subsectionsText = subsectionsMatch[1].trim();
    
    // Parser les sous-sections (format: ### Titre\nDescription)
    const headingPattern = /^(#{2,6})\s+(.+)$/gm;
    let match;
    const headings: { level: number; title: string; startIndex: number }[] = [];
    
    while ((match = headingPattern.exec(subsectionsText)) !== null) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        startIndex: match.index + match[0].length,
      });
    }

    // Extraire le contenu de chaque sous-section
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextStart = i + 1 < headings.length 
        ? subsectionsText.lastIndexOf('#', headings[i + 1].startIndex - 1)
        : subsectionsText.length;
      
      const description = subsectionsText
        .substring(heading.startIndex, nextStart)
        .trim();
      
      result.subsections.push({
        title: heading.title,
        description: description,
        level: heading.level,
      });
    }
  }

  // Si aucune section n'a été détectée, mettre tout dans discussion (fallback)
  if (!result.discussion && !result.content && result.subsections.length === 0) {
    result.discussion = response;
  }

  return result;
}

export interface AIContextSandwich {
  globalContext: string;
  hierarchicalContext: string; // Nouveau: contexte des ancêtres
  agentRole: string;
  agentInstructions: string;
  currentNodeContent: string;
  childrenSummary: string;
  fullDocumentContent: string; // Contenu complet du document (tous nœuds)
  dependencies: NodeData[];
  nodePath: NodeData[];
}

/**
 * Trouver le chemin vers un nœud (ancêtres)
 */
function findNodePath(nodes: NodeData[], targetId: string): NodeData[] {
  const path: NodeData[] = [];
  
  function traverse(nodeList: NodeData[], currentPath: NodeData[]): boolean {
    for (const node of nodeList) {
      const newPath = [...currentPath, node];
      if (node.id === targetId) {
        path.push(...newPath);
        return true;
      }
      if (node.children.length > 0) {
        if (traverse(node.children, newPath)) {
          return true;
        }
      }
    }
    return false;
  }
  
  traverse(nodes, []);
  return path;
}

/**
 * Construire un résumé des enfants d'un nœud pour le contexte IA
 */
function buildChildrenSummary(children: NodeData[], indent: string = ''): string {
  if (children.length === 0) return '';
  return children.map(child => {
    let line = `${indent}- ${'#'.repeat(child.headingDepth)} ${child.heading}`;
    if (child.content.trim()) {
      const preview = child.content.trim().split('\n')[0].substring(0, 100);
      line += ` — ${preview}`;
    }
    if (child.children.length > 0) {
      line += '\n' + buildChildrenSummary(child.children, indent + '  ');
    }
    return line;
  }).join('\n');
}

/**
 * Construire le contenu complet du document (tous nœuds récursivement)
 */
function buildFullDocumentContent(nodes: NodeData[]): string {
  let content = '';
  for (const node of nodes) {
    content += '#'.repeat(node.headingDepth) + ' ' + node.heading + '\n\n';
    if (node.content.trim()) {
      content += node.content.trim() + '\n\n';
    }
    if (node.children.length > 0) {
      content += buildFullDocumentContent(node.children);
    }
  }
  return content;
}

export interface ExtraContextDocument {
  name: string;
  markdown: string;
}

/**
 * Construire le contexte sandwich pour un appel API IA.
 * `extraDocuments` (optionnel) : documents annexes du projet à injecter dans
 * le contexte global (ex : liste des personnages quand on rédige le manuscrit).
 */
export function buildContextSandwich(
  tree: NodeData[],
  activeNode: NodeData | null,
  extraDocuments: ExtraContextDocument[] = []
): AIContextSandwich {
  // Couche 1: Contexte global (tous les nœuds avec isGlobal: true)
  const globalNodes = filterGlobalNodes(tree);
  const globalParts: string[] = globalNodes.map(n => `## ${n.heading}\n${n.content}`);

  if (extraDocuments.length > 0) {
    const extra = extraDocuments
      .map(d => `### Document : ${d.name}\n\n${d.markdown.trim() || '(vide)'}`)
      .join('\n\n---\n\n');
    globalParts.push(`## Documents additionnels\n\n${extra}`);
  }

  const globalContext = globalParts.join('\n\n');

  // Couche 2: Contexte hiérarchique (chemin des ancêtres)
  const nodePath = activeNode ? findNodePath(tree, activeNode.id) : [];
  const ancestors = nodePath.slice(0, -1);
  const hierarchicalContext = ancestors
    .map((node, index) => {
      const indent = '  '.repeat(index);
      return `${indent}${'#'.repeat(node.headingDepth)} ${node.heading}\n${indent}${node.content.split('\n').slice(0, 3).join('\n' + indent)}...`;
    })
    .join('\n\n');

  // Couche 3: Configuration du rôle local
  const agentRole = activeNode?.meta.agentConfig?.role || 'Assistant';
  const agentInstructions = activeNode?.meta.agentConfig?.instructions || '';

  // Couche 4: Contenu du nœud actif
  const currentNodeContent = activeNode ? activeNode.content : '';

  // Couche 5: Résumé des enfants existants
  const children = activeNode ? activeNode.children : tree;
  const childrenSummary = buildChildrenSummary(children);

  // Gérer les dépendances explicites
  const dependencies: NodeData[] = [];
  if (activeNode?.meta.contextConfig?.dependencies) {
    for (const depId of activeNode.meta.contextConfig.dependencies) {
      const depNode = findNodeById(tree, depId);
      if (depNode) {
        dependencies.push(depNode);
      }
    }
  }

  // Document complet
  const fullDocumentContent = buildFullDocumentContent(tree);

  return {
    globalContext,
    hierarchicalContext,
    agentRole,
    agentInstructions,
    currentNodeContent,
    childrenSummary,
    fullDocumentContent,
    dependencies,
    nodePath,
  };
}

/**
 * Filtrer les nœuds globaux (contexte disponible pour tous les appels IA)
 */
function filterGlobalNodes(nodes: NodeData[]): NodeData[] {
  const result: NodeData[] = [];

  function traverse(nodeList: NodeData[]) {
    for (const node of nodeList) {
      if (node.meta.contextConfig?.isGlobal) {
        result.push(node);
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

/**
 * Trouver un nœud par ID dans l'arbre complet
 */
function findNodeById(nodes: NodeData[], nodeId: string): NodeData | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Construire le prompt système pour l'IA en fonction du contexte sandwich
 */
export function buildSystemPrompt(context: AIContextSandwich, chatMode: ChatMode = 'discussion'): string {
  let prompt = '';

  // Format de réponse structuré - COMMUN AUX DEUX MODES
  prompt += `## FORMAT DE RÉPONSE OBLIGATOIRE

Tu DOIS structurer TOUTES tes réponses en utilisant ces marqueurs de section :

**📣 DISCUSSION**
Tes commentaires, analyses, explications. Cette partie est conversationnelle et ne sera PAS intégrée au document.

**📝 CONTENU**
Le contenu Markdown à intégrer dans le nœud actuel. Cette section sera proposée pour intégration directe.
(Laisse cette section vide si tu n'as pas de contenu à proposer.)

**🏗️ SOUS-SECTIONS**
Les sous-sections/sous-thèmes proposés. Utilise des titres Markdown du niveau approprié.
Chaque sous-section doit avoir un titre et une brève description.
(Laisse cette section vide si tu ne proposes pas de sous-sections.)

EXEMPLE DE RÉPONSE :
---
📣 DISCUSSION
Voici mon analyse de votre demande...

📝 CONTENU
Voici le texte que je propose d'intégrer dans votre section :
- Point 1
- Point 2

🏗️ SOUS-SECTIONS
### Nom de la sous-section 1
Description de ce que cette section doit contenir.

### Nom de la sous-section 2
Description...
---

`;

  // Instructions de mode en premier
  if (chatMode === 'structuration') {
    prompt += `## MODE STRUCTURATION (CHEF DE PROJET)
Tu es en MODE STRUCTURATION. Tu agis comme un **chef de projet** qui organise et structure le travail.

PRIORITÉS :
1. Analyser le contenu et identifier les sous-thèmes ou sous-tâches
2. Proposer une décomposition logique en sous-sections (section 🏗️ SOUS-SECTIONS obligatoire)
3. Évaluer la complétude de la structure actuelle
4. Suggérer les parties manquantes

En mode structuration, la section 🏗️ SOUS-SECTIONS doit être substantielle.

`;
  } else {
    prompt += `## MODE DISCUSSION
Tu es en mode discussion. Tu réponds aux questions de l'utilisateur de façon conversationnelle et utile.

**Principe directeur** : la section 📣 DISCUSSION porte la réponse à la question. Mais dès qu'un contenu insérable peut aider l'utilisateur, tu le proposes proactivement dans 📝 CONTENU et/ou 🏗️ SOUS-SECTIONS — il sera ajouté au document en un clic.

**Quand remplir 📝 CONTENU** (paragraphes, descriptions, scènes, listes…) :
- L'utilisateur demande explicitement un contenu ("écris un paragraphe sur…", "décris…", "propose une scène…")
- L'utilisateur pose une question dont la réponse naturelle EST un bout de contenu à ajouter ("comment décrire X ?", "que pourrait dire ce personnage ?")
- Tu identifies que le nœud actif est vide ou incomplet et que tu peux proposer une ébauche

**Quand remplir 🏗️ SOUS-SECTIONS** :
- L'utilisateur demande à étoffer/décomposer ("comment organiser…", "quels chapitres…", "propose 3 scènes…")
- Tu identifies un manque structurel évident dans la hiérarchie actuelle

**Quand laisser ces deux sections vides** :
- Question méta sur le document ("combien de chapitres ai-je ?", "résume-moi…")
- Discussion d'idées sans contenu prêt à insérer ("que penses-tu de…", "qu'est-ce qui marche le mieux…")
- L'utilisateur veut explorer, pas encore écrire

**Cohérence avec l'existant** : examine les SOUS-SECTIONS EXISTANTES et le DOCUMENT COMPLET avant de proposer. Ne duplique pas une section déjà présente. Respecte le ton, le vocabulaire et la profondeur hiérarchique déjà établis.

`;
  }

  prompt += `## TON RÔLE
**Rôle**: ${context.agentRole}\n\n`;

  if (context.agentInstructions) {
    prompt += `**Instructions spécifiques**: ${context.agentInstructions}\n\n`;
  }

  if (context.globalContext) {
    prompt += `## CONTEXTE GLOBAL DU PROJET\n${context.globalContext}\n\n`;
  }

  // Document complet en contexte (tronqué si trop volumineux)
  if (context.fullDocumentContent) {
    const MAX_DOC_CHARS = 8000; // ~2000 tokens environ
    const docContent = context.fullDocumentContent.length > MAX_DOC_CHARS
      ? context.fullDocumentContent.substring(0, MAX_DOC_CHARS) + '\n\n[... document tronqué pour limiter la taille du contexte ...]'
      : context.fullDocumentContent;
    prompt += `## DOCUMENT COMPLET (contexte global)
L'intégralité du document est fournie ci-dessous pour contexte. Tu travailles sur le nœud actif indiqué plus bas, mais tu dois tenir compte de l'ensemble du document pour tes réponses.

\`\`\`markdown
${docContent}
\`\`\`

`;
  }

  // Nouveau: Contexte hiérarchique (ancêtres)
  if (context.hierarchicalContext) {
    prompt += `## POSITION DANS LA HIÉRARCHIE
Tu travailles sur un nœud situé dans la structure suivante:
${context.hierarchicalContext}

Le nœud actif est le dernier de cette hiérarchie. Garde ce contexte parent en tête pour tes réponses.

`;
  }

  // Afficher le chemin du nœud
  if (context.nodePath.length > 1) {
    const pathString = context.nodePath.map(n => n.heading).join(' > ');
    prompt += `**Chemin**: ${pathString}\n\n`;
  }

  if (context.dependencies.length > 0) {
    prompt += `## CONTEXTE DÉPENDANT\n`;
    context.dependencies.forEach(dep => {
      prompt += `- [${dep.heading}]: ${dep.content}\n`;
    });
    prompt += '\n';
  }

  // Instructions pour la création de sous-nœuds
  const currentNode = context.nodePath[context.nodePath.length - 1];
  const isDocumentRoot = !currentNode;
  const currentDepth = isDocumentRoot ? 0 : currentNode.headingDepth;
  const childDepth = currentDepth + 1;
  const childHeadingPrefix = '#'.repeat(childDepth);

  prompt += `## STRUCTURE HIÉRARCHIQUE
Tu travailles sur ${isDocumentRoot ? 'le document complet (racine)' : `un nœud de niveau ${currentDepth} (profondeur de titre: ${'#'.repeat(currentDepth)})`}.
Les sous-sections seront de niveau ${childDepth} (${childHeadingPrefix}).

**Dans la section 🏗️ SOUS-SECTIONS, utilise TOUJOURS des titres de niveau ${childDepth}** :
${childHeadingPrefix} Nom de la sous-section
Description de ce que cette section doit contenir.

`;

  if (context.childrenSummary) {
    prompt += `## SOUS-SECTIONS EXISTANTES
Les sous-sections suivantes existent déjà. NE LES PROPOSE PAS à nouveau sauf si l'utilisateur demande explicitement de les réorganiser :
${context.childrenSummary}

`;
  }

  prompt += `**Quand proposer des sous-sections :**
- Le sujet peut être décomposé en parties distinctes
- Plusieurs aspects différents doivent être traités
- Une structure arborescente améliorerait la clarté
- L'utilisateur demande un développement détaillé
- Le nœud actuel est vide et mérite une structure

`;

  return prompt;
}

/**
 * Construire le message utilisateur avec le contexte du nœud actif
 */
export function buildUserMessage(context: AIContextSandwich, userQuery: string): string {
  const currentNode = context.nodePath[context.nodePath.length - 1];
  const isDocumentRoot = !currentNode;
  const nodeTitle = isDocumentRoot ? 'Document complet' : currentNode.heading;
  
  let message = `## ${isDocumentRoot ? 'Document' : 'Nœud'}: ${nodeTitle}\n\n`;
  message += `**Votre demande**: ${userQuery}\n\n`;
  
  if (context.currentNodeContent) {
    message += `**Contenu actuel du nœud**:\n${context.currentNodeContent}\n\n`;
  } else if (!isDocumentRoot) {
    message += `*Ce nœud est vide pour l'instant.*\n\n`;
  }

  if (context.childrenSummary) {
    message += `**Sous-sections existantes**:\n${context.childrenSummary}\n\n`;
  }
  
  message += `Réponds en tenant compte de la position ${isDocumentRoot ? 'globale du document' : 'de ce nœud dans la hiérarchie du document'}.`;
  return message;
}

/**
 * Statuts HTTP transitoires qui valent la peine d'être réessayés.
 */
const TRANSIENT_STATUSES = [429, 500, 502, 503, 504];

/**
 * Mapping modèle preview → modèle stable utilisé en cas de saturation.
 * Les modèles preview Gemini (gemini-3-*, gemini-2.0-flash-exp) renvoient
 * fréquemment des 503 quand la demande est forte côté Google.
 */
const PREVIEW_FALLBACKS: Record<string, string> = {
  'gemini-3-pro-preview': 'gemini-1.5-pro',
  'gemini-3-flash-preview': 'gemini-2.0-flash-exp',
  'gemini-2.0-flash-exp': 'gemini-1.5-pro',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Construit un message d'erreur utilisateur clair à partir d'un statut HTTP.
 * Le body brut est gardé en log console mais pas exposé tel quel à l'utilisateur
 * (il peut contenir des fragments de payload, du JSON technique, etc.).
 */
function friendlyErrorMessage(provider: 'Gemini' | 'OpenAI', model: string, status: number): string {
  if (status === 429) {
    return `${provider} a atteint la limite de requêtes (${status}) sur le modèle ${model}. Réessaie dans quelques instants, ou bascule sur un autre modèle.`;
  }
  if (status === 503) {
    return `Le modèle ${model} est temporairement saturé côté ${provider} (${status}). Réessaie dans quelques minutes, ou choisis un autre modèle dans le sélecteur du chat.`;
  }
  if (status === 500 || status === 502 || status === 504) {
    return `Erreur serveur ${provider} (${status}) sur ${model}. Le service est probablement en cours de stabilisation — réessaie dans quelques instants.`;
  }
  if (status === 401 || status === 403) {
    return `Clé API ${provider} refusée (${status}). Vérifie ta clé dans les paramètres et qu'elle a accès au modèle ${model}.`;
  }
  if (status === 400) {
    return `Requête refusée par ${provider} (${status}) — le modèle ${model} n'accepte peut-être pas ce contenu. Essaie un autre modèle.`;
  }
  return `Erreur ${provider} (${status}) sur ${model}.`;
}

/**
 * Appelle une URL avec retry exponentiel sur les statuts transitoires.
 * Renvoie la dernière Response (succès ou échec final).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts: number = 3
): Promise<Response> {
  let response: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    response = await fetch(url, init);
    if (response.ok) return response;
    if (!TRANSIENT_STATUSES.includes(response.status)) return response;
    if (i < attempts - 1) {
      // Backoff: 1s, 2s, 4s (peut être tuned selon les contraintes serveur)
      await sleep(1000 * Math.pow(2, i));
    }
  }
  return response!;
}

/**
 * Appeler l'API Gemini
 */
async function callGeminiAPI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string
): Promise<string> {
  const endpointFor = (m: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Configuration spécifique pour Gemini 3
  const isGemini3 = model.includes('gemini-3');
  const temperature = isGemini3 ? 1.0 : 0.7;

  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
    },
  });
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  // 1) Tentatives sur le modèle demandé avec retry exponentiel.
  let response = await fetchWithRetry(endpointFor(model), init);

  // 2) Si le modèle demandé est un preview et que l'erreur est encore
  //    transitoire, on tente une fois sur le modèle stable de fallback.
  if (!response.ok && TRANSIENT_STATUSES.includes(response.status) && PREVIEW_FALLBACKS[model]) {
    const fallback = PREVIEW_FALLBACKS[model];
    // eslint-disable-next-line no-console
    console.warn(`Gemini: ${model} indisponible (${response.status}), bascule sur ${fallback}.`);
    response = await fetchWithRetry(endpointFor(fallback), init);
    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '').join('') || '';
      if (!text.trim()) throw new Error('Réponse Gemini vide ou invalide.');
      // Préfixe discret pour signaler le fallback dans le chat. Les modes
      // structurés (📣 / 📝 / 🏗️) restent parseables ; le préfixe est isolé.
      return `📣 DISCUSSION\n_(Modèle ${model} saturé — réponse générée avec ${fallback}.)_\n\n${text}`;
    }
  }

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.warn(`Gemini error body (${response.status}):`, rawBody.slice(0, 500));
    throw new Error(friendlyErrorMessage('Gemini', model, response.status));
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || '').join('') || '';
  if (!text.trim()) throw new Error('Réponse Gemini vide ou invalide.');
  return text;
}

/**
 * Appeler l'API OpenAI (ChatGPT)
 */
async function callOpenAIAPI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string
): Promise<string> {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  };

  const response = await fetchWithRetry(endpoint, init);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.warn(`OpenAI error body (${response.status}):`, errorData);
    throw new Error(friendlyErrorMessage('OpenAI', model, response.status));
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('Réponse OpenAI vide ou invalide.');
  return text;
}

/**
 * Appeler l'API IA configurée (Gemini ou OpenAI)
 */
export async function callAIAPI(
  systemPrompt: string,
  userMessage: string,
  config: AIConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      'Clé API manquante. Configurez votre clé API dans les paramètres (⚙️).'
    );
  }

  if (config.provider === 'gemini') {
    return callGeminiAPI(systemPrompt, userMessage, config.apiKey, config.model);
  } else {
    return callOpenAIAPI(systemPrompt, userMessage, config.apiKey, config.model);
  }
}

/**
 * Lance une règle de synchro : analyse le doc source à la lumière du tool doc
 * actuel et de l'instruction, et renvoie une liste de NOUVELLES entrées à
 * proposer (jamais d'updates en V1). Les propositions sont parsées via le
 * format SOUS-SECTIONS standard et passent par une étape de revue côté UI.
 */
export async function runSyncRule(
  args: {
    sourceDocName: string;
    sourceMarkdown: string;
    toolDocName: string;
    toolMarkdown: string;
    instruction: string;
    config: AIConfig;
  }
): Promise<SubsectionProposal[]> {
  const { sourceDocName, sourceMarkdown, toolDocName, toolMarkdown, instruction, config } = args;
  // Borne le doc source pour ne pas exploser le contexte (manuscrit long).
  const MAX_SOURCE_CHARS = 12000;
  const sourceTrunc = sourceMarkdown.length > MAX_SOURCE_CHARS
    ? sourceMarkdown.substring(0, MAX_SOURCE_CHARS) + '\n\n[... document tronqué ...]'
    : sourceMarkdown;

  const systemPrompt = `Tu es chargé d'enrichir un document outil ("${toolDocName}") à partir d'un document source ("${sourceDocName}"), en suivant strictement une instruction utilisateur.

## INSTRUCTION UTILISATEUR
${instruction}

## RÈGLES IMPÉRATIVES
1. Propose UNIQUEMENT des entrées NOUVELLES — ne propose JAMAIS un élément déjà présent dans le document outil actuel (regarde les titres existants).
2. Si rien de nouveau n'est trouvé, renvoie une section SOUS-SECTIONS vide.
3. Une proposition = un titre H2 (## ) + une description concise (2-5 lignes) fidèle au contenu du document source. N'invente rien.
4. Respecte le ton, la longueur et le style des entrées existantes du document outil.

## FORMAT DE RÉPONSE OBLIGATOIRE
📣 DISCUSSION
(Optionnel — bref résumé de ce que tu as trouvé.)

🏗️ SOUS-SECTIONS
## Nom de la nouvelle entrée
Description fidèle au document source.

## Autre nouvelle entrée
Description…
`;

  const userMessage = `## DOCUMENT OUTIL ACTUEL (${toolDocName})

\`\`\`markdown
${toolMarkdown || '(vide)'}
\`\`\`

## DOCUMENT SOURCE (${sourceDocName})

\`\`\`markdown
${sourceTrunc}
\`\`\`

Applique l'instruction. Liste uniquement les NOUVELLES entrées à ajouter au document outil.`;

  const raw = await callAIAPI(systemPrompt, userMessage, config);
  return parseAIResponse(raw).subsections;
}
