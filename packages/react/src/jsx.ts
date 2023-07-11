import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Key, Ref, Props, ReactElement, ElementType } from 'shared/ReactTypes';

// ReactElement
const ReactElement = function (
	type: ElementType,
	key: Key,
	ref: Ref,
	props: Props
): ReactElement {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'Dora Li'
	};
	return element;
};

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		/*
		for...in循环不能区分对象自身的属性和从原型链中继承的属性，它会把两者都包含进来，
		所以这个判断是用来确认prop属性是否是config对象自有的属性，而非从原型链中继承的属性。

		至于这种使用方式主要是为了防止当 config 对象的原型上存在 hasOwnProperty 属性时，
		直接调用 config.hasOwnProperty(prop) 可能会产生错误或者意外的行为。
		所以，我们使用 {} 的 hasOwnProperty 方法，并通过 .call() 将 config 作为上下文来避免这个问题。
		* */
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}
	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength) {
		if (maybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}
	return ReactElement(type, key, ref, props);
};

// 兼容开发版本的jsx，开发版的jsx会做一些兼容处理
export const jsxDev = jsx;
