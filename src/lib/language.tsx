import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Multilingual support (contract §15).
 * - `LanguageProvider` stores the chosen language in localStorage (`ya1t_lang`).
 * - The language is sent to the AI edge functions (`ask-ai`, `study-tools`,
 *   `session-summary`) so DeepSeek answers in that language.
 * - For the static UI, the Google Translate Website widget is lazy-loaded ONLY
 *   when a non-English language is picked, and driven programmatically.
 *   NOTE: Google's widget may not offer Setswana (tn) / Sepedi (nso); when the
 *   widget lacks the language this degrades gracefully (UI stays English) and
 *   the AI-language path still covers the learner.
 */

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'tn', name: 'Setswana', native: 'Setswana' },
  { code: 'nso', name: 'Sepedi', native: 'Sepedi' },
  { code: 'zu', name: 'isiZulu', native: 'isiZulu' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'ya1t_lang';
/** Languages the Google Translate widget is asked to provide. */
const WIDGET_LANGUAGES = 'af,tn,nso,zu,en';
const WIDGET_SCRIPT_ID = 'ya1t-google-translate';
const WIDGET_HOST_ID = 'google_translate_element';

export interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguageCode(value: string | null): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}

function readStoredLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(stored)) return stored;
  } catch {
    /* localStorage unavailable — fall back to default */
  }
  return 'en';
}

/* ---------------- Google Translate widget plumbing ---------------- */

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          elementId: string,
        ) => unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

let widgetRequested = false;
let widgetReady = false;

/** Drive the widget's hidden combo box to the target language (no page reload). */
function applyWidgetLanguage(lang: LanguageCode, attempt = 0): void {
  const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!combo) {
    // Widget script may still be initialising; retry briefly, then give up quietly.
    if (attempt < 20) {
      window.setTimeout(() => applyWidgetLanguage(lang, attempt + 1), 300);
    }
    return;
  }
  // If the widget does not support the language (e.g. tn/nso), leave the UI in
  // English — the AI responses still arrive in the chosen language (§15).
  const supported = Array.from(combo.options).some((o) => o.value === lang);
  if (!supported && lang !== 'en') return;
  if (combo.value !== lang) {
    combo.value = lang;
    combo.dispatchEvent(new Event('change'));
  }
}

/** Lazy-load translate.google.com/translate_a/element.js exactly once. */
function ensureWidgetLoaded(): void {
  if (widgetRequested) return;
  widgetRequested = true;

  window.googleTranslateElementInit = () => {
    try {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: WIDGET_LANGUAGES,
            autoDisplay: false,
          },
          WIDGET_HOST_ID,
        );
        widgetReady = true;
        applyWidgetLanguage(readStoredLanguage());
      }
    } catch {
      /* widget init failed — degrade to English UI */
    }
  };

  const script = document.createElement('script');
  script.id = WIDGET_SCRIPT_ID;
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  script.onerror = () => {
    /* offline / blocked — static UI simply stays in English */
  };
  document.head.appendChild(script);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(readStoredLanguage);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* persistence is best-effort */
    }
  }, []);

  // Load + steer the Google Translate widget when a non-English UI language
  // is chosen; switch back to English without a reload when it is cleared.
  useEffect(() => {
    if (lang === 'en') {
      if (widgetReady) applyWidgetLanguage('en');
      return;
    }
    ensureWidgetLoaded();
    if (widgetReady) applyWidgetLanguage(lang);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, languages: LANGUAGES }),
    [lang, setLang],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {/* Visually hidden host for the Google Translate widget (contract §15). */}
      <div id={WIDGET_HOST_ID} className="notranslate" translate="no" aria-hidden="true" />
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
