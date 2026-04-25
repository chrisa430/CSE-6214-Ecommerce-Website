# SportVault – E-Commerce Website

## Overview
SportVault is a web-based e-commerce platform focused on the browsing and purchasing of sports memorabilia.  
The system supports guest and registered users, product search and comparison, shopping cart and checkout functionality, and administrative management of products and users.

This repository contains the source code, documentation, and requirements artifacts for the SportVault project.

---

## Team Members & Roles

| Name | NetID | Primary Role |
|-----|------|--------------|
| Christopher Argyros | ca1434 | Frontend Development, UI Integration & QA |
| Wyatt Carter | wac224 | Documentation, SRS, Requirements & QA |
| Darrell Hobson | dlh224 | Backend Development, API Design & QA |

---

## Major Project Features

- Online browsing of sports memorabilia by sport, team, and player
- Product search with filtering and comparison
- Product detail pages with images and descriptions
- Shopping cart and simulated checkout flow
- Guest and registered user support
- User account management and order history
- Product reviews and ratings
- Administrative tools for managing products, users, and orders
- Secure authentication and role-based access control

---

## Installation
The development can be deployed as Docker Containers. The docker-compose.yml file contains the Docker configuration. Each time a new feature is applied, you should blow away the previous Docker environment  
to ensure that all micro services and database tables are deployed programmatically via the sql scriptas in the database directory. The scripts build each database and inserts test data (except for a default admin user see below)

### Rebuild Container Environment

1. docker compose down -v    # -v destroys volumes so init.sql reruns
2. docker compose up
3. npm run dev # in root directory

## Create Admin User and seed database with test data
When you recreate the environment, you will have to insert an admin record into the account table or else you will not be able to create accounts since the admin has to approve account creation. Kind of a Catch-22.

### seed-admin.ts
1. Update ADMIN_EMAIL (line 26) with your email address
2. Update ADMIN_PASSWORD (line 27) with a valid password.
3. change to the scripts directory
4. npm install
5. npx ts-node seed-admin.ts
6. npm run seed:all

### Unit Testing

In order to run the unit tests simply:

1. cd apps/web
2. npm test

### System Testing

In order to run the system tests simply:

1. Follow '### seed-admin.ts' to ensure accounts are seeded
2. docker compose up
3. npm run dev
4. npm run test:e2e tests/e2e/system-flow.spec.ts (from root)
5. npm run test:e2e tests/e2e/return-flow.spec.ts (from root)

## Notes
### Email Notifications
In the current dev setup emails won't arrive in a real inbox. Instead the AdminService sends emails via Ethereal, a fake SMTP service used to test email functionality. The AdminService logs will have a link to the "email". Copy and
paste it to a browser to see a preview.

### Test Data Seeding
The application database is seeded
- account: 
  - seeded with 100 Buyer accounts
  - seeded with 25 Seller accounts
  - seeded with 10 Admin accounts
- inventory:
  - seeded with 1000 Products
- order
  - seeded with 500 completed Orders


---

## Sprint 4 Updates — AWS SES + RSS Feed Subscriptions

### Feature 1: AWS Simple Email Service (SES)

All platform email notifications (account approval, order confirmations, RSS alerts) are now
dispatched through AWS SES instead of the prior nodemailer/SMTP configuration.

**Transport priority in `admin-service`:**
1. **AWS SES** — when `AWS_SES_REGION` and `AWS_SES_FROM_ADDRESS` are set in the environment
2. **SMTP** — legacy fallback when `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` are set
3. **Ethereal** — development catch-all (messages captured at https://ethereal.email, never delivered)

**Required env vars for SES:**
```
AWS_SES_REGION=us-east-1
AWS_SES_FROM_ADDRESS=noreply@sportvault.com
AWS_ACCESS_KEY_ID=<your-key-id>        # omit if using instance/task role
AWS_SECRET_ACCESS_KEY=<your-secret>    # omit if using instance/task role
```

**AWS IAM permission required:**
```json
{ "Effect": "Allow", "Action": "ses:SendEmail", "Resource": "*" }
```

> **SES sandbox note:** In SES sandbox mode, both sender and each recipient address must be
> verified in the AWS SES console. Request production access to send to unverified addresses.

---

### Feature 2 & 3: RSS Feed Subscriptions + Live Feeds

Sellers can subscribe to four real-time RSS feed channels. Each channel generates a valid
RSS 2.0 XML feed and delivers email alerts via SES to subscribed sellers.

#### Four Feed Channels

| Feed | Trigger | RSS URL |
|------|---------|---------|
| Product Activations | Admin approves/activates a product | `/api/admin/rss/product_activations.xml` |
| Product Sales | Buyer completes checkout | `/api/admin/rss/product_sales.xml` |
| Product Returns | Buyer initiates a return | `/api/admin/rss/product_returns.xml` |
| Account Blocks | Admin rejects / blocks an account | `/api/admin/rss/account_blocks.xml` |

#### New Database Tables (admin DB)

- **`rss_feed_type`** — the four named feed channels
- **`rss_subscription`** — seller ↔ feed type subscription records with email_alerts flag
- **`rss_feed_item`** — event log; each entry becomes one `<item>` in the RSS 2.0 XML

#### New Kafka Topics Consumed by `admin-service`

| Topic | Event | Action |
|-------|-------|--------|
| `order.events` | `ORDER_COMPLETED` | Insert product_sales feed item; notify subscribed sellers |
| `return.events` | `RETURN_INITIATED` | Insert product_returns feed item; notify seller if subscribed |

`account.events` (existing) and direct-trigger paths (product activation, account block)
also produce feed items and notifications.

#### New API Endpoints (`admin-service`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/rss/feed-types` | List all four feed types |
| GET | `/admin/rss/subscriptions` | Seller: get own subscriptions |
| POST | `/admin/rss/subscribe` | Seller: subscribe to feeds |
| DELETE | `/admin/rss/unsubscribe` | Seller: unsubscribe from feeds |
| GET | `/admin/rss/feeds` | All feed items (admin/seller) |
| GET | `/admin/rss/admin/summary` | Admin: counts + recent items |
| GET | `/admin/rss/admin/subscribers` | Admin: all subscriptions |
| GET | `/admin/rss/:feedType.xml` | Public RSS 2.0 XML feed |

#### New Frontend Pages

- **`/seller/rss-feeds`** — Seller RSS Feeds subscription manager (subscribe, toggle email
  alerts, copy RSS URLs, view recent activity)
- **`/admin/rss-feeds`** — Admin RSS Feeds dashboard (Overview, Events log, Subscribers table)

Both pages are accessible from their respective nav sidebars.
