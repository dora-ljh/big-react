import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

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

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}
		// 遍历传入的 currentFirstChild 以及所有的兄弟节点，都标记删除
		let childToDelete = currentFirstChild;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	// 把div等创建 react Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		while (currentFiber !== null) {
			// update
			// key 相同
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						let props = element.props;

						/*
            Fragment 情况2
            针对
              编译前：
                <App>
                	<>
										<div></div>
										<div></div>
									</>
                </App>
              编译后：
                <div></div>
                <div></div>
            * */
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children;
						}

						// type 相同，说明可以复用
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// 当前节点可复用，标记剩下的节点删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// key 相同，type不同，不存在任何复用可能性
					// 删掉所有旧的
					deleteRemainingChildren(returnFiber, currentFiber);
					break;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break;
					}
				}
			} else {
				// key 不同,删除旧的,继续遍历其他的兄弟节点
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
				// break work;
			}
		}

		// 都不能复用，就创建新的

		// 根据 element 创建一个fiber
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		fiber.return = returnFiber;
		return fiber;
	}

	// 创建 文本节点的fiberNode
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用，删除其他兄弟节点
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			/*
			 走到这里是说，比如说，
			 之前是<div /> 是 HostComponent
			 现在是 big-react 是 HostText
			那就需要把当前 currentFiber 删掉，然后走创建流程
			* */
			// 类型变了，不能复用，标记删除，继续遍历兄弟节点
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}

		// 都不能复用，就创建新的

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

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null, // 对应的是更新前，单项兄弟节点链表
		newChild: any[] // 对应的是个数组，数组中的每一项是ReactElement
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 指向最后一个兄弟节点
		let lastNewFiber: FiberNode | null = null;
		// 指向第一个兄弟节点
		let firstNewFiber: FiberNode | null = null;

		// 1. 将current 保存在map中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		for (let i = 0; i < newChild.length; i++) {
			// 2. 遍历newChild,寻找是否可复用
			const after = newChild[i];
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
			// 更新之后的值，为false或者null，会进入这个
			if (newFiber === null) {
				continue;
			}

			// 3. 标记移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;
			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				// lastNewFiber 指向最后一个兄弟节点
				lastNewFiber = lastNewFiber.sibling;
			}
			if (!shouldTrackEffects) {
				continue;
			}
			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				/*
				移动是指 向右移动
				判断是否移动的依据就是，就是判断索引，
				A1 B2 C3->B2 C3 A1
				0  1  2 ->0  1  2
				currentFiber->newFiber
				第一次遍历是B2，知道B2可复用，记录一下B2的lastPlacedIndex 为1
				第二次遍历是C3，知道C3可复用，在更新之前C3的index为2，就用2和之前保存的 lastPlacedIndex 比较
				如果 index < lastPlacedIndex 的话，就说明要移动， 2 > 1 所以不需要移动
				就说明在更新之前C3的索引大于B2，在更新之后C3的索引还是大于B2，说明C3的位置相对B2就没有变
				此时 lastPlacedIndex 赋值为C3也就是2
				第二次遍历是A1，知道A1可复用，0 < 2
				也就是说A1在更新之前是在C3的左边，更新之后跑到C3的右边了
				就要标记给A1标记 Placement
				* */
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount
				newFiber.flags |= Placement;
			}
		}

		// 4. 将Map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});
		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);

		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before.tag === HostText) {
					// 可复用
					existingChildren.delete(keyToUse);
					return useFiber(before, { content: element + '' });
				}
			}
			return new FiberNode(HostText, { content: element + '' }, null);
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							// key相同，type相同，说明可以复用
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					return createFiberFromElement(element);
			}
			/*
				Fragment 情况3
				arr = [<li>c</li>, <li>d</li>]
				<ul>
					<li>a</li>
					<li>b</li>
					{arr}
				</ul>
				jsx 数组里边为数组的情况
			* */
			if (Array.isArray(element)) {
				return updateFragment(
					returnFiber,
					before,
					element,
					keyToUse,
					existingChildren
				);
			}
		}
		return null;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) {
		// 判断当前fiber的类型

		// Fragment
		/*
		Fragment 情况1
		针对
			编译前：
				<>
					<div></div>
					<div></div>
				</>
			编译后：
				<div></div>
				<div></div>
		* */
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		if (isUnkeyedTopLevelFragment) {
			// 这个时候newChild 可能就为一个数组类型
			newChild = newChild.props.children;
		}

		// ReactElement
		if (typeof newChild === 'object' && newChild !== null) {
			// 多节点的情况 ul> li * 3
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}

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

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		// 兜底就删除
		if (currentFiber !== null) {
			deleteRemainingChildren(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('未实现的reconcile 类型', newChild, currentFiber);
		}
		return null;
	};
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key);
	} else {
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber.return = returnFiber;
	return fiber;
}

export const reconcileChildFibers = ChildReconciler(true);
// mount 阶段不打标记追踪副作用
export const mountChildFibers = ChildReconciler(false);
