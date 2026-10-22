import mysql.connector
from mysql.connector import pooling

# Create thread-safe MySQL connection pool using pure Python driver
# use_pure=True avoids native libmysql.dll C-extension access violations under multi-threading
try:
    _connection_pool = pooling.MySQLConnectionPool(
        pool_name="grocery_store_pool",
        pool_size=10,
        pool_reset_session=True,
        user='root',
        password='vijay123',
        database='grocery_store',
        use_pure=True
    )
except Exception as e:
    print(f"Error creating connection pool: {e}")
    _connection_pool = None

def get_sql_connection():
    """Returns an isolated connection from the pool or a fresh connection."""
    global _connection_pool
    try:
        from flask import has_app_context, g
        if has_app_context():
            if 'db' not in g:
                if _connection_pool:
                    g.db = _connection_pool.get_connection()
                else:
                    g.db = mysql.connector.connect(
                        user='root',
                        password='vijay123',
                        database='grocery_store',
                        use_pure=True
                    )
            return g.db
    except ImportError:
        pass

    # Standalone execution (outside of Flask request context)
    if _connection_pool:
        try:
            return _connection_pool.get_connection()
        except Exception:
            pass

    return mysql.connector.connect(
        user='root',
        password='vijay123',
        database='grocery_store',
        use_pure=True
    )