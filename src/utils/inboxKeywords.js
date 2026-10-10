// src/utils/inboxKeywords.js

export const normalizeKeyword = (keyword) => {
  if (typeof keyword === 'string') {
    return {
      id: keyword,
      pattern: keyword,
      match_type: 'literal',
      case_sensitive: false,
    };
  }

  return {
    id: keyword?.id ?? keyword?.pattern,
    pattern: String(keyword?.pattern ?? ''),
    match_type: keyword?.match_type === 'regex' ? 'regex' : 'literal',
    case_sensitive: Boolean(keyword?.case_sensitive),
  };
};

const buildRegex = (keyword, global = true) => {
  const normalized = normalizeKeyword(keyword);
  if (!normalized.pattern) return null;

  const flags = `${global ? 'g' : ''}${normalized.case_sensitive ? '' : 'i'}`;

  try {
    if (normalized.match_type === 'regex') {
      return new RegExp(normalized.pattern, flags);
    }

    const escaped = normalized.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, flags);
  } catch {
    return null;
  }
};

export const keywordMatches = (text, keyword) => {
  const regex = buildRegex(keyword, false);
  if (!regex) return false;
  return regex.test(String(text ?? ''));
};

export const countKeywordMatches = (text, keyword) => {
  const regex = buildRegex(keyword, true);
  if (!regex) return 0;

  const matches = String(text ?? '').match(regex);
  return matches ? matches.length : 0;
};

export const keywordMatchRanges = (text, keywords = []) => {
  const value = String(text ?? '');
  if (!value) return [];

  const ranges = [];

  for (const keyword of keywords) {
    const regex = buildRegex(keyword, true);
    if (!regex) continue;

    let match;

    while ((match = regex.exec(value)) !== null) {
      const matchedText = match[0] || '';

      if (!matchedText.length) {
        regex.lastIndex += 1;
        continue;
      }

      ranges.push({
        start: match.index,
        end: match.index + matchedText.length,
        keyword: normalizeKeyword(keyword),
      });
    }
  }

  return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
};

export const replacePatternMatches = (text, patterns = [], replacement = '') => {
  let result = String(text ?? '');

  for (const pattern of patterns) {
    const regex = buildRegex(pattern, true);
    if (!regex) continue;
    result = result.replace(regex, replacement);
  }

  return result;
};