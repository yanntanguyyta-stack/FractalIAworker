import { z } from 'zod';

// Schéma Zod pour la configuration de l'Agent IA
export const AgentConfigSchema = z.object({
  role: z.string().min(1, 'Le rôle de l\'agent ne peut pas être vide'),
  instructions: z.string(),
  tone: z.string().optional(),
}).strict();

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Schéma Zod pour la configuration du Context Awareness
export const ContextConfigSchema = z.object({
  isGlobal: z.boolean().default(false),
  dependencies: z.array(z.string()).optional(),
}).strict();

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

// Schéma Zod pour la configuration UI
export const UIConfigSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  collapsed: z.boolean().optional(),
}).strict();

export type UIConfig = z.infer<typeof UIConfigSchema>;

// Schéma Zod pour l'évaluation de complétude
export const NodeEvaluationSchema = z.object({
  completenessScore: z.number().min(0).max(10).optional(),
  questionScore: z.number().min(0).max(10).optional(),
}).strict();

export type NodeEvaluation = z.infer<typeof NodeEvaluationSchema>;

// Types de nœuds supportés
export type NodeType = 'project-root' | 'section' | 'task';

// Schéma Zod pour les métadonnées des nœuds
export const NodeMetaSchema = z.object({
  id: z.string().min(1, 'L\'ID du nœud ne peut pas être vide'),
  parentId: z.string().optional(),
  type: z.enum(['project-root', 'section', 'task']),
  agentConfig: AgentConfigSchema.optional(),
  contextConfig: ContextConfigSchema.optional(),
  ui: UIConfigSchema.optional(),
  evaluation: NodeEvaluationSchema.optional(),
}).strict();

export type NodeMeta = z.infer<typeof NodeMetaSchema>;

// Schéma Zod pour la structure de données des nœuds
export const NodeDataSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    heading: z.string(),
    headingDepth: z.number().min(1).max(6),
    content: z.string(),
    meta: NodeMetaSchema,
    children: z.array(NodeDataSchema).default([]),
  }).strict()
);

export type NodeData = z.infer<typeof NodeDataSchema>;

// Schéma pour la racine du projet
export const ProjectRootSchema = z.object({
  nodes: z.array(NodeDataSchema),
}).strict();

export type ProjectRoot = z.infer<typeof ProjectRootSchema>;
