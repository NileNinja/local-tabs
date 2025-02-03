const translations = {
  en: {
    // Settings
    settings: 'Settings',
    language: 'Language',
    syncFolder: 'Sync Folder',
    enterFolderPath: 'Enter folder path',
    save: 'Save',
    folderSaved: 'Sync folder location saved successfully!',
    folderError: 'Failed to save folder location',
    folderRequired: 'Please enter a folder path',

    // Buttons
    syncGroups: 'Sync',
    import: 'Import',
    export: 'Export',

    // Sections
    currentWindows: 'Current Windows',
    savedGroups: 'Saved Groups',
    newTabGroup: 'New Tab Group',

    // Empty State
    noSavedGroups: 'No saved groups yet. Save a group of tabs to see them here.',

    // Actions
    saveGroup: 'Save Group',
    openGroup: 'Open Group',
    deleteGroup: 'Delete Group',
    openTab: 'Open tab',
    removeTab: 'Remove tab',

    // Notifications
    groupsExported: 'Groups exported successfully!',
    noGroupsToExport: 'No groups to export',
    groupsImported: (count) => `Successfully imported ${count} groups!`,
    exportError: (error) => `Failed to export groups: ${error}`,
    importError: (error) => `Error importing groups: ${error}`,
    updateError: (error) => `Failed to update group name: ${error}`,
    tabGroupError: (error) => `Failed to update tab group title: ${error}`,
    zipError: (error) => `Failed to process ZIP file: ${error}`,
    jsonError: (error) => `Invalid JSON format: ${error}`,
    invalidZip: 'Invalid ZIP file format: tab-groups.json not found'
  },
  ar: {
    // Settings
    settings: 'الإعدادات',
    language: 'اللغة',
    syncFolder: 'مجلد المزامنة',
    enterFolderPath: 'أدخل مسار المجلد',
    save: 'حفظ',
    folderSaved: 'تم حفظ موقع مجلد المزامنة بنجاح!',
    folderError: 'فشل حفظ موقع المجلد',
    folderRequired: 'الرجاء إدخال مسار المجلد',

    // Buttons
    syncGroups: 'مزامنة',
    import: 'استيراد',
    export: 'تصدير',

    // Sections
    currentWindows: 'النوافذ الحالية',
    savedGroups: 'المجموعات المحفوظة',
    newTabGroup: 'مجموعة تبويب جديدة',

    // Empty State
    noSavedGroups: 'لا توجد مجموعات محفوظة. احفظ مجموعة من علامات التبويب لتظهر هنا.',

    // Actions
    saveGroup: 'حفظ المجموعة',
    openGroup: 'فتح المجموعة',
    deleteGroup: 'حذف المجموعة',
    openTab: 'فتح التبويب',
    removeTab: 'إزالة التبويب',

    // Notifications
    groupsExported: 'تم تصدير المجموعات بنجاح!',
    noGroupsToExport: 'لا توجد مجموعات للتصدير',
    groupsImported: (count) => `تم استيراد ${count} مجموعات بنجاح!`,
    exportError: (error) => `فشل تصدير المجموعات: ${error}`,
    importError: (error) => `خطأ في استيراد المجموعات: ${error}`,
    updateError: (error) => `فشل تحديث اسم المجموعة: ${error}`,
    tabGroupError: (error) => `فشل تحديث عنوان مجموعة التبويب: ${error}`,
    zipError: (error) => `فشل معالجة ملف ZIP: ${error}`,
    jsonError: (error) => `تنسيق JSON غير صالح: ${error}`,
    invalidZip: 'تنسيق ملف ZIP غير صالح: لم يتم العثور على tab-groups.json'
  }
};

let currentLanguage = 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    return true;
  }
  return false;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(key, ...args) {
  const translation = translations[currentLanguage][key];
  if (typeof translation === 'function') {
    return translation(...args);
  }
  return translation || translations.en[key] || key;
}

// Export initialization function to be called from popup.js
export async function initializeLanguage() {
  try {
    // Get stored language preference
    const { language } = await chrome.storage.local.get('language');
    
    // Determine which language to use
    let selectedLang;
    if (language && translations[language]) {
      selectedLang = language;
    } else {
      // Try to use browser language, fallback to English
      selectedLang = navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
      // Save the initial language setting
      try {
        await chrome.storage.local.set({ language: selectedLang });
      } catch (storageError) {
        console.warn('Failed to save initial language setting:', storageError);
        // Continue execution even if storage fails
      }
    }

    // Set the language only once
    currentLanguage = selectedLang;
    const success = setLanguage(selectedLang);
    if (!success) {
      throw new Error(`Failed to set language: ${selectedLang}`);
    }

    return currentLanguage;
  } catch (error) {
    console.error('Error initializing language:', error);
    // Fallback to English on error, but only set if not already English
    if (currentLanguage !== 'en') {
      currentLanguage = 'en';
      setLanguage('en');
    }
    return 'en';
  }
}
