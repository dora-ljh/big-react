import { Dispatch } from 'react/src/currentDispatcher';
import { Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';

// 当前处理的fiber
// 这个参数只会在函数组件内部使用，
let currentlyRenderingFiber: FiberNode | null = null;
// 当前处理的hook
let workInProgressHook: Hook | null = null;

let currentHook: Hook | null = null;

let renderLane: Lane = NoLane;

// 只有在函数组件内部，才会写入  currentDispatcher
const { currentDispatcher } = internals;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

/**
 * 用于在函数组件中使用 Hooks 的渲染流程
 * */
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// render 之前，赋值操作
	// 为了在函数组件内部使用 Hooks 时能够获取到当前组件的 Fiber 节点
	// 并且只会在函数自建内部才会记录
	currentlyRenderingFiber = wip;
	// 接下来要把这个参数赋值为链表，所以先重置一下
	wip.memoizedState = null;
	renderLane = lane;

	// 这个current 拿到的就是 上次渲染的fiber，wip就是本次的fiber，如果是mount的话就是 null
	const current = wip.alternate;
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		// mount 阶段写入mount 的hooks
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	// FC render
	// 在这个里边调用的  useState 即可保证 currentDispatcher 不为空
	// 如果是update，这里获取的是wip的props，是新传入的props
	const children = Component(props);

	// 重置操作
	// 当前函数组件内部处理完成之后，把记录的当前fiber清除
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

/**
 * useState Hook 在组件更新时的处理函数
 * updateState 是不需要传入参数的，参数是dispatch 传入的参数
 * */
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook();

	// 计算新state的逻辑
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	if (pending !== null) {
		// 这里就是调用处理调用的state值
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		);
		// 新的hook 的 memoizedState 就为处理好的值
		hook.memoizedState = memoizedState;
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

/**
 * 获取当前 Hook 并为其设置更新队列和状态链表
 * */
function updateWorkInProgressHook(): Hook {
	// TODO render阶段触发的更新
	let nextCurrentHook: Hook | null;
	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		// 这个current 是拿到渲染前的fiber
		// currentlyRenderingFiber就是当前新的fiber
		// 初始化的时候把currentlyRenderingFiber的memoizedState 设置为了null
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			// 所以这里那的memoizedState就是hooks链表的第一个hook
			nextCurrentHook = current?.memoizedState;
		} else {
			// mount 进入这里不是mount，所以这里也是异常情况
			nextCurrentHook = null;
		}
	} else {
		// 这个 FC update 时，后续的hook
		nextCurrentHook = currentHook.next;
	}

	// 渲染前的hook都已经完了，旧的hook还进来这个函数，只能说明比上次多了
	if (nextCurrentHook === null) {
		// mount/update u1 u2 u3
		// update       u1 u2 u3 u4
		// 就会进入此报错
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		);
	}

	// 这里把全局的 currentHook 赋值一下，记录一下当前正在处理的hook
	// nextCurrentHook是用在函数内的
	currentHook = nextCurrentHook as Hook;
	const newHook: Hook = {
		// 这个memoizedState是hook中具体记录的值，如[num,setNum]=useState(100)中的num
		memoizedState: currentHook.memoizedState,
		//  setNum(3) 中的 3 就会在 updateQueue的padding中
		updateQueue: currentHook.updateQueue,
		next: null
	};
	if (workInProgressHook === null) {
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = newHook;
			// 新的fiber的memoizedState就等于第一个hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount时 后续的hook就用next链接起来
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}
	return workInProgressHook;
}

/**
 * 用于在函数组件初次渲染时，初始化状态，并为状态绑定更新操作的 dispatch
 * */
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

/**
 * 用于在状态更新时，将更新操作放入更新队列，并触发调度更新
 * */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	// 这个update 里的action 就是传入的 state 值
	const update = createUpdate(action, lane);
	// 将 update 放进 updateQueue 的pending 中
	enqueueUpdate(updateQueue, update);
	// 开始调度更新
	scheduleUpdateOnFiber(fiber, lane);
}

/**
 * 用于在 Hook 链表中添加新的 Hook，并返回当前添加的 Hook
 * */
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
