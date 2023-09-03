import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';

// 这里之所以不写成 ./hostConfig 是因为宿主环境不同，hostConfig的位置也不同，比如在react-DOM中的 hostConfig
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';

export class FiberNode {
	// 对应的React组件的类型。对于用户定义的组件，type是一个函数或者是一个class。对于原生DOM节点，type是一个字符串，例如'div'，'span'等
	type: any;
	// 一个数值，标识了该Fiber节点的类型，如ClassComponent，FunctionComponent，HostComponent等。
	tag: WorkTag;
	// 当前正在工作中的props，当工作完成后，pendingProps会变为memoizedProps。
	pendingProps: Props;
	// 该Fiber节点的React key，用于标识和跟踪节点的唯一性。
	key: Key;
	// 对于class组件，stateNode是组件的实例。对于原生DOM元素，stateNode是对应的DOM节点。
	stateNode: any;
	// ref字段保存的是该节点的ref引用，可能是一个函数，也可能是一个包含current属性的对象，用于在commit阶段将该节点实例（或DOM元素）挂载到这个ref上
	ref: Ref;

	// 父Fiber节点，指向创建该Fiber的节点。
	return: FiberNode | null;

	/*
  sibling 与 child 的关系，以及为什么 child 只需要是 第一个子节点就可以
	<div>
		<span>1</span>
		<span>2</span>
	</div>
	生成的
	div Fiber
	|
	|---child---> span Fiber (1)
								 |
								 |---sibling---> span Fiber (2)

	* */

	// 下一个兄弟Fiber节点。
	sibling: FiberNode | null;
	// 第一个子Fiber节点。
	child: FiberNode | null;
	// 表示这个Fiber在其兄弟Fiber中的位置。在React reconciliation算法中，用于判断两个Fiber是否相同，如果是相同类型且index也相同，那么他们就是相同的Fiber，React会复用这个Fiber的DOM和状态
	index: number;

	// 保存了上一次渲染完成后的props
	memoizedProps: Props | null;
	// 保存了上一次渲染完成后的state
	memoizedState: any;
	// 指向该Fiber节点的当前树中的对应Fiber节点，当React在进行更新时，会创建新的Fiber节点来代替旧的Fiber节点，这时旧的Fiber节点的alternate属性会指向新的Fiber节点，新的Fiber节点的alternate属性会指向旧的Fiber节点。
	alternate: FiberNode | null;
	// 用于表示Fiber节点在构建或更新过程中需要进行的操作或者已经进行过的操作，比如插入、删除、更新等等
	flags: Flags;
	// 标记 child 中的 flags
	subtreeFlags: Flags;
	// 存储着该Fiber节点上待处理的更新。
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key || null;
		// 如果 HostComponent 是 <div> 的话，stateNode就是div的DOM
		this.stateNode = null;
		// 对于一个 FunctionComponent 来说，type就是 FunctionComponent本身
		// FunctionComponent() => {}
		this.type = null;

		// 构成树状结构

		// 指向父fiberNode
		this.return = null;
		// 指向右边的兄弟fiberNode
		this.sibling = null;
		// 指向子 fiberNode
		this.child = null;
		// 比如 ul 下边三个li，第一个li 的index就是0，依次类推
		this.index = 0;
		this.ref = null;

		// 作为工作单元

		this.pendingProps = pendingProps;
		// 确定下来的 props
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;
		this.alternate = null;

		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export class FiberRootNode {
	// React 渲染的DOM容器
	container: Container;
	// 根FiberNode节点
	current: FiberNode;
	//  保存已完成的工作，也就是构建好的DOM结构。保存递归完成的FiberNode
	finishedWork: FiberNode | null;
	pendingLanes: Lanes;
	finishedLane: Lane;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		// FiberRootNode 的current 为 根 FiberNode
		this.current = hostRootFiber;
		// 根fiberNode节点的stateNode 为 FiberRootNode
		// 这样在 Fiber 节点中可以通过 stateNode 属性反向获取到所属的 FiberRootNode 实例
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;
	// 如果当前Fiber节点没有替代节点 则会创建一个新的Fiber节点
	if (wip === null) {
		// 这个节点的这些属性会被初始化为与当前Fiber 节点相同值
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);

		// 目前对于根节点 stateNode 对应的是  FiberRootNode
		wip.stateNode = current.stateNode;

		// 这是一个初始化的步骤，这个新创建的节点被用于第一次渲染时
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	return wip;
};

// 根据 reactElement 创建 fiber
export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;
	if (typeof type === 'string') {
		// <div/> type: 'div'
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
