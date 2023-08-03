import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags } from './fiberFlags';
import { commitMutationEffects } from './commitWork';

let workInProgress: FiberNode | null = null;

// 准备一个新的工作进度
function prepareFreshStack(root: FiberRootNode) {
	// 这个 root.current 就是 hostRootFiber 也就是 fiber的根节点

	// 创建一个新的工作进度节点，这个节点是当前Fiber节点（current）的替代节点，表示在下一次更新中应该呈现的状态
	workInProgress = createWorkInProgress(root.current, {});
}

// 在fiber中调度update
// 这个函数的作用是开始对某个Fiber节点进行调度更新
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// TODO 调度功能
	// fiberRootNode
	// 首先找到当前Fiber节点的root节点
	const root = markUpdateFromFiberToRoot(fiber);
	// 然后开始对root节点进行渲染
	renderRoot(root);
}

// 从当前fiber 找到 最顶端 root fiber
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		//  这个stateNode 就是 FiberRootNode
		return node.stateNode;
	}
	return null;
}

function renderRoot(root: FiberRootNode) {
	// 初始化
	prepareFreshStack(root);
	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop 发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);
	// 获取当前Fiber节点的替代节点（也就是“工作进度”节点）
	// 每个Fiber节点都有一个替代节点，它表示在下一次更新中应该呈现的状态
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// wip fiberNode 树，树中的 flags
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	// 重置
	root.finishedWork = null;

	// commit 阶段的三个子阶段

	// 判断 是否存在3个子阶段需要执行的操作
	// root flags root subtreeFlags
	// 判断 subtreeFlags 中是否包含 MutationMask 中指定的flags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;

	// 判断 flags 中是否包含 MutationMask 中指定的flags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	// 如果包含，则说明当前存在 mutation 阶段需要执行的操作
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation

		// mutation Placement
		commitMutationEffects(finishedWork);

		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}
}

// 工作循环
function workLoop() {
	// 如果还有未处理的工作（如待渲染的Fiber节点），则继续执行该工作
	while (workInProgress != null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;
	// 返回null，说明这个Fiber节点已经完成了它的工作，接下来就需要完成这个Fiber节点的收尾工作
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		// 返回了一个Fiber节点，说明当前的Fiber节点的工作还未完成，需要继续处理返回的Fiber节点
		workInProgress = next;
	}
}

// 用于完成一个Fiber节点的工作，包括它的子节点和兄弟节点
function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		// 完成当前Fiber节点的工作
		completeWork(node);
		const sibling = node.sibling;
		// 如果当前Fiber节点有兄弟节点
		if (sibling !== null) {
			// 则将workInProgress更新为兄弟节点并返回
			workInProgress = sibling;
			return;
		}
		// 如果没有兄弟节点，则回到父节点，然后重复这个过程
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
