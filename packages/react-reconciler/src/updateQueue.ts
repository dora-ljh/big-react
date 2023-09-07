import { Action } from 'shared/ReactTypes';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane } from './fiberLanes';
export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

// 创建更新
export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

// 创建更新队列
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// 把 更新 放入 更新队列  update -> updateQueue
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		/*
		 a -> a
		 ^    |
		 |		|
		 	----
		**/
		update.next = update;
	} else {
		/*
		 b -> a
		 ^    |
		 |		|
		 	----
		* */
		// 如果有c ，c -> a -> b -> c
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

// 消费队列
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};

	/*
		updateCount(count=>count+1)
		updateCount(count=>count+1)
		updateCount(count=>count+1)
		三次更新分别对应 abc更新
		pendingUpdate c->a->b->c
		first 为 a
		pending 也为 a
		updateLane === renderLane 条件暂时都为SyncLane，故肯定进入
		最后 执行之后 count为3
	* */
	if (pendingUpdate !== null) {
		// 看下 enqueueUpdate 方法，pendingUpdate.next 为第一个更新
		// 第一个update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				// baseState 1 update(x)=>4x memoizedState 4
				const action = pending.action;
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					// baseState 1 update 2 -> memoizedState 2
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入updateLane !== renderLane这个逻辑');
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);
	}
	result.memoizedState = baseState;
	return result;
};
