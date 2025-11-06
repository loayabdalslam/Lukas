export type Lang = 'en' | 'ar';

export interface Localization {
    appTitle: string;
    appDescription: string;
    promptPlaceholder: string;
    orchestrate: string;
    statusPending: string;
    statusRunning: string;
    statusCompleted: string;
    statusError: string;
    unknownError: string;
    computerTitle: string;
    computerStatusInactive: string;
    computerStatusWaiting: string;
    taskProgress: string;
    errorMessage: string;
}

export const translations: Record<Lang, Localization> = {
    en: {
        appTitle: "Ahrian: AI Orchestrator",
        appDescription: "An advanced AI that decomposes complex tasks and delegates them to a team of specialized AI agents.",
        promptPlaceholder: "Send message to Ahrian...",
        orchestrate: "Send",
        statusPending: "Pending",
        statusRunning: "Running",
        statusCompleted: "Completed",
        statusError: "Error",
        unknownError: "An unknown error occurred.",
        computerTitle: "Ahrian's Computer",
        computerStatusInactive: "Ahrian's computer is inactive",
        computerStatusWaiting: "Waiting for instructions",
        taskProgress: "Task progress",
        errorMessage: "I encountered an error"
    },
    ar: {
        appTitle: "أهريان: المنسق الذكي",
        appDescription: "ذكاء اصطناعي متقدم يفكك المهام المعقدة ويفوضها إلى فريق من وكلاء الذكاء الاصطناعي المتخصصين.",
        promptPlaceholder: "أرسل رسالة إلى أهريان...",
        orchestrate: "إرسال",
        statusPending: "قيد الانتظار",
        statusRunning: "قيد التشغيل",
        statusCompleted: "مكتمل",
        statusError: "خطأ",
        unknownError: "حدث خطأ غير معروف.",
        computerTitle: "حاسوب أهريان",
        computerStatusInactive: "حاسوب أهريان غير نشط",
        computerStatusWaiting: "في انتظار التعليمات",
        taskProgress: "تقدم المهمة",
        errorMessage: "واجهتني مشكلة"
    }
};