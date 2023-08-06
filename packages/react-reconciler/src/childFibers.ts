import { createFiberFromElement, FiberNode } from './fiber';
import { ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

// 性能优化策略，mount时 Placement 则先建好DOM树执行一次渲染，update时Placement 每次都执行渲染
function ChildReconciler(shouldTrackEffects: boolean) {
	// 把div等创建 react Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据 element 创建一个fiber
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;
		return fiber;
	}

	// 创建 文本节点的fiberNode
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		// @ts-ignore
		currentFiber: FiberNode | null,
		content: string | number
	) {
		// 根据 element 创建一个fiber
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 插入单一的节点
	function placeSingleChild(fiber: FiberNode) {
		// 应该追踪有副作用，并且是首屏渲染的话，就标记副作用
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile 类型', newChild);
					}
					break;
			}
		}
		// TODO 多节点的情况 ul> li *

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (__DEV__) {
			console.warn('未实现的reconcile 类型', newChild);
		}
		return null;
	};
}

export const reconcileChildFibers = ChildReconciler(true);
// mount 阶段不打标记追踪副作用
export const mountChildFibers = ChildReconciler(false);
