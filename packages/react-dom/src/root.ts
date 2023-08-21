// ReactDOM.createRoot(root).render(<App/>)

import { Container } from './hostConfig';
import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { ReactElementType } from 'shared/ReactTypes';
import { initEvent } from './SyntheticEvent';

/**
 * 用于创建一个 React 根节点
 * @param container 表示要将 React 渲染到的 DOM 容器
 * */
export function createRoot(container: Container) {
	// 函数来创建一个容器
	const root = createContainer(container);
	return {
		// render 方法用于将 React 元素渲染到根节点上
		render(element: ReactElementType) {
			initEvent(container, 'click');
			return updateContainer(element, root);
		}
	};
}
