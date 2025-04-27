import { adminAuthenticate } from './middleware/authenticate.js';
import keyHandler from './handlers/keyHandler';
import configHandler from './handlers/configHandler.js';
import { handleModelApi } from './handlers/modelApiHandler.js';
import mainHtmlContent from './gui/main.html';
import adminHtmlContent from './gui/admin.html';

// 设置环境变量以供全局使用
export default {
	async fetch(request, env) {
		// 将env保存为全局变量，便于其他函数访问D1
		globalThis.env = env;
		return handleRequest(request);
	},
};

async function handleRequest(request) {
	const url = new URL(request.url);
	const path = url.pathname;

	// 处理预检请求
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
				'Access-Control-Max-Age': '86400', // 24小时缓存预检请求结果
				'Access-Control-Allow-Credentials': 'true',
			},
		});
	}

	// 管理员界面路由
	if (path === '/admin' || path === '/admin/') {
		const isAuthenticated = await adminAuthenticate(request);

		if (!isAuthenticated) {
			return new Response('Unauthorized', {
				status: 401,
				headers: {
					'WWW-Authenticate': 'Basic realm="Admin Interface"',
				},
			});
		}

		return new Response(adminHtmlContent, {
			headers: { 'Content-Type': 'text/html;charset=UTF-8' },
		});
	}

	if (path.startsWith('/admin/api/')) {
		const endpoint = path.replace('/admin/api/', '');
		try {
			if (request.method === 'GET') {
				if (endpoint === 'pageSize') {
					// 特殊处理pageSize请求，无需鉴权
					return configHandler.getPageSize();
				}
				if (endpoint === 'keys') {
					return keyHandler.getKeys(request);
				}
				if (endpoint === 'config') {
					return configHandler.getConfig(request);
				}
				if (endpoint === 'access-control') {
					return configHandler.getAccessControl();
				}
			}
			if (request.method === 'POST') {
				if (endpoint === 'verifyGuest') {
					return configHandler.verifyGuest(request);
				}
				if (endpoint === 'addKey') {
					return keyHandler.addKey(request);
				}
				if (endpoint === 'addKeys') {
					return keyHandler.addKeys(request);
				}
				if (endpoint === 'deleteKey') {
					return keyHandler.deleteKey(request);
				}
				if (endpoint === 'updateConfig') {
					return configHandler.updateConfig(request);
				}
				if (endpoint === 'updateKeyBalance') {
					return keyHandler.updateKeyBalance(request);
				}
				if (endpoint === 'update-keys-balance') {
					return keyHandler.updateKeysBalance(request);
				}
				if (endpoint === 'batch-update-keys') {
					return keyHandler.updateKeys(request);
				}
			}
		} catch (error) {
			return new Response(JSON.stringify({ success: false, message: error.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 如果没有匹配的端点
		return new Response(JSON.stringify({ success: false, message: '无效的端点' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// API代理路由 - 转发请求到siliconflow API并进行负载均衡
	if (path.startsWith('/v1/')) {
		return handleModelApi(request, path);
	}

	// 主界面
	return new Response(mainHtmlContent, {
		headers: { 'Content-Type': 'text/html;charset=UTF-8' },
	});
}
