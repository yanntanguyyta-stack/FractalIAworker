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

export interface AIContextSandwich {
  globalContext: string;
  hierarchicalContext: string; // Nouveau: contexte des ancêtres
  agentRole: string;
  agentInstructions: string;
  currentNodeContent: string;
  dependencies: NodeData[];
  nodePath: NodeData[]; // Nouveau: chemin complet vers le nœud
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
 * Construire le contexte sandwich pour un appel API IA
 */
export function buildContextSandwich(
  allNodes: NodeData[],
  activeNode: NodeData
): AIContextSandwich {
  // Couche 1: Contexte global (tous les nœuds avec isGlobal: true)
  const globalNodes = filterGlobalNodes(allNodes);
  const globalContext = globalNodes
    .map(n => `## ${n.heading}\n${n.content}`)
    .join('\n\n');

  // Couche 2: Contexte hiérarchique (chemin des ancêtres)
  const nodePath = findNodePath(allNodes, activeNode.id);
  const ancestors = nodePath.slice(0, -1); // Exclure le nœud actif
  const hierarchicalContext = ancestors
    .map((node, index) => {
      const indent = '  '.repeat(index);
      return `${indent}${'#'.repeat(node.headingDepth)} ${node.heading}\n${indent}${node.content.split('\n').slice(0, 3).join('\n' + indent)}...`;
    })
    .join('\n\n');

  // Couche 3: Configuration du rôle local
  const agentRole = activeNode.meta.agentConfig?.role || 'Assistant';
  const agentInstructions = activeNode.meta.agentConfig?.instructions || '';

  // Couche 4: Contenu du nœud actif
  const currentNodeContent = activeNode.content;

  // Gérer les dépendances explicites
  const dependencies: NodeData[] = [];
  if (activeNode.meta.contextConfig?.dependencies) {
    for (const depId of activeNode.meta.contextConfig.dependencies) {
      const depNode = findNodeById(allNodes, depId);
      if (depNode) {
        dependencies.push(depNode);
      }
    }
  }

  return {
    globalContext,
    hierarchicalContext,
    agentRole,
    agentInstructions,
    currentNodeContent,
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

  // Instructions de mode en premier
  if (chatMode === 'redaction') {
    prompt += `## INSTRUCTIONS DE RÉDACTION (MODE RÉDACTION ACTIF)
Tu es en MODE RÉDACTION. Tes réponses seront intégrées directement dans un document.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le contenu à intégrer, rien d'autre
- PAS d'introduction ("Voici...", "Bien sûr...", "Je vais...")
- PAS de conclusion ("N'hésite pas...", "Si tu as besoin...")
- PAS de phrases de politesse ou de transition
- Format Markdown propre et structuré
- Utilise les listes, tableaux et titres de manière appropriée
- Sois concis et précis

`;
  } else {
    prompt += `## MODE DISCUSSION
Tu es en mode discussion. Tu peux être conversationnel et explicatif.

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

  return prompt;
}

/**
 * Construire le message utilisateur avec le contexte du nœud actif
 */
export function buildUserMessage(context: AIContextSandwich, userQuery: string): string {
  const currentNode = context.nodePath[context.nodePath.length - 1];
  const nodeTitle = currentNode?.heading || 'Nœud actif';
  
  let message = `## Nœud: ${nodeTitle}\n\n`;
  message += `**Votre demande**: ${userQuery}\n\n`;
  
  if (context.currentNodeContent) {
    message += `**Contenu actuel du nœud**:\n${context.currentNodeContent}\n\n`;
  } else {
    message += `*Ce nœud est vide pour l'instant.*\n\n`;
  }
  
  message += `Réponds en tenant compte de la position de ce nœud dans la hiérarchie du document.`;
  return message;
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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur Gemini (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
    '';

  if (!text.trim()) {
    throw new Error('Réponse Gemini vide ou invalide.');
  }

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `Erreur HTTP ${response.status}`;
    throw new Error(`Erreur OpenAI: ${errorMessage}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';

  if (!text.trim()) {
    throw new Error('Réponse OpenAI vide ou invalide.');
  }

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
