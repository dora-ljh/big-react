// 递归中的归阶段
import { FiberNode } from './fiber';

export const completeWork = (fiber: FiberNode): FiberNode => {
	console.log('completeWork', fiber);
	return fiber;
};
