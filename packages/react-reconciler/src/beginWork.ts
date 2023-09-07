// 递归中的递阶段
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

// 根据当前fiber，创建 子fiber，并返回
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			// 根节点处理 会返回 传入的 reactElement 如 <App/>
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			// 普通的DOM节点 处理，传入的是 div 等，返回 div的子fiber节点
			return updateHostComponent(wip);
		case HostText:
			// 文本节点 处理
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork 未实现的类型');
			}
			break;
	}
	return null;
};

function updateFragment(wip: FiberNode) {
	// 对于 Fragment
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	/*
		function App(){
			return <img/>
		}
		App()
		对于 FunctionComponent 想拿到他的child，就直接调用这个 FunctionComponent 即可

	* */
	const nextChildren = renderWithHooks(wip, renderLane);

	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// 处理 根 Fiber节点 ，返回根节点下的子fiber
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// 取出 待更新
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 处理待更新 根节点中的待更新也就是 传入的reactElement
	// HostRoot 中的 pendingUpdate 不是function类型，所以直接走update 2
	// 返回的 memoizedState 就是 reactElement
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;
	const nextChildren = wip.memoizedState;
	// 也就是根节点fiber 的 child 就会被设置为 根据 reactElement 创建的 fiber
	reconcileChildren(wip, nextChildren);
	// 返回子 FiberNode
	return wip.child;
}

// 处理普通的DOM节点，创建并返回这个dom节点的子 fiber
function updateHostComponent(wip: FiberNode) {
	// span 元素就在 div 的 children 中
	// <div><span/></div>
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// 创建并返回Fiber节点的子节点
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;
	// 如果有替代节点，表示这是一个更新操作
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// 没有替代节点，表示这是一个初次挂载操作
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
