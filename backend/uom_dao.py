
def get_uoms(connection):
    cursor = connection.cursor()
    try:
        query = ("SELECT uom_id, uom_name FROM uom ORDER BY uom_name ASC")
        cursor.execute(query)
        response = []
        for (uom_id, uom_name) in cursor:
            response.append({
                'uom_id': uom_id,
                'uom_name': uom_name
            })
        return response
    finally:
        cursor.close()


if __name__ == '__main__':
    from sql_connection import get_sql_connection

    connection = get_sql_connection()
    # print(get_all_products(connection))
    print(get_uoms(connection))