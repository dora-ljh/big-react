export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText;

// 函数组件
export const FunctionComponent = 0;
// 根节点
export const HostRoot = 3;
// <div>
export const HostComponent = 5;
// <div>123</div>
export const HostText = 6;
