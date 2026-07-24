CREATE TABLE users (
  id UUID PRIMARY KEY
  , username VARCHAR(150) NOT NULL UNIQUE
  , password VARCHAR(128) NOT NULL
  , first_name VARCHAR(150) NOT NULL DEFAULT ''
  , last_name VARCHAR(150) NOT NULL DEFAULT ''
  , email VARCHAR(254) NOT NULL DEFAULT ''
  , role VARCHAR(10) NOT NULL
  , -- CLIENT | AGENT
    is_staff BOOLEAN NOT NULL DEFAULT FALSE
  , is_active BOOLEAN NOT NULL DEFAULT TRUE
  , is_superuser BOOLEAN NOT NULL DEFAULT FALSE
  , last_login TIMESTAMP
  , date_joined TIMESTAMP NOT NULL
);

CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY
  , user_id UUID NOT NULL UNIQUE REFERENCES users(id)
  ON DELETE CASCADE
  , parent_name VARCHAR(150) NOT NULL
  , date_of_birth DATE NOT NULL
  , marital_status VARCHAR(10) NOT NULL
  , place_of_birth VARCHAR(100) NOT NULL
  , national_id_number VARCHAR(50) NOT NULL UNIQUE
  , tag VARCHAR(30) NOT NULL UNIQUE
  , created_at TIMESTAMP NOT NULL
);

CREATE TABLE wallet_profiles (
  id UUID PRIMARY KEY
  , name VARCHAR(50) NOT NULL
  , currency VARCHAR(3) NOT NULL DEFAULT 'EUR'
  , max_balance DECIMAL(12, 2) NOT NULL
  , max_transfer_amount DECIMAL(12, 2) NOT NULL
  , max_daily_transfer_total DECIMAL(12, 2) NOT NULL
  , max_deposit_amount DECIMAL(12, 2) NOT NULL
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY
  , client_id UUID NOT NULL REFERENCES users(id)
  ON DELETE CASCADE
  , profile_id UUID NOT NULL REFERENCES wallet_profiles(id)
  ON DELETE RESTRICT
  , balance DECIMAL(12, 2) NOT NULL DEFAULT 0
  , tag VARCHAR(30) NOT NULL UNIQUE
  , created_at TIMESTAMP NOT NULL
);

CREATE TABLE merchants (
  id UUID PRIMARY KEY
  , name VARCHAR(100) NOT NULL
  , owner_id UUID NOT NULL REFERENCES users(id)
  ON DELETE RESTRICT
  , wallet_id UUID NOT NULL UNIQUE REFERENCES wallets(id)
  ON DELETE RESTRICT
  , is_active BOOLEAN NOT NULL DEFAULT TRUE
  , created_at TIMESTAMP NOT NULL
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY
  , reference VARCHAR(20) NOT NULL UNIQUE
  , type VARCHAR(10) NOT NULL
  , -- DEPOSIT | TRANSFER | PAYMENT
    status VARCHAR(10) NOT NULL DEFAULT 'COMPLETED'
  , -- COMPLETED | PENDING | FAILED
    failure_reason VARCHAR(255) NOT NULL DEFAULT ''
  , from_wallet_id UUID REFERENCES wallets(id)
  ON DELETE RESTRICT
  , -- null for deposits
    to_wallet_id UUID NOT NULL REFERENCES wallets(id)
  ON DELETE RESTRICT
  , amount DECIMAL(12, 2) NOT NULL
  , performed_by_id UUID NOT NULL REFERENCES users(id)
  ON DELETE RESTRICT
  , created_at TIMESTAMP NOT NULL
);