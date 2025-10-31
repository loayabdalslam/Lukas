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
    yourRequest: string;
    finalAnswer: string;
    sources: string;
    task: string;
    result: string;
    sheetPreviewTitle: string;
    showingFirst10Rows: string;
    showingAllXRows: string;
    downloadFullCSV: string;
    sheetGenerated: string;
    unknownError: string;
    ahriansPlan: string;
    executePlan: string;
    clarificationNeeded: string;
    agentDescSearchAgent: string;
    agentDescMapsAgent: string;
    agentDescVisionAgent: string;
    agentDescVideoAgent: string;
    agentDescEmailAgent: string;
    agentDescSheetsAgent: string;
    agentDescDriveAgent: string;
}

export const translations: Record<Lang, Localization> = {
    en: {
        appTitle: "Ahrian: The AI Orchestrator",
        appDescription: "Decomposing complex tasks for a team of specialized AI agents.",
        promptPlaceholder: "Ask Ahrian to orchestrate a task...",
        orchestrate: "Orchestrate",
        statusPending: "Pending",
        statusRunning: "Running",
        statusCompleted: "Completed",
        statusError: "Error",
        yourRequest: "Your Request",
        finalAnswer: "Final Answer",
        sources: "Sources",
        task: "Task",
        result: "Result",
        sheetPreviewTitle: "Sheet Preview",
        showingFirst10Rows: "Showing first 10 of {0} rows.",
        showingAllXRows: "Showing all {0} rows.",
        downloadFullCSV: "Download Full File",
        sheetGenerated: "Spreadsheet generated. Preview available below.",
        unknownError: "An unknown error occurred.",
        ahriansPlan: "Ahrian's Plan",
        executePlan: "Execute Plan",
        clarificationNeeded: "Clarification Needed",
        agentDescSearchAgent: "Web searches.",
        agentDescMapsAgent: "Location queries.",
        agentDescVisionAgent: "Image analysis.",
        agentDescVideoAgent: "Video analysis.",
        agentDescEmailAgent: "Send emails.",
        agentDescSheetsAgent: "Manage sheets.",
        agentDescDriveAgent: "Access drive.",
    },
    ar: {
        appTitle: "أهريان: المنسق الذكي",
        appDescription: "تفكيك المهام المعقدة لفريق من وكلاء الذكاء الاصطناعي المتخصصين.",
        promptPlaceholder: "اطلب من أهريان تنسيق مهمة...",
        orchestrate: "نسّق",
        statusPending: "قيد الانتظار",
        statusRunning: "قيد التشغيل",
        statusCompleted: "مكتمل",
        statusError: "خطأ",
        yourRequest: "طلبك",
        finalAnswer: "الإجابة النهائية",
        sources: "المصادر",
        task: "المهمة",
        result: "النتيجة",
        sheetPreviewTitle: "معاينة الجدول",
        showingFirst10Rows: "عرض أول 10 صفوف من أصل {0}.",
        showingAllXRows: "عرض كل الصفوف وعددها {0}.",
        downloadFullCSV: "تحميل الملف الكامل",
        sheetGenerated: "تم إنشاء جدول البيانات. المعاينة متاحة أدناه.",
        unknownError: "حدث خطأ غير معروف.",
        ahriansPlan: "خطة أهريان",
        executePlan: "نفذ الخطة",
        clarificationNeeded: "مطلوب توضيح",
        agentDescSearchAgent: "بحث الويب.",
        agentDescMapsAgent: "استعلامات الموقع.",
        agentDescVisionAgent: "تحليل الصور.",
        agentDescVideoAgent: "تحليل الفيديو.",
        agentDescEmailAgent: "إرسال بريد.",
        agentDescSheetsAgent: "إدارة الجداول.",
        agentDescDriveAgent: "الوصول للملفات.",
    }
};