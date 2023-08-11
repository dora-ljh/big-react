import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';

const { name, module } = getPackageJSON('react');

// react 包路径
const pkgPath = resolvePkgPath(name);

// react 产物路径
const pkgDistPath = resolvePkgPath(name, true);

export default [
	// react
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			/*
			 name 主要用于 UMD 和 IIFE 模块格式，使用 es 则不需要设置
			 当使用这两种模块格式时，
			 Rollup 需要知道将哪个名称（也就是 name 选项的值）添加到全局命名空间（即，window 对象）。
			 如 name:react 其实 打包之后会在全局对象中出现 global.react 属性，可以直接访问
			* */
			name: 'react',
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	// jsx-runtime
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			// jsx-runtime
			{
				file: `${pkgDistPath}/jsx-runtime.js`,
				/*
					这个name 写成 jsx-runtime 会打包成 global['jsx-runtime']
					写成 jsx-runtime.js 会被打包成 global['jsx-runtime'] || global['jsx-runtime'].js
					会兼容 写成 jsx-runtime 的情况
				* */
				name: 'jsx-runtime',
				format: 'umd'
			},
			// jsx-dev-runtime
			{
				file: `${pkgDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				format: 'umd'
			}
		],
		plugins: getBaseRollupPlugins()
	}
];
