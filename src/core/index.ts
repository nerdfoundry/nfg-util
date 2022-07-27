export const definedProps = <T>(obj: object): T =>
  Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== undefined)) as T;
