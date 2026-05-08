# WhatsApp Web API

Production-ready WhatsApp Web API with multi-instance support, REST API, real-time dashboard, and mobile app integration.

> **⚠️ Disclaimer:** This project uses an unofficial WhatsApp Web library. Use at your own risk. WhatsApp may ban accounts that use unofficial APIs. This is for educational and personal use only.

---

## ✨ Features

- 📱 **Multi-Instance Support** — Run multiple WhatsApp accounts simultaneously
- 🔐 **Authentication** — JWT tokens + API key authentication
- 📡 **Real-Time QR Code** — Socket.io powered live QR code updates
- 💬 **Send Messages** — Text, images, videos, documents
- 🔔 **Webhooks** — Receive incoming messages on your server
- 📊 **Dashboard** — Professional dark-themed web dashboard
- 🔄 **Session Persistence** — Sessions survive server restarts
- 🐳 **Docker Ready** — One-command deployment with Docker
- 🛡️ **Security** — Rate limiting, input validation, bcrypt passwords

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Google Chrome** or **Chromium** (for whatsapp-web.js / Puppeteer)

### Installation

```bash
# 1. Clone/download the project
cd whatsapp-api

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env and change JWT_SECRET and admin credentials
# nano .env

# 4. Install dependencies
npm install

# 5. Start the server
npm start
```

The server will start at `http://localhost:3000`

### Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 🔐 Authentication

### Step 1: Login (get JWT token)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "changeme123"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "admin" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Step 2: Generate API Key

```bash
curl -X POST http://localhost:3000/api/auth/api-key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name": "My Mobile App"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "key": "wapi_abc123def456...",
    "name": "My Mobile App"
  }
}
```

---

## 📡 API Endpoints

All API endpoints accept either:
- `Authorization: Bearer <jwt_token>` header
- `X-API-Key: <api_key>` header

### Instance Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instance/create` | Create new WhatsApp instance |
| GET | `/api/instance/list` | List all instances |
| GET | `/api/instance/:id/qr` | Get QR code for instance |
| GET | `/api/instance/:id/status` | Get connection status |
| DELETE | `/api/instance/:id` | Delete instance |

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/message/send` | Send text message |
| POST | `/api/message/send-media` | Send media (image/video/doc) |
| GET | `/api/chats/:instanceId` | List all chats |
| GET | `/api/messages/:instanceId/:chatId` | Get chat messages |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook/set` | Set webhook URL for instance |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health status |

---

## 📱 API Usage Examples

### Create an Instance

```bash
curl -X POST http://localhost:3000/api/instance/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wapi_your_key_here" \
  -d '{"name": "My Business"}'
```

### Send a Text Message

```bash
curl -X POST http://localhost:3000/api/message/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wapi_your_key_here" \
  -d '{
    "instanceId": "inst_abc12345",
    "to": "919876543210@c.us",
    "message": "Hello from API!"
  }'
```

### Send a Media Message

```bash
curl -X POST http://localhost:3000/api/message/send-media \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wapi_your_key_here" \
  -d '{
    "instanceId": "inst_abc12345",
    "to": "919876543210@c.us",
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "Check this out!"
  }'
```

### Set a Webhook

```bash
curl -X POST http://localhost:3000/api/webhook/set \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wapi_your_key_here" \
  -d '{
    "instanceId": "inst_abc12345",
    "url": "https://your-server.com/webhook"
  }'
```

Webhook payload (when a message is received):
```json
{
  "event": "message",
  "instanceId": "inst_abc12345",
  "data": {
    "from": "919876543210@c.us",
    "to": "your_number@c.us",
    "body": "Hello!",
    "timestamp": 1234567890,
    "type": "chat",
    "hasMedia": false,
    "isGroup": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 📱 Mobile App Integration

### JavaScript / React Native

```javascript
class WhatsAppAPI {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async request(method, path, body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${this.apiUrl}${path}`, options);
    return res.json();
  }

  // Create a new WhatsApp instance
  async createInstance(name) {
    return this.request('POST', '/api/instance/create', { name });
  }

  // Send a text message
  async sendMessage(instanceId, to, message) {
    return this.request('POST', '/api/message/send', {
      instanceId, to, message,
    });
  }

  // Send a media message
  async sendMedia(instanceId, to, mediaUrl, caption = '') {
    return this.request('POST', '/api/message/send-media', {
      instanceId, to, mediaUrl, caption,
    });
  }

  // Get instance status
  async getStatus(instanceId) {
    return this.request('GET', `/api/instance/${instanceId}/status`);
  }

  // List all instances
  async listInstances() {
    return this.request('GET', '/api/instance/list');
  }

  // Get chats
  async getChats(instanceId) {
    return this.request('GET', `/api/chats/${instanceId}`);
  }

  // Set webhook
  async setWebhook(instanceId, url) {
    return this.request('POST', '/api/webhook/set', { instanceId, url });
  }
}

// Usage
const whatsapp = new WhatsAppAPI('https://your-api.com', 'wapi_your_key');

// Send a message
const result = await whatsapp.sendMessage(
  'inst_abc12345',
  '919876543210@c.us',
  'Hello from mobile app!'
);
console.log(result);
```

### Flutter / Dart

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class WhatsAppAPI {
  final String apiUrl;
  final String apiKey;

  WhatsAppAPI({required this.apiUrl, required this.apiKey});

  Future<Map<String, dynamic>> sendMessage({
    required String instanceId,
    required String to,
    required String message,
  }) async {
    final response = await http.post(
      Uri.parse('$apiUrl/api/message/send'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: jsonEncode({
        'instanceId': instanceId,
        'to': to,
        'message': message,
      }),
    );
    return jsonDecode(response.body);
  }
}

// Usage
final api = WhatsAppAPI(
  apiUrl: 'https://your-api.com',
  apiKey: 'wapi_your_key',
);

final result = await api.sendMessage(
  instanceId: 'inst_abc12345',
  to: '919876543210@c.us',
  message: 'Hello from Flutter!',
);
```

---

## 🔒 Security

- **API Key Authentication** — Every API call requires `X-API-Key` header
- **JWT Tokens** — Dashboard authentication with 24-hour expiry
- **Rate Limiting** — 100 requests/minute per API key, 10 instance creations/hour
- **Password Hashing** — bcrypt with 10 salt rounds
- **Input Validation** — Phone numbers, URLs, SQL injection prevention
- **CORS** — Configurable allowed origins
- **Helmet** — Security headers (XSS, clickjacking protection)

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_SECRET` | - | **CHANGE THIS** Secret for JWT signing |
| `DATABASE_PATH` | `./data/whatsapp.db` | SQLite database path |
| `SESSION_PATH` | `./sessions` | WhatsApp session storage |
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | `changeme123` | Default admin password |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `WEBHOOK_TIMEOUT` | `5000` | Webhook request timeout (ms) |

---

## 🐛 Troubleshooting

### QR Code not appearing
- Ensure Chromium/Chrome is installed
- Check server logs for Puppeteer errors
- On Linux/Docker, make sure `--no-sandbox` flag is set (default)

### Session not persisting
- Check `SESSION_PATH` directory exists and is writable
- Ensure `data/` directory has write permissions
- Check SQLite database is not locked

### Rate limit errors
- Default is 100 requests/minute per API key
- Increase `RATE_LIMIT_MAX` in `.env` if needed

### Docker issues
- Add `cap_add: SYS_ADMIN` in docker-compose (already included)
- Use `security_opt: seccomp=unconfined` for Chromium sandbox

---

## 📄 License

MIT License — Use freely for personal and educational purposes.

⚠️ **WhatsApp ToS Warning:** Using unofficial WhatsApp APIs may violate WhatsApp's Terms of Service. Your phone number may be banned. Use at your own risk.
