/**
 * Seed script para popular o ecossistema distribuído com dados ricos de demonstração.
 * Cria:
 * 1. Usuário Administrador (admin@microstore.com) com role ADMIN
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

async function seed() {
  const userApiUrl = process.env.USER_API_URL || 'http://localhost:3000';
  const catalogApiUrl = process.env.CATALOG_API_URL || 'http://localhost:3001';
  const inventoryApiUrl = process.env.INVENTORY_PORT
    ? `http://localhost:${process.env.INVENTORY_PORT}`
    : 'http://localhost:3003';

  console.log('--- Iniciando Seed de Demonstração MicroStore ---');

  // 1. Criar ou logar Admin
  let adminToken = '';
  try {
    const regRes = await fetch(`${userApiUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Arquiteto Admin',
        email: 'admin@microstore.com',
        password: 'AdminPassword123!',
        role: 'ADMIN',
      }),
    });
    if (!regRes.ok && regRes.status !== 409) {
      console.warn(`Registro admin status: ${regRes.status}`);
    }
  } catch (err) {
    console.warn('Admin já existente ou erro de conexão:', (err as Error).message);
  }

  try {
    const loginRes = await fetch(`${userApiUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@microstore.com',
        password: 'AdminPassword123!',
      }),
    });
    if (loginRes.ok) {
      const data = await loginRes.json() as { token: string };
      adminToken = data.token;
      console.log('✓ Admin autenticado com sucesso (role: ADMIN)');
    }
  } catch (err) {
    console.error('Falha ao logar admin:', (err as Error).message);
  }

  // 2. Criar Cliente de Teste
  try {
    const custRes = await fetch(`${userApiUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cliente Exemplo',
        email: 'cliente@microstore.com',
        password: 'ClientePassword123!',
        role: 'CUSTOMER',
      }),
    });
    if (custRes.ok || custRes.status === 409) {
      console.log('✓ Cliente de teste pronto: cliente@microstore.com (Senha: ClientePassword123!)');
    }
  } catch (err) {
    console.warn('Erro ao criar cliente demo:', (err as Error).message);
  }

  // 3. Cadastrar Produtos e Sincronizar Estoque
  for (const p of DEMO_PRODUCTS) {
    try {
      let productId = '';
      const prodRes = await fetch(`${catalogApiUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({
          name: p.name,
          sku: p.sku,
          price: p.price,
          stock: p.stock,
          description: p.description,
        }),
      });

      if (prodRes.ok) {
        const prodData = await prodRes.json() as { id: string };
        productId = prodData.id;
        console.log(`✓ Produto cadastrado no Catálogo (MongoDB): [${p.sku}] ${p.name}`);
      } else if (prodRes.status === 409) {
        // Buscar ID do produto existente
        const getRes = await fetch(`${catalogApiUrl}/api/products?q=${encodeURIComponent(p.sku)}`);
        if (getRes.ok) {
          const list = await getRes.json() as { items: Array<{ id: string; sku: string }> };
          const found = list.items.find(i => i.sku === p.sku);
          if (found) productId = found.id;
        }
        console.log(`* Produto já existia no Catálogo: [${p.sku}]`);
      }

      // Sincronizar no inventory-service (PostgreSQL)
      if (productId) {
        const invRes = await fetch(`${inventoryApiUrl}/api/inventory/seed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            productId,
            sku: p.sku,
            availableQty: p.stock,
          }),
        });
        if (invRes.ok) {
          console.log(`  └─ Estoque provisionado no inventory-service (PostgreSQL): ${p.stock} unidades para ${p.sku}`);
        }
      }
    } catch (err) {
      console.warn(`Aviso ao sincronizar produto ${p.sku}:`, (err as Error).message);
    }
  }

  console.log('--- Seed de Demonstração Concluído com Sucesso! ---');
}

void seed();
