// Filtro básico de prompts: bloquea referencias a menores. No sustituye a la moderación del proveedor de IA.
const BLOCKED = /\b(menor(es)?|nin[oa]s?|ninez|infantil(es)?|infancia|lolit[ao]s?|loli|shota|adolescentes?|colegial(es|a|as)?|preadolescente|teen(s|ager|agers)?|child(ren)?|kids?|minors?|underage|preteen|toddler|schoolgirl|schoolboy|jailbait)\b/;
const AGE = /\b(\d{1,2})\s*(anos|years?[- ]?old|y\.?o\.?)\b/g;

export function isPromptAllowed(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (BLOCKED.test(t)) return false;
  for (const m of t.matchAll(AGE)) if (Number(m[1]) < 18) return false;
  return true;
}
