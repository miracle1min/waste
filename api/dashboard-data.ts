import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTenantCredentials, extractTenantId } from './_lib/tenant-resolver.js';
import { getGoogleAccessToken } from './_lib/google-sheets.js';
import { requireRole, handleAuthError } from './_lib/auth.js';
import { getActivityLogs } from './_lib/activity-logger.js';

// Parse tab name "DD/MM/YY" to Date
function parseTabToDate(tab: string): Date | null {
  const match = tab.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
}

// BUG-018 fix: Safe date conversion that handles null
function tabToISODate(tab: string): string {
  const d = parseTabToDate(tab);
  if (!d) return tab;
  const iso = d.toISOString();
  return iso ? iso.split('T')[0] : tab;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Activity Log sub-route (Super Admin only)
  if (req.query.mode === 'activity-log') {
    try {
      requireRole(req, 'super_admin');
      const {
        page, limit, action, category, tenant_id,
        username, status, date_from, date_to, search
      } = req.query;
      const result = await getActivityLogs({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        action: action as string,
        category: category as string,
        tenantId: tenant_id as string,
        username: username as string,
        status: status as string,
        dateFrom: date_from as string,
        dateTo: date_to as string,
        search: search as string,
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return handleAuthError(err, res);
    }
  }

  const { startDate, endDate } = req.query;

  try {
    const tenantId = extractTenantId(req);
    const tenantCreds = await resolveTenantCredentials(tenantId);
    if (!tenantCreds.googleSheetsCredentials || !tenantCreds.googleSpreadsheetId) {
      return res.status(500).json({ error: 'Missing config' });
    }

    const credentials = JSON.parse(tenantCreds.googleSheetsCredentials);
    // BUG-030 fix: Use shared auth function
    const accessToken = await getGoogleAccessToken(credentials, 'readonly');
    const SPREADSHEET_ID = tenantCreds.googleSpreadsheetId;

    // BUG-031 fix: Add timeout
    const controller = new AbortController();
    const spreadsheetTimeout = setTimeout(() => controller.abort(), 20000);

    // 1. Get all sheet tabs
    const spreadsheet = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
    ).then(r => r.json()) as any;
    clearTimeout(spreadsheetTimeout);

    const allTabs = (spreadsheet.sheets || [])
      .map((s: any) => s.properties?.title)
      .filter((t: string) => /^\d{2}\/\d{2}\/\d{2}$/.test(t))
      .sort((a: string, b: string) => {
        const da = parseTabToDate(a);
        const db = parseTabToDate(b);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });

    // 2. Filter tabs by date range
    let filteredTabs = allTabs;
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      filteredTabs = allTabs.filter((tab: string) => {
        const d = parseTabToDate(tab);
        return d && d >= start && d <= end;
      });
    }

    // 3. Fetch data from each tab (batch read)
    const dailyData: any[] = [];
    const stationTotals: Record<string, number> = {};
    const shiftTotals: Record<string, number> = {};
    const productCounts: Record<string, { count: number; qty: number }> = {};
    const stationItemsByUnit: Record<string, Record<string, Record<string, number>>> = {};
    const allItems: { date: string; station: string; product: string; qty: number; unit: string; shift: string }[] = [];
    const allQcNames = new Set<string>();
    let lastEntryTime = 0;
    let lastEntryInfo: { date: string; qc: string; station: string; shift: string } | null = null;
    let totalItems = 0;
    let totalQty = 0;

    for (let i = 0; i < filteredTabs.length; i += 5) {
      const batch = filteredTabs.slice(i, i + 5);
      const ranges = batch.map((tab: string) => `${encodeURIComponent(tab)}!A2:V1000`).join('&ranges=');

      const batchController = new AbortController();
      const batchTimeout = setTimeout(() => batchController.abort(), 20000);

      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges}&valueRenderOption=UNFORMATTED_VALUE`;
      const batchRes = await fetch(batchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: batchController.signal,
      }).then(r => r.json()) as any;
      clearTimeout(batchTimeout);

      const valueRanges = batchRes.valueRanges || [];

      for (let j = 0; j < batch.length; j++) {
        const tab = batch[j];
        const rows = valueRanges[j]?.values || [];
        const tabDate = parseTabToDate(tab);

        let dayItems = 0;
        let dayQty = 0;
        const dayStations: Record<string, number> = {};
        const dayShifts: Record<string, number> = {};

        for (const row of rows) {
          const shift = (row[0] || '').toString().toUpperCase();
          const station = (row[2] || '').toString().toUpperCase();
          const productName = (row[3] || '').toString();
          const qtyStr = (row[5] || '').toString();
          const unitStr = (row[6] || '').toString().toUpperCase();
          const qcName = (row[10] || '').toString().trim();

          if (!productName || !station) continue;

          const products = productName.split('\n').filter((p: string) => p.trim());
          const quantities = qtyStr.split('\n').filter((q: string) => q.trim());
          const units = unitStr.split('\n').filter((u: string) => u.trim());

          for (let k = 0; k < products.length; k++) {
            const pName = products[k].trim().toUpperCase();
            const qty = parseFloat(quantities[k]) || 1;
            const unit = (units[k] || units[0] || 'PCS').trim().toUpperCase();

            totalItems++;
            totalQty += qty;
            dayItems++;
            dayQty += qty;

            if (station) {
              stationTotals[station] = (stationTotals[station] || 0) + qty;
              dayStations[station] = (dayStations[station] || 0) + qty;
            }
            if (shift) {
              shiftTotals[shift] = (shiftTotals[shift] || 0) + qty;
              dayShifts[shift] = (dayShifts[shift] || 0) + qty;
            }
            if (pName) {
              if (!productCounts[pName]) productCounts[pName] = { count: 0, qty: 0 };
              productCounts[pName].count++;
              productCounts[pName].qty += qty;
            }
            if (!stationItemsByUnit[station]) stationItemsByUnit[station] = {};
            if (!stationItemsByUnit[station][unit]) stationItemsByUnit[station][unit] = {};
            stationItemsByUnit[station][unit][pName] = (stationItemsByUnit[station][unit][pName] || 0) + qty;

            if (tabDate) {
              const entryTime = tabDate.getTime();
              if (entryTime >= lastEntryTime) {
                lastEntryTime = entryTime;
                const prevQc: string = lastEntryInfo?.qc || '';
                const cleanQc = (qcName && !qcName.includes('#REF') && !qcName.includes('Please use')) ? qcName : prevQc;
                lastEntryInfo = { date: tab, qc: cleanQc || '-', station, shift };
              }
            }

            if (qcName && !qcName.includes('#REF') && !qcName.includes('Please use') && !allQcNames.has(qcName)) allQcNames.add(qcName);

            // BUG-018 fix: Use safe tabToISODate
            allItems.push({ date: tabToISODate(tab), station, product: pName, qty, unit, shift });
          }
        }

        dailyData.push({
          date: tabToISODate(tab),
          tab,
          items: dayItems,
          qty: dayQty,
          stations: dayStations,
          shifts: dayShifts,
        });
      }
    }

    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    const stationBreakdown: Record<string, { unit: string; items: { name: string; qty: number }[]; totalQty: number }[]> = {};
    for (const [station, unitMap] of Object.entries(stationItemsByUnit)) {
      stationBreakdown[station] = Object.entries(unitMap).map(([unit, products]) => {
        const items = Object.entries(products).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
        return { unit, items, totalQty: items.reduce((s, i) => s + i.qty, 0) };
      }).sort((a, b) => b.totalQty - a.totalQty);
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];

    function buildPeriodBreakdown(items: typeof allItems, fromDate: string) {
      const filtered = items.filter(i => i.date >= fromDate);
      const byStation: Record<string, Record<string, Record<string, number>>> = {};
      for (const item of filtered) {
        if (!byStation[item.station]) byStation[item.station] = {};
        if (!byStation[item.station][item.unit]) byStation[item.station][item.unit] = {};
        byStation[item.station][item.unit][item.product] = (byStation[item.station][item.unit][item.product] || 0) + item.qty;
      }
      const result: Record<string, { unit: string; items: { name: string; qty: number }[]; totalQty: number }[]> = {};
      for (const [station, unitMap] of Object.entries(byStation)) {
        result[station] = Object.entries(unitMap).map(([unit, products]) => {
          const items = Object.entries(products).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
          return { unit, items, totalQty: items.reduce((s, i) => s + i.qty, 0) };
        }).sort((a, b) => b.totalQty - a.totalQty);
      }
      return result;
    }

    return res.json({
      success: true,
      availableDates: allTabs,
      summary: {
        totalDays: filteredTabs.length,
        totalItems,
        totalQty,
        avgItemsPerDay: filteredTabs.length ? Math.round(totalItems / filteredTabs.length) : 0,
        avgQtyPerDay: filteredTabs.length ? Math.round(totalQty / filteredTabs.length) : 0,
      },
      dailyData,
      stationTotals,
      shiftTotals,
      topProducts,
      lastEntry: lastEntryInfo,
      stationBreakdown,
      periodBreakdown: {
        daily: buildPeriodBreakdown(allItems, todayStr),
        weekly: buildPeriodBreakdown(allItems, weekAgo),
        monthly: buildPeriodBreakdown(allItems, monthAgo),
        byDate: (() => {
          const grouped: Record<string, typeof allItems> = {};
          for (const item of allItems) {
            if (!grouped[item.date]) grouped[item.date] = [];
            grouped[item.date].push(item);
          }
          const result: Record<string, Record<string, { unit: string; items: { name: string; qty: number }[]; totalQty: number }[]>> = {};
          for (const [date, dateItems] of Object.entries(grouped)) {
            const byStation: Record<string, Record<string, Record<string, number>>> = {};
            for (const item of dateItems) {
              if (!byStation[item.station]) byStation[item.station] = {};
              if (!byStation[item.station][item.unit]) byStation[item.station][item.unit] = {};
              byStation[item.station][item.unit][item.product] = (byStation[item.station][item.unit][item.product] || 0) + item.qty;
            }
            result[date] = {};
            for (const [station, unitMap] of Object.entries(byStation)) {
              result[date][station] = Object.entries(unitMap).map(([unit, products]) => {
                const items = Object.entries(products).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
                return { unit, items, totalQty: items.reduce((s, i) => s + i.qty, 0) };
              }).sort((a, b) => b.totalQty - a.totalQty);
            }
          }
          return result;
        })(),
      },
      qcNames: Array.from(allQcNames),
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}
