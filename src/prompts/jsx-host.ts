import { createElement } from './react-host';
export const Fragment = Symbol.for('react.fragment');
export const jsx = (type: any, props: any, key?: string) => createElement(type, key === undefined ? props : { ...props, key });
export const jsxs = jsx;
