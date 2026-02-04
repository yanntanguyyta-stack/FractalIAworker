import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import type { Root, Heading, Paragraph } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { NodeData, NodeMeta, NodeMetaSchema } from './types';

// Helper pour générer un UUID (utilisation simple)
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Regex pour extraire les commentaires HTML JSON au format <!-- {"meta":...} -->
const HTML_COMMENT_REGEX = /<!-- ({.*?"meta".*?}) -->/;

// Parse les métadonnées depuis le commentaire HTML
function parseMetaFromComment(comment: string): NodeMeta | null {
  try {
    const match = comment.match(HTML_COMMENT_REGEX);
    if (!match) return null;
    const json = JSON.parse(match[1]);
    // Valider avec Zod
    return NodeMetaSchema.parse(json);
  } catch (error) {
    console.warn('Failed to parse metadata from comment:', error);
    return null;
  }
}

// Sérialise les métadonnées en commentaire HTML
function serializeMetaToComment(meta: NodeMeta): string {
  return `<!-- ${JSON.stringify({ meta })} -->`;
}

// Créer le processeur unified une seule fois
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm);

// Parse un arbre Markdown en NodeData[]
export function parseMarkdownToTree(markdown: string): NodeData[] {
  const ast = processor.parse(markdown) as Root;
  const lines = markdown.split('\n');

  // Construire un index: ligne -> contenu du paragraphe pour retrouver le commentaire HTML
  const tree: NodeData[] = [];
  const nodeStack: { node: NodeData; depth: number }[] = [];

  // Parcourir les nœuds AST pour trouver les titres
  let lineIndex = 0;

  for (let i = 0; i < ast.children.length; i++) {
    const child = ast.children[i];

    if (child.type === 'heading') {
      const heading = child as Heading;
      const title = toString(heading);
      const depth = heading.depth;

      // Récupérer le contenu jusqu'au prochain titre
      let content = '';
      let metaComment = '';
      let j = i + 1;

      // Accumuler les paragraphes et le commentaire HTML
      while (j < ast.children.length && ast.children[j].type !== 'heading') {
        const nextChild = ast.children[j];
        if (nextChild.type === 'html') {
          const htmlNode = nextChild as any;
          if (htmlNode.value.includes('<!--')) {
            metaComment = htmlNode.value;
          }
        } else if (nextChild.type === 'paragraph') {
          const para = nextChild as Paragraph;
          content += toString(para) + '\n';
        } else if (nextChild.type === 'list' || nextChild.type === 'code' || nextChild.type === 'blockquote') {
          // Garder le texte brut
          content += toString(nextChild) + '\n';
        }
        j++;
      }

      content = content.trim();

      // Parser la méta depuis le commentaire
      let meta: NodeMeta;
      if (metaComment) {
        const parsed = parseMetaFromComment(metaComment);
        meta = parsed || {
          id: generateId(),
          type: depth === 1 ? 'project-root' : 'section',
        };
      } else {
        meta = {
          id: generateId(),
          type: depth === 1 ? 'project-root' : 'section',
        };
      }

      const node: NodeData = {
        id: meta.id,
        heading: title,
        headingDepth: depth,
        content,
        meta,
        children: [],
      };

      // Gérer la hiérarchie des nœuds
      while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].depth >= depth) {
        nodeStack.pop();
      }

      if (nodeStack.length === 0) {
        tree.push(node);
      } else {
        nodeStack[nodeStack.length - 1].node.children.push(node);
      }

      nodeStack.push({ node, depth });
      i = j - 1; // Sauter les nœuds déjà traités
    }
  }

  return tree;
}

// Convertit un arbre NodeData[] en Markdown avec métadonnées
export function treeToMarkdown(tree: NodeData[]): string {
  const lines: string[] = [];

  function traverseTree(nodes: NodeData[], baseDepth: number = 1) {
    for (const node of nodes) {
      const heading = '#'.repeat(node.headingDepth) + ' ' + node.heading;
      lines.push(heading);
      lines.push('');

      if (node.content) {
        lines.push(node.content);
        lines.push('');
      }

      // Ajouter le commentaire HTML avec les métadonnées
      const metaComment = serializeMetaToComment(node.meta);
      lines.push(metaComment);
      lines.push('');

      // Traiter les enfants
      if (node.children.length > 0) {
        traverseTree(node.children, baseDepth + 1);
      }
    }
  }

  traverseTree(tree);
  return lines.join('\n').trim() + '\n';
}

// Mises à jour d'un nœud dans l'arbre
export function updateNodeInTree(
  tree: NodeData[],
  nodeId: string,
  updates: Partial<NodeData>
): NodeData[] {
  function traverse(nodes: NodeData[]): NodeData[] {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children.length > 0) {
        return { ...node, children: traverse(node.children) };
      }
      return node;
    });
  }

  return traverse(tree);
}

// Trouver un nœud par ID
export function findNodeById(tree: NodeData[], nodeId: string): NodeData | null {
  function traverse(nodes: NodeData[]): NodeData | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      const found = traverse(node.children);
      if (found) return found;
    }
    return null;
  }

  return traverse(tree);
}

// Aplatir l'arbre en liste pour faciliter la navigation
export function flattenTree(tree: NodeData[]): NodeData[] {
  const result: NodeData[] = [];

  function traverse(nodes: NodeData[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}
