/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Info, 
  ArrowRight, 
  Lightbulb, 
  Brain, 
  BookOpen, 
  FileEdit, 
  Microscope, 
  BarChart3, 
  Archive, 
  Upload,
  Send,
  Copy,
  CheckCircle2,
  XCircle,
  History,
  UserCircle,
  Paperclip,
  Mic,
  Sparkles,
  LineChart,
  UserCheck,
  Building2,
  FlaskConical,
  ShieldAlert,
  LogOut,
  HelpCircle
} from 'lucide-react';
import { marked } from 'marked';
import { AppState, Message, SYSTEM_INSTRUCTIONS } from './types';
import { sendMessageToGemini } from './services/geminiService';
import { cn } from './lib/utils';

export default function App() {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [history, setHistory] = useState<Message[]>([
    { role: 'system', parts: [{ text: SYSTEM_INSTRUCTIONS }] }
  ]);
  const [userInput, setUserInput] = useState('');
  const [rq1, setRq1] = useState('');
  const [rq2, setRq2] = useState('');
  const [rq3, setRq3] = useState('');
  const [selectedRq, setSelectedRq] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Restore from local storage
  useEffect(() => {
    const savedHistory = localStorage.getItem('finer_history');
    const savedState = localStorage.getItem('finer_state');
    const savedProject = localStorage.getItem('finer_project');
    if (savedHistory && savedState) {
      // We don't auto-restore to avoid confusion, but we provide a button
    }
  }, []);

  // Scroll to top on state change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state]);

  const handleRestore = () => {
    const savedHistory = localStorage.getItem('finer_history');
    const savedState = localStorage.getItem('finer_state');
    const savedProject = localStorage.getItem('finer_project');
    if (savedHistory && savedState) {
      setHistory(JSON.parse(savedHistory));
      setState(savedState as AppState);
      if (savedProject) setProjectName(savedProject);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const saveState = (newHistory: Message[], newState: AppState) => {
    localStorage.setItem('finer_history', JSON.stringify(newHistory));
    localStorage.setItem('finer_state', newState);
    localStorage.setItem('finer_project', projectName);
  };

  const handleStart = () => {
    if (privacyAccepted) {
      setState(AppState.PHASE1);
    }
  };

  const handleExit = () => {
    setState(AppState.LANDING);
    setHistory([]);
    setUserInput('');
    setRq1('');
    setRq2('');
    setRq3('');
    setSelectedRq(null);
    setFeedback('');
    setFeedbackSent(false);
    setIsRefining(false);
    localStorage.removeItem('finer_history');
    localStorage.removeItem('finer_state');
    localStorage.removeItem('finer_project');
  };

  const handleSendMessage = async () => {
    const keyToUse = apiKey || (process.env.GEMINI_API_KEY as string);
    if (!userInput.trim() || !keyToUse) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const newUserMessage: Message = { role: 'user', parts: [{ text: userInput }] };
    const updatedHistory = [...history, newUserMessage];
    setHistory(updatedHistory);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(keyToUse, updatedHistory, state);
      const newModelMessage: Message = { role: 'model', parts: [{ text: response }] };
      const finalHistory = [...updatedHistory, newModelMessage];
      setHistory(finalHistory);
      
      // Detect phase transitions
      detectTransitions(response, finalHistory);
      saveState(finalHistory, state);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRQs = async () => {
    const keyToUse = apiKey || (process.env.GEMINI_API_KEY as string);
    if (!keyToUse || !rq1.trim() || !rq2.trim() || !rq3.trim()) return;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const combinedRQs = `RQ1: ${rq1}\nRQ2: ${rq2}\nRQ3: ${rq3}`;
    const newUserMessage: Message = { role: 'user', parts: [{ text: combinedRQs }] };
    const updatedHistory = [...history, newUserMessage];
    setHistory(updatedHistory);
    setIsLoading(true);
    setState(AppState.PHASE2);
    setIsRefining(false);

    try {
      const response = await sendMessageToGemini(keyToUse, updatedHistory, AppState.PHASE2);
      const newModelMessage: Message = { role: 'model', parts: [{ text: response }] };
      const finalHistory = [...updatedHistory, newModelMessage];
      setHistory(finalHistory);
      setSelectedRq(null);
      detectTransitions(response, finalHistory);
      saveState(finalHistory, AppState.PHASE2);
    } catch (error) {
      console.error(error);
      setState(AppState.PHASE1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateHypotheses = async () => {
    const keyToUse = apiKey || (process.env.GEMINI_API_KEY as string);
    if (!keyToUse || !selectedRq || selectedRq === 'Ninguna') return;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    let rqText = '';
    if (selectedRq === 'RQ1') rqText = rq1;
    else if (selectedRq === 'RQ2') rqText = rq2;
    else if (selectedRq === 'RQ3') rqText = rq3;

    const prompt = `He seleccionado la pregunta de investigación: "${rqText}". Por favor, procede a la Fase 3: Generación de Hipótesis y Estadística. Define variables independientes y dependientes, y genera 4 hipótesis en formato markdown.`;
    
    const newUserMessage: Message = { role: 'user', parts: [{ text: prompt }] };
    const updatedHistory = [...history, newUserMessage];
    setHistory(updatedHistory);
    setIsLoading(true);
    setState(AppState.PHASE3);

    try {
      const response = await sendMessageToGemini(keyToUse, updatedHistory, AppState.PHASE3);
      const newModelMessage: Message = { role: 'model', parts: [{ text: response }] };
      const finalHistory = [...updatedHistory, newModelMessage];
      setHistory(finalHistory);
      detectTransitions(response, finalHistory);
      saveState(finalHistory, AppState.PHASE3);
    } catch (error) {
      console.error(error);
      setState(AppState.PHASE2);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClosing = () => {
    setState(AppState.CLOSING);
    saveState(history, AppState.CLOSING);
  };

  const detectTransitions = (response: string, currentHistory: Message[]) => {
    // Extract RQs if present in the response
    const m1 = response.match(/(?:RQ1|Pregunta 1)[:\s*-]+(.*?)(?=\n(?:RQ2|Pregunta 2)|(?:\r?\n){2}|$)/si);
    const m2 = response.match(/(?:RQ2|Pregunta 2)[:\s*-]+(.*?)(?=\n(?:RQ3|Pregunta 3)|(?:\r?\n){2}|$)/si);
    const m3 = response.match(/(?:RQ3|Pregunta 3)[:\s*-]+(.*?)(?=(?:\r?\n){2}|$|#)/si);

    if (m1 && m1[1].trim()) setRq1(m1[1].trim().replace(/^\*\*|\*\*$/g, ''));
    if (m2 && m2[1].trim()) setRq2(m2[1].trim().replace(/^\*\*|\*\*$/g, ''));
    if (m3 && m3[1].trim()) setRq3(m3[1].trim().replace(/^\*\*|\*\*$/g, ''));

    // Phase 1 -> Phase 2: Triggered by the presence of a FINER table
    if (response.toLowerCase().includes('tabla de análisis finer') || response.toLowerCase().includes('finer comparative analysis')) {
      if (state === AppState.PHASE1) setState(AppState.PHASE2);
    }

    if (response.toLowerCase().includes('hipótesis') && state === AppState.PHASE2) {
      setState(AppState.PHASE3);
    }

    if (response.toLowerCase().includes('declaración de uso de ia') && state === AppState.PHASE3) {
      setState(AppState.CLOSING);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfnoQC9uTbLRsjx520tbGUx42-KFXBucBCBhGlZs2jFqqu-Fw/formResponse';
    const formData = new FormData();
    formData.append('entry.1448617893', projectName);
    formData.append('entry.947145212', state);
    formData.append('entry.295241438', feedback);

    try {
      await fetch(formUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
      });
      setFeedbackSent(true);
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  const renderMarkdown = (text: string) => {
    return { __html: marked.parse(text) };
  };

  const isAskingForRQs = history.some(m => 
    m.role === 'model' && 
    (m.parts[0].text.includes('RQ1') && m.parts[0].text.includes('RQ2') && m.parts[0].text.includes('RQ3'))
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <nav className="bg-background/80 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center px-6 py-4 w-full border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <Brain className="text-primary w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight text-primary font-headline">Agente FINER</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {state !== AppState.LANDING && (
            <button 
              onClick={handleExit}
              className="flex items-center gap-2 text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-all font-bold text-xs"
              title="Salir y volver al inicio"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant/20 relative">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">API Key</span>
              <button 
                onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                className="text-primary hover:text-primary-container transition-colors"
                title="¿Cómo obtengo mi clave?"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {showApiKeyHelp && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-surface-container-highest p-4 rounded-xl shadow-2xl border border-outline-variant/30 z-[100] text-xs text-on-surface space-y-3 animate-in fade-in slide-in-from-top-2">
                <p className="font-bold text-primary flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  ¿Cómo obtengo mi clave?
                </p>
                <div className="space-y-2 text-on-surface-variant leading-relaxed">
                  <p>Entra a <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-secondary underline font-medium">aistudio.google.com/app/apikey</a>.</p>
                  <p>Haz clic en <strong className="text-on-surface">"Create API key"</strong>.</p>
                  <p>Cópiala y pégala aquí. Es gratis y personal.</p>
                </div>
                <button 
                  onClick={() => setShowApiKeyHelp(false)}
                  className="w-full py-1.5 bg-surface-container-high rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-surface-container-highest transition-colors"
                >
                  Entendido
                </button>
              </div>
            )}

            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-xs w-32 p-0"
              placeholder="Ingrese su clave..."
            />
          </div>
          <button 
            onClick={handleRestore}
            className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant"
            title="Restaurar sesión"
          >
            <History className="w-5 h-5" />
          </button>
          <UserCircle className="text-on-surface-variant w-8 h-8" />
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-6 py-8 max-w-6xl">
        <AnimatePresence mode="wait">
          {state === AppState.LANDING && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center py-12"
            >
              <div className="lg:col-span-7 space-y-10">
                <div className="space-y-6">
                  <h2 className="text-5xl md:text-7xl font-bold text-primary leading-[1.1] tracking-tight font-headline">
                    Toda investigación comenzó con una pregunta que alguien se atrevió a hacer.
                  </h2>
                  <p className="text-on-surface-variant text-lg md:text-xl max-w-xl leading-relaxed">
                    Agente FINER te acompaña a transformar lo que observas en una pregunta de investigación rigurosa, relevante y tuya.
                  </p>
                </div>
                <div className="flex items-center gap-6 pt-4">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-12 h-12 rounded-full border-2 border-surface bg-surface-container-high overflow-hidden">
                        <img src={`https://picsum.photos/seed/doctor${i}/100/100`} alt="Researcher" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-on-surface-variant">Únete a más de 1,200 investigadores académicos.</p>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="bg-surface-container-low rounded-xl p-8 md:p-10 shadow-xl border border-outline-variant/10 relative overflow-hidden">
                  <div className="relative z-10 space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="w-6 h-6" />
                        <h3 className="text-2xl font-bold font-headline">Términos de uso</h3>
                      </div>
                    </div>

                    <div className="bg-surface rounded-xl p-6 border border-outline-variant/20 space-y-4 shadow-inner">
                      <div className="flex items-start gap-4">
                        <Info className="text-secondary w-5 h-5 mt-1" />
                        <div className="text-sm text-on-surface leading-relaxed space-y-3">
                          <ul className="list-disc pl-4 space-y-2 text-on-surface-variant">
                            <li>Las entradas pueden ser procesadas y utilizadas por Google para el entrenamiento de modelos.</li>
                            <li><span className="text-error font-bold">NO</span> cargue datos de pacientes ni registros clínicos privados.</li>
                            <li>Se prohíbe la carga de protocolos institucionales privados.</li>
                            <li>Se prohíbe la carga de documentos protegidos por derechos de autor.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="flex items-center gap-4 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={privacyAccepted}
                          onChange={(e) => setPrivacyAccepted(e.target.checked)}
                          className="w-6 h-6 rounded border-outline-variant text-secondary focus:ring-secondary/20"
                        />
                        <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface">Entiendo y acepto los términos de uso.</span>
                      </label>
                      <button 
                        disabled={!privacyAccepted}
                        onClick={handleStart}
                        className={cn(
                          "w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg",
                          privacyAccepted 
                            ? "bg-gradient-to-br from-primary to-primary-container text-white hover:scale-[1.02] active:scale-95 cursor-pointer opacity-100" 
                            : "bg-surface-dim text-on-surface-variant opacity-50 cursor-not-allowed"
                        )}
                      >
                        Iniciar Sesión de Agente FINER
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {state === AppState.PHASE1 && (
            <motion.div 
              key="phase1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 lg:grid-cols-24 gap-8 items-start">
                <div className="lg:col-span-13 space-y-8">
                  <section className="mb-8">
                    <h2 className="text-4xl md:text-5xl text-primary mb-4 font-headline leading-tight">Lluvia de ideas</h2>
                    <p className="text-on-surface-variant text-lg max-w-xl font-body">La observación es el primer acto científico.</p>
                  </section>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                      <label className="text-xs font-bold text-primary uppercase tracking-widest">Nombre del Proyecto / Tema</label>
                      <span className="text-[10px] text-outline">{projectName.length} / 50</span>
                    </div>
                    <input 
                      type="text" 
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/60 text-lg"
                      placeholder="Ingresa un título provisional..."
                    />
                  </div>

                  <div className="bg-surface-container-low rounded-3xl p-1 shadow-lg">
                    <div className="bg-surface-container-lowest rounded-2xl p-6 min-h-[300px] flex flex-col">
                      {isAskingForRQs ? (
                        <div className="space-y-6 flex-grow">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest px-1">Pregunta 1 (RQ1)</label>
                            <textarea 
                              value={rq1}
                              onChange={(e) => setRq1(e.target.value)}
                              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/40 text-lg resize-none h-24 leading-relaxed"
                              placeholder="Escribe tu primera pregunta de investigación..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest px-1">Pregunta 2 (RQ2)</label>
                            <textarea 
                              value={rq2}
                              onChange={(e) => setRq2(e.target.value)}
                              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/40 text-lg resize-none h-24 leading-relaxed"
                              placeholder="Escribe tu segunda pregunta de investigación..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-primary uppercase tracking-widest px-1">Pregunta 3 (RQ3)</label>
                            <textarea 
                              value={rq3}
                              onChange={(e) => setRq3(e.target.value)}
                              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/40 text-lg resize-none h-24 leading-relaxed"
                              placeholder="Escribe tu tercera pregunta de investigación..."
                            />
                          </div>
                          
                          <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-outline-variant/10">
                            <p className="text-secondary font-bold text-lg italic">¿list@ con las preguntas?</p>
                            <button 
                              onClick={handleSendRQs}
                              disabled={isLoading || !rq1.trim() || !rq2.trim() || !rq3.trim() || !(apiKey || process.env.GEMINI_API_KEY)}
                              className={cn(
                                "bg-gradient-to-br from-primary to-primary-container text-white px-10 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg active:scale-95 transition-all",
                                (isLoading || !rq1.trim() || !rq2.trim() || !rq3.trim() || !(apiKey || process.env.GEMINI_API_KEY)) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
                              )}
                            >
                              {isLoading ? "Analizando..." : "Continuar al analisis de las preguntas"}
                              <ArrowRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <textarea 
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="flex-grow w-full border-none focus:ring-0 bg-transparent text-on-surface placeholder:text-outline/40 text-xl resize-none leading-relaxed"
                            placeholder="Cuéntame qué tienes en mente: una historia de un paciente, algo que observaste, algo que te inquieta."
                          ></textarea>
                          <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline-variant/10">
                            <div className="flex gap-2">
                              <button className="p-2 text-primary hover:bg-surface-container transition-colors rounded-lg"><Paperclip className="w-5 h-5" /></button>
                              <button className="p-2 text-primary hover:bg-surface-container transition-colors rounded-lg"><Mic className="w-5 h-5" /></button>
                            </div>
                            <button 
                              onClick={handleSendMessage}
                              disabled={isLoading || !userInput.trim() || !projectName.trim() || !(apiKey || process.env.GEMINI_API_KEY)}
                              className={cn(
                                "bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all",
                                (isLoading || !userInput.trim() || !projectName.trim() || !(apiKey || process.env.GEMINI_API_KEY)) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
                              )}
                            >
                              {isLoading ? "Refinando..." : "Refinar Idea"}
                              <Sparkles className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                      {!(apiKey || process.env.GEMINI_API_KEY) && (userInput.trim() || projectName.trim()) && (
                        <p className="text-[10px] text-error mt-2 font-bold text-right italic">Requiere API Key en la barra superior</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-11 flex flex-col gap-6 pt-2">
                  <div className="bg-[#00008B] border-2 border-primary/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl ring-4 ring-primary/5">
                    <BookOpen className="absolute top-0 right-0 w-32 h-32 opacity-10 -mr-8 -mt-8 text-white" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center gap-2 text-white font-bold">
                        <Brain className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest opacity-90">Agente FINER</span>
                      </div>
                      <div className="space-y-4">
                        {isRefining ? (
                          <div className="bg-surface p-4 rounded-xl rounded-tl-none shadow-sm border-l-4 border-secondary">
                            <p className="italic leading-relaxed text-on-surface">
                              "¡Es momento de mejorar! Ahora puedes ajustar las 3 preguntas de investigación según tu criterio y volver a ejecutar el análisis FINER. Recuerda que refinar es parte esencial del proceso científico: cada versión te acerca un poco más a una pregunta sólida y rigurosa. ¡Adelante!"
                            </p>
                          </div>
                        ) : (
                          <>
                            {history.filter(m => m.role === 'model').slice(-1).map((m, i) => (
                              <div key={i} className="bg-surface p-4 rounded-xl rounded-tl-none shadow-sm border-l-4 border-secondary">
                                <p className="italic leading-relaxed text-on-surface">
                                  {m.parts[0].text}
                                </p>
                              </div>
                            ))}
                            {history.length <= 1 && (
                              <div className="bg-surface p-4 rounded-xl rounded-tl-none shadow-sm border-l-4 border-secondary">
                                <p className="italic leading-relaxed text-on-surface">
                                  "Estoy aquí para escuchar. A veces, la mejor investigación surge de las cosas que nos frustran o los pequeños detalles en los que no podemos dejar de pensar. Escribe como si estuvieras hablando con un colega tomando un café."
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl overflow-hidden h-48 relative group shadow-lg">
                    <img 
                      src="https://picsum.photos/seed/research/600/400" 
                      alt="Inspiration" 
                      className="w-full h-full object-cover grayscale transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px]"></div>
                    <div className="absolute bottom-0 left-0 p-4 w-full bg-gradient-to-t from-primary/80 to-transparent">
                      <p className="text-white font-headline italic text-lg leading-tight">"La investigación es curiosidad formalizada. Es hurgar y curiosear con un propósito."</p>
                      <p className="text-primary-fixed text-[10px] uppercase font-bold mt-1">— Zora Neale Hurston</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {state === AppState.PHASE2 && (
            <motion.div 
              key="phase2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <section>
                <h2 className="text-4xl text-primary mb-4 font-headline">Preguntas de Investigación Candidatas</h2>
                <p className="text-on-surface-variant text-sm">Refine las propuestas antes de proceder al análisis FINER automatizado.</p>
              </section>

              <div className="markdown-body bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 shadow-sm overflow-x-auto min-h-[200px] flex flex-col">
                {isLoading ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-primary font-bold animate-pulse text-lg">Realizando análisis FINER comparativo...</p>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={renderMarkdown(history.filter(m => m.role === 'model').slice(-1)[0]?.parts[0].text || '')} />
                )}
              </div>

              {!isLoading && (
                <div className="space-y-6">
                  <h3 className="text-xl font-headline text-secondary">Selecciona la pregunta para continuar:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['RQ1', 'RQ2', 'RQ3', 'Ninguna'].map((rq) => (
                      <button
                        key={rq}
                        onClick={() => setSelectedRq(rq)}
                        className={cn(
                          "px-6 py-4 rounded-xl font-bold transition-all border-2",
                          selectedRq === rq 
                            ? "bg-primary text-white border-primary shadow-md" 
                            : "bg-surface text-on-surface border-outline-variant/30 hover:border-primary/50"
                        )}
                      >
                        {rq}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-center md:justify-end gap-4 pb-12">
                {selectedRq === 'Ninguna' ? (
                  <button 
                    onClick={() => {
                      // Ensure RQs are extracted from the last model message if present
                      const lastModelMessage = [...history].reverse().find(m => m.role === 'model');
                      if (lastModelMessage) {
                        const text = lastModelMessage.parts[0].text;
                        const m1 = text.match(/(?:RQ1|Pregunta 1)[:\s*-]+(.*?)(?=\n(?:RQ2|Pregunta 2)|(?:\r?\n){2}|$)/si);
                        const m2 = text.match(/(?:RQ2|Pregunta 2)[:\s*-]+(.*?)(?=\n(?:RQ3|Pregunta 3)|(?:\r?\n){2}|$)/si);
                        const m3 = text.match(/(?:RQ3|Pregunta 3)[:\s*-]+(.*?)(?=(?:\r?\n){2}|$|#)/si);

                        if (m1 && m1[1].trim()) setRq1(m1[1].trim().replace(/^\*\*|\*\*$/g, ''));
                        if (m2 && m2[1].trim()) setRq2(m2[1].trim().replace(/^\*\*|\*\*$/g, ''));
                        if (m3 && m3[1].trim()) setRq3(m3[1].trim().replace(/^\*\*|\*\*$/g, ''));
                      }
                      setState(AppState.PHASE1);
                      setSelectedRq(null);
                      setIsRefining(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-surface-container-highest text-primary px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all border border-outline-variant/20 w-full md:w-auto"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                    Regresar a Lluvia de ideas
                  </button>
                ) : (
                  <button 
                    onClick={handleGenerateHypotheses}
                    disabled={!selectedRq || isLoading}
                    className={cn(
                      "bg-primary text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg w-full md:w-auto",
                      (!selectedRq || isLoading) ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-container"
                    )}
                  >
                    Continuar a Fase 3: Hipótesis
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {state === AppState.PHASE3 && (
            <motion.div 
              key="phase3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <header>
                <h1 className="text-5xl font-headline text-primary mb-4">Formulación de Hipótesis</h1>
                <p className="text-on-surface-variant max-w-2xl leading-relaxed">
                  Transformando tu pregunta refinada en proposiciones comprobables. A continuación se presentan las hipótesis sugeridas derivadas de tu alcance de investigación.
                </p>
              </header>

              <div className="markdown-body bg-surface-container-low p-8 rounded-xl border-l-4 border-primary min-h-[200px] flex flex-col">
                {isLoading ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-primary font-bold animate-pulse text-lg">Generando hipótesis...</p>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={renderMarkdown(history.filter(m => m.role === 'model').slice(-1)[0]?.parts[0].text || '')} />
                )}
              </div>

              <div className="flex flex-col items-center gap-6 py-12">
                <button 
                  onClick={handleGenerateClosing}
                  disabled={isLoading}
                  className={cn(
                    "bg-gradient-to-br from-primary to-primary-container text-white px-10 py-5 rounded-full text-lg font-bold shadow-lg flex items-center gap-3 transition-transform",
                    isLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-90"
                  )}
                >
                  Generar Bloque de Cierre
                  <Sparkles className="w-5 h-5" />
                </button>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2 opacity-60">
                  <UserCheck className="w-4 h-4" />
                  SÍNTESIS ACADÉMICA ASISTIDA POR IA
                </p>
              </div>
            </motion.div>
          )}

          {state === AppState.CLOSING && (
            <motion.div 
              key="closing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 py-12"
            >
              <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-4">
                  <h2 className="text-3xl text-primary font-headline leading-tight">Cierre del análisis de la pregunta de investigación</h2>
                  <p className="mt-4 text-on-surface-variant leading-relaxed">Tu proceso de refinamiento ha concluido. A continuación, encontrarás la declaración de transparencia y el mensaje final.</p>
                </div>
                <div className="md:col-span-8 space-y-8">
                  <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10 shadow-sm relative min-h-[100px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold tracking-wider uppercase text-primary">DECLARACIÓN DE USO DE IA</h3>
                      <button 
                        onClick={() => {
                          const text = "Se utilizó la aplicación Agente FINER (en Google AI Studio) como apoyo para la estructuración de la pregunta de investigación.";
                          navigator.clipboard.writeText(text);
                        }}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </button>
                    </div>
                    <div className="text-on-surface-variant leading-relaxed">
                      <p>Se utilizó la aplicación Agente FINER (en Google AI Studio) como apoyo para la estructuración de la pregunta de investigación.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center bg-surface-container-highest/30 rounded-xl p-8 md:p-12">
                <div>
                  <h3 className="text-3xl text-primary font-headline">Ayúdanos a evolucionar</h3>
                  <p className="mt-2 text-on-surface-variant">Como todo proyecto académico, esta aplicación busca la mejora continua. Tus comentarios son fundamentales.</p>
                </div>
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline">¿CÓMO PODEMOS MEJORAR ESTA APP?</label>
                    <textarea 
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full bg-surface-container-lowest border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-fixed-dim placeholder-on-surface-variant/40 text-sm" 
                      placeholder="Escribe tus sugerencias aquí..." 
                      rows={3}
                    ></textarea>
                  </div>
                  <button 
                    disabled={feedbackSent || !feedback.trim()}
                    type="submit" 
                    className={cn(
                      "w-full md:w-auto px-8 py-3 rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2",
                      feedbackSent ? "bg-secondary-container text-on-secondary-container" : "bg-secondary text-white hover:opacity-90 active:scale-95"
                    )}
                  >
                    {feedbackSent ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        ¡Gracias por tu aporte!
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar
                      </>
                    )}
                  </button>
                </form>
              </section>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleExit}
                  className="bg-surface-container-highest text-on-surface px-10 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-outline-variant/20 transition-all shadow-sm"
                >
                  <LogOut className="w-6 h-6" />
                  Finalizar y Salir
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low w-full py-12 px-8 border-t border-outline-variant/10 mt-auto">
        <div className="container mx-auto flex flex-col items-center gap-8">
          <div className="flex gap-8 text-xs font-medium text-on-surface-variant">
            <a href="#" className="hover:text-primary transition-colors">Metodología</a>
            <a href="#" className="hover:text-primary transition-colors">Política de Privacidad</a>
            <a href="#" className="hover:text-primary transition-colors">Soporte</a>
          </div>
          <p className="text-xs text-on-surface-variant/60">
            © 2026 Agente FINER v1.0 por Lyda Osorio TGHN y Universidad del Valle Colombia
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full flex justify-around items-center px-4 pb-safe bg-surface border-t border-outline-variant/20 shadow-2xl z-50 rounded-t-2xl py-3">
        {[
          { icon: FileEdit, label: 'Fase 1', phase: AppState.PHASE1 },
          { icon: Microscope, label: 'Fase 2', phase: AppState.PHASE2 },
          { icon: LineChart, label: 'Fase 3', phase: AppState.PHASE3 },
          { icon: Archive, label: 'Fase 4', phase: AppState.CLOSING },
          { icon: Upload, label: 'Fase 5', phase: AppState.CLOSING },
        ].map((item, i) => (
          <button 
            key={i}
            onClick={() => setState(item.phase)}
            className={cn(
              "flex flex-col items-center justify-center px-3 py-1.5 transition-all",
              state === item.phase ? "bg-secondary text-white rounded-xl scale-110 shadow-md" : "text-on-surface-variant opacity-60"
            )}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
