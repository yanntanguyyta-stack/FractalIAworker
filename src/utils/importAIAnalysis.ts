import { callAIAPI } from '../aiService';
import type { AIConfig } from '../store';
import { RawSection } from './importPatterns';

type ProgressCallback = (message: string) => void;

export async function detectSpecificPatterns(
  rawContent: string,
  aiConfig: AIConfig,
  analysisPrompt: string
): Promise<{ level: number; regex: string }[]> {
  const patternsPrompt = `Tu es un expert en analyse documentaire. Identifie les PATTERNS de structure de ce document.

## OBJECTIF
Trouver les motifs RÉGEX qui identifient les chapitres et sections. NE liste PAS les sections, donne les PATTERNS.

## FORMAT JSON UNIQUEMENT
{
  "patterns": [
    { "level": 2, "regex": "^Chapitre\\\\s+\\\\d+", "description": "Chapitres numérotés" }
  ]
}

${analysisPrompt ? `## INSTRUCTIONS\n${analysisPrompt}\n` : ''}

IMPORTANT: Regex JavaScript valides. Échappe \\\\ pour les caractères spéciaux.`;

  const sampleSize = 6000;
  const docLength = rawContent.length;
  const samples: string[] = [];
  const positions = [0, 0.25, 0.5, 0.75, 0.9].map(p => Math.floor(docLength * p));

  for (const pos of positions) {
    const sample = rawContent.substring(pos, pos + sampleSize);
    if (sample.trim()) samples.push(sample);
  }

  const patternsMessage = `Document de ${rawContent.length.toLocaleString()} caractères. Extraits :

${samples.map((s, i) => `--- Extrait ${i + 1} ---\n${s}\n`).join('\n')}

Identifie les PATTERNS récurrents (regex). JSON uniquement.`;

  try {
    const response = await callAIAPI(patternsPrompt, patternsMessage, aiConfig);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.patterns || [];
    }
  } catch (e) {
    console.warn('Erreur détection patterns IA:', e);
  }
  return [];
}

export async function analyzeByChunks(
  rawContent: string,
  aiConfig: AIConfig,
  analysisPrompt: string,
  onProgress?: ProgressCallback
): Promise<RawSection[]> {
  const CHUNK_SIZE = 15000;
  const OVERLAP = 500;
  const allSections: RawSection[] = [];
  const totalChunks = Math.ceil(rawContent.length / (CHUNK_SIZE - OVERLAP));

  const systemPrompt = `Tu es un expert en analyse documentaire. Liste TOUTES les sections de ce texte.

## RÈGLES
- Identifie CHAQUE chapitre, partie, section
- Niveau 1 = Parties/Tomes, Niveau 2 = Chapitres, Niveau 3 = Sous-parties
- Donne le titre EXACT tel qu'il apparaît

${analysisPrompt ? `## INSTRUCTIONS\n${analysisPrompt}\n` : ''}

## FORMAT JSON OBLIGATOIRE
{ "sections": [{ "title": "Titre exact", "level": 2 }] }`;

  let processedChunks = 0;

  for (let i = 0; i < rawContent.length; i += (CHUNK_SIZE - OVERLAP)) {
    const chunk = rawContent.substring(i, i + CHUNK_SIZE);
    processedChunks++;

    const progress = Math.round((processedChunks / totalChunks) * 100);
    onProgress?.(`Phase 3/3 : Analyse lot ${processedChunks}/${totalChunks} (${progress}%)...`);

    const userMessage = `Partie ${processedChunks}/${totalChunks} :

${chunk}

Liste les sections. JSON uniquement.`;

    try {
      const response = await callAIAPI(systemPrompt, userMessage, aiConfig);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.sections) {
          for (const section of parsed.sections) {
            let position = rawContent.indexOf(section.title, i);
            if (position === -1 || position > i + CHUNK_SIZE) {
              position = rawContent.indexOf(section.title);
            }
            if (position !== -1) {
              allSections.push({
                title: section.title,
                level: section.level || 2,
                position,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Erreur analyse chunk ${processedChunks}:`, e);
    }
  }

  return allSections;
}
