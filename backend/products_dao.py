from sql_connection import get_sql_connection
import mysql.connector

def get_all_products(connection):
    cursor = connection.cursor()
    try:
        query = ("SELECT products.product_id, products.name, products.uom_id, products.price_per_unit, uom.uom_name "
                 "FROM products INNER JOIN uom ON products.uom_id = uom.uom_id ORDER BY products.name ASC")
        cursor.execute(query)
        response = []
        for (product_id, name, uom_id, price_per_unit, uom_name) in cursor:
            response.append({
                'product_id': product_id,
                'name': name,
                'uom_id': uom_id,
                'price_per_unit': float(price_per_unit),
                'uom_name': uom_name
            })
        return response
    finally:
        cursor.close()

def insert_new_product(connection, product):
    cursor = connection.cursor()
    try:
        query = ("INSERT INTO products (name, uom_id, price_per_unit) VALUES (%s, %s, %s)")
        name = product.get('name') or product.get('product_name')
        data = (name, int(product['uom_id']), float(product['price_per_unit']))

        cursor.execute(query, data)
        connection.commit()
        return cursor.lastrowid
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()

def update_product(connection, product):
    cursor = connection.cursor()
    try:
        query = ("UPDATE products SET name = %s, uom_id = %s, price_per_unit = %s WHERE product_id = %s")
        name = product.get('name') or product.get('product_name')
        product_id = int(product.get('product_id') or product.get('id'))
        data = (name, int(product['uom_id']), float(product['price_per_unit']), product_id)

        cursor.execute(query, data)
        connection.commit()
        return product_id
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()

def delete_product(connection, product_id):
    cursor = connection.cursor()
    try:
        query = ("DELETE FROM products WHERE product_id = %s")
        cursor.execute(query, (int(product_id),))
        connection.commit()
        return int(product_id)
    except mysql.connector.Error as err:
        connection.rollback()
        if err.errno == 1451:
            raise ValueError("This product cannot be deleted because it is linked to existing customer orders.")
        raise err
    except Exception as e:
        connection.rollback()
        raise e
    finally:
        cursor.close()

if __name__ == '__main__':
    connection = get_sql_connection()
    print("All products:", get_all_products(connection))