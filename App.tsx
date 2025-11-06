import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, StepResult, Conversation, StoredFile, PlanStep, Clarification, GroundingSource } from './types';
import { AgentIcon, ClockIcon, CheckCircleIcon, LoadingSpinnerIcon, SunIcon, MoonIcon, ComputerIcon, OrchestratorIcon, UserIcon, WindowCloseIcon, WindowMaximizeIcon, WindowMinimizeIcon, SearchIcon, MapIcon, ArrowUpIcon, SettingsIcon, CogIcon, SheetsIcon } from './components/icons';
import { useLocation } from './hooks/useLocation';
import { generatePlan, executeSearch, executeMap, executeVision, executeVideo, synthesizeAnswer, executeEmail, executeSheets, executeDrive, executeOrchestratorIntermediateStep } from './services/geminiService';
import { marked } from 'marked';
import { translations, Localization, Lang } from './localization';

// --- HELPER COMPONENTS ---

const StreamingMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const html = useMemo(() => marked.parse(content, { gfm: true, breaks: true }), [content]);
    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html as string }} />;
};

// --- RIGHT PANEL COMPONENTS ---

const AgentVisualizer: React.FC<{ step: StepResult | null; t: (key: keyof Localization) => string; }> = ({ step, t }) => {
    const renderContent = () => {
        if (!step) {
             return (
                <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-secondary-color)] p-4">
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
                        <div className="w-full h-full bg-[var(--bg-secondary-color)] p-4 animate-pulse">
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
                         <div className="flex flex-col items-center justify-center h-full text-center p-4">
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
                // The step.result contains the markdown list of places found by the agent.
                // The Google Maps embed API is smart enough to parse this list and place pins for recognized locations.
                // This is more reliable than trying to parse a single source URI.
                const mapQuery = step.result || step.task;

                return (
                    <div className="w-full h-full bg-[var(--bg-secondary-color)] flex flex-col">
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
                    <div className="p-4 overflow-y-scroll h-full">
                        <StreamingMarkdownRenderer content={step.result} />
                    </div>
                )
        }
    };

    return (
        <div className="h-full bg-[var(--bg-secondary-color)] rounded-b-lg">
            {renderContent()}
        </div>
    );
};

const VirtualComputer: React.FC<{ viewedStep: StepResult | null; t: (key: keyof Localization) => string; }> = ({ viewedStep, t }) => {
    return (
        <div className="card flex flex-col flex-grow">
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
        return <div className="card p-4 h-48"><h3 className="font-bold text-sm mb-2">{t('taskProgress')}</h3><p className="text-sm text-[var(--text-secondary-color)]">{t('computerStatusWaiting')}</p></div>
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
        <div className="card p-4 h-48 overflow-y-scroll">
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
            return saved ? JSON.parse(saved).map((c: Conversation) => ({ ...c, imageFile: null, videoFile: null })) : [];
        } catch { return []; }
    });
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewedStep, setViewedStep] = useState<StepResult | null>(null);
    const { location } = useLocation();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [cycleCount, setCycleCount] = useState(1);
    
    const activeConversation = useMemo(() => conversations.find(c => c.id === activeConversationId), [conversations, activeConversationId]);
    
    useEffect(() => {
        // If there's no active conversation or results, clear the view
        if (!activeConversation?.results || activeConversation.results.length === 0) {
            setViewedStep(null);
            return;
        }

        const runningStep = activeConversation.results.find(r => r.status === 'running');
        if (runningStep) {
            // Always prioritize showing the currently running step
            setViewedStep(runningStep);
            return;
        }
    
        const latestProcessedStep = [...activeConversation.results]
            .reverse()
            .find(r => r.status === 'completed' || r.status === 'error');

        if (latestProcessedStep) {
            setViewedStep(latestProcessedStep);
        } else if (activeConversation.status === 'executing' && activeConversation.results.length > 0) {
            setViewedStep(activeConversation.results[0]);
        }

    }, [activeConversation]);


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
        localStorage.setItem('lukas_conversations', JSON.stringify(conversations.map(({ imageFile, videoFile, ...rest }) => rest)));
    }, [conversations]);
    
    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');
    
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeConversation, isLoading]);
    useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, [prompt]);

    const updateStepResult = (convoId: string, step: number, updates: Partial<StepResult>, appendResult: string = '') => {
        setConversations(prev => prev.map(c => {
            if (c.id !== convoId) return c;
            const newResults = c.results.map(r => r.step === step ? { ...r, ...updates, result: (updates.result !== undefined) ? updates.result : r.result + appendResult } : r);
            return { ...c, results: newResults };
        }));
    };

    const handleSubmitPrompt = async (promptToSubmit: string) => {
        if (!promptToSubmit.trim() || isLoading) return;
        
        setIsLoading(true);
        setPrompt('');

        const newConversation: Conversation = {
            id: Date.now().toString(), prompt: promptToSubmit, imageFile: null, videoFile: null,
            plan: null, results: [], status: 'planning',
        };
        setConversations(prev => [...prev, newConversation]);
        setActiveConversationId(newConversation.id);
        
        try {
            const planResponse = await generatePlan(promptToSubmit, false, false, [], cycleCount);

            setConversations(prev => prev.map(c => 
                c.id === newConversation.id 
                ? { ...c, 
                    plan: planResponse.plan || null, 
                    clarification: planResponse.clarification || null,
                    status: planResponse.clarification ? 'clarification_needed' : 'planning' 
                  } 
                : c
            ));
            
            if(planResponse.plan) {
                await handleExecute({ ...newConversation, plan: planResponse.plan });
            }
        } catch (err: any) { 
            const errorMessage = err.message || t('unknownError');
            setConversations(prev => prev.map(c => 
                c.id === newConversation.id 
                ? { ...c, status: 'error', errorMessage } 
                : c
            ));
        } 
        finally { setIsLoading(false); }
    };
    
    const handlePlan = () => handleSubmitPrompt(prompt);

    const handleClarificationResponse = async (convo: Conversation, selectedOption: { key: string; value: string; }) => {
        setIsLoading(true);
        setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, status: 'planning', clarification: null } : c));
        
        const clarifiedPrompt = `The user's original request was: "${convo.prompt}". I asked for clarification, and the user chose: "${selectedOption.value}". Now, please generate the execution plan based on this clarified request.`;
        
        try {
            const planResponse = await generatePlan(clarifiedPrompt, false, false, [], cycleCount);
            if (!planResponse.plan) throw new Error("Failed to get a plan after clarification.");
            
            const conversationToExecute: Conversation = { ...convo, plan: planResponse.plan, clarification: null, status: 'planning' };
            setConversations(prev => prev.map(c => c.id === convo.id ? conversationToExecute : c));
            await handleExecute(conversationToExecute);

        } catch (err: any) {
            const errorMessage = err.message || t('unknownError');
            setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, status: 'error', errorMessage } : c));
        } finally { setIsLoading(false); }
    };

    const handleExecute = async (conversation: Conversation) => {
        const { id: convoId, plan } = conversation;
        if (!plan) return;

        let generatedSheetFile: StoredFile | null = null;
        try {
            setIsLoading(true);
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'executing', plan, results: plan.map(step => ({ ...step, result: '', status: 'pending' })) } : c));
            
            let stepOutputs: StepResult[] = [];
            for (const step of plan) {
                updateStepResult(convoId, step.step, { status: 'running' });
                let fullStepResult = '';
                
                try {
                    const onChunk = (chunk: string) => { updateStepResult(convoId, step.step, {}, chunk); fullStepResult += chunk; };
                    let r: any = {};
                    
                    if (step.agent === Agent.Orchestrator) {
                        if (step.step === plan.length) { // Final synthesis step
                            r = await synthesizeAnswer(conversation.prompt, stepOutputs, onChunk);
                        } else { // Intermediate to-do or validation step
                            r = await executeOrchestratorIntermediateStep(step.task, conversation.prompt, stepOutputs, onChunk);
                        }
                    } else {
                        switch (step.agent) {
                            case Agent.SearchAgent: r = await executeSearch(step.task, onChunk); break;
                            case Agent.MapsAgent: r = await executeMap(step.task, location, onChunk); break;
                            case Agent.VisionAgent: r = await executeVision(step.task, conversation.imageFile!, onChunk); break;
                            case Agent.VideoAgent: r = await executeVideo(step.task, conversation.videoFile!, onChunk); break;
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
                    
                    const completedStep = { ...step, result: fullStepResult, status: 'completed' as const, sources: r.sources };
                    updateStepResult(convoId, step.step, completedStep);
                    stepOutputs.push(completedStep);

                    // Pause after completing a step to let the user see the result, but not after the final step.
                    if (step.step < plan.length) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                } catch (e: any) {
                    updateStepResult(convoId, step.step, { status: 'error', result: e.message }); throw e;
                }
            }

            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'completed', generatedFile: generatedSheetFile } : c));
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || t('unknownError');
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'error', errorMessage } : c));
        } finally {
            setIsLoading(false);
        }
    };
    
    const showComputer = activeConversation && (activeConversation.status !== 'planning' && activeConversation.status !== 'clarification_needed');
    
    const examplePrompts = [
        { icon: <MapIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Find a place", prompt: "Find cafes near Central Park, NYC" },
        { icon: <SheetsIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Organize data", prompt: "Create a spreadsheet of the top 5 largest cities in the world by population in 2024" },
        { icon: <SearchIcon className="w-6 h-6 text-[var(--accent-color)]" />, title: "Get latest news", prompt: "What are the latest developments in AI this week?" },
    ];

    const handleNewChat = () => {
        setActiveConversationId(null);
        setViewedStep(null);
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
                            {convo.prompt}
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
                                            <button 
                                                key={i} 
                                                onClick={() => handleSubmitPrompt(p.prompt)}
                                                disabled={isLoading}
                                                className="card p-4 hover:bg-[var(--hover-bg-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left rtl:text-right"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {p.icon}
                                                    <h3 className="font-bold">{p.title}</h3>
                                                </div>
                                                <p className="text-sm text-[var(--text-secondary-color)] mt-2">{p.prompt}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                           ) : (
                            <>
                                <ChatMessage agent={Agent.User} content={activeConversation.prompt} />
                                {activeConversation.status === 'completed' && activeConversation.results.find(r => r.agent === Agent.Orchestrator && r.step === activeConversation.plan?.length) &&
                                    <ChatMessage 
                                        agent={Agent.Orchestrator} 
                                        content={<StreamingMarkdownRenderer content={activeConversation.results.find(r => r.agent === Agent.Orchestrator && r.step === activeConversation.plan?.length)!.result} />}
                                        sources={Array.from(new Map(activeConversation.results.flatMap(r => r.sources || []).map(s => [s.uri, s])).values())}
                                    />
                                }
                                {activeConversation.status === 'clarification_needed' && activeConversation.clarification && (
                                    <ChatMessage agent={Agent.Orchestrator} content={
                                        <ClarificationRequest 
                                            clarification={activeConversation.clarification} 
                                            onSelect={(option) => handleClarificationResponse(activeConversation, option)}
                                            disabled={isLoading}
                                        />
                                    }/>
                                )}
                                {activeConversation.status === 'error' && activeConversation.errorMessage &&
                                    <ChatMessage agent={Agent.Orchestrator} content={`${t('errorMessage')}: ${activeConversation.errorMessage}`} />
                                }
                               {isLoading && activeConversation.status !== 'completed' && <ChatMessage agent={Agent.Orchestrator} content={<div className="flex justify-center items-center p-2"><LoadingSpinnerIcon className="w-6 h-6" /></div>} />}
                            </>
                           )}
                            <div ref={chatEndRef} />
                        </main>
                        
                        <footer className="flex-shrink-0 p-4">
                            <div className="relative">
                                <SettingsPopover 
                                    isOpen={isSettingsOpen}
                                    cycleCount={cycleCount}
                                    setCycleCount={setCycleCount}
                                    onClose={() => setIsSettingsOpen(false)}
                                    t={t}
                                />
                                <div className="card p-2 flex items-end gap-2 rtl:space-x-reverse">
                                     <button onClick={handlePlan} disabled={isLoading || !prompt.trim()} className="bg-[var(--accent-color)] text-white h-9 w-9 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center flex-shrink-0">
                                        {isLoading ? <LoadingSpinnerIcon className="w-5 h-5"/> : <ArrowUpIcon className="w-5 h-5" />}
                                    </button>
                                     <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan(); } }} placeholder={t('promptPlaceholder')} className="flex-grow bg-transparent focus:outline-none resize-none text-base p-1.5 max-h-40" rows={1} disabled={isLoading} />
                                     <button onClick={() => setIsSettingsOpen(prev => !prev)} className="p-1.5 rounded-md text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors">
                                        <CogIcon className="w-6 h-6" />
                                     </button>
                                </div>
                            </div>
                        </footer>
                    </div>

                    {/* Right Panel: Computer */}
                    {showComputer && (
                        <div className="hidden lg:flex flex-col h-full p-4 space-y-4 bg-[var(--bg-tertiary-color)] border-l border-[var(--border-color)] animate-fade-in">
                            <VirtualComputer viewedStep={viewedStep} t={t} />
                            <TaskProgress 
                                plan={activeConversation?.plan || null} 
                                results={activeConversation?.results || []} 
                                onStepSelect={setViewedStep}
                                viewedStep={viewedStep}
                                t={t}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;