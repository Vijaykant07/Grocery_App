from datetime import datetime

def insert_order(connection, order):
    cursor = connection.cursor()
    try:
        # 1. Insert into orders table
        order_query = ("INSERT INTO orders (customer_name, total, datetime) VALUES (%s, %s, %s)")
        order_data = (order['customer_name'].strip(), float(order['grand_total']), datetime.now())
        cursor.execute(order_query, order_data)
        order_id = cursor.lastrowid

        # 2. Group details by product_id to avoid primary key collisions
        merged_items = {}
        for record in order.get('order_details', []):
            p_id = int(record['product_id'])
            qty = float(record['quantity'])
            total_price = float(record['total_price'])
            if p_id in merged_items:
                merged_items[p_id]['quantity'] += qty
                merged_items[p_id]['total_price'] += total_price
            else:
                merged_items[p_id] = {
                    'quantity': qty,
                    'total_price': total_price
                }

        # 3. Insert into order_details table
        order_details_query = ("INSERT INTO order_details (order_id, product_id, quantity, total_price) "
                               "VALUES (%s, %s, %s, %s)")
        order_details_data = [
            (order_id, p_id, item['quantity'], item['total_price'])
            for p_id, item in merged_items.items()
        ]

        if order_details_data:
            cursor.executemany(order_details_query, order_details_data)

        connection.commit()
        return order_id
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()

def delete_order(connection, order_id):
    cursor = connection.cursor()
    try:
        # First remove associated items in order_details to satisfy foreign key constraint
        cursor.execute("DELETE FROM order_details WHERE order_id = %s", (int(order_id),))
        # Then remove the order record
        cursor.execute("DELETE FROM orders WHERE order_id = %s", (int(order_id),))
        connection.commit()
        return int(order_id)
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()

def get_all_orders(connection):
    cursor = connection.cursor()
    try:
        query = ("SELECT order_id, customer_name, total, datetime FROM orders ORDER BY datetime DESC, order_id DESC")
        cursor.execute(query)

        response = []
        for (order_id, customer_name, total, dt) in cursor:
            response.append({
                'order_id': order_id,
                'customer_name': customer_name,
                'total': float(total),
                'datetime': dt.strftime('%d %b %Y, %I:%M %p') if dt else ''
            })
        return response
    finally:
        cursor.close()

def get_order_details(connection, order_id):
    cursor = connection.cursor()
    try:
        query = ("SELECT od.order_id, od.product_id, od.quantity, od.total_price, p.name, p.price_per_unit, u.uom_name "
                 "FROM order_details od "
                 "JOIN products p ON od.product_id = p.product_id "
                 "JOIN uom u ON p.uom_id = u.uom_id "
                 "WHERE od.order_id = %s")
        cursor.execute(query, (int(order_id),))

        response = []
        for (ord_id, p_id, quantity, total_price, product_name, price_per_unit, uom_name) in cursor:
            response.append({
                'order_id': ord_id,
                'product_id': p_id,
                'product_name': product_name,
                'quantity': float(quantity),
                'price_per_unit': float(price_per_unit),
                'total_price': float(total_price),
                'uom_name': uom_name
            })
        return response
    finally:
        cursor.close()

def get_dashboard_stats(connection):
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders")
        orders_row = cursor.fetchone()
        total_orders = orders_row[0] if orders_row else 0
        total_revenue = float(orders_row[1]) if orders_row and orders_row[1] else 0.0

        cursor.execute("SELECT COUNT(*) FROM products")
        products_row = cursor.fetchone()
        total_products = products_row[0] if products_row else 0

        avg_order = (total_revenue / total_orders) if total_orders > 0 else 0.0

        return {
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'total_products': total_products,
            'avg_order_value': avg_order
        }
    finally:
        cursor.close()