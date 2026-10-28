/**
 * Conta ADMIN de demonstração. Ela é provisionada pelo user-service no boot
 * (ADMIN_EMAIL / ADMIN_PASSWORD no docker-compose); o frontend apenas faz login,
 * nunca cria contas privilegiadas.
 */
export const DEMO_ADMIN = {
  email: 'admin@microstore.com',
  password: 'AdminPassword123!',
} as const;
