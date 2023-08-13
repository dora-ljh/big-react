import {
	createFiberFromElement,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { Props, ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

// 性能优化策略，mount时 Placement 则先建好DOM树执行一次渲染，update时Placement 每次都执行渲染
function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	// 把div等创建 react Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		work: if (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// type 相同，说明可以复用
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						return existing;
					}
					deleteChild(returnFiber, currentFiber);
					break work;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break work;
					}
				}
			} else {
				// 删除旧的
				deleteChild(returnFiber, currentFiber);
				// break work;
			}
		}
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
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				return existing;
			}
			/*
			 走到这里是说，比如说，
			 之前是<div /> 是 HostComponent
			 现在是 big-react 是 HostText
			那就需要把当前 currentFiber 删掉，然后走创建流程
			* */
			deleteChild(returnFiber, currentFiber);
		}

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

		// 兜底就删除
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('未实现的reconcile 类型', newChild);
		}
		return null;
	};

	function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
		const clone = createWorkInProgress(fiber, pendingProps);
		clone.index = 0;
		clone.sibling = null;
		return clone;
	}
}

export const reconcileChildFibers = ChildReconciler(true);
// mount 阶段不打标记追踪副作用
export const mountChildFibers = ChildReconciler(false);
