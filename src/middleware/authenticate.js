import configService from '../service/configService';
import defaultConfig from '../config/defaultConfig';

// 访客认证中间件
export const guestAuthenticate = async (request) => {
	const config = await configService.getConfig();

	// 如果是完全开放的，直接通过认证
	if (config.accessControl === 'open') {
		return true;
	}

	// 如果是完全私有的，仅允许管理员访问，检查管理员认证
	if (config.accessControl === 'private') {
		return await adminAuthenticate(request);
	}

	// 部分开放模式，检查访客密码
	if (config.accessControl === 'restricted') {
		// 获取Authorization头
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return false;
		}

		// 检查访客token
		const guestToken = authHeader.replace('Bearer ', '').trim();

		// 验证访客密码
		return guestToken === config.guestPassword;
	}

	// 默认拒绝访问
	return false;
};

// 管理员认证中间件
export const adminAuthenticate = async (request) => {
	try {
		// 获取Authorization头
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Basic ')) {
			return false;
		}

		// 从D1数据库查询管理员凭据
		const adminUsername = await configService.getConfigValueByName('admin_username', defaultConfig.ADMIN_USERNAME);
		const adminPassword = await configService.getConfigValueByName('admin_password', defaultConfig.ADMIN_PASSWORD);

		// 解码并验证凭据
		const encodedCredentials = authHeader.split(' ')[1];
		const decodedCredentials = atob(encodedCredentials);
		const [username, password] = decodedCredentials.split(':');

		return username === adminUsername && password === adminPassword;
	} catch (error) {
		console.error('认证出错:', error);
		return false;
	}
};
