const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config({ path: __dirname + '/../.env' });

const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const appVersion = url.searchParams.get('v') || 'unknown';
    const osVersion = url.searchParams.get('os') || 'unknown';
    const deviceName = url.searchParams.get('device') || 'SureCloudVoice';

    if (!token) { ws.close(4001, 'Token required'); return; }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = payload.id;
      ws.tenantId = payload.tenant_id;
      ws.appVersion = appVersion;
      ws.deviceName = deviceName;

      if (!clients.has(payload.id)) clients.set(payload.id, new Set());
      clients.get(payload.id).add(ws);

      // Update device record
      try {
        await db.query(
          `INSERT INTO devices (user_id, device_name, device_type, app_version, os_version, online, last_ip, last_seen, ws_connected_at)
           VALUES ($1, $2, 'windows', $3, $4, true, $5, NOW(), NOW())
           ON CONFLICT (user_id, device_name) DO UPDATE SET app_version=$3, os_version=$4, online=true, last_ip=$5, last_seen=NOW(), ws_connected_at=NOW()`,
          [payload.id, deviceName, appVersion, osVersion, req.socket.remoteAddress]
        );
      } catch(e) {
        // devices table may not have unique constraint on (user_id, device_name) yet
        await db.query(
          `UPDATE devices SET app_version=$2, os_version=$3, online=true, last_seen=NOW(), ws_connected_at=NOW() WHERE user_id=$1`,
          [payload.id, appVersion, osVersion]
        ).catch(() => {});
      }

      broadcastToTenant(payload.tenant_id, { event: 'presenceChange', userId: payload.id, status: 'online' }, payload.id);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.event === 'typing') {
            broadcastToConversation(msg.conversationId, { event: 'typing', userId: payload.id, conversationId: msg.conversationId }, payload.id);
          } else if (msg.event === 'sipLogUpload') {
            handleSipLogUpload(payload, msg);
          } else if (msg.event === 'pong') {
            ws.lastPong = Date.now();
          }
        } catch {}
      });

      ws.on('close', async () => {
        const userSockets = clients.get(payload.id);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            clients.delete(payload.id);
            broadcastToTenant(payload.tenant_id, { event: 'presenceChange', userId: payload.id, status: 'offline' });
            await db.query('UPDATE devices SET online=false, last_seen=NOW() WHERE user_id=$1', [payload.id]).catch(() => {});
          }
        }
      });

      ws.send(JSON.stringify({ event: 'connected', userId: payload.id }));

      // Check for pending update
      try {
        const latest = await db.query("SELECT version, download_url, force_update FROM app_versions WHERE published=true ORDER BY created_at DESC LIMIT 1");
        if (latest.rows.length > 0 && latest.rows[0].version !== appVersion) {
          ws.send(JSON.stringify({ event: 'updateAvailable', version: latest.rows[0].version, downloadUrl: latest.rows[0].download_url, force: latest.rows[0].force_update }));
        }
      } catch {}

    } catch {
      ws.close(4002, 'Invalid token');
    }
  });

  // Ping interval
  setInterval(() => {
    clients.forEach((sockets) => {
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
      });
    });
  }, 30000);

  return wss;
}

function broadcast(userId, data) {
  const sockets = clients.get(userId);
  if (sockets) {
    const msg = JSON.stringify(data);
    sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
  }
}

function broadcastToTenant(tenantId, data, excludeUserId) {
  const msg = JSON.stringify(data);
  clients.forEach((sockets, userId) => {
    if (userId === excludeUserId) return;
    sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN && ws.tenantId === tenantId) ws.send(msg);
    });
  });
}

function broadcastToConversation(conversationId, data, excludeUserId) {
  // For typing indicators - broadcast to tenant for now
  const msg = JSON.stringify(data);
  clients.forEach((sockets, userId) => {
    if (userId === excludeUserId) return;
    sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
  });
}

function sendCommandToUser(userId, command) {
  const sockets = clients.get(userId);
  if (!sockets || sockets.size === 0) return false;
  const msg = JSON.stringify(command);
  sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
  return true;
}

function sendCommandToTenant(tenantId, command) {
  const msg = JSON.stringify(command);
  let count = 0;
  clients.forEach((sockets) => {
    sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN && ws.tenantId === tenantId) { ws.send(msg); count++; }
    });
  });
  return count;
}

function getOnlineUsers() {
  const online = {};
  clients.forEach((sockets, userId) => {
    sockets.forEach(ws => {
      if (!online[userId]) online[userId] = [];
      online[userId].push({ deviceName: ws.deviceName, appVersion: ws.appVersion, tenantId: ws.tenantId });
    });
  });
  return online;
}

async function handleSipLogUpload(user, msg) {
  try {
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(__dirname, '..', 'diagnostic-logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const filename = `sip-log-${user.id}-${Date.now()}.txt`;
    const filePath = path.join(logDir, filename);
    fs.writeFileSync(filePath, msg.logData || '');

    await db.query(
      `INSERT INTO diagnostic_logs (user_id, tenant_id, log_type, filename, file_path, file_size, status)
       VALUES ($1, $2, 'sip_log', $3, $4, $5, 'complete')`,
      [user.id, user.tenant_id, filename, filePath, (msg.logData || '').length]
    );
  } catch (e) { console.error('Log upload error:', e); }
}

module.exports = { setupWebSocket, broadcast, broadcastToTenant, sendCommandToUser, sendCommandToTenant, getOnlineUsers, clients };
