import { Action } from 'shared/ReactTypes';

/*

const [num,updateNum] = useState(0);

T 就是 0

* */
export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;
	if (dispatcher === null) {
		throw new Error('hook 只能在函数组件中执行');
	}
	return dispatcher;
};

export default currentDispatcher;
