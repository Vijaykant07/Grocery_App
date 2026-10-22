# FreshMart - Grocery Store Management System (GSMS)

A full-stack web application designed for grocery store inventory management, billing, and sales tracking.

---

## Features

- **Sales & Orders Dashboard**:
  - Real-time KPI summary cards (Total Revenue, Total Orders, Active Catalog Items, Average Order Value).
  - Recent orders table with live search and filtering.
  - Itemized receipt breakdown modal for each past order.
  - Order deletion with automatic total sales recalculation.
- **Product & Inventory Management**:
  - Add new grocery items with custom pricing and unit of measurement (UOM).
  - Edit existing product names, units, and rates.
  - Delete products with foreign key protection (prevents deleting items tied to past orders).
  - Live product search by name or unit.
- **Point of Sale (POS) / Order Creation**:
  - Dynamic line item creation with product catalog dropdown.
  - Automatic unit price auto-fill and line item total calculation.
  - Live grand total invoice calculation in Indian Rupees (₹).
  - Transaction-safe order creation with duplicate product merging.

---

## Tech Stack

- **Backend**: Python 3, Flask, Flask-CORS
- **Database**: MySQL 8.0+ (with thread-safe connection pooling via `MySQLConnectionPool` and pure-python connector)
- **Frontend**: HTML5, Vanilla CSS, Bootstrap, jQuery, FontAwesome 6

---

## Getting Started

### 1. Database Setup
Ensure MySQL is running, then import the database schema:
```bash
mysql -u root -p < database_schema.sql
```

### 2. Configure Database Credentials
Edit `backend/sql_connection.py` if your MySQL username or password differs:
```python
user='root',
password='YOUR_PASSWORD',
database='grocery_store'
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start the Application
```bash
python backend/server.py
```

Open your browser and navigate to:
```text
http://127.0.0.1:5000/
```
