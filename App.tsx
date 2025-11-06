import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, StepResult, Conversation, StoredFile, PlanStep, Clarification } from './types';
import { AgentIcon, ClockIcon, CheckCircleIcon, LoadingSpinnerIcon, SunIcon, MoonIcon, ComputerIcon, OrchestratorIcon, UserIcon, WindowCloseIcon, WindowMaximizeIcon, WindowMinimizeIcon, SearchIcon, MapIcon, ArrowUpIcon, SettingsIcon } from './components/icons';
import { useLocation } from './hooks/useLocation';
import { generatePlan, executeSearch, executeMap, executeVision, executeVideo, synthesizeAnswer, executeEmail, executeSheets, executeDrive } from './services/geminiService';
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
        if (!step || step.status !== 'running') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center text-secondary-color p-4">
                    <ComputerIcon className="w-20 h-20 text-[var(--text-secondary-color)] opacity-50" />
                    <p className="mt-4 font-bold text-lg text-[var(--text-color)]">{t('computerTitle')}</p>
                    <p className="text-sm">{step ? t('statusCompleted') : t('computerStatusWaiting')}</p>
                </div>
            );
        }

        switch (step.agent) {
            case Agent.SearchAgent:
                return (
                    <div className="w-full h-full bg-white dark:bg-gray-800 p-4 animate-pulse">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4">
                           <SearchIcon className="w-5 h-5 text-blue-500" />
                           <p className="text-sm font-semibold truncate">{step.task}</p>
                        </div>
                        <div className="space-y-3">
                           <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                           <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                           <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                           <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                    </div>
                );
            case Agent.MapsAgent:
                 return (
                    <div className="w-full h-full bg-gray-700 p-4 flex flex-col animate-pulse">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4 bg-white dark:bg-gray-800 p-2 rounded-md">
                           <MapIcon className="w-5 h-5 text-green-500" />
                           <p className="text-sm font-semibold truncate">{step.task}</p>
                        </div>
                         <div className="flex-grow bg-gray-500 dark:bg-gray-600 rounded-md opacity-75"></div>
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
    };

    return (
        <div className="h-full bg-[var(--bg-tertiary-color)] rounded-b-lg overflow-hidden">
            {renderContent()}
        </div>
    );
};

const VirtualComputer: React.FC<{ activeStep: StepResult | null; t: (key: keyof Localization) => string; }> = ({ activeStep, t }) => {
    return (
        <div className="card flex flex-col flex-grow">
            <header className="flex items-center justify-between p-2 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <AgentIcon agent={activeStep?.agent || Agent.Orchestrator} className="w-4 h-4 text-[var(--text-secondary-color)]" />
                    <span className="text-sm font-semibold">{t('computerTitle')}</span>
                    {activeStep && <span className="text-xs text-[var(--text-secondary-color)]">| {activeStep.status}...</span>}
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse text-[var(--text-secondary-color)]">
                   <WindowMinimizeIcon /><WindowMaximizeIcon /><WindowCloseIcon />
                </div>
            </header>
            <div className="flex-grow min-h-0">
                <AgentVisualizer step={activeStep} t={t} />
            </div>
        </div>
    );
};

const TaskProgress: React.FC<{ plan: PlanStep[] | null; results: StepResult[]; t: (key: keyof Localization) => string; }> = ({ plan, results, t }) => {
    if (!plan || plan.length === 0) {
        return <div className="card p-4 h-48"><h3 className="font-bold text-sm mb-2">{t('taskProgress')}</h3><p className="text-sm text-[var(--text-secondary-color)]">{t('computerStatusWaiting')}</p></div>
    }
    const getStatusIcon = (status: StepResult['status']) => {
        switch (status) {
            case 'running': return <LoadingSpinnerIcon className="w-5 h-5 text-blue-500" />;
            case 'completed': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error': return <CheckCircleIcon className="w-5 h-5 text-red-500" />; // Replace with error icon if available
            default: return <ClockIcon className="w-5 h-5 text-[var(--text-secondary-color)]" />;
        }
    }
    
    return (
        <div className="card p-4 h-48 overflow-y-auto">
            <h3 className="font-bold text-sm mb-3">{t('taskProgress')}</h3>
            <ul className="space-y-3">
                {plan.map(step => {
                    const result = results.find(r => r.step === step.step);
                    const status = result?.status || 'pending';
                    return (
                         <li key={step.step} className="flex items-center space-x-3 rtl:space-x-reverse text-sm">
                            <div>{getStatusIcon(status)}</div>
                            <span className={`${status === 'pending' ? 'text-[var(--text-secondary-color)]' : ''}`}>{step.task}</span>
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

const ChatMessage: React.FC<{ agent: Agent, content: string | React.ReactNode, sources?: any[] }> = ({ agent, content, sources }) => {
    const isUser = agent === Agent.User;
    
    return (
        <div className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-tertiary-color)]`}>
                {isUser ? <UserIcon className="w-5 h-5" /> : <OrchestratorIcon className="w-5 h-5 text-[var(--accent-color)]" />}
            </div>
            <div className={`relative w-full max-w-xl p-3 rounded-xl ${isUser ? 'bg-[var(--accent-color)] text-white' : 'card'}`}>
                 {isUser && typeof content === 'string' && (
                    <div className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-white">
                           <SettingsIcon className="w-4 h-4" />
                       </button>
                    </div>
                )}
                {typeof content === 'string' ? <p className="whitespace-pre-wrap">{content}</p> : content}
            </div>
        </div>
    )
}


const App: React.FC = () => {
    const [lang, setLang] = useState<Lang>('ar');
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [prompt, setPrompt] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        try {
            const saved = localStorage.getItem('ahrian_conversations');
            return saved ? JSON.parse(saved).map((c: Conversation) => ({ ...c, imageFile: null, videoFile: null })) : [];
        } catch { return []; }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeExecution, setActiveExecution] = useState<{ convoId: string, step: number } | null>(null);
    const { location } = useLocation();

    const t = useMemo(() => (key: keyof Localization, ...args: (string | number)[]) => {
        let translation = translations[lang][key] || translations['en'][key];
        if (args.length) { translation = translation.replace(/\{0\}/g, String(args[0])); }
        return translation;
    }, [lang]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('ahrian_theme') as 'light' | 'dark';
        if (savedTheme) setTheme(savedTheme);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
    }, []);
    
    useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('ahrian_theme', theme);
    }, [theme]);
    useEffect(() => {
        localStorage.setItem('ahrian_conversations', JSON.stringify(conversations.map(({ imageFile, videoFile, ...rest }) => rest)));
    }, [conversations]);
    
    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
    const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');
    
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversations, isLoading]);
    useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, [prompt]);

    const updateStepResult = (convoId: string, step: number, updates: Partial<StepResult>, appendResult: string = '') => {
        setConversations(prev => prev.map(c => {
            if (c.id !== convoId) return c;
            const newResults = c.results.map(r => r.step === step ? { ...r, ...updates, result: (updates.result !== undefined) ? updates.result : r.result + appendResult } : r);
            return { ...c, results: newResults };
        }));
    };

    const handlePlan = async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        const currentPrompt = prompt;
        setPrompt('');
        
        try {
            const planResponse = await generatePlan(currentPrompt, false, false, conversations);
            const newConversation: Conversation = {
                id: Date.now().toString(), prompt: currentPrompt, imageFile: null, videoFile: null,
                plan: planResponse.plan || null, results: [],
                status: planResponse.clarification ? 'clarification_needed' : 'planning',
                clarification: planResponse.clarification || null,
            };
            setConversations(prev => [...prev, newConversation]);
            if(planResponse.plan) {
                await handleExecute(newConversation);
            }
        } catch (err: any) { 
            const errorMessage = err.message || t('unknownError');
            const failedConversation: Conversation = {
                 id: Date.now().toString(), prompt: currentPrompt, imageFile: null, videoFile: null,
                 plan: null, results: [], status: 'error', errorMessage
            };
            setConversations(prev => [...prev, failedConversation]);
        } 
        finally { setIsLoading(false); }
    };
    
    const handleClarificationResponse = async (convo: Conversation, selectedOption: { key: string; value: string; }) => {
        setIsLoading(true);

        const userResponseMessage: Conversation = {
            id: Date.now().toString(),
            prompt: selectedOption.value,
            status: 'completed', plan: null, results: [], imageFile: null, videoFile: null,
        };
        const updatedConversations = conversations.map(c => 
            c.id === convo.id ? { ...c, status: 'planning', clarification: null } : c
        );
        setConversations([...updatedConversations, userResponseMessage]);

        const clarifiedPrompt = `The user's original request was: "${convo.prompt}". I asked for clarification, and the user chose: "${selectedOption.value}". Now, please generate the execution plan based on this clarified request.`;
        
        try {
            const planResponse = await generatePlan(clarifiedPrompt, false, false, conversations);
            if (!planResponse.plan) {
                throw new Error("Failed to get a plan after clarification.");
            }
            
            // FIX: Explicitly type conversationToExecute as Conversation to fix type inference issue.
            const conversationToExecute: Conversation = { ...convo, plan: planResponse.plan, clarification: null, status: 'planning' };
            setConversations(prev => prev.map(c => c.id === convo.id ? conversationToExecute : c));
            await handleExecute(conversationToExecute);

        } catch (err: any) {
            const errorMessage = err.message || t('unknownError');
            setConversations(prev => prev.map(c => 
                c.id === convo.id ? { ...c, status: 'error', errorMessage } : c
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecute = async (conversation: Conversation) => {
        const { id: convoId, plan } = conversation;
        if (!plan) return;

        let generatedSheetFile: StoredFile | null = null;
        try {
            setIsLoading(true);
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'executing', plan, results: plan.map(step => ({ ...step, result: '', status: 'pending' })) } : c));
            
            let stepOutputs: { agent: Agent; task: string; result: string; }[] = [];
            for (const step of plan) {
                setActiveExecution({ convoId, step: step.step });
                updateStepResult(convoId, step.step, { status: 'running' });
                let fullStepResult = '';
                try {
                    const onChunk = (chunk: string) => { updateStepResult(convoId, step.step, {}, chunk); fullStepResult += chunk; };
                    let r: any = {};
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
                    if (step.agent !== Agent.Orchestrator) {
                      updateStepResult(convoId, step.step, { status: 'completed', sources: r.sources, result: fullStepResult });
                      stepOutputs.push({ ...step, result: fullStepResult });
                    }
                } catch (e: any) {
                    updateStepResult(convoId, step.step, { status: 'error', result: e.message }); throw e;
                }
            }
            const orchestratorStep = plan.find(s => s.agent === Agent.Orchestrator);
            if (orchestratorStep) {
                setActiveExecution({ convoId, step: orchestratorStep.step });
                updateStepResult(convoId, orchestratorStep.step, { status: 'running' });
                await synthesizeAnswer(conversation.prompt, stepOutputs, (chunk) => updateStepResult(convoId, orchestratorStep.step, {}, chunk));
                updateStepResult(convoId, orchestratorStep.step, { status: 'completed' });
            }

            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'completed', generatedFile: generatedSheetFile } : c));
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || t('unknownError');
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'error', errorMessage } : c));
        } finally {
            setIsLoading(false);
            setActiveExecution(null);
        }
    };
    
    const showComputer = useMemo(() => conversations.some(c => c.status === 'executing' || (c.status === 'completed' && c.plan) || (c.status === 'error' && c.plan)), [conversations]);
    const activeConversation = conversations.find(c => c.id === activeExecution?.convoId) || conversations.slice().reverse().find(c => c.status === 'executing');
    const activeStepResult = activeConversation?.results.find(r => r.step === activeExecution?.step);
    
    return (
        <div className={`h-screen w-screen grid grid-cols-1 ${showComputer ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} transition-all duration-500`}>
            {/* Left Panel: Chat */}
            <div className="flex flex-col h-full bg-[var(--bg-color)]">
                <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-[var(--border-color)]">
                    <h1 className="text-lg font-bold">Ahrian 1.5 Lite</h1>
                    <div className='flex items-center space-x-2 rtl:space-x-reverse'>
                        <button onClick={toggleLang} className="p-2 rounded-md font-semibold text-sm text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors">{lang === 'en' ? 'AR' : 'EN'}</button>
                        <button onClick={toggleTheme} className="p-2 rounded-md text-[var(--text-secondary-color)] hover:bg-[var(--hover-bg-color)] transition-colors">
                            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </header>
                
                <main className="flex-grow w-full overflow-y-auto p-4 space-y-6">
                   {conversations.length === 0 && (
                     <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                        <OrchestratorIcon className="w-20 h-20 text-[var(--text-secondary-color)] opacity-50" />
                        <h2 className="text-2xl font-bold mt-4">{t('appTitle')}</h2>
                        <p className="text-[var(--text-secondary-color)] mt-2 max-w-md">{t('appDescription')}</p>
                    </div>
                   )}
                   {conversations.map(convo => {
                       const orchestratorResult = convo.results.find(r => r.agent === Agent.Orchestrator);
                       return (
                            <React.Fragment key={convo.id}>
                                <ChatMessage agent={Agent.User} content={convo.prompt} />
                                {convo.status === 'completed' && orchestratorResult &&
                                    <ChatMessage agent={Agent.Orchestrator} content={<StreamingMarkdownRenderer content={orchestratorResult.result} />} />
                                }
                                {convo.status === 'clarification_needed' && convo.clarification && (
                                    <ChatMessage agent={Agent.Orchestrator} content={
                                        <ClarificationRequest 
                                            clarification={convo.clarification} 
                                            onSelect={(option) => handleClarificationResponse(convo, option)}
                                            disabled={isLoading}
                                        />
                                    }/>
                                )}
                                {convo.status === 'error' &&
                                    <ChatMessage agent={Agent.Orchestrator} content={`${t('errorMessage')}: ${convo.errorMessage}`} />
                                }
                            </React.Fragment>
                       );
                   })}
                   {isLoading && !activeExecution && <ChatMessage agent={Agent.Orchestrator} content={<div className="flex justify-center items-center p-2"><LoadingSpinnerIcon className="w-6 h-6" /></div>} />}
                    <div ref={chatEndRef} />
                </main>
                
                <footer className="flex-shrink-0 p-4">
                    <div className="card p-2 flex items-end gap-2 rtl:space-x-reverse">
                         <button onClick={handlePlan} disabled={isLoading || !prompt.trim()} className="bg-[var(--accent-color)] text-white h-10 w-10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center flex-shrink-0">
                            {isLoading && !activeExecution ? <LoadingSpinnerIcon className="w-5 h-5"/> : <ArrowUpIcon className="w-5 h-5" />}
                        </button>
                         <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan(); } }} placeholder={t('promptPlaceholder')} className="flex-grow bg-transparent focus:outline-none resize-none text-base p-2 max-h-40 w-full" rows={1} disabled={isLoading} />
                    </div>
                </footer>
            </div>

            {/* Right Panel: Computer */}
            {showComputer && (
                <div className="hidden lg:flex flex-col h-full p-4 space-y-4 bg-[var(--bg-tertiary-color)] border-l border-[var(--border-color)] animate-fade-in">
                    <VirtualComputer activeStep={activeStepResult || null} t={t} />
                    <TaskProgress plan={activeConversation?.plan || null} results={activeConversation?.results || []} t={t}/>
                </div>
            )}
        </div>
    );
};

export default App;