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
