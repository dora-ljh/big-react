// ReactDOM.createRoot 内部执行
import { Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

/**
 * 用于创建一个容器，用于管理 React 应用的渲染过程
 * */
export function createContainer(container: Container) {
	// 创建一个根级的 FiberNode 节点
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	// 管理渲染根节点的数据结构
	const root = new FiberRootNode(container, hostRootFiber);
	// 这个地方只是创建更新队列的壳子
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

/**
 * ReactDOM.createRoot().render() 内部执行
 * 这个函数是 React 内部用于触发根节点的更新的关键部分，用于将新的 React 元素（或者 null）传递给根节点并触发重新渲染
 * @param element 渲染到根节点的 React 元素
 * @param root 根管理节点
 * */
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	// 这里拿到的是 根FiberNode
	const hostRootFiber = root.current;
	// element 就是render 中传入的 <App />
	// 这个update里的action，就是一个reactElement 的类型
	const update = createUpdate<ReactElementType | null>(element);
	// 把创建的更新加入到更新队列中
	// 把在 createContainer 中创建的更新队列的壳子 放进一个更新
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	);
	// 开始调度更新 传入的是 根FiberNode
	scheduleUpdateOnFiber(hostRootFiber);
	return element;
}
