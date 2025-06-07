import { PoolClient } from 'pg';
import { withTx } from '../db';
import { logger } from '../utils/logger';     

interface IdentifyInput { email?: string; phoneNumber?: string; }
interface ContactRow {
  id: number;
  email: string | null;
  phone_number: string | null;
  linked_id: number | null;
  link_precedence: 'primary' | 'secondary';
  created_at: string; // using string as returned from DB
  updated_at: string;
  deleted_at: string | null;
}

export async function identify(input: IdentifyInput) {
  const { email, phoneNumber } = input;
  logger.info({ email, phoneNumber }, 'identify() called');

  return withTx(async (client: PoolClient) => {
    // Step A
    const baseRows = await client.query<ContactRow>(
      `SELECT * FROM contacts
         WHERE ($1::text IS NOT NULL AND email = $1)
            OR ($2::text IS NOT NULL AND phone_number = $2)`,
      [email, phoneNumber]
    );
    // Step B – no rows, create primary
    if (baseRows.rowCount === 0) {
      logger.info('no existing contact; inserting primary');
      const insert = await client.query<ContactRow>(
        `INSERT INTO contacts (email, phone_number, link_precedence)
           VALUES ($1, $2, 'primary')
           RETURNING *`,
        [email, phoneNumber]
      );
      const result = formatCluster([insert.rows[0]]);
      logger.info({ result }, 'identify() returning new primary');
      return result;
    }

    // Step C.1 – pull full cluster
    const clusterRows = await getFullCluster(client, baseRows.rows.map(r => r.id));

    // Step C.2 – ensure single primary
    const primaries = clusterRows.filter(r => r.link_precedence === 'primary');
    // sort by created_at ascending using timestamps
    const primary = primaries.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];

    if (primaries.length > 1) {
      logger.warn({ primaries }, 'multiple primaries detected — merging');
      const toDowngrade = primaries.filter(p => p.id !== primary.id);
      await Promise.all(
        toDowngrade.map(p =>
          client.query(
            `UPDATE contacts SET link_precedence='secondary', linked_id=$1, updated_at=now() WHERE id=$2`,
            [primary.id, p.id]
          )
        )
      );
    }

    // Step C.3 – insert new secondary if new info
    const emailsSet = new Set(clusterRows.map(r => r.email).filter(Boolean));
    const phonesSet = new Set(clusterRows.map(r => r.phone_number).filter(Boolean));
    const shouldInsert =
      (email && !emailsSet.has(email)) ||
      (phoneNumber && !phonesSet.has(phoneNumber));

    if (shouldInsert) {
      logger.info({ email, phoneNumber }, 'inserting new secondary');
      await client.query(
        `INSERT INTO contacts (email, phone_number, link_precedence, linked_id)
           VALUES ($1, $2, 'secondary', $3)`,
        [email, phoneNumber, primary.id]
      );
    }

    // Step C.4 – pull again for response
    const finalRows = await getFullCluster(client, [primary.id]);
    return formatCluster(finalRows);
  });
}

// Helpers
async function getFullCluster(client: PoolClient, seedIds: number[]) {
  const { rows } = await client.query<ContactRow>(
    `WITH RECURSIVE cte AS (
       SELECT * FROM contacts WHERE id = ANY($1)
       UNION
       SELECT c.* FROM contacts c JOIN cte ON c.linked_id = cte.id OR c.id = cte.linked_id
     )
     SELECT * FROM cte WHERE deleted_at IS NULL`,
    [seedIds]
  );
  return rows;
}

function formatCluster(rows: any[]) {
  const primary = rows.find(r => r.link_precedence === 'primary');
  const secondaries = rows.filter(r => r.id !== primary.id);

  const uniq = <T>(arr: T[]) => [...new Set(arr)];
  const sortPrimaryFirst = <T>(arr: T[], first: T) => [first, ...arr.filter(x => x !== first)];

  const emails = uniq(rows.map(r => r.email).filter(Boolean));
  const phoneNumbers = uniq(rows.map(r => r.phone_number).filter(Boolean));

  return {
    contact: {
      primaryContactId: primary.id,
      emails: sortPrimaryFirst(emails, primary.email).filter(Boolean),
      phoneNumbers: sortPrimaryFirst(phoneNumbers, primary.phone_number).filter(Boolean),
      secondaryContactIds: secondaries.map(r => r.id).sort((a, b) => a - b),
    }
  };
}
