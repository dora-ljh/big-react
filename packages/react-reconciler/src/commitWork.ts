import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';
import { Container, appendChildToContainer } from 'hostConfig';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 如果子fiber flags 包含 MutationMask 中指定的 flags
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			// 这个时候就应该继续向下遍历
			nextEffect = child;
		} else {
			// 向上遍历 DFS
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;
	// 如果flags 包含 Placement
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		// 这个操作就是将 Placement 从 flags 中过移除
		finishedWork.flags &= ~Placement;
	}
	// 如果flags 包含 Update

	// 如果flags 包含 ChildDelete
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	// parent DOM 得知道他的父节点
	const hostParent = getHostParent(finishedWork);

	// finishedWork ~~ DOM finishedWork对应的dom阶段
	// 再将找到的 DOM append 到 parent DOM 中
	appendPlacementNodeIntoContainer(finishedWork, hostParent);
};

function getHostParent(fiber: FiberNode): Container {
	let parent = fiber.return;
	// 找到父级节点中的 dom 元素
	while (parent) {
		const parentTag = parent.tag;
		// 只有 HostComponent HostRoot 才是dom元素
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到host parent');
	}
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// append 之前应该先确认下 finishedWork 是  HostComponent HostText 才可以 append
	// 因为对于需要append的tag类型不可能是HostRoot类型的，子 dom要是div 或者 直接是字符才可以append
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(finishedWork.stateNode, hostParent);
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
