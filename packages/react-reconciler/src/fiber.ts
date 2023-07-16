import { Props, Key, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;
	ref: Ref;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	alternate: FiberNode | null;
	flags: Flags;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
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
		this.alternate = null;
		// 副作用
		this.flags = NoFlags;
	}
}
