import React, { useState, useCallback, useRef } from 'react';
import { X, Upload, FileText, Wand2, CheckCircle, ChevronRight, ChevronDown, AlertCircle, Loader2, Plus, Trash2, GripVertical, Eye } from 'lucide-react';
import { useStore } from '../store';
import { importFileToMarkdown } from '../utils/documentConversion';
import { callAIAPI, buildContextSandwich, buildSystemPrompt } from '../aiService';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Structure détectée par l'IA
interface DetectedSection {
  id: string;
  title: string;
  level: number; // 1 = H1, 2 = H2, etc.
  content: string; // Aperçu du contenu
  children: DetectedSection[];
  expanded?: boolean;
  titlePosition: number; // Position du titre dans le document original
  startPosition: number; // Position de début du contenu (après le titre)
  endPosition: number; // Position de fin dans le document original
}

type WizardStep = 'upload' | 'preview' | 'analyze' | 'structure' | 'import';

// Formats de fichiers supportés
const SUPPORTED_FORMATS = [
  { ext: '.txt', label: 'Texte brut', mime: 'text/plain' },
  { ext: '.md', label: 'Markdown', mime: 'text/markdown' },
  { ext: '.pdf', label: 'PDF', mime: 'application/pdf' },
  { ext: '.docx', label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
];

const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose }) => {
  const { loadMarkdown, aiConfig, tree } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États du wizard
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  
  // Structure détectée
  const [detectedStructure, setDetectedStructure] = useState<DetectedSection[]>([]);
  const [analysisPrompt, setAnalysisPrompt] = useState<string>('');
  
  // Options d'import
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);

  // Réinitialiser le wizard
  const resetWizard = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawContent('');
    setError(null);
    setDetectedStructure([]);
    setAnalysisPrompt('');
    setImportMode('replace');
    setTargetNodeId(null);
    setAnalysisProgress('');
  }, []);

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  // Patterns pré-définis communs pour la détection déterministe
  const COMMON_PATTERNS = [
    // Niveau 1 : Tomes, Livres, Parties principales
    { level: 1, regex: /^(TOME|Tome|LIVRE|Livre|PREMIÈRE PARTIE|DEUXIÈME PARTIE|TROISIÈME PARTIE|QUATRIÈME PARTIE|CINQUIÈME PARTIE|Première partie|Deuxième partie|Troisième partie|Quatrième partie|Cinquième partie|PART\s+[IVXLCDM\d]+|Part\s+[IVXLCDM\d]+)\s*[:\-–—]?\s*.*/i },
    { level: 1, regex: /^(VOLUME|Volume)\s+[IVXLCDM\d]+/i },
    { level: 1, regex: /^(PROLOGUE|ÉPILOGUE|Prologue|Épilogue|PRÉFACE|Préface)\s*$/i },
    
    // Niveau 2 : Chapitres
    { level: 2, regex: /^(CHAPITRE|Chapitre|CHAPTER)\s+[IVXLCDM\d]+\s*[:\-–—]?\s*.*/i },
    { level: 2, regex: /^(Chap\.|CHAP\.)\s*\d+/i },
    { level: 2, regex: /^\d+\s*[:\-–—\.]\s+[A-Z][a-zÀ-ÿ]/m },  // "1. Titre" ou "1 - Titre"
    
    // Niveau 3 : Sous-sections, Scènes
    { level: 3, regex: /^(Scène|SCÈNE|Scene)\s+\d+/i },
    { level: 3, regex: /^(SECTION|Section)\s+\d+/i },
    { level: 3, regex: /^\*\*\*\s*$/m },  // Séparateur ***
    { level: 3, regex: /^[-–—]{3,}\s*$/m },  // Séparateur ---
  ];

  // Gestion du drag & drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
    e.target.value = '';
  };

  // Traitement du fichier uploadé
  const processFile = async (uploadedFile: File) => {
    setIsLoading(true);
    setError(null);
    setFile(uploadedFile);
    
    try {
      const content = await importFileToMarkdown(uploadedFile);
      // Retirer le titre généré automatiquement pour garder le contenu brut
      const cleanContent = content.replace(/^# .+\n\n/, '');
      setRawContent(cleanContent || content);
      setStep('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyse IA de la structure - approche hybride en 3 phases
  const analyzeStructure = async () => {
    if (!aiConfig.apiKey) {
      setError('Veuillez configurer votre clé API dans les paramètres pour utiliser l\'analyse IA.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('analyze');
    
    const docLength = rawContent.length;
    const docPages = Math.ceil(docLength / 2000); // Estimation ~2000 chars/page
    
    setAnalysisProgress(`Document de ~${docPages} pages. Phase 1/3 : Détection automatique des patterns...`);

    try {
      // ========== PHASE 1 : Patterns pré-définis (déterministe) ==========
      let allSections: Array<{ title: string; level: number; position: number }> = [];
      
      // Appliquer tous les patterns pré-définis
      for (const pattern of COMMON_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, 'gm');
        let match;
        
        while ((match = regex.exec(rawContent)) !== null) {
          const lineStart = rawContent.lastIndexOf('\n', match.index) + 1;
          const lineEnd = rawContent.indexOf('\n', match.index);
          const fullLine = rawContent.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
          
          // Ignorer les lignes trop courtes ou les séparateurs purs
          if (fullLine.length < 3 || /^[-*_]{3,}$/.test(fullLine)) continue;
          
          allSections.push({
            title: fullLine || match[0],
            level: pattern.level,
            position: match.index,
          });
        }
      }
      
      // Dédupliquer les sections trouvées au même endroit
      allSections = deduplicateSections(allSections);
      
      setAnalysisProgress(`Phase 1 : ${allSections.length} sections détectées avec patterns communs.`);
      
      // ========== PHASE 2 : IA identifie des patterns spécifiques ==========
      // Si moins de 5 sections trouvées ou document très long, demander à l'IA
      const needsAIPatterns = allSections.length < 5 || docLength > 100000;
      
      if (needsAIPatterns) {
        setAnalysisProgress('Phase 2/3 : Recherche de patterns spécifiques par IA...');
        
        const aiPatterns = await detectSpecificPatterns();
        if (aiPatterns.length > 0) {
          const aiSections = applyPatternsToDocument(aiPatterns, rawContent);
          allSections = deduplicateSections([...allSections, ...aiSections]);
          setAnalysisProgress(`Phase 2 : ${allSections.length} sections totales avec patterns IA.`);
        }
      }
      
      // ========== PHASE 3 : Analyse par lots si nécessaire ==========
      // Pour les documents longs ou si peu de sections, analyser par chunks
      const needsChunkAnalysis = allSections.length < 10 && docLength > 50000;
      
      if (needsChunkAnalysis) {
        setAnalysisProgress('Phase 3/3 : Analyse exhaustive par lots...');
        const chunkSections = await analyzeByChunks();
        allSections = deduplicateSections([...allSections, ...chunkSections]);
      }
      
      // ========== FINALISATION ==========
      if (allSections.length === 0) {
        setError('Aucune structure détectée. Essayez d\'ajouter des instructions personnalisées.');
        setStep('preview');
        return;
      }

      // Trier par position et construire la hiérarchie
      allSections.sort((a, b) => a.position - b.position);
      setAnalysisProgress(`${allSections.length} sections détectées, construction de la hiérarchie...`);
      
      const structure = buildHierarchicalStructure(allSections, rawContent);
      setDetectedStructure(structure);
      setStep('structure');
      
    } catch (err) {
      console.error('Erreur d\'analyse:', err);
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'analyse';
      setError(`Erreur d'analyse IA: ${message}. Vous pouvez ajuster les instructions et réessayer.`);
      setStep('preview');
    } finally {
      setIsLoading(false);
      setAnalysisProgress('');
    }
  };

  // Dédupliquer les sections proches
  const deduplicateSections = (
    sections: Array<{ title: string; level: number; position: number }>
  ): Array<{ title: string; level: number; position: number }> => {
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const dedupedSections: typeof sections = [];
    
    for (const section of sorted) {
      const last = dedupedSections[dedupedSections.length - 1];
      if (!last || Math.abs(last.position - section.position) > 50) {
        dedupedSections.push(section);
      } else if (section.level < last.level) {
        // Garder celui avec le niveau le plus élevé (H1 > H2)
        dedupedSections[dedupedSections.length - 1] = section;
      }
    }
    
    // Aussi dédupliquer par titre identique
    const uniqueByTitle = dedupedSections.filter((section, index, self) =>
      index === self.findIndex(s => s.title === section.title && Math.abs(s.position - section.position) < 100)
    );
    
    return uniqueByTitle;
  };

  // Phase 2 : Détection de patterns spécifiques par l'IA
  const detectSpecificPatterns = async (): Promise<Array<{ level: number; regex: string }>> => {
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

    // Échantillonnage étendu : 5 points du document
    const sampleSize = 6000;
    const docLength = rawContent.length;
    const samples: string[] = [];
    
    // Points d'échantillonnage : 0%, 25%, 50%, 75%, ~100%
    const positions = [0, 0.25, 0.5, 0.75, 0.9].map(p => Math.floor(docLength * p));
    
    for (const pos of positions) {
      const sample = rawContent.substring(pos, pos + sampleSize);
      if (sample.trim()) {
        samples.push(sample);
      }
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
  };

  // Phase 3 : Analyse exhaustive par chunks pour documents longs
  const analyzeByChunks = async (): Promise<Array<{ title: string; level: number; position: number }>> => {
    const CHUNK_SIZE = 15000; // Réduit pour meilleure précision
    const OVERLAP = 500; // Chevauchement pour ne pas couper les titres
    const allSections: Array<{ title: string; level: number; position: number }> = [];
    
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
      setAnalysisProgress(`Phase 3/3 : Analyse lot ${processedChunks}/${totalChunks} (${progress}%)...`);
      
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
              // Trouver la position exacte dans le document
              // Chercher d'abord dans la zone du chunk, puis élargir
              let position = rawContent.indexOf(section.title, i);
              if (position === -1 || position > i + CHUNK_SIZE) {
                // Chercher dans tout le document si non trouvé localement
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
  };

  // Appliquer les patterns regex à tout le document
  const applyPatternsToDocument = (
    patterns: Array<{ level: number; regex: string; description?: string }>,
    content: string
  ): Array<{ title: string; level: number; position: number }> => {
    const sections: Array<{ title: string; level: number; position: number }> = [];
    
    for (const pattern of patterns) {
      try {
        // Créer la regex avec flag multiline et global
        const regex = new RegExp(pattern.regex, 'gm');
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          // Extraire le titre complet (ligne entière ou jusqu'au retour ligne)
          const lineStart = content.lastIndexOf('\n', match.index) + 1;
          const lineEnd = content.indexOf('\n', match.index);
          const fullLine = content.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
          
          sections.push({
            title: fullLine || match[0],
            level: pattern.level,
            position: match.index,
          });
        }
      } catch (e) {
        console.warn(`Pattern regex invalide: ${pattern.regex}`, e);
      }
    }
    
    // Trier par position dans le document
    sections.sort((a, b) => a.position - b.position);
    
    // Dédupliquer les sections au même endroit
    const dedupedSections: typeof sections = [];
    for (const section of sections) {
      const last = dedupedSections[dedupedSections.length - 1];
      if (!last || Math.abs(last.position - section.position) > 50) {
        dedupedSections.push(section);
      } else if (section.level < last.level) {
        // Garder celui avec le niveau le plus élevé (H1 > H2)
        dedupedSections[dedupedSections.length - 1] = section;
      }
    }
    
    return dedupedSections;
  };

  // Construire une structure hiérarchique à partir des sections détectées
  const buildHierarchicalStructure = (
    sections: Array<{ title: string; level: number; position: number }>,
    fullContent: string
  ): DetectedSection[] => {
    const result: DetectedSection[] = [];
    const stack: DetectedSection[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];
      
      // Position de début = après le titre de la section
      const titleEndIndex = fullContent.indexOf('\n', section.position);
      const contentStart = titleEndIndex !== -1 ? titleEndIndex + 1 : section.position + section.title.length;
      
      // Position de fin = début de la section suivante ou fin du document
      const contentEnd = nextSection ? nextSection.position : fullContent.length;
      
      // Extraire un aperçu du contenu pour l'affichage
      const sectionContent = fullContent.substring(contentStart, Math.min(contentEnd, contentStart + 500)).trim();
      
      const newSection: DetectedSection = {
        id: `section-${Date.now()}-${i}`,
        title: section.title,
        level: section.level,
        content: sectionContent.length > 200 ? sectionContent.substring(0, 200) + '...' : sectionContent,
        children: [],
        expanded: section.level <= 2,
        titlePosition: section.position,
        startPosition: contentStart,
        endPosition: contentEnd,
      };
      
      // Construire la hiérarchie
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        result.push(newSection);
      } else {
        stack[stack.length - 1].children.push(newSection);
      }
      
      stack.push(newSection);
    }
    
    return result;
  };

  // Mise à jour d'une section
  const updateSection = (sectionId: string, updates: Partial<DetectedSection>) => {
    const updateRecursive = (sections: DetectedSection[]): DetectedSection[] => {
      return sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, ...updates };
        }
        if (s.children.length > 0) {
          return { ...s, children: updateRecursive(s.children) };
        }
        return s;
      });
    };
    setDetectedStructure(updateRecursive(detectedStructure));
  };

  // Supprimer une section
  const deleteSection = (sectionId: string) => {
    const deleteRecursive = (sections: DetectedSection[]): DetectedSection[] => {
      return sections
        .filter(s => s.id !== sectionId)
        .map(s => ({
          ...s,
          children: deleteRecursive(s.children),
        }));
    };
    setDetectedStructure(deleteRecursive(detectedStructure));
  };

  // Ajouter une section
  const addSection = (parentId: string | null, level: number) => {
    const newSection: DetectedSection = {
      id: `section-${Date.now()}-new`,
      title: 'Nouvelle section',
      level,
      content: '',
      children: [],
      expanded: true,
      titlePosition: 0,
      startPosition: 0,
      endPosition: 0,
    };

    if (!parentId) {
      setDetectedStructure([...detectedStructure, newSection]);
    } else {
      const addRecursive = (sections: DetectedSection[]): DetectedSection[] => {
        return sections.map(s => {
          if (s.id === parentId) {
            return { ...s, children: [...s.children, { ...newSection, level: s.level + 1 }] };
          }
          if (s.children.length > 0) {
            return { ...s, children: addRecursive(s.children) };
          }
          return s;
        });
      };
      setDetectedStructure(addRecursive(detectedStructure));
    }
  };

  // Générer le Markdown final
  const generateMarkdown = (sections: DetectedSection[]): string => {
    let markdown = '';

    const processSection = (section: DetectedSection, fullContent: string) => {
      const headingPrefix = '#'.repeat(section.level);
      markdown += `${headingPrefix} ${section.title}\n\n`;

      // Trouver le contenu réel dans le document original
      // Pour l'instant, on utilise le contenu stocké
      if (section.content && !section.content.endsWith('...')) {
        markdown += `${section.content}\n\n`;
      }

      section.children.forEach(child => processSection(child, fullContent));
    };

    sections.forEach(section => processSection(section, rawContent));
    return markdown;
  };

  // Import final
  const handleImport = () => {
    setIsLoading(true);
    
    try {
      // Générer le markdown structuré
      let markdown = '';
      
      if (detectedStructure.length > 0) {
        // Reconstruire le document avec la structure détectée
        markdown = reconstructDocument(detectedStructure, rawContent);
      } else {
        // Import brut sans structure
        markdown = `# ${file?.name.replace(/\.[^.]+$/, '') || 'Document importé'}\n\n${rawContent}`;
      }

      if (importMode === 'replace') {
        loadMarkdown(markdown);
      } else {
        // Mode append - ajouter au document existant
        const currentMarkdown = useStore.getState().saveToMarkdown();
        loadMarkdown(currentMarkdown + '\n\n' + markdown);
      }

      setStep('import');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'import';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Reconstruire le document avec la structure et le contenu
  const reconstructDocument = (sections: DetectedSection[], originalContent: string): string => {
    let markdown = '';

    const processSection = (section: DetectedSection) => {
      const headingPrefix = '#'.repeat(section.level);
      markdown += `${headingPrefix} ${section.title}\n\n`;

      // Calculer le contenu propre de cette section
      // Si la section a des enfants, le contenu va jusqu'au titre du premier enfant
      // Sinon, il va jusqu'à endPosition
      let contentEnd = section.endPosition;
      if (section.children.length > 0) {
        contentEnd = section.children[0].titlePosition;
      }
      
      // Extraire le contenu réel depuis le document original
      if (section.startPosition < contentEnd) {
        const sectionContent = originalContent
          .substring(section.startPosition, contentEnd)
          .trim()
          // Nettoyer les titres qui pourraient être inclus dans le contenu
          .replace(/^#+\s*[^\n]+\n*/gm, '')
          .trim();
        
        if (sectionContent) {
          markdown += `${sectionContent}\n\n`;
        }
      }
      
      // Traiter les enfants récursivement
      section.children.forEach(child => processSection(child));
    };

    // Si pas de structure, retourner le contenu brut avec un titre
    if (sections.length === 0) {
      return `# Document importé\n\n${originalContent}`;
    }

    sections.forEach(section => processSection(section));
    
    return markdown.trim();
  };

  // Import sans analyse (brut)
  const handleImportRaw = () => {
    const markdown = `# ${file?.name.replace(/\.[^.]+$/, '') || 'Document importé'}\n\n${rawContent}`;
    
    if (importMode === 'replace') {
      loadMarkdown(markdown);
    } else {
      const currentMarkdown = useStore.getState().saveToMarkdown();
      loadMarkdown(currentMarkdown + '\n\n' + markdown);
    }

    setStep('import');
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  // Compter les sections
  const countSections = (sections: DetectedSection[]): number => {
    return sections.reduce((count, s) => count + 1 + countSections(s.children), 0);
  };

  // Rendu d'une section dans l'arbre
  const renderSection = (section: DetectedSection, depth: number = 0) => {
    const levelColors = [
      'border-blue-400 bg-blue-50',
      'border-indigo-400 bg-indigo-50',
      'border-purple-400 bg-purple-50',
      'border-pink-400 bg-pink-50',
      'border-rose-400 bg-rose-50',
      'border-orange-400 bg-orange-50',
    ];
    const colorClass = levelColors[Math.min(section.level - 1, levelColors.length - 1)];

    return (
      <div key={section.id} className="mb-2" style={{ marginLeft: `${depth * 16}px` }}>
        <div className={`border-l-4 ${colorClass} rounded-r-lg p-3`}>
          <div className="flex items-center gap-2 mb-2">
            <GripVertical size={14} className="text-gray-400 cursor-grab" />
            
            {section.children.length > 0 && (
              <button
                onClick={() => updateSection(section.id, { expanded: !section.expanded })}
                className="p-0.5 hover:bg-white/50 rounded"
              >
                {section.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}

            <span className="text-xs font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded">
              H{section.level}
            </span>

            <input
              type="text"
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              className="flex-1 px-2 py-1 text-sm font-medium border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none bg-transparent"
            />

            <button
              onClick={() => addSection(section.id, section.level + 1)}
              className="p-1 hover:bg-green-100 rounded text-green-600"
              title="Ajouter une sous-section"
              disabled={section.level >= 6}
            >
              <Plus size={14} />
            </button>

            <button
              onClick={() => deleteSection(section.id)}
              className="p-1 hover:bg-red-100 rounded text-red-600"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {section.content && (
            <p className="text-xs text-gray-600 line-clamp-2 ml-6">
              {section.content}
            </p>
          )}
        </div>

        {section.expanded && section.children.length > 0 && (
          <div className="mt-1">
            {section.children.map(child => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import de document</h2>
              <p className="text-sm text-gray-600">
                {step === 'upload' && 'Sélectionnez un fichier à importer'}
                {step === 'preview' && 'Aperçu du contenu importé'}
                {step === 'analyze' && 'Analyse de la structure en cours...'}
                {step === 'structure' && 'Validez la structure détectée'}
                {step === 'import' && 'Import terminé !'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 border-b">
          {(['upload', 'preview', 'structure', 'import'] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === s ? 'bg-blue-500 text-white' :
                (['upload', 'preview', 'structure', 'import'].indexOf(step) > i) ? 'bg-green-100 text-green-700' :
                'bg-gray-200 text-gray-500'
              }`}>
                {(['upload', 'preview', 'structure', 'import'].indexOf(step) > i) ? (
                  <CheckCircle size={14} />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
                    {i + 1}
                  </span>
                )}
                <span className="hidden sm:inline">
                  {s === 'upload' && 'Upload'}
                  {s === 'preview' && 'Aperçu'}
                  {s === 'structure' && 'Structure'}
                  {s === 'import' && 'Import'}
                </span>
              </div>
              {i < 3 && <ChevronRight size={16} className="text-gray-400" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 hover:text-red-800 mt-1"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  isDragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.pdf,.docx"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="text-blue-500 animate-spin" />
                    <p className="text-gray-600">Lecture du fichier...</p>
                  </div>
                ) : (
                  <>
                    <Upload size={48} className={`mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      {isDragActive ? 'Déposez le fichier ici' : 'Glissez-déposez votre fichier ici'}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">ou cliquez pour sélectionner un fichier</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUPPORTED_FORMATS.map(format => (
                        <span
                          key={format.ext}
                          className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border"
                        >
                          {format.ext} ({format.label})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <FileText size={24} className="text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{file?.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file?.size ?? 0) > 1024 * 1024
                      ? `${((file?.size ?? 0) / 1024 / 1024).toFixed(2)} Mo`
                      : `${((file?.size ?? 0) / 1024).toFixed(1)} Ko`}
                    {' • '}
                    {rawContent.length.toLocaleString()} caractères
                    {' • '}
                    ~{rawContent.split(/\s+/).length.toLocaleString()} mots
                  </p>
                </div>
              </div>

              {/* Content preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Aperçu du contenu</h3>
                  <span className="text-xs text-gray-500">
                    {rawContent.length > 5000 ? 'Affichage des 5000 premiers caractères' : 'Contenu complet'}
                  </span>
                </div>
                <div className="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {rawContent.substring(0, 5000)}
                    {rawContent.length > 5000 && (
                      <span className="text-gray-400">
                        {'\n\n... [{rawContent.length - 5000} caractères supplémentaires]'}
                      </span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Analysis options */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="font-medium text-indigo-900 mb-3 flex items-center gap-2">
                  <Wand2 size={18} />
                  Analyse IA de la structure
                </h3>
                <p className="text-sm text-indigo-700 mb-3">
                  L'IA va analyser votre document pour identifier automatiquement la structure 
                  (tomes, chapitres, sections, sous-parties...).
                </p>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-indigo-800 mb-1">
                    Instructions supplémentaires (optionnel)
                  </label>
                  <textarea
                    value={analysisPrompt}
                    onChange={(e) => setAnalysisPrompt(e.target.value)}
                    placeholder="Ex: C'est un roman avec 3 tomes et environ 20 chapitres par tome. Les chapitres commencent par 'Chapitre X'..."
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={3}
                  />
                </div>

                {/* Import mode */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm font-medium text-indigo-800">Mode d'import :</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-indigo-600"
                    />
                    <span className="text-sm text-indigo-700">Remplacer le document</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600"
                    />
                    <span className="text-sm text-indigo-700">Ajouter au document</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step: Analyze (loading) */}
          {step === 'analyze' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-200 animate-pulse"></div>
                <Wand2 size={32} className="absolute inset-0 m-auto text-indigo-500 animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Analyse en cours...</h3>
              <p className="text-gray-600 text-center max-w-md mb-4">
                L'IA analyse la structure de votre document.
              </p>
              {analysisProgress && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                  <p className="text-sm font-medium text-indigo-700">{analysisProgress}</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-4">
                Document : {rawContent.length.toLocaleString()} caractères
              </p>
            </div>
          )}

          {/* Step: Structure */}
          {step === 'structure' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Structure détectée</h3>
                  <p className="text-sm text-gray-500">
                    {countSections(detectedStructure)} sections détectées. Vous pouvez modifier les titres et la hiérarchie.
                  </p>
                </div>
                <button
                  onClick={() => addSection(null, 1)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  Ajouter H1
                </button>
              </div>

              {/* Structure tree */}
              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                {detectedStructure.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Aucune structure détectée. Ajoutez des sections manuellement.
                  </p>
                ) : (
                  detectedStructure.map(section => renderSection(section))
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={() => {
                    setDetectedStructure([]);
                    setStep('preview');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  ← Réanalyser
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleImportRaw}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Importer sans structure
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Import complete */}
          {step === 'import' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Import réussi !</h3>
              <p className="text-gray-600">
                Votre document a été importé avec succès.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'import' && step !== 'analyze' && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-xl">
            <button
              onClick={step === 'upload' ? handleClose : () => setStep(step === 'structure' ? 'preview' : 'upload')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              {step === 'upload' ? 'Annuler' : '← Retour'}
            </button>

            <div className="flex gap-3">
              {step === 'preview' && (
                <>
                  <button
                    onClick={handleImportRaw}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Importer tel quel
                  </button>
                  <button
                    onClick={analyzeStructure}
                    disabled={isLoading || !aiConfig.apiKey}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  >
                    <Wand2 size={18} />
                    Analyser la structure
                  </button>
                </>
              )}

              {step === 'structure' && (
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  <CheckCircle size={18} />
                  Importer avec cette structure
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportWizard;
