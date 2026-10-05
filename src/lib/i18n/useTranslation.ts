"use client";

import { useCallback, useEffect } from "react";
import { type Language, dirForLanguage, translate } from "./index";

export function useTranslation(language: Language) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dirForLanguage(language);
  }, [language]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );

  return { t, dir: dirForLanguage(language) };
}
