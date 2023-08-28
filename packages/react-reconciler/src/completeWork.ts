// 递归中的归阶段
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { NoFlags, Update } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

export const completeWork = (wip: FiberNode) => {
	// 递归中的归
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			// 检查当前 Fiber 是否存在对应的 DOM 实例
			if (current !== null && wip.stateNode) {
				// update
				// 1. props 是否变化 {onClick:xxx} {onClick:yyy}
				// 2. 变了 Update flag
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// 如果不存在，就会创建一个新的 DOM 实例，并将其挂载到 DOM 树中

				// 1. 构建DOM
				const instance = createInstance(wip.type, newProps);
				// 2. 将DOM插入到DOM树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			// 检查当前 Fiber 是否存在对应的 DOM 实例
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps?.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// 如果不存在，就会创建一个新的 DOM 实例，并将其挂载到 DOM 树中

				// 1. 构建DOM
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的 completeWork 情况', wip);
			}
			break;
	}
};
/*
	function A(){
		return <div></div>
	}
	<h3><A/><A/></h3>
	对于这样的数据，h3 中应该插入的 是 div，而不是A
* */
// parent 节点，插入  wip节点
// 将 Fiber 节点的所有子节点添加到其父节点中。它会遍历所有的子节点
// 深度优先搜索的算法来遍历所有的子节点和兄弟节点
function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		// 如果当前node已经到当前处理的节点时，终止
		if (node === wip) {
			return;
		}
		// 遍历兄弟节点
		while (node.sibling === null) {
			// 如果当前节点已经没有父节点，或者父节点为当前处理的节点时，终止遍历兄弟节点
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node?.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 合并所有子节点的 flags 和 subtreeFlags
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;
		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}
