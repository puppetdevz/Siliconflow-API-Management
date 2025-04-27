import { adminAuthenticate  } from '../middleware/authenticate.js';
import configService from '../service/configService';
import defaultConfig from '../config/defaultConfig.js';

/**
 * 获取配置
 * @param request
 * @returns {Promise<Response>}
 */
export async function getConfig(request) {
	// 判断是否为管理员
	let isAdmin = await adminAuthenticate(request);
	if (!isAdmin) {
		return new Response(
			JSON.stringify({
				error: { message: '需要管理员权限' }
			}),
			{
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	const config = await configService.getConfig();
	return new Response(JSON.stringify({
		success: true,
		data: config
	}), {
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * 更新配置
 * @param request
 * @returns {Promise<Response>}
 */
export async function updateConfig(request) {
	try {
		const data = await request.json();
		// 更新配置
		await configService.updateConfig(data);
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ success: false, message: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

/**
 * 获取页面大小
 * @returns {Promise<Response>}
 */
export async function getPageSize() {
	// 特殊处理pageSize请求，无需鉴权
	const pageSize = parseInt(await configService.getConfigValueByName('page_size', defaultConfig.PAGE_SIZE));
	return new Response(JSON.stringify({ success: true, data: pageSize }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * 获取访问控制模式
 * @returns {Promise<Response>}
 */
export async function getAccessControl() {
	// 这个端点可以公开访问，用于前端判断认证方式
	const config = await configService.getConfig();
	return new Response(
		JSON.stringify({
			success: true,
			data: {
				accessControl: config.accessControl
			}
		}),
		{
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

export async function verifyGuest(request) {
	const data = await request.json();
	const config = await configService.getConfig();

	if (config.accessControl !== 'restricted') {
		return new Response(
			JSON.stringify({
				success: false,
				message: '当前模式不需要访客认证'
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	// 验证访客密码
	if (data.password === config.guestPassword) {
		return new Response(
			JSON.stringify({
				success: true,
				token: config.guestPassword
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} else {
		return new Response(
			JSON.stringify({
				success: false,
				message: '访客密码不正确'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

export default {
	getConfig,
	getPageSize,
	getAccessControl,
	verifyGuest,
	updateConfig
};
