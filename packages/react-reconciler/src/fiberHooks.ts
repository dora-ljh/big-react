import { Dispatch } from 'react/src/currentDispatcher';
import { Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

const { currentDispatcher } = internals;

// 当前处理的fiber
// 这个参数只会在函数组件内部使用，
let currentlyRenderingFiber: FiberNode | null = null;
// 当前处理的hook
let workInProgressHook: Hook | null = null;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
	// render 之前，赋值操作
	// 在函数组件内部调用的时候，记录当前fiber，
	currentlyRenderingFiber = wip;
	// 接下来要把这个参数赋值为链表，所以先重置一下
	wip.memoizedState = null;

	const current = wip.alternate;
	if (current !== null) {
		// update
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	// 当前函数组件内部处理完成之后，把记录的当前fiber清除
	currentlyRenderingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

// useState Hook 在组件初次挂载时的处理函数
function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgressHook();
	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;

	// 防止在全局或者在其他地方调用 dispatch 时，拿不到 currentlyRenderingFiber，故预制参数
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

// 用于在状态更新时将更新操作放入更新队列，并触发调度更新
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}

// 根据条件将新的 Hook 添加到链表中，并且返回当前 hook
function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};
	if (workInProgressHook === null) {
		// mount时 第一个hook

		/*
		不在函数组件外时拿不到当前 currentlyRenderingFiber
		之所以在函数组件外时拿不到 currentlyRenderingFiber，是因为数据仅仅在函数组件内部调用时才会记录
		在函数组件外部调用时并没有 currentlyRenderingFiber 参数值，具体的赋值在 renderWithHooks 中
		但是这个目前只处理了在首个链表hook调用的限制
		* */
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时 后续的hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}
