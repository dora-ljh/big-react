// 递归中的递阶段
import { FiberNode } from './fiber';

export const beginWork = (fiber: FiberNode): FiberNode => {
	// 比较，返回子fiberNode
	console.log('beginWork', fiber);
	return fiber;
};
