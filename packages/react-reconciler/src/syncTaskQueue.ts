let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

// 调度
export function scheduleSyncCallback(callback: (...args: any) => void) {
	// 第一个callback
	if (syncQueue === null) {
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

// 冲洗
export function flushSyncCallbacks() {
	// 如果没有开始冲洗（执行调度），并且有需要执行的调度的时候
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true;
		try {
			syncQueue.forEach((callback) => callback());
		} catch (e) {
			if (__DEV__) {
				console.error('flushSyncCallbacks报错', e);
			}
		} finally {
			isFlushingSyncQueue = false;
		}
	}
}
