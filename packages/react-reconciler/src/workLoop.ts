import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags } from './fiberFlags';
import { commitMutationEffects } from './commitWork';
import {
	getHighestPriorityLane,
	Lane,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';

let workInProgress: FiberNode | null = null;

// 准备一个新的工作进度
function prepareFreshStack(root: FiberRootNode) {
	// 这个 root.current 就是 hostRootFiber 也就是 fiber的根节点

	// 创建一个新的工作进度节点，这个节点是当前Fiber节点（current）的替代节点，表示在下一次更新中应该呈现的状态
	workInProgress = createWorkInProgress(root.current, {});
}

// 在fiber中调度update
// 这个函数的作用是开始对某个Fiber节点进行调度更新
// 每次更新都会调用
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// fiberRootNode
	// 首先找到根管理节点
	const root = markUpdateFromFiberToRoot(fiber);

	markRootUpdated(root, lane);

	// 这里开始调度更新
	ensureRootIsScheduled(root);
}

// 调度阶段的入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级：', updateLane);
		}
		/*
		 多个更新会在这里产生一个数组,数组的每一项就是一个回调函数
		 [performSyncWorkOnRoot,performSyncWorkOnRoot,performSyncWorkOnRoot]
		* */
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		// 这里虽然调用了三次，但是有 isFlushingSyncQueue 变量控制，所以里边的调度数组(syncQueue) 只会遍历调用一次
		// 并且微任务会在所有同步执行完成才会调用这三次
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// TODO 其他优先级会用宏任务调度
	}
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
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

/**
 * 开始从根管理节点渲染
 * */
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLanes = getHighestPriorityLane(root.pendingLanes);
	if (nextLanes !== SyncLane) {
		// 其他比 SyncLane 低的优先级
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}
	// 初始化 创建 workInProgress
	prepareFreshStack(root);
	do {
		try {
			// 处理每个fiber，打标记
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

/**
 * @param  root 管理的根节点
 * */
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
