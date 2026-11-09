export function monthInputValue(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value) ? value.slice(0,7) : value;
}
