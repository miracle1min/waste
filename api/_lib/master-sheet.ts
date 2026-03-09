/**
 * Master Sheet library — pusat data tenants, users, dan configs.
 * Semua CRUD untuk multi-tenant disini.
 */
import crypto from 'crypto';

// ===== JWT Auth (reuse dari google-sheets.ts) =====

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJWT(credentials: { client_email: string; private_key: string }): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = base64url(sign.sign(credentials.private_key));
  return `${signatureInput}.${signature}`;
}

async function getAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const jwt = createJWT(credentials);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.status}`);
  }
  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

// ===== Sheets Helpers =====

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsRequest(accessToken: string, url: string, method = 'GET', body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${errorText}`);
  }
  return response.json();
}

// ===== Master Sheet Connection =====

function getMasterCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_SHEETS_CREDENTIALS not set');
  return JSON.parse(raw);
}

function getMasterSpreadsheetId(): string {
  const id = process.env.MASTER_SPREADSHEET_ID;
  if (!id) throw new Error('MASTER_SPREADSHEET_ID not set');
  return id;
}

async function getMasterToken(): Promise<string> {
  return getAccessToken(getMasterCredentials());
}

// ===== Types =====

export interface Tenant {
  id: string;
  name: string;
  store_code: string;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  username: string;
  password: string;
  role: string;
  created_at: string;
}

export interface TenantConfig {
  tenant_id: string;
  google_sheet_id: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_public_url: string;
  updated_at: string;
}

// ===== Generic Sheet Read/Write =====

async function readTab(tabName: string): Promise<string[][]> {
  const token = await getMasterToken();
  const spreadsheetId = getMasterSpreadsheetId();
  const result = await sheetsRequest(token, `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:Z`);
  return result.values || [];
}

async function appendRow(tabName: string, row: string[]): Promise<void> {
  const token = await getMasterToken();
  const spreadsheetId = getMasterSpreadsheetId();
  await sheetsRequest(
    token,
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:Z:append?valueInputOption=RAW`,
    'POST',
    { values: [row] }
  );
}

async function updateRow(tabName: string, rowIndex: number, row: string[]): Promise<void> {
  const token = await getMasterToken();
  const spreadsheetId = getMasterSpreadsheetId();
  const range = `${encodeURIComponent(tabName)}!A${rowIndex + 1}:Z${rowIndex + 1}`;
  await sheetsRequest(
    token,
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    'PUT',
    { values: [row] }
  );
}

async function deleteRow(tabName: string, rowIndex: number): Promise<void> {
  const token = await getMasterToken();
  const spreadsheetId = getMasterSpreadsheetId();
  // Get sheet ID
  const spreadsheet = await sheetsRequest(token, `${SHEETS_BASE_URL}/${spreadsheetId}`);
  const sheet = spreadsheet.sheets?.find((s: any) => s.properties?.title === tabName);
  if (!sheet) throw new Error(`Tab ${tabName} not found`);
  const sheetId = sheet.properties.sheetId;

  await sheetsRequest(token, `${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, 'POST', {
    requests: [{
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
      }
    }]
  });
}

function rowsToObjects<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj as T;
  });
}

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ===== TENANT CRUD =====

export async function getAllTenants(): Promise<Tenant[]> {
  const rows = await readTab('tenants');
  return rowsToObjects<Tenant>(rows);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const tenants = await getAllTenants();
  return tenants.find(t => t.id === id) || null;
}

export async function createTenant(data: { name: string; store_code: string }): Promise<Tenant> {
  const tenant: Tenant = {
    id: generateId(),
    name: data.name,
    store_code: data.store_code,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  await appendRow('tenants', [tenant.id, tenant.name, tenant.store_code, tenant.status, tenant.created_at]);
  return tenant;
}

export async function updateTenant(id: string, data: Partial<{ name: string; store_code: string; status: string }>): Promise<Tenant | null> {
  const rows = await readTab('tenants');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx === -1) return null;

  const current = rows[idx];
  const updated: Tenant = {
    id,
    name: data.name ?? current[1],
    store_code: data.store_code ?? current[2],
    status: data.status ?? current[3],
    created_at: current[4],
  };
  await updateRow('tenants', idx, [updated.id, updated.name, updated.store_code, updated.status, updated.created_at]);
  return updated;
}

export async function deleteTenant(id: string): Promise<boolean> {
  const rows = await readTab('tenants');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx === -1) return false;
  await deleteRow('tenants', idx);
  return true;
}

// ===== USER CRUD =====

export async function getAllUsers(): Promise<User[]> {
  const rows = await readTab('users');
  return rowsToObjects<User>(rows);
}

export async function getUsersByTenant(tenantId: string): Promise<User[]> {
  const users = await getAllUsers();
  return users.filter(u => u.tenant_id === tenantId || u.tenant_id === 'ALL');
}

export async function createUser(data: { tenant_id: string; username: string; password: string; role: string }): Promise<User> {
  const user: User = {
    id: generateId(),
    tenant_id: data.tenant_id,
    username: data.username,
    password: hashPassword(data.password),
    role: data.role,
    created_at: new Date().toISOString(),
  };
  await appendRow('users', [user.id, user.tenant_id, user.username, user.password, user.role, user.created_at]);
  return user;
}

export async function updateUser(id: string, data: Partial<{ tenant_id: string; username: string; password: string; role: string }>): Promise<User | null> {
  const rows = await readTab('users');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx === -1) return null;

  const current = rows[idx];
  const updated: User = {
    id,
    tenant_id: data.tenant_id ?? current[1],
    username: data.username ?? current[2],
    password: data.password ? hashPassword(data.password) : current[3],
    role: data.role ?? current[4],
    created_at: current[5],
  };
  await updateRow('users', idx, [updated.id, updated.tenant_id, updated.username, updated.password, updated.role, updated.created_at]);
  return updated;
}

export async function deleteUser(id: string): Promise<boolean> {
  const rows = await readTab('users');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx === -1) return false;
  await deleteRow('users', idx);
  return true;
}

// ===== TENANT CONFIG CRUD =====

export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  const rows = await readTab('tenant_configs');
  const configs = rowsToObjects<TenantConfig>(rows);
  return configs.find(c => c.tenant_id === tenantId) || null;
}

export async function getAllTenantConfigs(): Promise<TenantConfig[]> {
  const rows = await readTab('tenant_configs');
  return rowsToObjects<TenantConfig>(rows);
}

export async function saveTenantConfig(tenantId: string, data: Partial<Omit<TenantConfig, 'tenant_id' | 'updated_at'>>): Promise<TenantConfig> {
  const rows = await readTab('tenant_configs');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === tenantId);

  const config: TenantConfig = {
    tenant_id: tenantId,
    google_sheet_id: data.google_sheet_id ?? (idx > 0 ? rows[idx][1] : '') ?? '',
    r2_account_id: data.r2_account_id ?? (idx > 0 ? rows[idx][2] : '') ?? '',
    r2_access_key_id: data.r2_access_key_id ?? (idx > 0 ? rows[idx][3] : '') ?? '',
    r2_secret_access_key: data.r2_secret_access_key ?? (idx > 0 ? rows[idx][4] : '') ?? '',
    r2_bucket_name: data.r2_bucket_name ?? (idx > 0 ? rows[idx][5] : '') ?? '',
    r2_public_url: data.r2_public_url ?? (idx > 0 ? rows[idx][6] : '') ?? '',
    updated_at: new Date().toISOString(),
  };

  const row = [config.tenant_id, config.google_sheet_id, config.r2_account_id, config.r2_access_key_id, config.r2_secret_access_key, config.r2_bucket_name, config.r2_public_url, config.updated_at];

  if (idx > 0) {
    await updateRow('tenant_configs', idx, row);
  } else {
    await appendRow('tenant_configs', row);
  }

  return config;
}

export async function deleteTenantConfig(tenantId: string): Promise<boolean> {
  const rows = await readTab('tenant_configs');
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === tenantId);
  if (idx === -1) return false;
  await deleteRow('tenant_configs', idx);
  return true;
}

// ===== AUTH =====

export async function authenticateUser(username: string, password: string): Promise<{
  user: Omit<User, 'password'>;
  tenant: Tenant | null;
} | null> {
  const users = await getAllUsers();
  const hashedPw = hashPassword(password);
  const user = users.find(u => u.username === username && u.password === hashedPw);

  if (!user) return null;

  let tenant: Tenant | null = null;
  if (user.tenant_id !== 'ALL') {
    tenant = await getTenantById(user.tenant_id);
  }

  const { password: _, ...safeUser } = user;
  return { user: safeUser, tenant };
}
