/* Language plumbing. Transcribes the original's `applyI18n` (prototype lines 545-554).
 *
 * The original walked the DOM and assigned `el.innerHTML = T(key)`. We render translated
 * strings as ordinary React children instead: no value in src/i18n/dictionary.mjs contains
 * markup (verified - zero tag matches across all four languages), so innerHTML bought the
 * original nothing and dangerouslySetInnerHTML here would buy an injection surface for a
 * first-pass translation file that still needs native review. Do not reintroduce it.
 *
 * `document.documentElement.lang` is set from the active language exactly as applyI18n did
 * (prototype line 549): screen readers and hyphenation depend on it, and it is the one piece
 * of applyI18n that React's rendering does not replace. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, T } from '../i18n/dictionary.mjs';
import { readStoredEnum, writeStored } from './persist';

export type Lang = 'en' | 'ha' | 'ig' | 'yo';

/** localStorage key and default, ruling 6. */
export const LANG_KEY = 'suhi.lang';
export const DEFAULT_LANG: Lang = 'en';

const ALLOWED_LANGS = LANGS as readonly Lang[];

export interface LangApi {
  lang: Lang;
  setLang: (next: Lang) => void;
}

const LangContext = createContext<LangApi | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredEnum(LANG_KEY, ALLOWED_LANGS, DEFAULT_LANG));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (dirty) writeStored(LANG_KEY, lang);
  }, [dirty, lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState((prev) => (prev === next ? prev : next));
    setDirty(true);
  }, []);

  const api = useMemo<LangApi>(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={api}>{children}</LangContext.Provider>;
}

export function useLang(): LangApi {
  const api = useContext(LangContext);
  if (!api) throw new Error('useLang must be used inside <I18nProvider>');
  return api;
}

/** `T` bound to the active language. Unknown key -> the key itself; missing entry -> English. */
export function useT(): (key: string) => string {
  const { lang } = useLang();
  return useCallback((key: string) => T(key, lang), [lang]);
}
