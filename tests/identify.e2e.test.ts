import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/db';

describe('POST /identify', () => {
  // Clear the contacts table before each test for isolation
  beforeEach(async () => {
    await pool.query('DELETE FROM contacts;');
  });

  // Close DB connection after all tests
  afterAll(async () => {
    await pool.end();
  });

  it('creates a primary when no data exists', async () => {
    const res = await request(app)
      .post('/identify')
      .send({ email: 'foo@x.com' });

    expect(res.status).toBe(200);
    const { contact } = res.body;
    expect(contact.primaryContactId).toBeDefined();
    expect(contact.emails).toEqual(['foo@x.com']);
    expect(contact.phoneNumbers).toEqual([]);
    expect(contact.secondaryContactIds).toEqual([]);
  });

  it('creates a secondary when same phoneNumber with new email', async () => {
    // Seed primary
    const primaryRes = await request(app)
      .post('/identify')
      .send({ email: 'alice@example.com', phoneNumber: '555-0001' });
    const primaryId = primaryRes.body.contact.primaryContactId;

    // Insert secondary
    const secondaryRes = await request(app)
      .post('/identify')
      .send({ email: 'bob@example.com', phoneNumber: '555-0001' });

    expect(secondaryRes.status).toBe(200);
    const { contact } = secondaryRes.body;
    expect(contact.primaryContactId).toBe(primaryId);
    expect(contact.emails).toEqual(['alice@example.com', 'bob@example.com']);
    expect(contact.phoneNumbers).toEqual(['555-0001']);
    expect(contact.secondaryContactIds.length).toBe(1);
  });

  it('creates a secondary when same email with new phoneNumber', async () => {
    // Seed primary
    const primaryRes = await request(app)
      .post('/identify')
      .send({ email: 'carol@example.com', phoneNumber: '555-0002' });
    const primaryId = primaryRes.body.contact.primaryContactId;

    // Insert secondary
    const secondaryRes = await request(app)
      .post('/identify')
      .send({ email: 'carol@example.com', phoneNumber: '555-0003' });

    expect(secondaryRes.status).toBe(200);
    const { contact } = secondaryRes.body;
    expect(contact.primaryContactId).toBe(primaryId);
    expect(contact.emails).toEqual(['carol@example.com']);
    expect(contact.phoneNumbers.sort()).toEqual(['555-0002', '555-0003'].sort());
    expect(contact.secondaryContactIds.length).toBe(1);
  });

  it('is idempotent for repeated calls with same contact info', async () => {
    const payload = { email: 'dave@example.com', phoneNumber: '555-0004' };
    const firstRes = await request(app).post('/identify').send(payload);
    const secondRes = await request(app).post('/identify').send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toEqual(firstRes.body);

    // Ensure only one record exists in DB
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM contacts WHERE email = $1 AND phone_number = $2',
      [payload.email, payload.phoneNumber]
    );
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it('merges two primaries into one cluster when email and phone collide', async () => {
    // Create two separate primaries
    const res1 = await request(app)
      .post('/identify')
      .send({ email: 'eve@example.com', phoneNumber: '555-1000' });
    const res2 = await request(app)
      .post('/identify')
      .send({ email: 'frank@example.com', phoneNumber: '555-2000' });

    const id1 = res1.body.contact.primaryContactId;
    const id2 = res2.body.contact.primaryContactId;

    // Merge by sending email of first and phone of second
    const mergeRes = await request(app)
      .post('/identify')
      .send({ email: 'eve@example.com', phoneNumber: '555-2000' });

    expect(mergeRes.status).toBe(200);
    const cluster = mergeRes.body.contact;
    expect(cluster.primaryContactId).toBe(id1);
    expect(cluster.emails.sort()).toEqual(['eve@example.com', 'frank@example.com'].sort());
    expect(cluster.phoneNumbers.sort()).toEqual(['555-1000', '555-2000'].sort());
    expect(cluster.secondaryContactIds).toContain(id2);

    // Ensure only two rows remain (no extra inserts)
    const totalRes = await pool.query('SELECT COUNT(*) FROM contacts');
    expect(parseInt(totalRes.rows[0].count, 10)).toBe(2);
  });
});
