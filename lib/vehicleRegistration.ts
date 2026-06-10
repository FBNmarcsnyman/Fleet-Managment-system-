export const stripHistoricRegistration = (value?: string): string => {
  if (!value) return '';
  return value
    .toString()
    .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

export const normalizeRegistration = (value?: string): string => {
  const stripped = stripHistoricRegistration(value);
  return stripped.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const formatRegistration = (value?: string): string => {
  return stripHistoricRegistration(value).toUpperCase().trim();
};
