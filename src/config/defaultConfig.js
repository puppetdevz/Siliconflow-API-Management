// Configuration (可以通过管理员界面覆盖)
export default {
	ADMIN_USERNAME: 'default-admin-username', // 默认管理员用户名
	ADMIN_PASSWORD: 'default-admin-password', // 默认管理员密码
	API_KEY: 'default-api-key', // 用于代理认证的默认API密钥
	PAGE_SIZE: 12, // 主界面每页显示的密钥数量
	ACCESS_CONTROL: 'open', // 访问控制模式: "open", "restricted", "private"
	GUEST_PASSWORD: 'guest_password', // 访客密码，用于restricted模式
};
