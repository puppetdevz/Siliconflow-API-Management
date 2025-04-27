import configService from '../service/configService';
import keysService from '../service/keysService';
import defaultConfig from '../config/defaultConfig.js';

// 处理API代理，带负载均衡
export async function handleModelApi(request, path) {
	// 验证API请求
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return new Response(
			JSON.stringify({
				error: { message: '需要认证' },
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 从Authorization头中提取token
	const providedToken = authHeader.replace('Bearer ', '').trim();

	const apiKey = await configService.getConfigValueByName('api_key', defaultConfig.API_KEY);

	if (providedToken !== apiKey) {
		return new Response(
			JSON.stringify({
				error: { message: '无效的API密钥' },
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 获取所有有效密钥用于负载均衡
	const allKeys = await keysService.getKeys();
	const validKeys = allKeys.filter((k) => k.balance > 0);

	// 获取所有 Key 的总余额
	if (path === '/v1/dashboard/billing/subscription') {
		const totalBalance = validKeys.reduce((sum, key) => sum + key.balance, 0);
		return new Response(
			JSON.stringify({
				code: 200,
				message: 'ok',
				status: true,
				success: true,
				balance: totalBalance,
				data: {
					balance: totalBalance,
				},
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	if (validKeys.length === 0) {
		return new Response(
			JSON.stringify({
				error: { message: '没有可用的API密钥' },
			}),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 负载均衡 - 随机选择一个密钥
	const randomIndex = Math.floor(Math.random() * validKeys.length);
	const selectedKey = validKeys[randomIndex].key;

	// 克隆请求并修改头信息
	const newHeaders = new Headers(request.headers);
	newHeaders.set('Authorization', `Bearer ${selectedKey}`);

	// 移除host头以避免冲突
	newHeaders.delete('host');

	// 创建新请求
	const newRequest = new Request(`https://api.siliconflow.cn${path}`, {
		method: request.method,
		headers: newHeaders,
		body: request.body,
		redirect: 'follow',
	});

	// 转发请求
	const response = await fetch(newRequest);

	// 创建一个新的响应用于流式传输（如果需要）
	const newResponse = new Response(response.body, response);

	// 添加完整的CORS头
	newResponse.headers.set('Access-Control-Allow-Origin', '*');
	newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
	newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
	newResponse.headers.set('Access-Control-Max-Age', '86400');

	// 禁用缓存以支持流式传输
	newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	newResponse.headers.set('Pragma', 'no-cache');
	newResponse.headers.set('Expires', '0');

	return newResponse;
}

export default {
	handleModelApi,
};
