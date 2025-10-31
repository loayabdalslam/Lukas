import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Agent, StepResult, GroundingSource, Conversation, StoredFile, PlanStep, Clarification } from './types';
import { AgentIcon, SunIcon, MoonIcon, ChevronDownIcon } from './components/icons';
import { useLocation } from './hooks/useLocation';
import { generatePlan, executeSearch, executeMap, executeVision, executeVideo, synthesizeAnswer, executeEmail, executeSheets, executeDrive } from './services/geminiService';
import { marked } from 'marked';
import { translations, Localization, Lang } from './localization';

// Helper component for rendering streaming markdown content
const StreamingMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const html = marked.parse(content, { gfm: true, breaks: true });
    return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html as string }} />;
};

// Agent Card Component for home screen
const AgentCard: React.FC<{ agent: Agent, description: string }> = ({ agent, description }) => (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 sm:p-4 flex flex-col items-center text-center transition-colors duration-300">
        <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-full mb-3 transition-colors duration-300">
            <AgentIcon agent={agent} className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <h3 className="font-bold text-sm">{agent}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
);

const StepCard: React.FC<{ result: StepResult; isExpanded: boolean; onToggle: () => void; t: (key: keyof Localization, ...args: (string | number)[]) => string; }> = ({ result, isExpanded, onToggle, t }) => {
    const getStatusInfo = () => {
        switch (result.status) {
            case 'pending': return { text: t('statusPending'), ring: 'ring-gray-300 dark:ring-gray-600' };
            case 'running': return { text: t('statusRunning'), ring: 'ring-black dark:ring-white' };
            case 'completed': return { text: t('statusCompleted'), ring: 'ring-gray-500' };
            case 'error': return { text: t('statusError'), ring: 'ring-gray-500' };
        }
    };
    const statusInfo = getStatusInfo();
    const canToggle = result.status === 'completed' || result.status === 'error';

    return (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg transition-all duration-300">
            <div className={`p-4 ${canToggle ? 'cursor-pointer' : 'cursor-default'}`} onClick={canToggle ? onToggle : undefined}>
                <div className="flex items-start space-x-4 rtl:space-x-reverse">
                    <div className={`relative flex-shrink-0 mt-1 ring-2 ${statusInfo.ring} bg-white dark:bg-gray-900 p-2 rounded-full`}>
                        <AgentIcon agent={result.agent} className="w-5 h-5" />
                        {result.status === 'running' && <div className="absolute inset-0 rounded-full ring-2 ring-black dark:ring-white animate-ping"></div>}
                    </div>
                    <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold">{result.agent}</p>
                            <p className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">{statusInfo.text}</p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 truncate">{result.task}</p>
                    </div>
                    {canToggle && <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />}
                </div>
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                        <div className="text-sm pt-3 border-t border-gray-200 dark:border-gray-700">
                             <p className="font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('task')}:</p>
                             <p className="mb-4 whitespace-pre-wrap">{result.task}</p>
                             <p className="font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('result')}:</p>
                            {(result.status === 'completed' || result.status === 'running') && result.result && <StreamingMarkdownRenderer content={result.result} />}
                            {result.status === 'error' && <p className="text-red-500">{result.result}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const SheetPreview: React.FC<{ file: StoredFile; t: (key: keyof Localization, ...args: (string | number)[]) => string; }> = ({ file, t }) => {
    const headers = useMemo(() => {
        if (file.data.length === 0) return [];
        const headerSet = new Set<string>();
        file.data.forEach(row => {
            Object.keys(row).forEach(key => headerSet.add(key));
        });
        return Array.from(headerSet);
    }, [file.data]);
    
    const previewData = file.data.slice(0, 10);

    const downloadAsCSV = (fullData: Record<string, any>[]) => {
        if (fullData.length === 0) return;
        
        const csvRows = [headers.join(',')]; // Header row

        for (const row of fullData) {
            const values = headers.map(header => {
                const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${file.name.replace(/[^a-z0-9]/gi, '_')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    
    const totalRows = file.data.length;
    const previewMessage = totalRows <= 10
        ? t('showingAllXRows', totalRows)
        : t('showingFirst10Rows', totalRows);

    return (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mt-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                <div>
                    <h3 className="font-bold text-base">{t('sheetPreviewTitle')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{previewMessage}</p>
                </div>
                <button onClick={() => downloadAsCSV(file.data)} className="bg-black text-white dark:bg-white dark:text-black font-semibold px-4 py-2 text-sm rounded-md w-full sm:w-auto flex-shrink-0">{t('downloadFullCSV')}</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full min-w-[600px] text-sm text-left rtl:text-right">
                    <thead className="bg-gray-200 dark:bg-gray-900"><tr>{headers.map(h => <th key={h} className="p-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>
                        {previewData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                                {headers.map(header => <td key={`${rowIndex}-${header}`} className="p-3 whitespace-nowrap truncate max-w-xs">{String(row[header] ?? '')}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PlanPreview: React.FC<{ plan: PlanStep[]; onExecute: () => void; isLoading: boolean; t: (key: keyof Localization) => string; }> = ({ plan, onExecute, isLoading, t }) => (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mt-6">
        <h3 className="font-semibold text-base mb-4">{t('ahriansPlan')}</h3>
        <ul className="space-y-4">
            {plan.map(step => (
                <li key={step.step} className="flex items-start space-x-3 rtl:space-x-reverse">
                    <div className="flex-shrink-0 mt-1 bg-white dark:bg-gray-700 p-2 rounded-full ring-2 ring-gray-300 dark:ring-gray-600">
                        <AgentIcon agent={step.agent} className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{step.agent}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{step.task}</p>
                    </div>
                </li>
            ))}
        </ul>
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
             <button onClick={onExecute} disabled={isLoading} className="bg-black w-full hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-semibold px-4 py-2 rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex justify-center items-center">
                {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div> : t('executePlan')}
            </button>
        </div>
    </div>
);

const ClarificationComponent: React.FC<{ clarification: Clarification; onClarify: (optionKey: string, optionValue: string) => void; isLoading: boolean; t: (key: keyof Localization) => string; }> = ({ clarification, onClarify, isLoading, t }) => (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mt-6">
        <h3 className="font-semibold text-base mb-4">{t('clarificationNeeded')}</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{clarification.question}</p>
        <div className="flex flex-col sm:flex-row gap-3">
            {clarification.options.map(option => (
                <button key={option.key} onClick={() => onClarify(option.key, option.value)} disabled={isLoading} className="flex-1 bg-black text-white dark:bg-white dark:text-black font-semibold px-4 py-2 text-sm rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-600">
                     {option.value}
                </button>
            ))}
        </div>
    </div>
);

const ConversationView: React.FC<{ conversation: Conversation; onExecute: (convoId: string) => void; onClarify: (convoId: string, optionKey: string, optionValue: string) => void; isLoading: boolean; t: (key: keyof Localization, ...args: (string | number)[]) => string; }> = ({ conversation, onExecute, onClarify, isLoading, t }) => {
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    const handleToggleStep = (stepNumber: number) => {
        setExpandedSteps(prev => {
            const newSet = new Set(prev);
            newSet.has(stepNumber) ? newSet.delete(stepNumber) : newSet.add(stepNumber);
            return newSet;
        });
    };

    const agentSteps = conversation.results.filter(r => r.agent !== Agent.Orchestrator);
    const orchestratorStep = conversation.results.find(r => r.agent === Agent.Orchestrator);
    
    const uniqueSources = (conversation.results.reduce((acc, r) => {
        if (r.sources) acc.push(...r.sources);
        return acc;
    }, [] as GroundingSource[])).filter((source, index, self) => index === self.findIndex((s) => s.uri === source.uri));

    return (
        <div className="space-y-6 pb-8">
            <div className="flex items-start space-x-4 rtl:space-x-reverse">
                <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full flex-shrink-0"><AgentIcon agent={Agent.User} className="w-5 h-5" /></div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 w-full"><p className="font-semibold">{t('yourRequest')}</p><p className="text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{conversation.prompt}</p></div>
            </div>

            {conversation.status === 'clarification_needed' && conversation.clarification && 
                <ClarificationComponent 
                    clarification={conversation.clarification} 
                    onClarify={(key, value) => onClarify(conversation.id, key, value)}
                    isLoading={isLoading}
                    t={t}
                />}

            {conversation.status === 'planning' && conversation.plan && <PlanPreview plan={conversation.plan} onExecute={() => onExecute(conversation.id)} isLoading={isLoading} t={t} />}

            {agentSteps.map(res => <StepCard key={res.step} result={res} isExpanded={res.status === 'running' || expandedSteps.has(res.step)} onToggle={() => handleToggleStep(res.step)} t={t} />)}
            
            {orchestratorStep && (orchestratorStep.status !== 'pending') && (
                 <div className="flex items-start space-x-4 rtl:space-x-reverse">
                    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full flex-shrink-0"><AgentIcon agent={Agent.Orchestrator} className="w-5 h-5" /></div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 w-full border border-black/20 dark:border-white/20">
                         <p className="font-semibold">{t('finalAnswer')}</p>
                         <div className="mt-2"><StreamingMarkdownRenderer content={orchestratorStep.result || '...'} /></div>
                         {uniqueSources.length > 0 && (
                             <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('sources')}:</p><div className="flex flex-wrap gap-2">{uniqueSources.map((source, i) => (<a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md truncate">{source.title}</a>))}</div></div>
                         )}
                    </div>
                </div>
            )}
            {conversation.generatedFile && <SheetPreview file={conversation.generatedFile} t={t} />}
        </div>
    );
};

const App: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'dark');
    const [lang, setLang] = useState<Lang>('en');
    const [prompt, setPrompt] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>(() => {
        try {
            const savedConvos = localStorage.getItem('ahrian_conversations');
            if (savedConvos) {
                const parsedConvos: Conversation[] = JSON.parse(savedConvos);
                return parsedConvos.map(c => ({ ...c, imageFile: null, videoFile: null }));
            }
        } catch (error) { console.error("Failed to load conversations:", error); }
        return [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { location } = useLocation();

    const t = useMemo(() => (key: keyof Localization, ...args: (string | number)[]) => {
        let translation = translations[lang][key] || translations['en'][key];
        if (args.length) { translation = translation.replace(/\{0\}/g, String(args[0])); }
        return translation;
    }, [lang]);

    useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    useEffect(() => {
        try {
            const conversationsToSave = conversations.map(({ imageFile, videoFile, ...rest }) => rest);
            localStorage.setItem('ahrian_conversations', JSON.stringify(conversationsToSave));
        } catch (e) { console.error("Failed to save conversations:", e); }
    }, [conversations]);
    
    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
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
        const currentPrompt = prompt;
        const currentHistory = conversations;
        
        setIsLoading(true);
        setError(null);
        setPrompt('');
        
        try {
            const planResponse = await generatePlan(currentPrompt, false, false, currentHistory);
            const convoId = Date.now().toString();
            const newConversation: Conversation = {
                id: convoId,
                prompt: currentPrompt,
                imageFile: null, videoFile: null,
                plan: planResponse.plan || null,
                results: [],
                status: planResponse.clarification ? 'clarification_needed' : 'planning',
                clarification: planResponse.clarification || null,
            };
            setConversations(prev => [...prev, newConversation]);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('unknownError'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClarification = async (convoId: string, optionKey: string, optionValue: string) => {
        const conversation = conversations.find(c => c.id === convoId);
        if (!conversation) return;

        setIsLoading(true);
        setError(null);
        setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'planning', clarification: null } : c));

        try {
            const augmentedPrompt = `${conversation.prompt}\n\n(User clarification: The user chose "${optionValue}", indicating they want the data formatted for a '${optionKey}'.)`;
            const planResponse = await generatePlan(augmentedPrompt, false, false, conversations);

            if (planResponse.plan) {
                 setConversations(prev => prev.map(c => c.id === convoId ? { ...c, plan: planResponse.plan } : c));
            } else {
                 throw new Error("AI failed to provide a plan after clarification.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('unknownError'));
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'error' } : c));
        } finally {
             setIsLoading(false);
        }
    };
    
    const handleExecute = async (convoId: string) => {
        const conversation = conversations.find(c => c.id === convoId);
        if (!conversation || !conversation.plan) return;
        
        let generatedSheetFile: StoredFile | null = null;
        try {
            setIsLoading(true);
            setError(null);
            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'executing', results: c.plan!.map(step => ({ ...step, result: '', status: 'pending' })) } : c));
            
            let stepOutputs: { agent: Agent; task: string; result: string; }[] = [];
            for (const step of conversation.plan) {
                if (step.agent === Agent.Orchestrator) continue;
                updateStepResult(convoId, step.step, { status: 'running' });
                let fullStepResult = '';
                try {
                    const onChunk = (chunk: string) => { updateStepResult(convoId, step.step, {}, chunk); fullStepResult += chunk; };
                    let executionResult: any = {};
                    switch (step.agent) {
                        case Agent.SearchAgent: executionResult = await executeSearch(step.task, onChunk); break;
                        case Agent.MapsAgent: executionResult = await executeMap(step.task, location, onChunk); break;
                        case Agent.SheetsAgent: {
                            const previousResult = stepOutputs.length > 0 ? stepOutputs[stepOutputs.length - 1].result : '';
                            if (!previousResult) throw new Error("SheetsAgent was called without any data from a previous step to process.");
                            executionResult = await executeSheets(step.task, previousResult, onChunk);
                            break;
                        }
                        case Agent.VisionAgent: onChunk("Vision processing simulated."); executionResult={}; break;
                        case Agent.VideoAgent: onChunk("Video processing simulated."); executionResult={}; break;
                        case Agent.EmailAgent: executionResult = await executeEmail(step.task, onChunk); break;
                        case Agent.DriveAgent: executionResult = await executeDrive(step.task, onChunk); break;
                    }
                    const finalUpdates: Partial<StepResult> = { status: 'completed', sources: executionResult.sources };
                    if (step.agent === Agent.SheetsAgent && executionResult.sheetData) {
                        const fileId = `file-${Date.now()}`;
                        generatedSheetFile = { id: fileId, name: `${step.task.substring(0, 30)}...`, data: executionResult.sheetData, createdAt: new Date().toISOString() };
                    }
                    finalUpdates.result = fullStepResult;
                    updateStepResult(convoId, step.step, finalUpdates);
                    stepOutputs.push({ ...step, result: fullStepResult });

                } catch (e: any) {
                    updateStepResult(convoId, step.step, { status: 'error', result: e.message });
                    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'error' } : c));
                    throw e;
                }
            }
            const orchestratorStep = conversation.plan.find(s => s.agent === Agent.Orchestrator);
            if (orchestratorStep) {
                updateStepResult(convoId, orchestratorStep.step, { status: 'running' });
                await synthesizeAnswer(conversation.prompt, stepOutputs, (chunk) => updateStepResult(convoId, orchestratorStep.step, {}, chunk));
                updateStepResult(convoId, orchestratorStep.step, { status: 'completed' });
            }

            setConversations(prev => prev.map(c => c.id === convoId ? { ...c, status: 'completed', generatedFile: generatedSheetFile } : c));
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('unknownError'));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col p-2 sm:p-4 lg:p-6 bg-white dark:bg-black text-black dark:text-white transition-colors duration-300">
            <header className="flex items-center justify-between mb-4 px-2">
                 <h1 className="text-2xl md:text-3xl font-bold">{t('appTitle')}</h1>
                <div className='flex items-center space-x-1 sm:space-x-2 rtl:space-x-reverse'>
                    <button onClick={toggleLang} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 font-semibold text-sm">{lang === 'en' ? 'AR' : 'EN'}</button>
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300">{theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}</button>
                </div>
            </header>

            <main className="flex-grow w-full max-w-4xl mx-auto overflow-y-auto px-1" style={{'scrollPaddingBottom': '120px'}}>
                {conversations.length === 0 && (
                    <div className="text-center mt-8">
                        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">{t('appDescription')}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 mt-8">
                           {Object.values(Agent).filter(a => a !== Agent.Orchestrator && a !== Agent.User).map(agent => <AgentCard key={agent} agent={agent} description={t(`agentDesc${agent}` as keyof Localization)} />)}
                        </div>
                    </div>
                )}
                {conversations.map(convo => <ConversationView key={convo.id} conversation={convo} onExecute={handleExecute} onClarify={handleClarification} isLoading={isLoading} t={t} />)}
                <div ref={chatEndRef} />
            </main>
            
            {error && <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black text-sm px-4 py-2 rounded-md z-10" onClick={() => setError(null)}>{error}</div>}

            <footer className="sticky bottom-0 left-0 right-0 w-full bg-white/80 dark:bg-black/80 backdrop-blur-sm pt-2 sm:pt-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2 flex items-end space-x-2 rtl:space-x-reverse">
                         <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan(); } }} placeholder={t('promptPlaceholder')} className="flex-grow bg-transparent focus:outline-none resize-none text-sm p-2 max-h-32 w-full" rows={1} disabled={isLoading} />
                        <button onClick={handlePlan} disabled={isLoading || !prompt.trim()} className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-semibold px-4 py-2 rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div> : t('orchestrate')}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default App;