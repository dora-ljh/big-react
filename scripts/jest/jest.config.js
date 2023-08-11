const { defaults } = require('jest-config');

module.exports = {
	...defaults,
	rootDir: process.cwd(), // 执行目录
	// 因为执行目录配置在package.json 故<rootDir>即为根目录
	// 寻找 测试用力 不要在 .history 目录下寻找
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	// 配置依赖的第三方包要从哪里解析
	moduleDirectories: [
		// 对于 React ReactDOM
		'dist/node_modules',
		// 对于第三方依赖
		...defaults.moduleDirectories
	],
	//默认环境jsdom，也就是安装的 jest-environment-jsdom
	testEnvironment: 'jsdom'
};
