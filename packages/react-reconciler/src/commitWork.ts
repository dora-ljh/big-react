import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';

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
		// 这个操作就是将 Placement 从 flags 中移除
		finishedWork.flags &= ~Placement;
	}
	// 如果flags 包含 Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		// 这个操作就是将 Update 从 flags 中移除
		finishedWork.flags &= ~Update;
	}

	// 如果flags 包含 ChildDelete
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}

		// 这个操作就是将 ChildDeletion 从 flags 中移除
		finishedWork.flags &= ~ChildDeletion;
	}
};

/*
<div>
	<App/>
	<p/>
</div>
function App(){
	return <p>12<p/>
}

执行顺序为：
div=>p>12>p
* */
function commitDeletion(childToDelete: FiberNode) {
	let rootHostNode: FiberNode | null = null;
	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				// TODO 解绑ref
				return;
			case HostText:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			case FunctionComponent:
				// TODO useEffect unmount
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});
	// 移除rootHostComponent的DOM
	if (rootHostNode !== null) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent);
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		// 向下遍历
		onCommitUnmount(node);
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			// 终止条件
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	// parent DOM 得知道他的父节点
	const hostParent = getHostParent(finishedWork);

	// host sibling
	const sibling = getHostSibling(finishedWork);

	// finishedWork ~~ DOM finishedWork对应的dom阶段
	// 再将找到的 DOM append 到 parent DOM 中
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

/**
 * 找到相邻的有真实DOM的节点，
 * */
function getHostSibling(fiber: FiberNode) {
	/*
		<A/><B/>
		这种就需要一直找到组件下的HostComponent或者HostText比如div或者字符
		A或者B下都可能还是FunctionComponent故需要while
		如果是 <App/><div/>
		App 组件下是 A组件
		那A组件的 HostSibling 就为 div，需要向上找
	* */
	let node: FiberNode = fiber;
	findSibling: while (true) {
		// 如果没有兄弟节点，则看一下父节点，如果父节点有 sibling，那就会终止进入，不终止只能说明找到 HostRoot 也没找到 HostSibling
		while (node.sibling === null) {
			const parent = node.return;
			// 没找到
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}
			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;
		// 说明不是一个可直接操作的类型
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历
			// 不稳定的节点，不能作为HostSibling
			// 如果flags中包含 Placement
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling;
			}
			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}
		// 如果flags中不包含 Placement
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

function getHostParent(fiber: FiberNode): Container | null {
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
	return null;
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	// append 之前应该先确认下 finishedWork 是  HostComponent HostText 才可以 append
	// 因为对于需要append的tag类型不可能是HostRoot类型的，子 dom要是div 或者 直接是字符才可以append
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		//  before 存在就插入到child前边
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
