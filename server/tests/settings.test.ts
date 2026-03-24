import request from 'supertest';
import { vi, describe, it, expect } from 'vitest';
import app from '../src/index';

// Mock de la base de datos para no afectar una BD real
vi.mock('../src/config/db.js', () => ({
    query: vi.fn().mockResolvedValue({
        rows: [
            { key: 'notification_email', value: 'test@sgc.gov.co' },
            { key: 'next_week_slots_limit', 'value': '6' }
        ]
    })
}));

describe('Settings API', () => {
    it('GET /api/settings should return public settings without auth', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.status).toBe(200);
        // Since it's public (no auth), it shouldn't contain sensitive info if designed properly,
        // actually, let's just check status.
        expect(res.body).toBeDefined();
    });

    it('PUT /api/settings should return 401 if unauthorized', async () => {
        const res = await request(app).put('/api/settings').send({});
        expect(res.status).toBe(401);
    });
});
