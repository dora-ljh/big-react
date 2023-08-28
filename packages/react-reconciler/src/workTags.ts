/**
 * 这里边定义的都是FiberNode下的tag属性
 * FiberNode.tag
 * */

export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment;

// 函数组件
export const FunctionComponent = 0;
// 根节点
export const HostRoot = 3;
// <div>
export const HostComponent = 5;
// <div>123</div> 中的 123
export const HostText = 6;

export const Fragment = 7;
