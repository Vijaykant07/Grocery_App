import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sql_connection import get_sql_connection
import products_dao
import orders_dao
import uom_dao
import ai_engine

# Set the path to the ui folder
UI_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ui'))

app = Flask(__name__, static_folder=UI_DIR, static_url_path='')
CORS(app)

def get_payload():
    """Helper to extract request payload from JSON or form-data."""
    if request.is_json:
        return request.get_json()
    if 'data' in request.form:
        try:
            return json.loads(request.form['data'])
        except Exception:
            return request.form.to_dict()
    if request.form:
        return request.form.to_dict()
    return {}

@app.teardown_appcontext
def teardown_db(exception=None):
    from flask import g
    db = g.pop('db', None)
    if db is not None:
        try:
            db.close()
        except Exception:
            pass

# --- Frontend Page Serving Routes ---

@app.route('/', methods=['GET'])
def index():
    return send_from_directory(UI_DIR, 'index.html')

@app.route('/index.html', methods=['GET'])
def index_page():
    return send_from_directory(UI_DIR, 'index.html')

@app.route('/manage-product.html', methods=['GET'])
def manage_product_page():
    return send_from_directory(UI_DIR, 'manage-product.html')

@app.route('/order.html', methods=['GET'])
def order_page():
    return send_from_directory(UI_DIR, 'order.html')

# --- API Endpoints ---

@app.route('/getUOM', methods=['GET'])
def get_uom():
    try:
        connection = get_sql_connection()
        response = uom_dao.get_uoms(connection)
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/getProducts', methods=['GET'])
def get_products():
    try:
        connection = get_sql_connection()
        response = products_dao.get_all_products(connection)
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/insertProduct', methods=['POST'])
def insert_product():
    try:
        payload = get_payload()
        if not payload:
            return jsonify({'status': 'error', 'message': 'Missing product data'}), 400

        connection = get_sql_connection()
        product_id = products_dao.insert_new_product(connection, payload)
        return jsonify({
            'status': 'success',
            'product_id': product_id,
            'message': 'Product added successfully'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/editProduct', methods=['POST'])
def edit_product():
    try:
        payload = get_payload()
        if not payload:
            return jsonify({'status': 'error', 'message': 'Missing product data'}), 400

        connection = get_sql_connection()
        product_id = products_dao.update_product(connection, payload)
        return jsonify({
            'status': 'success',
            'product_id': product_id,
            'message': 'Product updated successfully'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/deleteProduct', methods=['POST'])
def delete_product():
    try:
        payload = get_payload()
        product_id = payload.get('product_id')
        if not product_id:
            return jsonify({'status': 'error', 'message': 'Missing product_id'}), 400

        connection = get_sql_connection()
        return_id = products_dao.delete_product(connection, product_id)
        return jsonify({
            'status': 'success',
            'product_id': return_id,
            'message': 'Product deleted successfully'
        })
    except ValueError as ve:
        return jsonify({'status': 'error', 'message': str(ve)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/getAllOrders', methods=['GET'])
def get_all_orders():
    try:
        connection = get_sql_connection()
        response = orders_dao.get_all_orders(connection)
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/getOrderDetails/<int:order_id>', methods=['GET'])
def get_order_details(order_id):
    try:
        connection = get_sql_connection()
        response = orders_dao.get_order_details(connection, order_id)
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/getDashboardStats', methods=['GET'])
def get_dashboard_stats():
    try:
        connection = get_sql_connection()
        response = orders_dao.get_dashboard_stats(connection)
        return jsonify(response)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/insertOrder', methods=['POST'])
def insert_order():
    try:
        payload = get_payload()
        if not payload:
            return jsonify({'status': 'error', 'message': 'Missing order data'}), 400

        if not payload.get('customer_name'):
            return jsonify({'status': 'error', 'message': 'Customer name is required'}), 400

        if not payload.get('order_details') or len(payload['order_details']) == 0:
            return jsonify({'status': 'error', 'message': 'Order must contain at least one product'}), 400

        connection = get_sql_connection()
        order_id = orders_dao.insert_order(connection, payload)
        return jsonify({
            'status': 'success',
            'order_id': order_id,
            'message': 'Order created successfully'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/deleteOrder', methods=['POST'])
def delete_order():
    try:
        payload = get_payload()
        order_id = payload.get('order_id')
        if not order_id:
            return jsonify({'status': 'error', 'message': 'Missing order_id'}), 400

        connection = get_sql_connection()
        return_id = orders_dao.delete_order(connection, order_id)
        return jsonify({
            'status': 'success',
            'order_id': return_id,
            'message': f'Order #{return_id} deleted successfully'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# --- AI Technology Routes ---

@app.route('/ai/recommendations', methods=['POST'])
def ai_recommendations():
    try:
        payload = get_payload()
        product_ids = payload.get('product_ids', [])
        if isinstance(product_ids, str):
            try:
                product_ids = json.loads(product_ids)
            except Exception:
                product_ids = [int(p) for p in product_ids.split(',') if p.strip().isdigit()]

        connection = get_sql_connection()
        recommendations = ai_engine.get_recommendations(connection, product_ids)
        return jsonify({
            'status': 'success',
            'recommendations': recommendations
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/ai/parseOrder', methods=['POST'])
def ai_parse_order():
    try:
        payload = get_payload()
        text = payload.get('text', '')
        if not text:
            return jsonify({'status': 'error', 'message': 'Please provide text to parse'}), 400

        connection = get_sql_connection()
        result = ai_engine.parse_natural_order(connection, text)
        return jsonify({
            'status': 'success',
            'customer_name': result['customer_name'],
            'items': result['items']
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/ai/insights', methods=['GET'])
def ai_insights():
    try:
        connection = get_sql_connection()
        data = ai_engine.get_ai_insights(connection)
        return jsonify({
            'status': 'success',
            'data': data
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == "__main__":
    print("Starting Python Flask Server For Grocery Store Management System on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)