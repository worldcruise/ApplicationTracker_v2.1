let host: any;
export function setReact(value: any) { host = value; }
export function createElement(...args: any[]) { return host.createElement(...args); }
export const useState = (...args: any[]) => host.useState(...args);
export const useEffect = (...args: any[]) => host.useEffect(...args);
export const useRef = (...args: any[]) => host.useRef(...args);
export const useLayoutEffect = (...args: any[]) => host.useLayoutEffect(...args);
