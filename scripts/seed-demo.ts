/**
 * Seed script para popular o ecossistema distribuído com dados ricos de demonstração.
 * Todo o tráfego passa pelo API Gateway (as portas dos serviços não são expostas).
 * Cria:
 * 1. Login com o ADMIN provisionado pelo user-service no boot (ADMIN_EMAIL/ADMIN_PASSWORD)
 * 2. Usuário Cliente (cliente@microstore.com) com role CUSTOMER
 * 3. 5 Produtos com fotos no catalog-service (MongoDB)
 * 4. Estoque sincronizado para cada produto no inventory-service (PostgreSQL)
 */

interface ProductSeed {
  name: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  category: string;
}

const DEMO_PRODUCTS: ProductSeed[] = [
  {
    name: 'Teclado Mecânico RGB Switch Brown',
    sku: 'KB-1234',
    price: 299.90,
    stock: 45,
    description: 'Teclado mecânico compacto ABNT2 com iluminação RGB individual e switches táteis silenciosos.',
    category: 'Periféricos',
  },
  {
    name: 'Monitor Gamer 27" QHD 165Hz IPS',
    sku: 'MON-27-QHD',
    price: 1899.00,
    stock: 20,
    description: 'Painel Fast IPS com 1ms de resposta, 165Hz, HDR400 e suporte a FreeSync / G-Sync.',
    category: 'Monitores',
  },
  {
    name: 'Headset Wireless 7.1 Surround',
    sku: 'HDST-W71',
    price: 499.50,
    stock: 35,
    description: 'Áudio espacial de alta definição, cancelamento passivo de ruído e bateria de até 40 horas.',
    category: 'Áudio',
  },
  {
    name: 'Mouse Gamer Ultraleve 62g 26K DPI',
    sku: 'MSE-ULTR-62',
    price: 249.00,
    stock: 60,
    description: 'Sensor óptico PixArt topo de linha, switches ópticos e cabo paracord de baixíssimo atrito.',
    category: 'Periféricos',
  },
  {
    name: 'Cadeira Ergonômica Mesh Pro',
    sku: 'CAD-ERG-01',
    price: 1290.00,
    stock: 15,
    description: 'Estrutura totalmente em tela mesh respirável, ajuste 4D nos braços e suporte lombar adaptativo.',
    category: 'Ergonomia',
  },
];

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@microstore.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

async function api<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

async function seed(): Promise<void> {
  console.log(`--- Seed de Demonstração MicroStore (via gateway ${GATEWAY_URL}) ---`);

  // 1. Admin: provisionado pelo user-service; aqui só autenticamos
  const login = await api<{ tokenJwt?: string; user?: { role: string } }>('POST', '/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const adminToken = login.data?.tokenJwt;
  if (login.status !== 200 || !adminToken || login.data.user?.role !== 'ADMIN') {
    throw new Error(
      `Não foi possível autenticar o ADMIN ${ADMIN_EMAIL} (HTTP ${login.status}). ` +
        'Confira ADMIN_EMAIL/ADMIN_PASSWORD no .env e se a stack está healthy.'
    );
  }
  console.log(`✓ Admin autenticado: ${ADMIN_EMAIL}`);

  // 2. Cliente de teste (cadastro público => sempre CUSTOMER)
  const customer = await api('POST', '/users', {
    name: 'Cliente Exemplo',
    email: 'cliente@microstore.com',
    password: 'ClientePassword123!',
  });
  if (customer.status !== 201 && customer.status !== 400) {
    throw new Error(`Falha ao criar cliente demo (HTTP ${customer.status})`);
  }
  console.log('✓ Cliente pronto: cliente@microstore.com (Senha: ClientePassword123!)');

  // 3. Produtos no catálogo + estoque sincronizado no inventory
  for (const p of DEMO_PRODUCTS) {
    let productId: string | undefined;

    const created = await api<{ id: string }>(
      'POST',
      '/api/products',
      { name: p.name, sku: p.sku, price: p.price, stock: p.stock, description: p.description },
      adminToken
    );
    if (created.status === 201 || created.status === 200) {
      productId = created.data.id;
      console.log(`✓ Produto cadastrado no catálogo: [${p.sku}] ${p.name}`);
    } else if (created.status === 409 || created.status === 400) {
      const found = await api<{ items: Array<{ id: string; sku: string }> }>(
        'GET',
        `/api/products?q=${encodeURIComponent(p.sku)}&limit=100`
      );
      productId = found.data.items.find((i) => i.sku === p.sku)?.id;
      console.log(`* Produto já existia no catálogo: [${p.sku}]`);
    }

    if (!productId) {
      throw new Error(`Não foi possível obter o produto ${p.sku} (HTTP ${created.status})`);
    }

    const stock = await api(
      'POST',
      '/api/inventory/seed',
      { productId, sku: p.sku, availableQty: p.stock },
      adminToken
    );
    if (stock.status >= 300) {
      throw new Error(`Falha ao provisionar estoque de ${p.sku} (HTTP ${stock.status})`);
    }
    console.log(`  └─ Estoque: ${p.stock} unidades de ${p.sku}`);
  }

  console.log('--- Seed concluído ---');
}

seed().catch((err: Error) => {
  console.error(`✗ Seed falhou: ${err.message}`);
  process.exit(1);
});
