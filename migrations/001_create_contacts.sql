CREATE TABLE contacts (
  id             SERIAL       PRIMARY KEY,
  phone_number   VARCHAR(32),
  email          VARCHAR(255),
  linked_id      INT REFERENCES contacts(id),
  link_precedence VARCHAR(10) NOT NULL CHECK (link_precedence IN ('primary','secondary')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_contacts_email        ON contacts(email);
CREATE INDEX idx_contacts_phone_number ON contacts(phone_number);
