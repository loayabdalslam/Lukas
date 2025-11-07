import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, StepResult, Conversation, StoredFile, PlanStep, Clarification, GroundingSource, Exchange } from './types';
import { AgentIcon, ClockIcon, CheckCircleIcon, LoadingSpinnerIcon, SunIcon, MoonIcon, ComputerIcon, OrchestratorIcon, UserIcon, WindowCloseIcon, WindowMaximizeIcon, WindowMinimizeIcon, SearchIcon, MapIcon, ArrowUpIcon, SettingsIcon, CogIcon, SheetsIcon, ImageIcon, PaperclipIcon } from './components/icons';
import { useLocation } from './hooks/useLocation';
import { generatePlan, executeSearch, executeMap, executeVision, executeVideo, synthesizeAnswer, executeEmail, executeSheets, executeDrive, executeOrchestratorIntermediateStep, executeImageGeneration } from './services/geminiService';
import { marked } from 'marked';
import { translations, Localization, Lang } from './localization';

// --- HELPER COMPONENTS ---

const StreamingMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const html = useMemo(() => marked.parse(content, { gfm: true, breaks: true }), [content]);
    return <div className="prose prose-sm max-w-none text-left rtl:text-right" dangerouslySetInnerHTML={{ __html: html as string }} />;
};

// --- RIGHT PANEL COMPONENTS ---

const AgentVisualizer: React.FC<{ step: StepResult | null; t: (key: keyof Localization) => string; }> = ({ step, t }) => {
    const renderContent = () => {
        if (!step) {
             return (
                <div className="flex flex-col items-center justify-center flex-grow text-center text-[var(--text-secondary-color)] p-4">
                    <ComputerIcon className="w-20 h-20 text-[var(--text-secondary-color)] opacity-50" />
                    <p className="mt-4 font-bold text-lg text-[var(--text-color)]">{t('computerTitle')}</p>
                    <p className="text-sm">{t('computerStatusWaiting')}</p>
                </div>
            );
        }
        
        if (step.status === 'running') {
             switch (step.agent) {
                case Agent.SearchAgent:
                    return (
                        <div className="w-full flex-grow bg-[var(--bg-secondary-color)] p-4 animate-pulse">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4">
                               <SearchIcon className="w-5 h-5 text-blue-500" />
                               <p className="text-sm font-semibold truncate">{step.task}</p>
                            </div>
                            <div className="space-y-3">
                               <div className="h-4 bg-[var(--bg-tertiary-color)] rounded w-5/6"></div>
                               <div className="h-3 bg-[var(--bg-tertiary-color)] rounded w-full"></div>
                               <div className="h-3 bg-[var(--bg-tertiary-color)] rounded w-full"></div>
                               <div className="h-3 bg-[var(--bg-tertiary-color)] rounded w-2/3"></div>
                            </div>
                        </div>
                    );
                default:
                     return (
                         <div className="flex flex-col items-center justify-center flex-grow text-center p-4">
                            <AgentIcon agent={step.agent} className="w-16 h-16 text-[var(--accent-color)]" />
                            <p className="mt-4 font-bold">{step.agent}</p>
                            <p className="text-sm text-secondary-color">{step.task}</p>
                        </div>
                    );
             }
        }

        // Completed / Error states
        switch (step.agent) {
            case Agent.MapsAgent: {
                const mapQuery = step.result || step.task;
                return (
                    <div className="w-full flex-grow bg-[var(--bg-secondary-color)] flex flex-col">
                        <div className="p-2 border-b border-[var(--border-color)] flex items-center space-x-2 rtl:space-x-reverse flex-shrink-0">
                           <MapIcon className="w-5 h-5 text-green-500" />
                           <p className="text-sm font-semibold truncate">{step.task}</p>
                        </div>
                         <iframe
                            className="w-full flex-grow border-0"
                            loading="lazy"
                            allowFullScreen
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
                        ></iframe>
                    </div>
                );
            }
            default:
                 return (
                    <div className="p-4 overflow-y-auto flex-grow min-h-0">
                        <StreamingMarkdownRenderer content={step.result} />
                    </div>
                )
        }
    };

    return (
        <div className="h-full bg-[var(--bg-secondary-color)] rounded-b-lg flex flex-col overflow-hidden">
            {renderContent()}
        </div>
    );
};

const VirtualComputer: React.FC<{ viewedStep: StepResult | null; t: (key: keyof Localization) => string; }> = ({ viewedStep, t }) => {
    return (
        <div className="card flex flex-col h-full">
            <header className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <AgentIcon agent={viewedStep?.agent || Agent.Orchestrator} className="w-4 h-4 text-[var(--text-secondary-color)]" />
                    <span className="text-sm font-semibold">{t('computerTitle')}</span>
                    {viewedStep && <span className="text-xs text-[var(--text-secondary-color)]">| Step {viewedStep.step}: {viewedStep.status}</span>}
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse text-[var(--text-secondary-color)]">
                   <WindowMinimizeIcon /><WindowMaximizeIcon /><WindowCloseIcon />
                </div>
            </header>
            <div className="flex-grow min-h-0">
                <AgentVisualizer step={viewedStep} t={t} />
            </div>
        </div>
    );
};

const TaskProgress: React.FC<{ 
    plan: PlanStep[] | null; 
    results: StepResult[]; 
    onStepSelect: (step: StepResult) => void;
    viewedStep: StepResult | null;
    t: (key: keyof Localization) => string; 
}> = ({ plan, results, onStepSelect, viewedStep, t }) => {
    if (!plan || plan.length === 0) {
        return <div className="card p-4 h-full"><h3 className="font-bold text-sm mb-2">{t('taskProgress')}</h3><p className="text-sm text-[var(--text-secondary-color)]">{t('computerStatusWaiting')}</p></div>
    }
    const getStatusIcon = (status: StepResult['status']) => {
        switch (status) {
            case 'running': return <LoadingSpinnerIcon className="w-5 h-5 text-blue-500" />;
            case 'completed': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error': return <CheckCircleIcon className="w-5 h-5 text-red-500" />;
            default: return <ClockIcon className="w-5 h-5 text-[var(--text-secondary-color)]" />;
        }
    }
    
    return (
        <div className="card p-4 h-full overflow-y-scroll">
            <h3 className="font-bold text-sm mb-3">{t('taskProgress')}</h3>
            <ul className="space-y-1">
                {plan.map(step => {
                    const result = results.find(r => r.step === step.step);
                    if (!result) return null;

                    const status = result.status;
                    const isViewed = viewedStep?.step === result.step;
                    
                    return (
                         <li key={step.step}>
                             <button 
                                onClick={() => onStepSelect(result)}
                                disabled={status === 'pending'}
                                className={`w-full flex items-center space-x-3 rtl:space-x-reverse text-sm p-2 rounded-md transition-colors text-left rtl:text-right disabled:opacity-50 disabled:cursor-not-allowed ${isViewed ? 'bg-[var(--hover-bg-color)]' : 'hover:bg-[var(--hover-bg-color)]'}`}
                            >
                                <div>{getStatusIcon(status)}</div>
                                <span className={`${status === 'pending' ? 'text-[var(--text-secondary-color)]' : ''}`}>{step.task}</span>
                             </button>
                         </li>
                    )
                })}
            </ul>
        </div>
    )
}

// --- CHAT PANEL COMPONENTS ---

const ClarificationRequest: React.FC<{ clarification: Clarification; onSelect: (option: {key: string, value: string}) => void; disabled: boolean }> = ({ clarification, onSelect, disabled }) => {
    return (
        <div>
            <p className="mb-3">{clarification.question}</p>
            <div className="flex flex-col sm:flex-row gap-2">
                {clarification.options.map(option => (
                    <button 
                        key={option.key} 
                        onClick={() => onSelect(option)}
                        disabled={disabled}
                        className="text-sm w-full text-left p-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--hover-bg-color)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {option.value}
                    </button>
                ))}
            </div>
        </div>
    )
}

const ChatMessage: React.FC<{ agent: Agent; content: string | React.ReactNode; sources?: GroundingSource[] }> = ({ agent, content, sources }) => {
    const isUser = agent === Agent.User;
    
    return (
        <div className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-tertiary-color)]`}>
                {isUser ? <UserIcon className="w-5 h-5" /> : <OrchestratorIcon className="w-5 h-5 text-[var(--accent-color)]" />}
            </div>
            <div className={`relative w-full max-w-xl p-3 rounded-xl ${isUser ? 'bg-[var(--accent-color)] text-white' : 'card'} max-h-[60vh] overflow-y-auto`}>
                 {typeof content === 'string' ? <p className="whitespace-pre-wrap">{content}</p> : content}

                {sources && sources.length > 0 && (
                    <div className={`mt-3 pt-3 border-t ${isUser ? 'border-white/20' : 'border-[var(--border-color)]'}`}>
                        <ul className="space-y-2">
                            {sources.map((source, index) => (
                                <li key={index} className="text-xs">
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 group/link ${isUser ? 'text-white/90 hover:text-white' : 'text-[var(--text-secondary-color)] hover:text-[var(--text-color)]'}`}>
                                        <div className="flex-shrink-0">
                                            <AgentIcon agent={source.agent} className="w-4 h-4" />
                                        </div>
                                        <span className="truncate group-hover/link:underline">{source.title}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}

const SettingsPopover: React.FC<{
    isOpen: boolean;
    cycleCount: number;
    setCycleCount: (count: number) => void;
    onClose: () => void;
    t: (key: keyof Localization) => string;
}> = ({ isOpen, cycleCount, setCycleCount, onClose, t }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div ref={popoverRef} className="absolute bottom-full mb-3 right-0 rtl:right-auto rtl:left-0 w-64 card p-4 shadow-lg z-10">
            <h4 className="font-bold text-sm mb-2">{t('settingsTitle')}</h4>
            <div className="flex items-center justify-between">
                <label htmlFor="cycle-count" className="text-sm text-[var(--text-secondary-color)]">{t('cycleCount')}</label>
                <div className="flex items-center gap-2">
                     <button onClick={() => setCycleCount(Math.max(1, cycleCount - 1))} className="font-bold w-6 h-6 rounded-md bg-[var(--bg-tertiary-color)]">-</button>
                     <input id="cycle-count" type="number" value={cycleCount} readOnly className="w-10 text-center bg-transparent" />
                     <button onClick={() => setCycleCount(Math.min(5, cycleCount + 1))} className="font-bold w-6 h-6 rounded-md bg-[var(--bg-tertiary-color)]">+</button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [lang, setLang] = useState<Lang>('ar');
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [prompt, setPrompt] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        try {
            const saved = localStorage.getItem('lukas_conversations');
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            return parsed.map((convo: Conversation) => ({
                ...convo,
                exchanges: convo.exchanges.map((ex: any) => ({
                    ...ex,
                    imageFile: null,
                    videoFile: null,
                }))
            }));
        } catch { return []; }
    });
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewedStep, setViewedStep] = useState<StepResult | null>(null);
    const { location } = useLocation();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [cycleCount, setCycleCount] = useState(1);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const activeConversation = useMemo(() => conversations.find(c => c.id === activeConversationId), [conversations, activeConversationId]);
    const activeExchange = useMemo(() => {
        if (!activeConversation) return null;
        return activeConversation.exchanges[activeConversation.exchanges.length - 1];
    }, [activeConversation]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
        if (!activeExchange?.results || activeExchange.results.length === 0) { setViewedStep(null); return; }
        const runningStep = activeExchange.results.find(r => r.status === 'running');
        if (runningStep) { setViewedStep(runningStep); return; }
        const latestProcessedStep = [...activeExchange.results].reverse().find(r => r.status === 'completed' || r.status === 'error');
        if (latestProcessedStep) { setViewedStep(latestProcessedStep); } 
        else if (activeExchange.status === 'executing' && activeExchange.results.length > 0) { setViewedStep(activeExchange.results[0]); }
    }, [activeExchange]);

    const t = useMemo(() => (key: keyof Localization, ...args: (string | number)[]) => {
        let translation = translations[lang][key] || translations['en'][key];
        if (args.length) { translation = translation.replace(/\{0\}/g, String(args[0])); }
        return translation;
    }, [lang]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('lukas_theme') as 'light' | 'dark';
        if (savedTheme) setTheme(savedTheme);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
    }, []);
    
    useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('lukas_theme', theme);
    }, [theme]);
    useEffect(() => {
        const serializableConversations = conversations.map(convo => ({
            ...convo,
            exchanges: convo.exchanges.map(({ imageFile, videoFile, ...rest }) => rest)
        }));
        localStorage.setItem('lukas_conversations', JSON.stringify(serializableConversations));
    }, [conversations]);
    
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeConversation, isLoading]);
    useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, [prompt]);

    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setAttachedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearAttachment = () => {
        setAttachedFile(null);
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
        if(fileInputRef.current) { fileInputRef.current.value = ""; }
    };
    
    const updateExchange = (convoId: string, exchangeId: string, updates: Partial<Exchange>) => {
        setConversations(prevConvos => prevConvos.map(c => {
            if (c.id !== convoId) return c;
            const newExchanges = c.exchanges.map(ex => 
                ex.id === exchangeId ? { ...ex, ...updates } : ex
            );
            return { ...c, exchanges: newExchanges };
        }));
    };
    
    const updateStepResult = (convoId: string, exchangeId: string, step: number, updates: Partial<StepResult>, appendResult: string = '') => {
        setConversations(prev => prev.map(c => {
            if (c.id !== convoId) return c;
            const newExchanges = c.exchanges.map(ex => {
                if (ex.id !== exchangeId) return ex;
                const newResults = ex.results.map(r => r.step === step ? { ...r, ...updates, result: (updates.result !== undefined) ? updates.result : r.result + appendResult } : r);
                return { ...ex, results: newResults };
            });
            return { ...c, exchanges: newExchanges };
        }));
    };
    
    const handleSubmitPrompt = async (promptToSubmit: string) => {
        if ((!promptToSubmit.trim() && !attachedFile) || isLoading) return;
        
        setIsLoading(true);
        setPrompt('');

        const exchangeId = Date.now().toString();
        const newExchange: Exchange = {
            id: exchangeId,
            prompt: promptToSubmit,
            imageFile: attachedFile && attachedFile.type.startsWith('image/') ? attachedFile : null,
            videoFile: attachedFile && attachedFile.type.startsWith('video/') ? attachedFile : null,
            plan: null, results: [], status: 'planning',
        };
        clearAttachment();
        
        let convoToUpdateId: string;
        let convoToUpdate: Conversation;

        if (activeConversationId) {
            convoToUpdateId = activeConversationId;
            setConversations(prev => prev.map(c => {
                if (c.id !== convoToUpdateId) return c;
                convoToUpdate = { ...c, exchanges: [...c.exchanges, newExchange] };
                return convoToUpdate;
            }));
        } else {
            const newConvoId = Date.now().toString();
            convoToUpdateId = newConvoId;
            convoToUpdate = {
                id: newConvoId,
                title: promptToSubmit,
                exchanges: [newExchange]
            };
            setConversations(prev => [...prev, convoToUpdate]);
            setActiveConversationId(newConvoId);
        }
        
        const currentConvo = conversations.find(c => c.id === convoToUpdateId) || convoToUpdate!;
        const history = (currentConvo.exchanges || [])
            .slice(0, -1)
            .filter(ex => ex.status === 'completed')
            .map(ex => ({ prompt: ex.prompt, results: ex.results }));

        try {
            const planResponse = await generatePlan(promptToSubmit, !!newExchange.imageFile, !!newExchange.videoFile, history as any, cycleCount);

            updateExchange(convoToUpdateId, exchangeId, {
                plan: planResponse.plan || null,
                clarification: planResponse.clarification || null,
                status: planResponse.clarification ? 'clarification_needed' : 'planning'
            });
            
            if(planResponse.plan) {
                 await handleExecute(convoToUpdateId, exchangeId, newExchange, planResponse.plan);
            }
        } catch (err: any) { 
            const errorMessage = err.message || t('unknownError');
            updateExchange(convoToUpdateId, exchangeId, { status: 'error', errorMessage });
        } 
        finally { setIsLoading(false); }
    };
    
    const handlePlan = () => handleSubmitPrompt(prompt);

    const handleClarificationResponse = async (convoId: string, exchangeId: string, exchange: Exchange, selectedOption: { key: string; value: string; }) => {
        setIsLoading(true);
        updateExchange(convoId, exchangeId, { status: 'planning', clarification: null });

        const clarifiedPrompt = `The user's original request was: "${exchange.prompt}". I asked for clarification, and the user chose: "${selectedOption.value}". Now, please generate the execution plan based on this clarified request.`;
        
        try {
            const currentConvo = conversations.find(c => c.id === convoId)!;
            const history = currentConvo.exchanges
                .filter(ex => ex.id !== exchangeId && ex.status === 'completed')
                .map(ex => ({ prompt: ex.prompt, results: ex.results }));

            const planResponse = await generatePlan(clarifiedPrompt, !!exchange.imageFile, !!exchange.videoFile, history as any, cycleCount);
            if (!planResponse.plan) throw new Error("Failed to get a plan after clarification.");
            
            updateExchange(convoId, exchangeId, { plan: planResponse.plan, clarification: null, status: 'planning' });
            await handleExecute(convoId, exchangeId, { ...exchange, plan: planResponse.plan }, planResponse.plan);

        } catch (err: any) {
            const errorMessage = err.message || t('unknownError');
            updateExchange(convoId, exchangeId, { status: 'error', errorMessage });
        } finally { setIsLoading(false); }
    };

    const handleExecute = async (convoId: string, exchangeId: string, exchange: Exchange, plan: PlanStep[]) => {
        let generatedSheetFile: StoredFile | null = null;
        try {
            setIsLoading(true);
            updateExchange(convoId, exchangeId, { status: 'executing', plan, results: plan.map(step => ({ ...step, result: '', status: 'pending' })) });
            
            let stepOutputs: StepResult[] = [];
            for (const step of plan) {
                updateStepResult(convoId, exchangeId, step.step, { status: 'running' });
                let fullStepResult = '';
                
                try {
                    const onChunk = (chunk: string) => { updateStepResult(convoId, exchangeId, step.step, {}, chunk); fullStepResult += chunk; };
                    let r: any = {};
                    let imageBase64Data: string | undefined;
                    
                    if (step.agent === Agent.Orchestrator) {
                        if (step.step === plan.length) { r = await synthesizeAnswer(exchange.prompt, stepOutputs, onChunk); } 
                        else { r = await executeOrchestratorIntermediateStep(step.task, exchange.prompt, stepOutputs, onChunk); }
                    } else {
                        switch (step.agent) {
                            case Agent.SearchAgent: r = await executeSearch(step.task, onChunk); break;
                            case Agent.MapsAgent: r = await executeMap(step.task, location, onChunk); break;
                            case Agent.VisionAgent: r = await executeVision(step.task, exchange.imageFile!, onChunk); break;
                            case Agent.VideoAgent: r = await executeVideo(step.task, exchange.videoFile!, onChunk); break;
                            case Agent.ImageGenerationAgent:
                                r = await executeImageGeneration(step.task, onChunk);
                                imageBase64Data = r.imageBase64;
                                break;
                            case Agent.EmailAgent: r = await executeEmail(step.task, onChunk); break;
                            case Agent.DriveAgent: r = await executeDrive(step.task, onChunk); break;
                            case Agent.SheetsAgent: {
                                const prevData = stepOutputs.length > 0 ? stepOutputs[stepOutputs.length - 1].result : '';
                                r = await executeSheets(step.task, prevData, onChunk);
                                if (r.sheetData) generatedSheetFile = { id: `file-${Date.now()}`, name: `${step.task.substring(0,30)}...`, data: r.sheetData, createdAt: new Date().toISOString() };
                                break;
                            }
                        }
                    }
                    
                    const completedStep: StepResult = {
                        ...step,
                        result: fullStepResult,
                        status: 'completed',
                        sources: r.sources,
                        imageBase64: imageBase64Data,
                    };

                    updateStepResult(convoId, exchangeId, step.step, completedStep);
                    stepOutputs.push(completedStep);
                    if (step.step < plan.length) { await new Promise(resolve => setTimeout(resolve, 1000)); }
                } catch (e: any) {
                    updateStepResult(convoId, exchangeId, step.step, { status: 'error', result: e.message }); throw e;
                }
            }
            updateExchange(convoId, exchangeId, { status: 'completed', generatedFile: generatedSheetFile });
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || t('unknownError');
            updateExchange(convoId, exchangeId, { status: 'error', errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const showComputer = activeExchange && (activeExchange.status !== 'planning' && activeExchange.status !== 'clarification_needed');
    
    const examplePrompts = [
        { icon: <MapIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Find a place", prompt: "Find cafes near Central Park, NYC" },
        { icon: <ImageIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Create an image", prompt: "Generate an image of a photorealistic cat wearing sunglasses" },
        { icon: <SheetsIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Organize data", prompt: "Create a spreadsheet of the top 5 largest cities in the world by population in 2024" },
    ];

    const handleNewChat = () => { setActiveConversationId(null); setViewedStep(null); }
    
    const renderExchangeResponse = (exchange: Exchange) => {
        if (exchange.status === 'completed') {
             const finalAnswer = exchange.results.find(r => r.agent === Agent.Orchestrator && r.step === exchange.plan?.length);
             const finalImage = exchange.results.find(r => r.imageBase64);
             if (!finalAnswer && !finalImage) return null;

            const allSources = Array.from(new Map(exchange.results.flatMap(r => r.sources || []).map(s => [s.uri, s])).values());
            
            return (
                <>
                    {finalAnswer && (
                        <ChatMessage 
                            agent={Agent.Orchestrator} 
                            content={<StreamingMarkdownRenderer content={finalAnswer.result} />}
                            sources={allSources}
                        />
                    )}
                    {finalImage && (
                        <ChatMessage
                            agent={Agent.Orchestrator}
                            content={
                                <img
                                    src={`data:image/png;base64,${finalImage.imageBase64}`}
                                    alt={finalImage.task}
                                    className="rounded-lg max-w-full h-auto"
                                />
                            }
                        />
                    )}
                </>
            );
        }
        if (exchange.status === 'clarification_needed' && exchange.clarification && activeConversation) {
            return (
                <ChatMessage 
                    agent={Agent.Orchestrator} 
                    content={<ClarificationRequest 
                        clarification={exchange.clarification} 
                        onSelect={(option) => handleClarificationResponse(activeConversation.id, exchange.id, exchange, option)} 
                        disabled={isLoading} 
                    />} 
                />
            );
        }
        if (exchange.status === 'error' && exchange.errorMessage) {
            return <ChatMessage agent={Agent.Orchestrator} content={`${t('errorMessage')}: ${exchange.errorMessage}`} />;
        }
        return null;
    }

    return (
        <div className="h-screen w-screen flex bg-[var(--bg-color)] overflow-hidden">
            {/* Sidebar */}
            <div className="flex-shrink-0 w-64 bg-[var(--bg-tertiary-color)] flex flex-col">
                <div className="p-4 border-b border-[var(--border-color)]">
                    <button onClick={handleNewChat} className="w-full p-2 rounded-md text-sm font-semibold bg-[var(--bg-secondary-color)] border border-[var(--border-color)] hover:bg-[var(--hover-bg-color)]">
                        + {t('newChat')}
                    </button>
                </div>
                 <div className="flex-grow overflow-y-scroll p-2 space-y-1">
                    {conversations.slice().reverse().map(convo => (
                        <button key={convo.id} onClick={() => setActiveConversationId(convo.id)} className={`w-full text-left rtl:text-right p-2 rounded-md text-sm truncate ${activeConversationId === convo.id ? 'bg-[var(--accent-color)] text-white' : 'hover:bg-[var(--hover-bg-color)]'}`}>
                            {convo.title || t('newChat')}
                        </button>
                    ))}
                </div>
                <div className="flex-shrink-0 p-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    <h1 className="text-md font-bold">Lukas 1.5</h1>
                    <div className='flex items-center space-x-1 rtl:space-x-reverse'>
                        <button onClick={toggleLang} className="p-2 rounded-md font-semibold text-sm text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors">{lang === 'en' ? 'AR' : 'EN'}</button>
                        <button onClick={toggleTheme} className="p-2 rounded-md text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors">
                            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col min-w-0">
                 <div className={`flex-grow min-h-0 grid ${showComputer ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Left Panel: Chat */}
                    <div className="flex flex-col h-full bg-[var(--bg-color)]">
                        <main className="flex-grow min-h-0 w-full overflow-y-scroll p-4 space-y-6">
                           {!activeConversation ? (
                             <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                                <OrchestratorIcon className="w-20 h-20 text-[var(--text-secondary-color)] opacity-50" />
                                <h2 className="text-2xl font-bold mt-4">{t('appTitle')}</h2>
                                <p className="text-[var(--text-secondary-color)] mt-2 max-w-md">{t('appDescription')}</p>
                                <div className="mt-8 w-full max-w-4xl">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left rtl:text-right">
                                        {examplePrompts.map((p, i) => (
                                            <button key={i} onClick={() => handleSubmitPrompt(p.prompt)} disabled={isLoading} className="card p-4 hover:bg-[var(--hover-bg-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left rtl:text-right">
                                                <div className="flex items-center gap-3">{p.icon} <h3 className="font-bold">{p.title}</h3></div>
                                                <p className="text-sm text-[var(--text-secondary-color)] mt-2">{p.prompt}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                           ) : (
                            <>
                                {activeConversation.exchanges.map(exchange => (
                                    <React.Fragment key={exchange.id}>
                                        <ChatMessage agent={Agent.User} content={exchange.prompt} />
                                        {renderExchangeResponse(exchange)}
                                    </React.Fragment>
                                ))}
                               {isLoading && activeExchange && activeExchange.status !== 'completed' && <ChatMessage agent={Agent.Orchestrator} content={<div className="flex justify-center items-center p-2"><LoadingSpinnerIcon className="w-6 h-6" /></div>} />}
                            </>
                           )}
                            <div ref={chatEndRef} />
                        </main>
                        
                        <footer className="flex-shrink-0 p-4">
                            <div className="relative">
                                <SettingsPopover isOpen={isSettingsOpen} cycleCount={cycleCount} setCycleCount={setCycleCount} onClose={() => setIsSettingsOpen(false)} t={t} />
                                {previewUrl && (
                                    <div className="relative w-24 h-24 mb-2 p-1 border border-[var(--border-color)] rounded-md">
                                        <img src={previewUrl} className="w-full h-full object-cover rounded" />
                                        <button onClick={clearAttachment} className="absolute -top-2 -right-2 rtl:-right-auto rtl:-left-2 bg-gray-800 text-white rounded-full p-0.5"><WindowCloseIcon className="w-4 h-4" /></button>
                                    </div>
                                )}
                                <div className="card p-2 flex items-end gap-2 rtl:space-x-reverse">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                                     <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-1.5 rounded-md text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors flex-shrink-0 h-9 w-9 flex items-center justify-center">
                                        <PaperclipIcon className="w-6 h-6" />
                                     </button>
                                     <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan(); } }} placeholder={t('promptPlaceholder')} className="flex-grow bg-transparent focus:outline-none resize-none text-base p-1.5 max-h-40" rows={1} disabled={isLoading} />
                                     <button onClick={() => setIsSettingsOpen(prev => !prev)} className="p-1.5 rounded-md text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors h-9 w-9 flex items-center justify-center flex-shrink-0">
                                        <CogIcon className="w-6 h-6" />
                                     </button>
                                     <button onClick={handlePlan} disabled={isLoading || (!prompt.trim() && !attachedFile)} className="bg-[var(--accent-color)] text-white h-9 w-9 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center flex-shrink-0">
                                        {isLoading ? <LoadingSpinnerIcon className="w-5 h-5"/> : <ArrowUpIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </footer>
                    </div>

                    {/* Right Panel: Computer */}
                    {showComputer && (
                        <div className="hidden lg:flex flex-col h-full p-4 space-y-4 bg-[var(--bg-tertiary-color)] border-l border-[var(--border-color)] animate-fade-in">
                           <div className="flex-1 min-h-0">
                               <VirtualComputer viewedStep={viewedStep} t={t} />
                           </div>
                           <div className="flex-1 min-h-0">
                               <TaskProgress plan={activeExchange?.plan || null} results={activeExchange?.results || []} onStepSelect={setViewedStep} viewedStep={viewedStep} t={t} />
                           </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;