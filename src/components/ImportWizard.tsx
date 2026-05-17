import React, { useState, useCallback, useRef } from 'react';
import {
  X, Upload, FileText, Wand2, CheckCircle, ChevronRight, ChevronDown,
  AlertCircle, Loader2, Plus, Trash2, GripVertical,
} from 'lucide-react';
import { useStore } from '../store';
import { importFileToMarkdown } from '../utils/documentConversion';
import {
  DetectedSection,
  RawSection,
  detectByCommonPatterns,
  deduplicateSections,
  applyPatternsToDocument,
  buildHierarchicalStructure,
  reconstructDocument,
  countSections,
} from '../utils/importPatterns';
import { detectSpecificPatterns, analyzeByChunks } from '../utils/importAIAnalysis';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'upload' | 'preview' | 'analyze' | 'structure' | 'import';

const SUPPORTED_FORMATS = [
  { ext: '.txt', label: 'Texte brut', mime: 'text/plain' },
  { ext: '.md', label: 'Markdown', mime: 'text/markdown' },
  { ext: '.pdf', label: 'PDF', mime: 'application/pdf' },
  { ext: '.docx', label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
];

const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose }) => {
  const { loadMarkdown, importAsDocument, aiConfig } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [detectedStructure, setDetectedStructure] = useState<DetectedSection[]>([]);
  const [analysisPrompt, setAnalysisPrompt] = useState<string>('');
  const [importMode, setImportMode] = useState<'replace' | 'append' | 'new-doc'>('replace');

  const resetWizard = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawContent('');
    setError(null);
    setDetectedStructure([]);
    setAnalysisPrompt('');
    setImportMode('replace');
    setAnalysisProgress('');
  }, []);

  const handleClose = () => {
    resetWizard();
    onClose();
  };

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
    if (droppedFile) await processFile(droppedFile);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) await processFile(selectedFile);
    e.target.value = '';
  };

  const processFile = async (uploadedFile: File) => {
    setIsLoading(true);
    setError(null);
    setFile(uploadedFile);

    try {
      const content = await importFileToMarkdown(uploadedFile);
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

  const analyzeStructure = async () => {
    if (!aiConfig.apiKey) {
      setError('Veuillez configurer votre clé API dans les paramètres pour utiliser l\'analyse IA.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('analyze');

    const docLength = rawContent.length;
    const docPages = Math.ceil(docLength / 2000);
    setAnalysisProgress(`Document de ~${docPages} pages. Phase 1/3 : Détection automatique des patterns...`);

    try {
      let allSections: RawSection[] = detectByCommonPatterns(rawContent);
      setAnalysisProgress(`Phase 1 : ${allSections.length} sections détectées avec patterns communs.`);

      const needsAIPatterns = allSections.length < 5 || docLength > 100000;
      if (needsAIPatterns) {
        setAnalysisProgress('Phase 2/3 : Recherche de patterns spécifiques par IA...');
        const aiPatterns = await detectSpecificPatterns(rawContent, aiConfig, analysisPrompt);
        if (aiPatterns.length > 0) {
          const aiSections = applyPatternsToDocument(aiPatterns, rawContent);
          allSections = deduplicateSections([...allSections, ...aiSections]);
          setAnalysisProgress(`Phase 2 : ${allSections.length} sections totales avec patterns IA.`);
        }
      }

      const needsChunkAnalysis = allSections.length < 10 && docLength > 50000;
      if (needsChunkAnalysis) {
        setAnalysisProgress('Phase 3/3 : Analyse exhaustive par lots...');
        const chunkSections = await analyzeByChunks(
          rawContent, aiConfig, analysisPrompt, setAnalysisProgress
        );
        allSections = deduplicateSections([...allSections, ...chunkSections]);
      }

      if (allSections.length === 0) {
        setError('Aucune structure détectée. Essayez d\'ajouter des instructions personnalisées.');
        setStep('preview');
        return;
      }

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

  const updateSection = (sectionId: string, updates: Partial<DetectedSection>) => {
    const updateRecursive = (sections: DetectedSection[]): DetectedSection[] =>
      sections.map(s => {
        if (s.id === sectionId) return { ...s, ...updates };
        if (s.children.length > 0) return { ...s, children: updateRecursive(s.children) };
        return s;
      });
    setDetectedStructure(updateRecursive(detectedStructure));
  };

  const deleteSection = (sectionId: string) => {
    const deleteRecursive = (sections: DetectedSection[]): DetectedSection[] =>
      sections
        .filter(s => s.id !== sectionId)
        .map(s => ({ ...s, children: deleteRecursive(s.children) }));
    setDetectedStructure(deleteRecursive(detectedStructure));
  };

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
      const addRecursive = (sections: DetectedSection[]): DetectedSection[] =>
        sections.map(s => {
          if (s.id === parentId) {
            return { ...s, children: [...s.children, { ...newSection, level: s.level + 1 }] };
          }
          if (s.children.length > 0) return { ...s, children: addRecursive(s.children) };
          return s;
        });
      setDetectedStructure(addRecursive(detectedStructure));
    }
  };

  const handleImport = () => {
    setIsLoading(true);
    try {
      const markdown = detectedStructure.length > 0
        ? reconstructDocument(detectedStructure, rawContent)
        : `# ${file?.name.replace(/\.[^.]+$/, '') || 'Document importé'}\n\n${rawContent}`;

      if (importMode === 'replace') {
        loadMarkdown(markdown);
      } else if (importMode === 'append') {
        const currentMarkdown = useStore.getState().saveToMarkdown();
        loadMarkdown(currentMarkdown + '\n\n' + markdown);
      } else {
        const docName = file?.name.replace(/\.[^.]+$/, '') || 'Document importé';
        const ok = importAsDocument(docName, markdown);
        if (!ok) {
          setError('Le fichier importé est vide — aucun document créé.');
          setIsLoading(false);
          return;
        }
      }

      setStep('import');
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'import';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportRaw = () => {
    const markdown = `# ${file?.name.replace(/\.[^.]+$/, '') || 'Document importé'}\n\n${rawContent}`;
    if (importMode === 'replace') {
      loadMarkdown(markdown);
    } else if (importMode === 'append') {
      const currentMarkdown = useStore.getState().saveToMarkdown();
      loadMarkdown(currentMarkdown + '\n\n' + markdown);
    } else {
      const docName = file?.name.replace(/\.[^.]+$/, '') || 'Document importé';
      const ok = importAsDocument(docName, markdown);
      if (!ok) {
        setError('Le fichier importé est vide — aucun document créé.');
        return;
      }
    }
    setStep('import');
    setTimeout(() => handleClose(), 1500);
  };

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
            <p className="text-xs text-gray-600 line-clamp-2 ml-6">{section.content}</p>
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
    <div className="modal-backdrop">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-glow-accent">
              <Upload size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold accent-text-gradient tracking-tight">Import de document</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 'upload' && 'Sélectionnez un fichier à importer'}
                {step === 'preview' && 'Aperçu du contenu importé'}
                {step === 'analyze' && 'Analyse de la structure en cours…'}
                {step === 'structure' && 'Validez la structure détectée'}
                {step === 'import' && 'Import terminé'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="icon-btn" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-b border-white/40 flex-shrink-0">
          {(['upload', 'preview', 'structure', 'import'] as WizardStep[]).map((s, i) => {
            const isActive = step === s;
            const isDone = ['upload', 'preview', 'structure', 'import'].indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ease-spring ${
                  isActive ? 'accent-gradient text-white shadow-glow-accent' :
                  isDone ? 'bg-emerald-100 text-emerald-700' :
                  'bg-white/60 text-slate-500 border border-white/80'
                }`}>
                  {isDone ? (
                    <CheckCircle size={12} />
                  ) : (
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/30 text-[10px]">
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
                {i < 3 && <ChevronRight size={12} className="text-slate-300" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
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

          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
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

          {step === 'preview' && (
            <div className="space-y-4">
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={importMode === 'new-doc'}
                      onChange={() => setImportMode('new-doc')}
                      className="text-indigo-600"
                    />
                    <span className="text-sm text-indigo-700">Nouveau document dans le projet</span>
                  </label>
                </div>
              </div>
            </div>
          )}

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

              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                {detectedStructure.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Aucune structure détectée. Ajoutez des sections manuellement.
                  </p>
                ) : (
                  detectedStructure.map(section => renderSection(section))
                )}
              </div>

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

          {step === 'import' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Import réussi !</h3>
              <p className="text-gray-600">Votre document a été importé avec succès.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'import' && step !== 'analyze' && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/40 flex-shrink-0">
            <button
              onClick={step === 'upload' ? handleClose : () => setStep(step === 'structure' ? 'preview' : 'upload')}
              className="btn-ghost"
            >
              {step === 'upload' ? 'Annuler' : '← Retour'}
            </button>

            <div className="flex gap-2">
              {step === 'preview' && (
                <>
                  <button onClick={handleImportRaw} className="btn-secondary">
                    Importer tel quel
                  </button>
                  <button
                    onClick={analyzeStructure}
                    disabled={isLoading || !aiConfig.apiKey}
                    className="btn-primary"
                  >
                    <Wand2 size={15} />
                    Analyser la structure
                  </button>
                </>
              )}

              {step === 'structure' && (
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="btn bg-emerald-500 text-white shadow-soft hover:scale-[1.02]"
                >
                  <CheckCircle size={15} />
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
