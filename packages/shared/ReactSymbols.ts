const supportSymbol = typeof Symbol === 'function' && Symbol.for;

/**
 * 这里定义的都是ReactElement的$$Typeof属性
 * ReactElement.$$typeof
 * */
export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

/**
 * 这里定义的都是ReactElement的type属性
 * ReactElement.type = Symbol.for('react.fragment')
 * */
export const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb;

/*
{
	$$typeof: 'Symbol(react.element)',
	type: 'Symbol(react.fragment)',
	key: null,
	ref: null,
	props: null,
	__mark: 'Dora Li'
}

 * */
